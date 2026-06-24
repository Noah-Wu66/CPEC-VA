import type { NextRequest } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireApiSession } from "@/lib/auth";
import { failJson } from "@/lib/api";
import { logError } from "@/lib/logger";

// 本地上传视频大小上限：50 MB
const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 给浏览器签发 Vercel Blob 直传令牌。浏览器拿到令牌后把视频直接传到 Blob 存储，
// 绕开 Serverless Function 4.5MB 请求体上限。
export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return failJson("请求体格式错误", 400);
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["video/*"],
        maximumSizeInBytes: MAX_UPLOAD_FILE_BYTES,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // 直传完成后无需额外处理，解读接口会主动拉取视频并删除这个临时文件
      },
    });
    return Response.json(result);
  } catch (error) {
    logError("video-brief", "generate upload token", error);
    return failJson(error instanceof Error ? error.message : "获取上传凭证失败", 400);
  }
}
