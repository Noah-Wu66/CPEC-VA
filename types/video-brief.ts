import type { ObjectId } from "mongodb";

export interface VideoBriefTimelineItem {
  time: string;
  content: string;
}

export interface VideoBriefAnalysis {
  summary: string;
  interpretation: string;
  keyPoints: string[];
  timeline: VideoBriefTimelineItem[];
  tags: string[];
  people: string[];
  places: string[];
  organizations: string[];
  uncertainPoints: string[];
}

export interface VideoBriefArchiveDoc {
  _id?: ObjectId;
  userId: ObjectId | string;
  sourceUrl: string;
  canonicalUrl: string;
  platform: string;
  title: string;
  author: string;
  coverUrl: string;
  durationSeconds: number;
  analysis: VideoBriefAnalysis;
  model: string;
  createdAt: Date;
}

export interface SerializedVideoBriefArchive {
  id: string;
  sourceUrl: string;
  canonicalUrl: string;
  platform: string;
  title: string;
  author: string;
  coverUrl: string;
  durationSeconds: number;
  analysis: VideoBriefAnalysis;
  model: string;
  createdAt: string;
}

export interface ExtractedVideoSource {
  sourceUrl: string;
  canonicalUrl: string;
  platform: string;
  title: string;
  author: string;
  coverUrl: string;
  durationSeconds: number;
  // 真实可下载的视频地址：B 站是 CDN 直链，其它平台是原始视频地址
  videoUrl: string;
  // 下载视频时需要携带的 Referer（B 站防盗链需要，其它平台可为空）
  mediaReferer?: string;
}
