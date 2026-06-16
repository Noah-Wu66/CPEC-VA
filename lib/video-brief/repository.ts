import { ObjectId } from "mongodb";
import { videoBriefArchivesCollection } from "@/lib/db";
import { normalizeVideoBriefAssetUrl } from "@/lib/video-brief/urls";
import type { SerializedVideoBriefArchive, VideoBriefArchiveDoc } from "@/types/video-brief";

function toObjectId(id: string) {
  if (!/^[0-9a-fA-F]{24}$/.test(String(id || ""))) {
    throw new Error("记录编号无效");
  }
  return new ObjectId(id);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePositiveInteger(value: unknown, defaultValue: number, maxValue: number) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number) || number < 1) return defaultValue;
  return Math.min(number, maxValue);
}

export function serializeVideoBriefArchive(doc: VideoBriefArchiveDoc): SerializedVideoBriefArchive {
  return {
    id: String(doc._id || ""),
    sourceUrl: doc.sourceUrl,
    canonicalUrl: doc.canonicalUrl,
    platform: doc.platform,
    title: doc.title,
    author: doc.author,
    coverUrl: normalizeVideoBriefAssetUrl(doc.coverUrl),
    durationSeconds: doc.durationSeconds,
    analysis: doc.analysis,
    model: doc.model,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
  };
}

export class VideoBriefArchiveRepository {
  private static async getCollection() {
    return videoBriefArchivesCollection();
  }

  static async create(input: Omit<VideoBriefArchiveDoc, "_id" | "createdAt">) {
    const collection = await this.getCollection();
    const result = await collection.insertOne({
      ...input,
      userId: typeof input.userId === "string" ? new ObjectId(input.userId) : input.userId,
      createdAt: new Date(),
    });
    return result.insertedId;
  }

  static async findById(id: string, userId: string) {
    const collection = await this.getCollection();
    return collection.findOne({
      _id: toObjectId(id),
      userId: new ObjectId(userId),
    });
  }

  static async deleteById(id: string, userId: string) {
    const collection = await this.getCollection();
    const result = await collection.deleteOne({
      _id: toObjectId(id),
      userId: new ObjectId(userId),
    });
    return result.deletedCount > 0;
  }

  static async listByUser(input: {
    userId: string;
    page?: unknown;
    pageSize?: unknown;
    q?: string;
    tag?: string;
  }) {
    const page = normalizePositiveInteger(input.page, 1, 9999);
    const pageSize = normalizePositiveInteger(input.pageSize, 10, 50);
    const filter: Record<string, unknown> = {
      userId: new ObjectId(input.userId),
    };

    const q = typeof input.q === "string" ? input.q.trim() : "";
    if (q) {
      const keyword = new RegExp(escapeRegExp(q), "i");
      filter.$or = [
        { title: keyword },
        { author: keyword },
        { platform: keyword },
        { sourceUrl: keyword },
        { canonicalUrl: keyword },
        { "analysis.summary": keyword },
        { "analysis.tags": keyword },
      ];
    }

    const tag = typeof input.tag === "string" ? input.tag.trim() : "";
    if (tag) {
      filter["analysis.tags"] = tag;
    }

    const collection = await this.getCollection();
    const [total, archives] = await Promise.all([
      collection.countDocuments(filter),
      collection.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
    ]);

    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      archives: archives.map(serializeVideoBriefArchive),
    };
  }
}
