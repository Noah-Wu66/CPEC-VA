import { isIP } from "net";
import { createVideoBriefMediaToken } from "@/lib/video-brief/media-tokens";
import { normalizeVideoBriefAssetUrl } from "@/lib/video-brief/urls";
import type { ExtractedVideoSource } from "@/types/video-brief";

const DIRECT_VIDEO_RE = /\.(mp4|m3u8|flv|mov|webm)(?:$|[?#])/i;
const HLS_MIME_TYPES = new Set(["application/x-mpegurl", "application/vnd.apple.mpegurl"]);
const VIDEO_BRIEF_MEDIA_ROUTE = "/api/video-brief/media";
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";
const BILIBILI_API_ORIGIN = "https://api.bilibili.com";
const BILIBILI_WEB_ORIGIN = "https://www.bilibili.com";
const BILIBILI_BVID_RE = /(BV[0-9A-Za-z]+)/i;

export class VideoSourceError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.status = status;
  }
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function parseAttributes(tag: string) {
  const attrs: Record<string, string> = {};
  const attrPattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(tag))) {
    attrs[match[1].toLowerCase()] = decodeHtml(match[2] || match[3] || match[4] || "");
  }
  return attrs;
}

function collectTags(html: string, name: string) {
  const pattern = new RegExp(`<${name}\\b[^>]*>`, "gi");
  return html.match(pattern) || [];
}

function getMetaContent(html: string, keys: string[]) {
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()));
  for (const tag of collectTags(html, "meta")) {
    const attrs = parseAttributes(tag);
    const key = (attrs.property || attrs.name || attrs.itemprop || "").toLowerCase();
    if (normalizedKeys.has(key) && attrs.content) {
      return attrs.content;
    }
  }
  return "";
}

function getTitle(html: string) {
  const metaTitle = getMetaContent(html, ["og:title", "twitter:title", "title"]);
  if (metaTitle) return metaTitle;
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtml(match[1].replace(/\s+/g, " ")) : "";
}

function getCanonicalUrl(html: string, pageUrl: string) {
  for (const tag of collectTags(html, "link")) {
    const attrs = parseAttributes(tag);
    if ((attrs.rel || "").toLowerCase() === "canonical" && attrs.href) {
      return resolvePublicUrl(attrs.href, pageUrl);
    }
  }
  return pageUrl;
}

function getHost(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isPrivateIp(hostname: string) {
  const ipVersion = isIP(hostname);
  if (!ipVersion) return false;
  if (ipVersion === 6) {
    return hostname === "::1" || hostname.toLowerCase().startsWith("fc") || hostname.toLowerCase().startsWith("fd");
  }
  const parts = hostname.split(".").map((part) => Number(part));
  const [a, b] = parts;
  return a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0;
}

export function assertPublicHttpUrl(input: string) {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new VideoSourceError("请输入正确的视频网址", 400);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new VideoSourceError("只支持 http 或 https 视频网址", 400);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    isPrivateIp(hostname)
  ) {
    throw new VideoSourceError("不支持读取本地或内网地址", 400);
  }

  return parsed;
}

function resolvePublicUrl(value: string, baseUrl: string) {
  const parsed = new URL(value, baseUrl);
  assertPublicHttpUrl(parsed.toString());
  return parsed.toString();
}

function getPlatform(url: string) {
  const host = getHost(url).replace(/^www\./, "");
  if (host === "b23.tv" || host.endsWith("bilibili.com")) return "哔哩哔哩";
  if (host.endsWith("douyin.com")) return "抖音";
  if (host.endsWith("kuaishou.com") || host.endsWith("kwai.com")) return "快手";
  if (host.endsWith("youku.com")) return "优酷";
  if (host.endsWith("iqiyi.com")) return "爱奇艺";
  if (host.endsWith("mgtv.com")) return "芒果TV";
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "YouTube";
  if (host === "x.com" || host.endsWith("twitter.com")) return "X";
  if (host.endsWith("yangshipin.cn")) return "央视频";
  return "公开视频";
}

function isBilibiliUrl(url: string) {
  const host = getHost(url).replace(/^www\./, "");
  return host === "b23.tv" || host.endsWith("bilibili.com");
}

