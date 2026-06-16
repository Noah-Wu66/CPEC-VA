import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { failJson, okJson } from "@/lib/api";
import { logError } from "@/lib/logger";
import { serializeVideoBriefArchive, VideoBriefArchiveRepository } from "@/lib/video-brief/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ id: string }>;
};

function getErrorStatus(error: unknown) {
  const status = typeof (error as { status?: unknown })?.status === "number"
    ? (error as { status: number }).status
    : 400;
  return status >= 400 && status <= 599 ? status : 400;
}

export async function GET(request: NextRequest, context: Context) {
  const auth = await requireApiSession(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const archive = await VideoBriefArchiveRepository.findById(id, auth.user._id.toString());
    if (!archive) {
      return failJson("归档不存在", 404);
    }
    return okJson({
      success: true,
      archive: serializeVideoBriefArchive(archive),
    });
  } catch (error) {
    logError("video-brief", "read archive", error);
    return failJson(error instanceof Error ? error.message : "读取归档失败", getErrorStatus(error));
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const auth = await requireApiSession(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const deleted = await VideoBriefArchiveRepository.deleteById(id, auth.user._id.toString());
    if (!deleted) {
      return failJson("归档不存在", 404);
    }
    return okJson({
      success: true,
      message: "删除成功",
    });
  } catch (error) {
    logError("video-brief", "delete archive", error);
    return failJson(error instanceof Error ? error.message : "删除归档失败", getErrorStatus(error));
  }
}
