import type { NextRequest } from "next/server";
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

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return failJson("请选择要上传的视频文件", 400);
    }

    if (file.size === 0) {
      return failJson("视频文件为空", 400);
    }

    if (file.size > MAX_UPLOAD_FILE_BYTES) {
      const limitMb = Math.round(MAX_UPLOAD_FILE_BYTES / 1024 / 1024);
      return failJson(`视频文件不能超过 ${limitMb} MB`, 400);
    }

    if (!file.type.toLowerCase().startsWith("video/")) {
      return failJson("只支持上传视频文件", 400);
    }

    // 可选：前端截取的视频第一帧 base64 封面
    const coverRaw = form.get("coverDataUrl");
    let coverUrl = "";
    if (typeof coverRaw === "string" && coverRaw) {
      if (coverRaw.length > MAX_COVER_DATA_URL_BYTES) {
        return failJson("视频封面过大", 400);
      }
      if (!COVER_DATA_URL_RE.test(coverRaw)) {
        return failJson("视频封面格式不正确", 400);
      }
      coverUrl = coverRaw;
    }

    const analysis = await analyzeVideoFromBlob(
      file,
      file.name,
      { platform: "本地上传", title: file.name },
      request.signal,
    );

    const id = await VideoBriefArchiveRepository.create({
      userId: auth.user._id,
      sourceUrl: `local://${file.name}`,
      canonicalUrl: `local://${file.name}`,
      platform: "本地上传",
      title: file.name,
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
  }
}