function getBilibiliRequestHeaders(referer = `${BILIBILI_WEB_ORIGIN}/`) {
  return {
    Accept: "application/json,text/plain,*/*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    Origin: BILIBILI_WEB_ORIGIN,
    Pragma: "no-cache",
    Referer: referer,
    "User-Agent": BROWSER_UA,
  };
}

function getBilibiliMediaHeaders(referer: string, range?: string | null) {
  const headers: Record<string, string> = {
    Accept: "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    Origin: BILIBILI_WEB_ORIGIN,
    Referer: referer,
    "User-Agent": BROWSER_UA,
  };
  if (range) {
    headers.Range = range;
  }
  return headers;
}

function getBvidFromText(value: string) {
  const match = String(value || "").match(BILIBILI_BVID_RE);
  return match?.[1] || "";
}

function getBilibiliPageNumber(url: string) {
  try {
    const page = Number(new URL(url).searchParams.get("p"));
    return Number.isInteger(page) && page > 0 ? page : 1;
  } catch {
    return 1;
  }
}

async function resolveBilibiliVideoRef(sourceUrl: string, signal?: AbortSignal) {
  const directBvid = getBvidFromText(new URL(sourceUrl).pathname);
  if (directBvid) {
    return {
      bvid: directBvid,
      pageNumber: getBilibiliPageNumber(sourceUrl),
      pageUrl: sourceUrl,
    };
  }

  const response = await fetch(sourceUrl, {
    headers: getBilibiliRequestHeaders(sourceUrl),
    redirect: "follow",
    signal,
  });
  const responseUrl = response.url;
  if (!responseUrl) {
    throw new VideoSourceError("B 站短链接没有返回目标地址", 502);
  }
  assertPublicHttpUrl(responseUrl);

  const redirectedBvid = getBvidFromText(new URL(responseUrl).pathname);
  if (redirectedBvid) {
    return {
      bvid: redirectedBvid,
      pageNumber: getBilibiliPageNumber(responseUrl),
      pageUrl: responseUrl,
    };
  }

  if (!response.ok) {
    throw new VideoSourceError(`B 站短链接解析失败（${response.status}）`, 502);
  }

  const contentType = response.headers.get("content-type") || "";
  const html = contentType.toLowerCase().includes("text/html") ? await response.text() : "";
  const htmlBvid = getBvidFromText(html);
  if (!htmlBvid) {
    throw new VideoSourceError("无法识别 B 站视频编号", 422);
  }

  return {
    bvid: htmlBvid,
    pageNumber: getBilibiliPageNumber(responseUrl),
    pageUrl: responseUrl,
  };
}

async function fetchBilibiliApi(url: URL, referer: string, signal?: AbortSignal) {
  const response = await fetch(url, {
    headers: getBilibiliRequestHeaders(referer),
    signal,
  });
  if (!response.ok) {
    throw new VideoSourceError(`B 站接口读取失败（${response.status}）`, 502);
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    throw new VideoSourceError("B 站接口返回格式异常", 502);
  }

  if (payload?.code !== 0) {
    throw new VideoSourceError(payload?.message || "B 站接口没有返回可用数据", 422);
  }
  return payload?.data;
}

function pickBilibiliPage(viewData: any, pageNumber: number) {
  const pages = Array.isArray(viewData?.pages) ? viewData.pages : [];
  const page = pages.length > 0
    ? pages.find((item: any) => Number(item?.page) === pageNumber)
    : viewData;
  if (!page) {
    throw new VideoSourceError(`B 站视频没有第 ${pageNumber} 个分 P`, 422);
  }
  const cid = Number(page?.cid);
  if (!Number.isFinite(cid) || cid <= 0) {
    throw new VideoSourceError("B 站视频缺少可播放分集信息", 422);
  }
  return {
    cid,
    part: typeof page?.part === "string" ? page.part.trim() : "",
    durationSeconds: Number.isFinite(Number(page?.duration)) ? Math.max(0, Number(page.duration)) : 0,
  };
}

