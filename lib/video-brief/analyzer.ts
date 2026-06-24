import { resolveBailianProviderConfig } from "@/lib/ai/modelRoutes";
import { assertPublicHttpUrl } from "@/lib/video-brief/extractors";
import type { ExtractedVideoSource, VideoBriefAnalysis } from "@/types/video-brief";

export const VIDEO_BRIEF_MODEL = "qwen3.5-omni-flash";

const DOWNLOAD_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";
const HLS_URL_RE = /\.m3u8(?:$|[?#])/i;
const HLS_MIME_TYPES = new Set(["application/x-mpegurl", "application/vnd.apple.mpegurl"]);
const MAX_HLS_SEGMENTS = 800;
const HLS_FETCH_BATCH_SIZE = 6;

class VideoBriefAnalysisError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

interface DownloadedVideoFile {
  blob: Blob;
  filename: string;
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

function getDownloadHeaders(source: ExtractedVideoSource) {
  const headers: Record<string, string> = {
    "User-Agent": DOWNLOAD_USER_AGENT,
  };
  if (source.mediaReferer) {
    headers["Referer"] = source.mediaReferer;
  }
  return headers;
}

function isHlsUrl(url: string) {
  try {
    const parsed = new URL(url);
    return HLS_URL_RE.test(`${parsed.pathname}${parsed.search}`);
  } catch {
    return false;
  }
}

function isHlsMimeType(value: string) {
  return HLS_MIME_TYPES.has(value.trim().toLowerCase().split(";")[0]);
}

function getVideoExtension(url: string) {
  try {
    const match = new URL(url).pathname.match(/\.(mp4|flv|mov|webm|ts)$/i);
    return match?.[1]?.toLowerCase() || "mp4";
  } catch {
    return "mp4";
  }
}

function parseHlsAttributes(value: string) {
  const attrs: Record<string, string> = {};
  const pattern = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    attrs[match[1].toUpperCase()] = match[2].replace(/^"|"$/g, "");
  }
  return attrs;
}

function resolveMediaUrl(value: string, baseUrl: string) {
  return assertPublicHttpUrl(new URL(value, baseUrl).toString()).toString();
}

function parseHlsPlaylist(text: string, playlistUrl: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const variants: Array<{ url: string; bandwidth: number }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;

    const attrs = parseHlsAttributes(line.slice(line.indexOf(":") + 1));
    const nextUri = lines.slice(index + 1).find((item) => !item.startsWith("#"));
    if (!nextUri) continue;

    variants.push({
      url: resolveMediaUrl(nextUri, playlistUrl),
      bandwidth: Number(attrs.BANDWIDTH) || Number.MAX_SAFE_INTEGER,
    });
  }

  if (variants.length > 0) {
    variants.sort((left, right) => left.bandwidth - right.bandwidth);
    return { variantUrl: variants[0].url, segments: [], initUrl: "" };
  }

  let initUrl = "";
  const segments: string[] = [];
  for (const line of lines) {
    if (line.startsWith("#EXT-X-KEY")) {
      const attrs = parseHlsAttributes(line.slice(line.indexOf(":") + 1));
      const method = attrs.METHOD?.toUpperCase();
      if (method && method !== "NONE") {
        throw new VideoBriefAnalysisError("该视频流已加密，暂时无法解读", 422);
      }
      continue;
    }

    if (line.startsWith("#EXT-X-MAP")) {
      const attrs = parseHlsAttributes(line.slice(line.indexOf(":") + 1));
      if (attrs.URI) {
        initUrl = resolveMediaUrl(attrs.URI, playlistUrl);
      }
      continue;
    }

    if (!line.startsWith("#")) {
      segments.push(resolveMediaUrl(line, playlistUrl));
    }
  }

  return { variantUrl: "", segments, initUrl };
}

async function fetchBytes(url: string, headers: Record<string, string>, signal?: AbortSignal) {
  const response = await fetch(url, { headers, signal });
  if (!response.ok) {
    throw new VideoBriefAnalysisError(`视频片段下载失败（${response.status}）`, 502);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function fetchText(url: string, headers: Record<string, string>, signal?: AbortSignal) {
  const response = await fetch(url, { headers, signal });
  if (!response.ok) {
    throw new VideoBriefAnalysisError(`视频流读取失败（${response.status}）`, 502);
  }
  return {
    text: await response.text(),
    url: response.url || url,
  };
}

async function downloadHlsVideo(
  initialText: string,
  initialUrl: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<DownloadedVideoFile> {
  let playlistText = initialText;
  let playlistUrl = initialUrl;

  for (let depth = 0; depth < 4; depth += 1) {
    const playlist = parseHlsPlaylist(playlistText, playlistUrl);
    if (playlist.variantUrl) {
      const next = await fetchText(playlist.variantUrl, headers, signal);
      playlistText = next.text;
      playlistUrl = next.url;
      continue;
    }

    if (playlist.segments.length === 0) {
      throw new VideoBriefAnalysisError("视频流里没有可下载的视频片段", 422);
    }
    if (playlist.segments.length > MAX_HLS_SEGMENTS) {
      throw new VideoBriefAnalysisError("视频片段过多，请换一个更短的视频", 400);
    }

    const parts: Uint8Array[] = [];
    if (playlist.initUrl) {
      parts.push(await fetchBytes(playlist.initUrl, headers, signal));
    }

    for (let index = 0; index < playlist.segments.length; index += HLS_FETCH_BATCH_SIZE) {
      const batch = playlist.segments.slice(index, index + HLS_FETCH_BATCH_SIZE);
      const batchParts = await Promise.all(batch.map((url) => fetchBytes(url, headers, signal)));
      parts.push(...batchParts);
    }

    const extension = playlist.initUrl ? "mp4" : "ts";
    const blob = new Blob(parts.map(toArrayBuffer), { type: playlist.initUrl ? "video/mp4" : "video/mp2t" });
    if (blob.size === 0) {
      throw new VideoBriefAnalysisError("视频内容为空", 502);
    }

    return {
      blob,
      filename: `video-${Date.now()}.${extension}`,
    };
  }

  throw new VideoBriefAnalysisError("视频流层级过深，暂时无法解读", 422);
}

// 把视频原文件下载到内存。B 站等有防盗链的平台需要带上来源页 Referer。
async function downloadVideo(source: ExtractedVideoSource, signal?: AbortSignal): Promise<DownloadedVideoFile> {
  const headers = getDownloadHeaders(source);

  const response = await fetch(source.videoUrl, { headers, signal });
  if (!response.ok) {
    throw new VideoBriefAnalysisError(`视频下载失败（${response.status}）`, 502);
  }

  const responseUrl = response.url || source.videoUrl;
  const contentType = response.headers.get("content-type") || "";
  if (isHlsUrl(responseUrl) || isHlsMimeType(contentType)) {
    return downloadHlsVideo(await response.text(), responseUrl, headers, signal);
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new VideoBriefAnalysisError("视频内容为空", 502);
  }
  return {
    blob,
    filename: `video-${Date.now()}.${getVideoExtension(responseUrl)}`,
  };
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
async function uploadVideoToBailian(policy: BailianUploadPolicy, file: DownloadedVideoFile, signal?: AbortSignal) {
  const key = `${policy.upload_dir}/${file.filename}`;

  const form = new FormData();
  form.append("OSSAccessKeyId", policy.oss_access_key_id);
  form.append("Signature", policy.signature);
  form.append("policy", policy.policy);
  form.append("key", key);
  form.append("x-oss-object-acl", policy.x_oss_object_acl);
  form.append("x-oss-forbid-overwrite", policy.x_oss_forbid_overwrite);
  form.append("success_action_status", "200");
  form.append("file", file.blob, file.filename);

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

// 共用的"上传百炼 → 调 AI → 解析"流程。无论是从网址下载还是用户直传，拿到视频 Blob 后都走这里。
async function runBailianAnalysis(file: DownloadedVideoFile, source: ExtractedVideoSource, signal?: AbortSignal) {
  const { apiKey, openAIBaseUrl, dashScopeBaseUrl } = resolveBailianProviderConfig();

  const policy = await fetchBailianUploadPolicy(apiKey, dashScopeBaseUrl, VIDEO_BRIEF_MODEL, signal);
  const ossUrl = await uploadVideoToBailian(policy, file, signal);

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

export async function analyzeVideo(source: ExtractedVideoSource, signal?: AbortSignal) {
  // 先把视频下载下来，再上传到百炼临时存储，避免百炼跨境下载公网视频时 60 秒超时。
  const file = await downloadVideo(source, signal);
  return runBailianAnalysis(file, source, signal);
}

// 处理用户直接上传的本地视频文件，跳过下载步骤，直接进入"上传百炼 → 调 AI"流程。
export async function analyzeVideoFromBlob(
  blob: Blob,
  filename: string,
  sourceMeta: { platform: string; title: string; author?: string },
  signal?: AbortSignal,
) {
  const file: DownloadedVideoFile = { blob, filename };
  const source: ExtractedVideoSource = {
    sourceUrl: `local://${filename}`,
    canonicalUrl: `local://${filename}`,
    platform: sourceMeta.platform,
    title: sourceMeta.title,
    author: sourceMeta.author || "",
    coverUrl: "",
    durationSeconds: 0,
    videoUrl: "",
  };
  return runBailianAnalysis(file, source, signal);
}
