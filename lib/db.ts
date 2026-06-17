import { MongoClient, ServerApiVersion, type Collection, type Db } from "mongodb";
import { getEnv } from "@/lib/env";
import type { SessionDoc, UserDoc } from "@/types/domain";
import type { VideoBriefArchiveDoc } from "@/types/video-brief";

declare global {
  var mongoClientPromise: Promise<MongoClient> | undefined;
  var videoAssistantIndexesPromise: Promise<void> | undefined;
  var videoAssistantIndexesReady: boolean | undefined;
}

function getClientPromise() {
  if (!global.mongoClientPromise) {
    const client = new MongoClient(getEnv().mongoUri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });

    global.mongoClientPromise = client.connect();
  }

  return global.mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db();
}

export async function ensureMongoIndexes() {
  if (global.videoAssistantIndexesReady) {
    return;
  }

  if (!global.videoAssistantIndexesPromise) {
    global.videoAssistantIndexesPromise = (async () => {
      const db = await getDb();
      await Promise.all([
        db.collection<UserDoc>("users").createIndex({ email: 1 }, { unique: true }),
        db.collection<SessionDoc>("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
        db.collection<SessionDoc>("sessions").createIndex({ userId: 1 }),
        db.collection<VideoBriefArchiveDoc>("video_brief_archives").createIndex({ userId: 1, createdAt: -1 }),
        db.collection<VideoBriefArchiveDoc>("video_brief_archives").createIndex({ userId: 1, "analysis.tags": 1 }),
      ]);
      global.videoAssistantIndexesReady = true;
    })();
  }

  await global.videoAssistantIndexesPromise;
}

export async function usersCollection(): Promise<Collection<UserDoc>> {
  await ensureMongoIndexes();
  return (await getDb()).collection<UserDoc>("users");
}

export async function sessionsCollection(): Promise<Collection<SessionDoc>> {
  await ensureMongoIndexes();
  return (await getDb()).collection<SessionDoc>("sessions");
}

export async function videoBriefArchivesCollection(): Promise<Collection<VideoBriefArchiveDoc>> {
  await ensureMongoIndexes();
  return (await getDb()).collection<VideoBriefArchiveDoc>("video_brief_archives");
}