function pickBilibiliMediaUrl(playData: any) {
  const item = Array.isArray(playData?.durl)
    ? playData.durl.find((entry: any) => entry?.url)
    : null;
  const mediaUrl = item?.url || "";
  if (!mediaUrl) {
    throw new VideoSourceError("B 站没有返回可分析的视频流", 422);
  }
  assertPublicHttpUrl(mediaUrl);
  return mediaUrl;
}

function isDirectVideoUrl(url: string) {
  try {
    const parsed = new URL(url);
    return DIRECT_VIDEO_RE.test(`${parsed.pathname}${parsed.search}`);
  } catch {
    return false;
  }
}

function isVideoMimeType(value: string) {
  const mimeType = value.trim().toLowerCase().split(";")[0];
  return mimeType.startsWith("video/") || HLS_MIME_TYPES.has(mimeType);
}

function getVideoCandidate(html: string, pageUrl: string) {
  const metaType = getMetaContent(html, ["og:video:type", "twitter:player:stream:content_type"]);
  const metaCandidates = [
    getMetaContent(html, ["og:video:secure_url"]),
    getMetaContent(html, ["og:video:url"]),
    getMetaContent(html, ["og:video"]),
    getMetaContent(html, ["twitter:player:stream"]),
  ].filter(Boolean);

  for (const candidate of metaCandidates) {
    const videoUrl = resolvePublicUrl(candidate, pageUrl);
    if (isDirectVideoUrl(videoUrl) || isVideoMimeType(metaType)) {
      return videoUrl;
    }
  }

  const mediaTags = [
    ...collectTags(html, "video"),
    ...collectTags(html, "source"),
  ];
  for (const tag of mediaTags) {
    const attrs = parseAttributes(tag);
    if (!attrs.src) continue;
    const videoUrl = resolvePublicUrl(attrs.src, pageUrl);
    if (isDirectVideoUrl(videoUrl) || isVideoMimeType(attrs.type || "")) {
      return videoUrl;
    }
  }

  return "";
}

function getDirectTitle(url: string) {
  const pathname = new URL(url).pathname;
  const name = pathname.split("/").filter(Boolean).pop() || "";
  return decodeURIComponent(name).replace(/\.(mp4|m3u8|flv|mov|webm)$/i, "");
}

function buildDirectSource(url: string): ExtractedVideoSource {
  const parsed = assertPublicHttpUrl(url);
  return {
    sourceUrl: parsed.toString(),
    canonicalUrl: parsed.toString(),
    platform: getPlatform(parsed.toString()),
    title: getDirectTitle(parsed.toString()),
    author: "",
    coverUrl: "",
    durationSeconds: 0,
    videoUrl: parsed.toString(),
  };
}

function getPageRequestHeaders(referer: string) {
  return {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Referer: referer,
    "User-Agent": BROWSER_UA,
  };
}

export async function buildVideoBriefMediaProxyUrl(
  mediaUrl: string,
  publicOrigin: string,
  referer = "",
  expiresInSeconds = 12 * 60 * 60,
) {
  assertPublicHttpUrl(mediaUrl);
  const origin = new URL(publicOrigin);
  if (origin.protocol !== "http:" && origin.protocol !== "https:") {
    throw new VideoSourceError("媒体代理地址配置无效", 500);
  }
  if (!referer) {
    throw new VideoSourceError("缺少视频来源信息", 500);
  }
  const token = await createVideoBriefMediaToken({ mediaUrl, referer, expiresInSeconds });
  const signed = new URL(VIDEO_BRIEF_MEDIA_ROUTE, origin.origin);
  signed.searchParams.set("t", token);
  return signed.toString();
}

export function fetchVideoBriefMediaUrl(input: string, range?: string | null, referer = "") {
  assertPublicHttpUrl(input);

  if (!referer) {
    throw new VideoSourceError("缺少视频来源信息", 403);
  }
  const headers = getBilibiliMediaHeaders(referer, range);
  return fetch(input, { headers });
}

