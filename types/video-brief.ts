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

export interface VideoBriefMediaTokenDoc {
  _id?: ObjectId;
  tokenHash: string;
  mediaUrl: string;
  referer: string;
  expiresAt: Date;
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
  videoUrl: string;
}
