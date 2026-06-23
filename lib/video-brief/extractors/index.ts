import { randomUUID } from "crypto";
import { isIP } from "net";
import { normalizeVideoBriefAssetUrl } from "@/lib/video-brief/urls";
import type { ExtractedVideoSource } from "@/types/video-brief";

const DIRECT_VIDEO_RE = /\.(mp4|m3u8|flv|mov|webm)(?:$|[?#])/i;
const HLS_MIME_TYPES = new Set(["application/x-mpegurl", "application/vnd.apple.mpegurl"]);
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";
const BILIBILI_API_ORIGIN = "https://api.bilibili.com";
const BILIBILI_WEB_ORIGIN = "https://www.bilibili.com";
const BILIBILI_BVID_RE = /(BV[0-9A-Za-z]+)/i;
const YOUKU_API_ORIGIN = "https://ups.youku.com";
const YOUKU_WEB_ORIGIN = "https://v.youku.com";
const YOUKU_LOG_URL = "https://log.mmstat.com/eg.js";
const MGTV_API_ORIGIN = "https://pcweb.api.mgtv.com";

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
  if (host.endsWith("youku.com") || host.endsWith("tudou.com")) return "优酷";
  if (host.endsWith("mgtv.com")) return "芒果TV";
  return "公开视频";
}

function isBilibiliUrl(url: string) {
  const host = getHost(url).replace(/^www\./, "");
  return host === "b23.tv" || host.endsWith("bilibili.com");
}

function isYoukuUrl(url: string) {
  const host = getHost(url).replace(/^www\./, "");
  return host.endsWith("youku.com") || host.endsWith("tudou.com");
}

function isMgtvUrl(url: string) {
  const host = getHost(url).replace(/^www\./, "");
  return host.endsWith("mgtv.com");
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

async function extractBilibiliSource(
  sourceUrl: string,
  signal: AbortSignal | undefined,
): Promise<ExtractedVideoSource> {
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
  const videoUrl = pickBilibiliMediaUrl(playData);
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
    mediaReferer: canonicalUrl,
  };
}

async function readJsonResponse(response: Response, label: string) {
  if (!response.ok) {
    throw new VideoSourceError(`${label}读取失败（${response.status}）`, 502);
  }

  try {
    return await response.json();
  } catch {
    throw new VideoSourceError(`${label}返回格式异常`, 502);
  }
}

function createYoukuCookie() {
  const suffix = Array.from({ length: 3 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");
  return `__ysuid=${Math.floor(Date.now() / 1000)}${suffix}; xreferrer=http://www.youku.com`;
}

function getYoukuRequestHeaders(referer: string, cookie: string) {
  return {
    Accept: "application/json,text/plain,*/*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    Cookie: cookie,
    Pragma: "no-cache",
    Referer: referer,
    "User-Agent": BROWSER_UA,
  };
}

function getYoukuVideoId(sourceUrl: string) {
  const match = sourceUrl.match(/(?:v_show\/id_|player\.php\/sid\/|video\.tudou\.com\/v\/)([A-Za-z0-9=]+)/i);
  if (!match?.[1]) {
    throw new VideoSourceError("无法识别优酷视频编号", 422);
  }
  return match[1];
}

async function fetchYoukuCna(cookie: string, signal?: AbortSignal) {
  const response = await fetch(YOUKU_LOG_URL, {
    headers: getYoukuRequestHeaders(YOUKU_WEB_ORIGIN, cookie),
    signal,
  });
  if (!response.ok) {
    throw new VideoSourceError(`优酷播放凭证读取失败（${response.status}）`, 502);
  }

  const cna = (response.headers.get("etag") || "").replace(/^"|"$/g, "");
  if (!cna) {
    throw new VideoSourceError("优酷播放凭证为空", 502);
  }
  return cna;
}

async function fetchYoukuData(videoId: string, referer: string, signal?: AbortSignal) {
  const cookie = createYoukuCookie();
  const cna = await fetchYoukuCna(cookie, signal);
  const apiUrl = new URL("/ups/get.json", YOUKU_API_ORIGIN);
  apiUrl.searchParams.set("vid", videoId);
  apiUrl.searchParams.set("ccode", "0564");
  apiUrl.searchParams.set("client_ip", "192.168.1.1");
  apiUrl.searchParams.set("utid", cna);
  apiUrl.searchParams.set("client_ts", String(Math.floor(Date.now() / 1000)));

  const payload = await readJsonResponse(
    await fetch(apiUrl, {
      headers: getYoukuRequestHeaders(referer, cookie),
      signal,
    }),
    "优酷接口",
  );
  const data = payload?.data;
  if (data?.error) {
    const message = typeof data.error.note === "string" ? data.error.note : "优酷接口没有返回可用数据";
    throw new VideoSourceError(message.replace(/<[^>]*>/g, ""), 422);
  }
  if (!data?.video || !Array.isArray(data?.stream)) {
    throw new VideoSourceError("优酷接口返回格式异常", 502);
  }
  return data;
}

function pickYoukuStream(data: any) {
  const streams = (Array.isArray(data?.stream) ? data.stream : [])
    .filter((stream: any) => stream?.m3u8_url && stream?.channel_type !== "tail")
    .sort((left: any, right: any) => {
      const leftSize = Number(left?.size) || Number.MAX_SAFE_INTEGER;
      const rightSize = Number(right?.size) || Number.MAX_SAFE_INTEGER;
      return leftSize - rightSize;
    });
  const stream = streams[0];
  if (!stream?.m3u8_url) {
    throw new VideoSourceError("优酷没有返回可分析的视频流", 422);
  }
  const videoUrl = resolvePublicUrl(stream.m3u8_url, YOUKU_WEB_ORIGIN);
  return videoUrl;
}

async function extractYoukuSource(
  sourceUrl: string,
  signal: AbortSignal | undefined,
): Promise<ExtractedVideoSource> {
  const videoId = getYoukuVideoId(sourceUrl);
  const canonicalUrl = `${YOUKU_WEB_ORIGIN}/v_show/id_${videoId}.html`;
  const data = await fetchYoukuData(videoId, canonicalUrl, signal);
  const videoData = data.video || {};

  return {
    sourceUrl,
    canonicalUrl,
    platform: "优酷",
    title: typeof videoData.title === "string" ? videoData.title.trim() : "",
    author: typeof videoData.username === "string" ? videoData.username.trim() : "",
    coverUrl: normalizeVideoBriefAssetUrl(typeof videoData.logo === "string" ? videoData.logo : ""),
    durationSeconds: Number.isFinite(Number(videoData.seconds)) ? Math.max(0, Number(videoData.seconds)) : 0,
    videoUrl: pickYoukuStream(data),
    mediaReferer: canonicalUrl,
  };
}

function getMgtvVideoId(sourceUrl: string) {
  const pathname = new URL(sourceUrl).pathname;
  const match = pathname.match(/\/[bv]\/(?:[^/]+\/)*(\d+)\.html$/i);
  if (!match?.[1]) {
    throw new VideoSourceError("无法识别芒果 TV 视频编号", 422);
  }
  return match[1];
}

function buildMgtvTk2() {
  const raw = `did=${randomUUID()}|pno=1030|ver=0.3.0301|clit=${Math.floor(Date.now() / 1000)}`;
  const encoded = Buffer.from(raw).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
  return encoded.split("").reverse().join("");
}

function getMgtvRequestHeaders(referer: string) {
  return {
    Accept: "application/json,text/plain,*/*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    Referer: referer,
    "User-Agent": BROWSER_UA,
  };
}

async function fetchMgtvApi(url: URL, referer: string, signal?: AbortSignal) {
  const payload = await readJsonResponse(
    await fetch(url, {
      headers: getMgtvRequestHeaders(referer),
      signal,
    }),
    "芒果 TV 接口",
  );
  if (!payload?.data) {
    throw new VideoSourceError(payload?.msg || "芒果 TV 接口没有返回可用数据", 422);
  }
  return payload.data;
}

function pickMgtvStream(streamData: any) {
  const streamDomain = Array.isArray(streamData?.stream_domain)
    ? streamData.stream_domain.find((item: any) => typeof item === "string" && item)
    : "";
  const qualityRank: Record<string, number> = {
    "标清": 1,
    "高清": 2,
    "超清": 3,
    "蓝光": 4,
  };
  const streams = (Array.isArray(streamData?.stream) ? streamData.stream : [])
    .filter((stream: any) => stream?.url)
    .sort((left: any, right: any) => {
      const leftRank = qualityRank[String(left?.name || left?.standardName || left?.barName || "")] || 99;
      const rightRank = qualityRank[String(right?.name || right?.standardName || right?.barName || "")] || 99;
      return leftRank - rightRank;
    });
  const stream = streams[0];
  if (!stream?.url || !streamDomain) {
    throw new VideoSourceError("芒果 TV 没有返回可分析的视频流", 422);
  }
  return resolvePublicUrl(stream.url, streamDomain);
}

async function extractMgtvSource(
  sourceUrl: string,
  signal: AbortSignal | undefined,
): Promise<ExtractedVideoSource> {
  const videoId = getMgtvVideoId(sourceUrl);
  const tk2 = buildMgtvTk2();

  const videoApi = new URL("/player/video", MGTV_API_ORIGIN);
  videoApi.searchParams.set("tk2", tk2);
  videoApi.searchParams.set("video_id", videoId);
  videoApi.searchParams.set("type", "pch5");
  const videoData = await fetchMgtvApi(videoApi, sourceUrl, signal);

  const sourceApi = new URL("/player/getSource", MGTV_API_ORIGIN);
  sourceApi.searchParams.set("tk2", tk2);
  sourceApi.searchParams.set("pm2", String(videoData?.atc?.pm2 || ""));
  sourceApi.searchParams.set("video_id", videoId);
  sourceApi.searchParams.set("type", "pch5");
  sourceApi.searchParams.set("src", "intelmgtv");
  const streamData = await fetchMgtvApi(sourceApi, sourceUrl, signal);

  const formatApiUrl = pickMgtvStream(streamData);
  const formatData = await readJsonResponse(
    await fetch(formatApiUrl, {
      headers: getMgtvRequestHeaders(sourceUrl),
      signal,
    }),
    "芒果 TV 视频流",
  );
  const videoUrl = typeof formatData?.info === "string" ? formatData.info : "";
  if (!videoUrl) {
    throw new VideoSourceError("芒果 TV 视频流地址为空", 422);
  }

  const info = videoData?.info || {};
  return {
    sourceUrl,
    canonicalUrl: sourceUrl,
    platform: "芒果TV",
    title: typeof info.title === "string" ? info.title.trim() : "",
    author: "",
    coverUrl: normalizeVideoBriefAssetUrl(typeof info.thumb === "string" ? info.thumb : ""),
    durationSeconds: Number.isFinite(Number(info.duration)) ? Math.max(0, Number(info.duration)) : 0,
    videoUrl: resolvePublicUrl(videoUrl, formatApiUrl),
    mediaReferer: sourceUrl,
  };
}

export async function extractVideoSource(
  inputUrl: string,
  signal?: AbortSignal,
): Promise<ExtractedVideoSource> {
  const parsed = assertPublicHttpUrl(String(inputUrl || "").trim());
  const sourceUrl = parsed.toString();
  const platform = getPlatform(sourceUrl);

  if (isBilibiliUrl(sourceUrl)) {
    return extractBilibiliSource(sourceUrl, signal);
  }

  if (isYoukuUrl(sourceUrl)) {
    return extractYoukuSource(sourceUrl, signal);
  }

  if (isMgtvUrl(sourceUrl)) {
    return extractMgtvSource(sourceUrl, signal);
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
    const target = platform === "公开视频" ? "该网页里的视频源" : `${platform}的视频源`;
    throw new VideoSourceError(`无法读取${target}。该视频可能需要登录、会员权限、DRM 或被平台反爬限制。`, 422);
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