async function extractBilibiliSource(
  sourceUrl: string,
  signal: AbortSignal | undefined,
  publicOrigin: string | undefined,
): Promise<ExtractedVideoSource> {
  if (!publicOrigin) {
    throw new VideoSourceError("缺少视频媒体代理地址", 500);
  }

  const ref = await resolveBilibiliVideoRef(sourceUrl, signal);
  const viewApi = new URL("/x/web-interface/view", BILIBILI_API_ORIGIN);
  viewApi.searchParams.set("bvid", ref.bvid);
  const viewData = await fetchBilibiliApi(viewApi, ref.pageUrl, signal);
  const page = pickBilibiliPage(viewData, ref.pageNumber);
  const bvid = ref.bvid;
  const canonicalUrl = ref.pageNumber > 1
    ? `${BILIBILI_WEB_ORIGIN}/video/${bvid}?p=${ref.pageNumber}`
    : `${BILIBILI_WEB_ORIGIN}/video/${bvid}`;

  const playApi = new URL("/x/player/playurl", BILIBILI_API_ORIGIN);
  playApi.searchParams.set("bvid", bvid);
  playApi.searchParams.set("cid", String(page.cid));
  playApi.searchParams.set("qn", "32");
  playApi.searchParams.set("fnval", "0");
  playApi.searchParams.set("fnver", "0");
  playApi.searchParams.set("fourk", "0");
  playApi.searchParams.set("platform", "html5");
  const playData = await fetchBilibiliApi(playApi, canonicalUrl, signal);
  const mediaUrl = pickBilibiliMediaUrl(playData);
  const videoUrl = await buildVideoBriefMediaProxyUrl(mediaUrl, publicOrigin, canonicalUrl);
  const title = [viewData?.title, page.part]
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .join(" - ");

  return {
    sourceUrl,
    canonicalUrl,
    platform: "哔哩哔哩",
    title,
    author: typeof viewData?.owner?.name === "string" ? viewData.owner.name.trim() : "",
    coverUrl: normalizeVideoBriefAssetUrl(typeof viewData?.pic === "string" ? viewData.pic : ""),
    durationSeconds: page.durationSeconds,
    videoUrl,
  };
}

export async function extractVideoSource(
  inputUrl: string,
  signal?: AbortSignal,
  options: { publicOrigin?: string } = {},
): Promise<ExtractedVideoSource> {
  const parsed = assertPublicHttpUrl(String(inputUrl || "").trim());
  const sourceUrl = parsed.toString();
  const platform = getPlatform(sourceUrl);

  if (isBilibiliUrl(sourceUrl)) {
    return extractBilibiliSource(sourceUrl, signal, options.publicOrigin);
  }

  if (isDirectVideoUrl(sourceUrl)) {
    return buildDirectSource(sourceUrl);
  }

  const response = await fetch(sourceUrl, {
    headers: getPageRequestHeaders(sourceUrl),
    redirect: "follow",
    signal,
  });

  const responseUrl = response.url || sourceUrl;
  assertPublicHttpUrl(responseUrl);

  if (!response.ok) {
    throw new VideoSourceError(`视频页面读取失败（${response.status}）`, 502);
  }

  const contentType = response.headers.get("content-type") || "";
  if (isVideoMimeType(contentType) || isDirectVideoUrl(responseUrl)) {
    return buildDirectSource(responseUrl);
  }

  if (!contentType.toLowerCase().includes("text/html")) {
    throw new VideoSourceError("该地址不是可读取的视频页面", 422);
  }

  const html = await response.text();
  const canonicalUrl = getCanonicalUrl(html, responseUrl);
  const videoUrl = getVideoCandidate(html, responseUrl);
  if (!videoUrl) {
    throw new VideoSourceError(`无法读取${platform}的视频源。该视频可能需要登录、会员权限、DRM 或被平台反爬限制。`, 422);
  }

  const durationText = getMetaContent(html, ["video:duration", "og:video:duration", "duration"]);
  const durationSeconds = Number.isFinite(Number(durationText)) ? Math.max(0, Number(durationText)) : 0;

  return {
    sourceUrl,
    canonicalUrl,
    platform,
    title: getTitle(html),
    author: getMetaContent(html, ["author", "article:author", "og:site_name"]),
    coverUrl: normalizeVideoBriefAssetUrl(getMetaContent(html, ["og:image:secure_url", "og:image", "twitter:image"])),
    durationSeconds,
    videoUrl,
  };
}
