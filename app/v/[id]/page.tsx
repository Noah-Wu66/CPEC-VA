import { connection } from "next/server";
import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/auth";
import { ChatShell } from "@/components/layout/chat-shell";
import { VideoDetailPageClient } from "@/components/video-brief/video-detail-client";
import {
  serializeVideoBriefArchive,
  VideoBriefArchiveRepository,
} from "@/lib/video-brief/repository";
import type { SerializedVideoBriefArchive } from "@/types/video-brief";

const RECENT_LIMIT = 25;

async function loadRecentArchives(userId: string): Promise<SerializedVideoBriefArchive[]> {
  try {
    const result = await VideoBriefArchiveRepository.listByUser({
      userId,
      page: 1,
      pageSize: RECENT_LIMIT,
    });
    return result.archives;
  } catch {
    return [];
  }
}

export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const current = await requirePageSession();
  const { id } = await params;
  const archives = await loadRecentArchives(current.user._id.toString());

  const archive = await VideoBriefArchiveRepository.findById(
    id,
    current.user._id.toString()
  );
  if (!archive) {
    redirect("/");
  }

  return (
    <ChatShell
      currentUser={{
        email: current.user.email,
        displayName: current.user.displayName,
      }}
      archives={archives}
      activeArchiveId={id}
    >
      <VideoDetailPageClient
        archiveId={id}
        initialArchive={serializeVideoBriefArchive(archive)}
      />
    </ChatShell>
  );
}
