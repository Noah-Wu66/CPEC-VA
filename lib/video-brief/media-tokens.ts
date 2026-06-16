import crypto from "crypto";
import { videoBriefMediaTokensCollection } from "@/lib/db";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function createVideoBriefMediaToken(input: {
  mediaUrl: string;
  referer: string;
  expiresInSeconds: number;
}) {
  const token = createToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.expiresInSeconds * 1000);
  const collection = await videoBriefMediaTokensCollection();

  await collection.insertOne({
    tokenHash: hashToken(token),
    mediaUrl: input.mediaUrl,
    referer: input.referer,
    expiresAt,
    createdAt: now,
  });

  return token;
}

export async function resolveVideoBriefMediaToken(token: string) {
  if (!/^[a-f0-9]{64}$/i.test(String(token || ""))) {
    return null;
  }

  const collection = await videoBriefMediaTokensCollection();
  return collection.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });
}
