import type { NextRequest } from "next/server";
import { del } from "@vercel/blob";
import { requireApiSession } from "@/lib/auth";
import { failJson, okJson } from "@/lib/api";
import { logError } from "@/lib/logger";
import { analyzeVideoFromBlob, VIDEO_BRIEF_MODEL } from "@/lib/video-brief/analyzer";
import { serializeVideoBriefArchive, VideoBriefArchiveRepository } from "@/lib/video-brief/repository";

// 本地上传视频大小上限：50 MB
const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;
// 封面图 base64 上限：2 MB（足够 640px JPEG）
const MAX_COVER_DATA_URL_BYTES = 2 * 1024 * 1024;
const COVER_DATA_URL_RE = /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorStatus(error: unknown) {
  const status = typeof (error as { status?: unknown })?.status === "number"
    ? (error as { status: number }).status
    : 500;
  return status >= 400 && status <= 599 ? status : 500;
}

// 校验地址确实是本项目的 Vercel Blob 下载地址，避免被当成任意网址抓取
function isVercelBlobUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: { blobUrl?: unknown; filename?: unknown; coverDataUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return failJson("请求体格式错误", 400);
  }

  // 浏览器已经把视频直传到 Vercel Blob，这里只收到临时下载地址
  const blobUrl = typeof body.blobUrl === "string" ? body.blobUrl.trim() : "";
  if (!blobUrl || !isVercelBlobUrl(blobUrl)) {
    return failJson("视频上传地址无效", 400);
  }

  const rawName = typeof body.filename === "string" ? body.filename.trim() : "";
  const filename = rawName || "本地视频";

  // 可选：前端截取的视频第一帧 base64 封面
  let coverUrl = "";
  const coverRaw = body.coverDataUrl;
  if (typeof coverRaw === "string" && coverRaw) {
    if (coverRaw.length > MAX_COVER_DATA_URL_BYTES) {
      return failJson("视频封面过大", 400);
    }
    if (!COVER_DATA_URL_RE.test(coverRaw)) {
      return failJson("视频封面格式不正确", 400);
    }
    coverUrl = coverRaw;
  }

  try {
    const response = await fetch(blobUrl, { signal: request.signal });
    if (!response.ok) {
      return failJson("读取上传的视频失败", 502);
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("video/")) {
      return failJson("只支持上传视频文件", 400);
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      return failJson("视频文件为空", 400);
    }
    if (blob.size > MAX_UPLOAD_FILE_BYTES) {
      const limitMb = Math.round(MAX_UPLOAD_FILE_BYTES / 1024 / 1024);
      return failJson(`视频文件不能超过 ${limitMb} MB`, 400);
    }

    const analysis = await analyzeVideoFromBlob(
      blob,
      filename,
      { platform: "本地上传", title: filename },
      request.signal,
    );

    const id = await VideoBriefArchiveRepository.create({
      userId: auth.user._id,
      sourceUrl: `local://${filename}`,
      canonicalUrl: `local://${filename}`,
      platform: "本地上传",
      title: filename,
      author: "",
      coverUrl,
      durationSeconds: 0,
      analysis,
      model: VIDEO_BRIEF_MODEL,
    });

    const archive = await VideoBriefArchiveRepository.findById(id.toString(), auth.user._id.toString());
    if (!archive) {
      return failJson("归档保存失败", 500);
    }

    return okJson({
      success: true,
      archive: serializeVideoBriefArchive(archive),
    });
  } catch (error) {
    logError("video-brief", "analyze uploaded video", error);
    return failJson(error instanceof Error ? error.message : "视频速览失败", getErrorStatus(error));
  } finally {
    // 不论成功失败都删除 Blob 临时文件，避免占用存储；删除失败只记录日志，不影响响应
    try {
      await del(blobUrl);
    } catch (delError) {
      logError("video-brief", "delete temp blob", delError);
    }
  }
}
