"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  ExternalLink,
  MessageSquarePlus,
  RefreshCw,
  Search,
  Tags,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/client/date";
import { ArchiveDetail } from "@/components/video-brief/archive-detail";
import { readJson } from "@/lib/client/api";
import type { SerializedVideoBriefArchive } from "@/types/video-brief";

interface ArchiveListResponse {
  success?: boolean;
  message?: string;
  archives?: SerializedVideoBriefArchive[];
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

const PAGE_SIZE = 6;

function getErrorMessage(error: unknown, defaultMessage: string) {
  return error instanceof Error ? error.message : defaultMessage;
}

async function requestArchives(input: { page: number; q: string; tag: string }) {
  const params = new URLSearchParams({
    page: String(input.page),
    pageSize: String(PAGE_SIZE),
  });
  if (input.q.trim()) params.set("q", input.q.trim());
  if (input.tag.trim()) params.set("tag", input.tag.trim());
  const response = await fetch(`/api/video-brief/archives?${params.toString()}`, {
    cache: "no-store",
  });
  return readJson(response) as Promise<ArchiveListResponse>;
}

interface VideoArchivesSidebarProps {
  archives: SerializedVideoBriefArchive[];
  selectedId: string;
  loading: boolean;
  error: string;
  total: number;
  page: number;
  totalPages: number;
  q: string;
  tag: string;
  selectedTags: string[];
  onQChange: (value: string) => void;
  onSearch: () => void;
  onTagChange: (nextTag: string) => void;
  onSelect: (archive: SerializedVideoBriefArchive) => void;
  onDelete: (archive: SerializedVideoBriefArchive) => void;
  onRefresh: () => void;
  onPageChange: (nextPage: number) => void;
}

function SidebarArchiveItem({
  archive,
  selected,
  onSelect,
  onDelete,
}: {
  archive: SerializedVideoBriefArchive;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group relative rounded-[var(--radius-md)] border p-3 transition-colors ${
        selected
          ? "border-[var(--va-accent-border)] bg-[var(--va-accent-soft)]"
          : "border-[var(--va-border)] bg-[var(--va-card)] hover:border-[var(--va-muted-soft)] hover:bg-[var(--va-hover)]"
      }`}
    >
      <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 text-left">
        <div className="h-12 w-20 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--va-border)] bg-[var(--va-card-soft)]">
          {archive.coverUrl ? (
            <img
              src={archive.coverUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--va-muted)]">
              <Clapperboard className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--va-fg)]">
            {archive.title || archive.canonicalUrl || archive.sourceUrl}
          </h4>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--va-muted)]">
            <span>{archive.platform}</span>
            <span>· {formatRelativeTime(archive.createdAt)}</span>
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="删除归档"
        className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--va-border)] bg-[var(--va-card)] text-[var(--va-danger)] transition hover:bg-[var(--va-danger-soft)] group-hover:flex"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function VideoArchivesSidebar({
  archives,
  selectedId,
  loading,
  error,
  total,
  page,
  totalPages,
  q,
  tag,
  selectedTags,
  onQChange,
  onSearch,
  onTagChange,
  onSelect,
  onDelete,
  onRefresh,
  onPageChange,
}: VideoArchivesSidebarProps) {
  return (
    <>
      <div className="app-sidebar-body">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-[var(--va-fg)]">
            视频归档
            <span className="ml-2 text-xs font-medium text-[var(--va-muted)]">{total} 条</span>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onRefresh} disabled={loading} aria-label="刷新归档">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSearch();
          }}
          className="relative"
        >
          <input
            value={q}
            onChange={(event) => onQChange(event.target.value)}
            placeholder="搜索标题、摘要、标签"
            className="h-9 w-full pr-9 text-sm"
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--va-muted)]" />
        </form>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onTagChange("")}
            className={`inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-medium transition ${
              !tag
                ? "border-[var(--va-accent-border)] bg-[var(--va-accent-soft)] text-[var(--va-accent)]"
                : "border-[var(--va-border)] bg-[var(--va-card)] text-[var(--va-muted)] hover:bg-[var(--va-hover)] hover:text-[var(--va-fg)]"
            }`}
          >
            <Tags className="mr-1 h-3 w-3" />
            全部
          </button>
          {selectedTags.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onTagChange(item)}
              className={`inline-flex h-7 max-w-[120px] items-center rounded-full border px-2.5 text-[11px] font-medium transition ${
                tag === item
                  ? "border-[var(--va-accent-border)] bg-[var(--va-accent-soft)] text-[var(--va-accent)]"
                  : "border-[var(--va-border)] bg-[var(--va-card)] text-[var(--va-muted)] hover:bg-[var(--va-hover)] hover:text-[var(--va-fg)]"
              }`}
            >
              <span className="truncate">{item}</span>
            </button>
          ))}
        </div>

        {error ? <div className="alert-danger">{error}</div> : null}

        {loading ? (
          <div className="grid gap-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-[68px] animate-skeleton-pulse rounded-[var(--radius-md)] bg-[var(--va-border-soft)]" />
            ))}
          </div>
        ) : archives.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center text-[var(--va-muted)]">
            <Clapperboard className="h-8 w-8" />
            <p className="text-sm">还没有视频归档</p>
            <p className="text-xs">完成一次速览后会出现在这里</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {archives.map((archive) => (
              <SidebarArchiveItem
                key={archive.id}
                archive={archive}
                selected={archive.id === selectedId}
                onSelect={() => onSelect(archive)}
                onDelete={() => onDelete(archive)}
              />
            ))}
          </div>
        )}
      </div>

      {archives.length > 0 ? (
        <div className="flex shrink-0 items-center justify-between border-t border-[var(--va-border)] px-4 py-3">
          <span className="text-xs text-[var(--va-muted)]">
            第 {page} / {totalPages} 页
          </span>
          <div className="flex gap-1">
            <Button type="button" variant="outline" size="icon" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)} aria-label="上一页">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" disabled={loading || page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="下一页">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function VideoBriefArchivePage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [archives, setArchives] = useState<SerializedVideoBriefArchive[]>([]);
  const [selectedArchive, setSelectedArchive] = useState<SerializedVideoBriefArchive | null>(null);
  const [loadingArchives, setLoadingArchives] = useState(true);
  const [archiveError, setArchiveError] = useState("");
  const loadingRef = useRef(false);

  const selectedTags = useMemo(() => {
    const set = new Set<string>();
    archives.forEach((item) => item.analysis.tags.forEach((nextTag) => set.add(nextTag)));
    return Array.from(set).slice(0, 18);
  }, [archives]);

  const fetchArchives = async (nextPage = page, filters?: { q?: string; tag?: string }) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadingArchives(true);
    setArchiveError("");
    try {
      const activeQ = filters?.q ?? q;
      const activeTag = filters?.tag ?? tag;
      const data = await requestArchives({ page: nextPage, q: activeQ, tag: activeTag });
      setArchives(data.archives || []);
      setPage(data.page || nextPage);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (loadError) {
      setArchiveError(getErrorMessage(loadError, "获取归档失败"));
    } finally {
      setLoadingArchives(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    let active = true;
    setLoadingArchives(true);
    requestArchives({ page: 1, q: "", tag: "" })
      .then((data) => {
        if (!active) return;
        setArchives(data.archives || []);
        setPage(data.page || 1);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      })
      .catch((loadError) => {
        if (!active) return;
        setArchiveError(getErrorMessage(loadError, "获取归档失败"));
      })
      .finally(() => {
        if (active) setLoadingArchives(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleDelete = async (archive: SerializedVideoBriefArchive) => {
    if (!confirm("确定要删除这条视频归档吗？")) {
      return;
    }

    setArchiveError("");
    try {
      const response = await fetch(`/api/video-brief/archives/${archive.id}`, {
        method: "DELETE",
      });
      await readJson(response);
      const remaining = archives.filter((item) => item.id !== archive.id);
      setArchives(remaining);
      setTotal((value) => Math.max(0, value - 1));
      setSelectedArchive((current) => (current?.id === archive.id ? null : current));
      if (remaining.length === 0 && page > 1) {
        fetchArchives(page - 1, { q, tag });
      }
    } catch (deleteError) {
      setArchiveError(getErrorMessage(deleteError, "删除失败"));
    }
  };

  const handleSearch = () => {
    fetchArchives(1, { q, tag });
  };

  const handleTagChange = (nextTag: string) => {
    setTag(nextTag);
    fetchArchives(1, { q, tag: nextTag });
  };

  const handlePageChange = (nextPage: number) => {
    fetchArchives(nextPage, { q, tag });
  };

  return (
    <div className="app-workspace">
      <aside className="app-sidebar">
        <VideoArchivesSidebar
          archives={archives}
          selectedId={selectedArchive?.id ?? ""}
          loading={loadingArchives}
          error={archiveError}
          total={total}
          page={page}
          totalPages={totalPages}
          q={q}
          tag={tag}
          selectedTags={selectedTags}
          onQChange={setQ}
          onSearch={handleSearch}
          onTagChange={handleTagChange}
          onSelect={setSelectedArchive}
          onDelete={handleDelete}
          onRefresh={() => fetchArchives(page)}
          onPageChange={handlePageChange}
        />
      </aside>

      <div className="app-content">
        <div className="site-layout-content mx-auto w-full max-w-3xl">
          {selectedArchive ? (
            <div className="rounded-[12px] border border-[var(--va-border)] bg-[var(--va-card)] shadow-[var(--va-shadow-sm)]">
              <div className="border-b border-[var(--va-border)] p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-base font-semibold leading-snug tracking-tight text-[var(--va-fg)]">
                      {selectedArchive.title || selectedArchive.canonicalUrl || selectedArchive.sourceUrl}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--va-muted)]">{formatRelativeTime(selectedArchive.createdAt)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/v/${selectedArchive.id}`)}
                  >
                    查看详情
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="p-5 pt-0 md:p-6 md:pt-0">
                <ArchiveDetail archive={selectedArchive} />
              </div>
            </div>
          ) : (
            <div className="home-welcome">
              <Clapperboard className="mb-4 h-10 w-10 text-[var(--va-muted)]" />
              <h1 className="home-welcome-title">视频归档</h1>
              <p className="home-welcome-subtitle">从左侧选择一条记录，或开始一次新的视频速览。</p>
              <Button onClick={() => router.push("/")} className="mt-2">
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                新建速览
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
