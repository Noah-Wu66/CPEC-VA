import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { failJson, okJson, parseJsonBody } from "@/lib/api";
import { logError } from "@/lib/logger";
import { analyzeVideo, VIDEO_BRIEF_MODEL } from "@/lib/video-brief/analyzer";
import { extractVideoSource } from "@/lib/video-brief/extractors";
import { serializeVideoBriefArchive, VideoBriefArchiveRepository } from "@/lib/video-brief/repository";

// 视频速览时长上限：10 分钟，超过则拦截，避免模型处理过长视频
const MAX_VIDEO_DURATION_SECONDS = 10 * 60;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const analyzeSchema = z.object({
  url: z.string().trim().min(1, "请输入视频网址").max(2000, "视频网址太长"),
});

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

  const parsed = await parseJsonBody(request, analyzeSchema);
  if (!parsed.ok) {
    return failJson(parsed.message, 400);
  }

  try {
    const source = await extractVideoSource(parsed.data.url, request.signal, {
      publicOrigin: request.nextUrl.origin,
    });

    // 视频时长超过 10 分钟则拦截，只有当平台能提供真实时长时才判断
    if (source.durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
      const minutes = Math.round(source.durationSeconds / 60);
      return failJson(`视频时长 ${minutes} 分钟，已超过 10 分钟的速览上限，请换一个更短的视频`, 400);
    }

    const analysis = await analyzeVideo(source, request.signal);
    const id = await VideoBriefArchiveRepository.create({
      userId: auth.user._id,
      sourceUrl: source.sourceUrl,
      canonicalUrl: source.canonicalUrl,
      platform: source.platform,
      title: source.title,
      author: source.author,
      coverUrl: source.coverUrl,
      durationSeconds: source.durationSeconds,
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
    logError("video-brief", "analyze video", error);
    return failJson(error instanceof Error ? error.message : "视频速览失败", getErrorStatus(error));
  }
}
