"use client";

import { useEffect, useState } from "react";
import { Clapperboard, Loader2 } from "lucide-react";
import { ArchiveDetail } from "@/components/video-brief/archive-detail";
import { readJson } from "@/lib/client/api";
import type { SerializedVideoBriefArchive } from "@/types/video-brief";

function getErrorMessage(error: unknown, defaultMessage: string) {
  return error instanceof Error ? error.message : defaultMessage;
}

interface VideoDetailPageClientProps {
  archiveId: string;
  initialArchive?: SerializedVideoBriefArchive;
}

export function VideoDetailPageClient({
  archiveId,
  initialArchive,
}: VideoDetailPageClientProps) {
  const [archive, setArchive] = useState<SerializedVideoBriefArchive | null>(
    initialArchive ?? null
  );
  const [loading, setLoading] = useState(!initialArchive);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialArchive) return;
    let active = true;
    setLoading(true);
    fetch(`/api/video-brief/archives/${archiveId}`, { cache: "no-store" })
      .then(async (response) => {
        if (!active) return;
        const data = await readJson(response);
        const archiveData = data.archive as SerializedVideoBriefArchive | undefined;
        setArchive(archiveData ?? null);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(getErrorMessage(loadError, "获取视频详情失败"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [archiveId, initialArchive]);

  if (loading) {
    return (
      <div className="home-detail-empty">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--va-muted)]" />
        <p className="mt-4 text-sm text-[var(--va-muted)]">加载视频中…</p>
      </div>
    );
  }

  if (error || !archive) {
    return (
      <div className="home-detail-empty">
        <Clapperboard className="h-10 w-10 text-[var(--va-muted)]" />
        <p className="mt-4 text-sm text-[var(--va-muted)]">
          {error || "视频不存在或已被删除"}
        </p>
      </div>
    );
  }

  return (
    <div className="home-detail">
      <ArchiveDetail archive={archive} />
    </div>
  );
}
