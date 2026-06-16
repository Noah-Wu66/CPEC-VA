import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";
import { fetchVideoBriefMediaUrl } from "@/lib/video-brief/extractors";
import { resolveVideoBriefMediaToken } from "@/lib/video-brief/media-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function copyResponseHeaders(response: Response) {
  const headers = new Headers();
  const names = [
    "accept-ranges",
    "content-length",
    "content-range",
    "content-type",
    "etag",
    "last-modified",
  ];

  for (const name of names) {
    const value = response.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  headers.set("Cache-Control", "private, max-age=0, must-revalidate");
  return headers;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") || "";

  try {
    const media = await resolveVideoBriefMediaToken(token);
    if (!media) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const upstream = await fetchVideoBriefMediaUrl(media.mediaUrl, request.headers.get("range"), media.referer);

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: copyResponseHeaders(upstream),
    });
  } catch (error) {
    logError("video-brief", "read bilibili media", error);
    return new NextResponse("读取视频失败", { status: 502 });
  }
}
