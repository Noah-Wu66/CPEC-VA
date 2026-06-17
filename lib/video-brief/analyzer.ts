import { resolveBailianProviderConfig } from "@/lib/ai/modelRoutes";
import type { ExtractedVideoSource, VideoBriefAnalysis } from "@/types/video-brief";

export const VIDEO_BRIEF_MODEL = "qwen3.5-omni-flash";

const DOWNLOAD_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

class VideoBriefAnalysisError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

function getChoiceText(payload: any) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = (fenced ? fenced[1] : trimmed).trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new VideoBriefAnalysisError("模型没有返回可用的 JSON 结果");
  }
  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch {
    throw new VideoBriefAnalysisError("模型返回的 JSON 格式不正确");
  }
}

function requireString(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new VideoBriefAnalysisError(`模型结果缺少 ${fieldName}`);
  }
  return value.trim();
}

function requireStringArray(value: unknown, fieldName: string) {
  if (!Array.isArray(value)) {
    throw new VideoBriefAnalysisError(`模型结果缺少 ${fieldName}`);
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function requireTimeline(value: unknown) {
  if (!Array.isArray(value)) {
    throw new VideoBriefAnalysisError("模型结果缺少 timeline");
  }
  return value
    .map((item) => ({
      time: typeof item?.time === "string" ? item.time.trim() : "",
      content: typeof item?.content === "string" ? item.content.trim() : "",
    }))
    .filter((item) => item.time || item.content);
}

function normalizeAnalysis(raw: any): VideoBriefAnalysis {
  const tags = requireStringArray(raw?.tags, "tags").slice(0, 12);
  if (tags.length === 0) {
    throw new VideoBriefAnalysisError("模型没有返回有效标签");
  }

  return {
    summary: requireString(raw?.summary, "summary"),
    interpretation: requireString(raw?.interpretation, "interpretation"),
    keyPoints: requireStringArray(raw?.keyPoints, "keyPoints"),
    timeline: requireTimeline(raw?.timeline),
    tags,
    people: requireStringArray(raw?.people, "people"),
    places: requireStringArray(raw?.places, "places"),
    organizations: requireStringArray(raw?.organizations, "organizations"),
    uncertainPoints: requireStringArray(raw?.uncertainPoints, "uncertainPoints"),
  };
}

function buildPrompt(source: ExtractedVideoSource) {
  return [
    "你是视频速览与归档助手。请认真观看完整视频，结合画面、字幕、口播、屏幕文字和声音信息生成归档内容。",
    "不要只根据标题判断；看不到、听不清或无法确定的信息必须放进 uncertainPoints，不要编造。",
    "请只返回 JSON，不要输出解释、Markdown 或代码块。",
    "字段要求：",
    "summary：一段 80 字以内的视频速览。",
    "interpretation：一段 180 字以内的重点解读，说明视频核心内容、表达意图和重要信息。",
    "keyPoints：3 到 6 条重点，每条不超过 30 字。",
    "timeline：最多 6 条关键片段，time 写成 00:00-00:15，content 写片段内容。",
    "tags：5 到 12 个中文短标签，由你根据视频内容自由生成。",
    "people、places、organizations：视频里能明确确认的人物、地点、机构，没有则返回空数组。",
    "uncertainPoints：不确定或证据不足的信息，没有则返回空数组。",
    "",
    "视频来源信息：",
    `平台：${source.platform}`,
    `标题：${source.title || "未提供"}`,
    `作者：${source.author || "未提供"}`,
    `原始地址：${source.sourceUrl}`,
    "",
    "输出格式：",
    "{\"summary\":\"\",\"interpretation\":\"\",\"keyPoints\":[],\"timeline\":[{\"time\":\"\",\"content\":\"\"}],\"tags\":[],\"people\":[],\"places\":[],\"organizations\":[],\"uncertainPoints\":[]}",
  ].join("\n");
}

// 把视频原文件下载到内存。B 站等有防盗链的平台需要带上来源页 Referer。
async function downloadVideo(source: ExtractedVideoSource, signal?: AbortSignal) {
  const headers: Record<string, string> = {
    "User-Agent": DOWNLOAD_USER_AGENT,
  };
  if (source.mediaReferer) {
    headers["Referer"] = source.mediaReferer;
  }

  const response = await fetch(source.videoUrl, { headers, signal });
  if (!response.ok) {
    throw new VideoBriefAnalysisError(`视频下载失败（${response.status}）`, 502);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new VideoBriefAnalysisError("视频内容为空", 502);
  }
  return bytes;
}

interface BailianUploadPolicy {
  policy: string;
  signature: string;
  upload_dir: string;
  upload_host: string;
  oss_access_key_id: string;
  x_oss_object_acl: string;
  x_oss_forbid_overwrite: string;
}

// 向百炼申请临时上传凭证（免费临时存储，48 小时有效）。
async function fetchBailianUploadPolicy(
  apiKey: string,
  dashScopeBaseUrl: string,
  model: string,
  signal?: AbortSignal,
): Promise<BailianUploadPolicy> {
  const url = `${dashScopeBaseUrl}/uploads?action=getPolicy&model=${encodeURIComponent(model)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal,
  });

  const text = await response.text();
  let payload: any = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok || payload?.code) {
    throw new VideoBriefAnalysisError(
      payload?.message || `获取视频上传凭证失败（${response.status}）`,
      response.ok ? 502 : response.status,
    );
  }

  const data = payload?.data;
  if (!data?.policy || !data?.upload_host || !data?.upload_dir) {
    throw new VideoBriefAnalysisError("视频上传凭证格式不正确", 502);
  }

  return data as BailianUploadPolicy;
}

// 把视频上传到百炼临时存储，返回阿里云内网地址 oss://...，模型从内网读取，彻底绕开 60 秒下载超时。
async function uploadVideoToBailian(policy: BailianUploadPolicy, buffer: Uint8Array, signal?: AbortSignal) {
  const filename = `video-${Date.now()}.mp4`;
  const key = `${policy.upload_dir}/${filename}`;

  const form = new FormData();
  form.append("OSSAccessKeyId", policy.oss_access_key_id);
  form.append("Signature", policy.signature);
  form.append("policy", policy.policy);
  form.append("key", key);
  form.append("x-oss-object-acl", policy.x_oss_object_acl);
  form.append("x-oss-forbid-overwrite", policy.x_oss_forbid_overwrite);
  form.append("success_action_status", "200");
  form.append("file", new Blob([buffer], { type: "video/mp4" }), filename);

  const response = await fetch(policy.upload_host, { method: "POST", body: form, signal });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new VideoBriefAnalysisError(
      `视频上传失败（${response.status}）${body ? `：${body.slice(0, 200)}` : ""}`,
      502,
    );
  }

  return `oss://${key}`;
}

export async function analyzeVideo(source: ExtractedVideoSource, signal?: AbortSignal) {
  const { apiKey, openAIBaseUrl, dashScopeBaseUrl } = resolveBailianProviderConfig();

  // 先把视频下载下来，再上传到百炼临时存储，避免百炼跨境下载公网视频时 60 秒超时。
  const buffer = await downloadVideo(source, signal);
  const policy = await fetchBailianUploadPolicy(apiKey, dashScopeBaseUrl, VIDEO_BRIEF_MODEL, signal);
  const ossUrl = await uploadVideoToBailian(policy, buffer, signal);

  const response = await fetch(`${openAIBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // 必需：让百炼解析 oss:// 内网地址
      "X-DashScope-OssResourceResolve": "enable",
    },
    body: JSON.stringify({
      model: VIDEO_BRIEF_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "video_url",
              video_url: {
                url: ossUrl,
                fps: 10,
                min_pixels: 65536,
                max_pixels: 2048000,
                total_pixels: 184549376,
              },
            },
            {
              type: "text",
              text: buildPrompt(source),
            },
          ],
        },
      ],
      modalities: ["text"],
      stream: false,
    }),
    signal,
  });

  const text = await response.text();
  let payload: any = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok || payload?.error) {
    const message = payload?.error?.message || payload?.message || `视频理解失败（${response.status}）`;
    throw new VideoBriefAnalysisError(message, response.ok ? 502 : response.status);
  }

  const outputText = getChoiceText(payload);
  if (!outputText) {
    throw new VideoBriefAnalysisError("模型没有返回视频解读结果");
  }

  return normalizeAnalysis(parseJsonObject(outputText));
}
