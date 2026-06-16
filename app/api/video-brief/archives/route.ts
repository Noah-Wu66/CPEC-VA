import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { failJson, okJson } from "@/lib/api";
import { logError } from "@/lib/logger";
import { VideoBriefArchiveRepository } from "@/lib/video-brief/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const params = request.nextUrl.searchParams;
    const result = await VideoBriefArchiveRepository.listByUser({
      userId: auth.user._id.toString(),
      page: params.get("page"),
      pageSize: params.get("pageSize"),
      q: params.get("q") || "",
      tag: params.get("tag") || "",
    });

    return okJson({
      success: true,
      ...result,
    });
  } catch (error) {
    logError("video-brief", "list archives", error);
    return failJson("获取视频归档失败", 500);
  }
}
