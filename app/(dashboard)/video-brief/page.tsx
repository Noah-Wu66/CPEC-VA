"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Tags,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/client/date";
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

function formatDuration(seconds: number) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  if (!value) return "";
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  if (minutes < 60) return `${minutes}分${rest.toString().padStart(2, "0")}秒`;
  const hours = Math.floor(minutes / 60);
  return `${hours}时${(minutes % 60).toString().padStart(2, "0")}分`;
}

function getArchiveTitle(archive: SerializedVideoBriefArchive) {
  return archive.title || archive.canonicalUrl || archive.sourceUrl;
}

function getErrorMessage(error: unknown, defaultMessage: string) {
  return error instanceof Error ? error.message : defaultMessage;
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "请求失败");
  }
  return data;
}

async function requestArchives(input: { page: number; q: string; tag: string }) {
  const params = new URLSearchParams({
    page: String(input.page),
    pageSize: String(PAGE_SIZE),
  });
  if (input.q.trim()) params.set("q", input.q.trim());
  if (input.tag.trim()) params.set("tag", input.tag.trim());
  const response = await fetch(`/api/video-brief/archives?${params.toString()}`, { cache: "no-store" });
  return readJson(response) as Promise<ArchiveListResponse>;
}

function ArchiveDetail({ archive }: { archive: SerializedVideoBriefArchive }) {
  const duration = formatDuration(archive.durationSeconds);
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--va-border)] bg-[var(--va-card-soft)]">
          {archive.coverUrl ? (
            <img src={archive.coverUrl} alt="" className="aspect-video w-full object-cover" />
          ) : (
            <div className="flex aspect-video items-center justify-center text-[var(--va-muted)]">
              <Clapperboard className="h-10 w-10" />
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{archive.platform}</Badge>
              {duration ? (
                <Badge variant="outline">
                  <Clock className="mr-1 h-3 w-3" />
                  {duration}
                </Badge>
              ) : null}
            </div>
            <h2 className="mt-3 break-words text-2xl font-bold leading-tight tracking-tight text-[var(--va-fg)]">
              {getArchiveTitle(archive)}
            </h2>
            {archive.author ? (
              <p className="mt-2 text-sm text-[var(--va-muted)]">{archive.author}</p>
            ) : null}
          </div>

          <div className="rounded-[var(--radius-md)] border border-[var(--va-border)] bg-[var(--va-card-soft)] p-4">
            <p className="text-sm font-semibold text-[var(--va-fg)]">视频速览</p>
            <p className="mt-2 text-sm leading-7 text-[var(--va-fg-2)]">{archive.analysis.summary}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <div className="space-y-4">
          <section className="rounded-[var(--radius-md)] border border-[var(--va-border)] bg-[var(--va-card)] p-4">
            <p className="text-sm font-semibold text-[var(--va-fg)]">重点解读</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--va-fg-2)]">{archive.analysis.interpretation}</p>
          </section>

          <section className="rounded-[var(--radius-md)] border border-[var(--va-border)] bg-[var(--va-card)] p-4">
            <p className="text-sm font-semibold text-[var(--va-fg)]">关键片段</p>
            <div className="mt-3 space-y-3">
              {archive.analysis.timeline.map((item, index) => (
                <div key={`${item.time}-${index}`} className="grid gap-2 rounded-[var(--radius-md)] bg-[var(--va-card-soft)] p-3 sm:grid-cols-[108px_minmax(0,1fr)]">
                  <div className="text-xs font-semibold text-[var(--va-accent)]">{item.time || "时间未标注"}</div>
                  <div className="text-sm leading-6 text-[var(--va-fg-2)]">{item.content}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-[var(--radius-md)] border border-[var(--va-border)] bg-[var(--va-card)] p-4">
            <p className="text-sm font-semibold text-[var(--va-fg)]">AI 标签</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {archive.analysis.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          </section>

          <section className="rounded-[var(--radius-md)] border border-[var(--va-border)] bg-[var(--va-card)] p-4">
            <p className="text-sm font-semibold text-[var(--va-fg)]">重点信息</p>
            <div className="mt-3 grid gap-2">
              {archive.analysis.keyPoints.map((point) => (
                <div key={point} className="rounded-[var(--radius-md)] bg-[var(--va-card-soft)] px-3 py-2 text-sm text-[var(--va-fg-2)]">
                  {point}
                </div>
              ))}
            </div>
          </section>

          {archive.analysis.people.length || archive.analysis.places.length || archive.analysis.organizations.length ? (
            <section className="rounded-[var(--radius-md)] border border-[var(--va-border)] bg-[var(--va-card)] p-4">
              <p className="text-sm font-semibold text-[var(--va-fg)]">实体</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[...archive.analysis.people, ...archive.analysis.places, ...archive.analysis.organizations].map((item) => (
                  <Badge key={item} variant="secondary">{item}</Badge>
                ))}
              </div>
            </section>
          ) : null}

          {archive.analysis.uncertainPoints.length ? (
            <section className="rounded-[var(--radius-md)] border border-[var(--va-border)] bg-[var(--va-card)] p-4">
              <p className="text-sm font-semibold text-[var(--va-fg)]">待确认</p>
              <div className="mt-3 grid gap-2">
                {archive.analysis.uncertainPoints.map((item) => (
                  <div key={item} className="rounded-[var(--radius-md)] bg-[var(--va-card-soft)] px-3 py-2 text-sm text-[var(--va-muted)]">
                    {item}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface SidebarArchiveItemProps {
  archive: SerializedVideoBriefArchive;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SidebarArchiveItem({ archive, selected, onSelect, onDelete }: SidebarArchiveItemProps) {
  const duration = formatDuration(archive.durationSeconds);
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
            <img src={archive.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--va-muted)]">
              <Clapperboard className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--va-fg)]">
            {getArchiveTitle(archive)}
          </h4>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--va-muted)]">
            <span>{archive.platform}</span>
            {duration ? <span>· {duration}</span> : null}
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

export default function VideoBriefPage() {
  const [url, setUrl] = useState("");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [archives, setArchives] = useState<SerializedVideoBriefArchive[]>([]);
  const [selectedArchive, setSelectedArchive] = useState<SerializedVideoBriefArchive | null>(null);
  const [loadingArchives, setLoadingArchives] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [archiveError, setArchiveError] = useState("");
  const analyzingRef = useRef(false);

  const selectedTags = useMemo(() => {
    const set = new Set<string>();
    archives.forEach((item) => item.analysis.tags.forEach((nextTag) => set.add(nextTag)));
    return Array.from(set).slice(0, 18);
  }, [archives]);

  const fetchArchives = async (nextPage = page, filters?: { q?: string; tag?: string }) => {
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

  const handleAnalyze = async (event: FormEvent) => {
    event.preventDefault();
    if (analyzingRef.current) return;

    setError("");
    setSelectedArchive(null);

    if (!url.trim()) {
      setError("请输入视频网址");
      return;
    }

    setAnalyzing(true);
    analyzingRef.current = true;
    try {
      const response = await fetch("/api/video-brief/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await readJson(response);
      const fresh = data.archive as SerializedVideoBriefArchive | undefined;
      setQ("");
      setTag("");
      await fetchArchives(1, { q: "", tag: "" });
      if (fresh) {
        setSelectedArchive(fresh);
      }
    } catch (analyzeError) {
      setError(getErrorMessage(analyzeError, "视频速览失败"));
    } finally {
      analyzingRef.current = false;
      setAnalyzing(false);
    }
  };

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
        <div className="site-layout-content mx-auto my-auto w-full max-w-3xl space-y-6">
          <div className="rounded-[12px] border border-[var(--va-border)] bg-[var(--va-card)] shadow-[var(--va-shadow-sm)]">
            <div className="border-b border-[var(--va-border)] p-5 md:p-6">
              <h3 className="text-lg font-semibold leading-none tracking-tight text-[var(--va-fg)]">视频速览</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--va-muted)]">输入公开视频地址，生成可归档的解读和标签。</p>
            </div>
            <div className="p-5 pt-0 md:p-6 md:pt-0">
              <form onSubmit={handleAnalyze} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="relative min-w-0">
                  <input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="粘贴视频链接，支持 B 站、抖音、YouTube 等"
                    className="h-12 w-full pr-12 text-base"
                    disabled={analyzing}
                  />
                  <ExternalLink className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--va-muted)]" />
                </div>
                <Button type="submit" size="lg" disabled={analyzing} className="min-w-[148px]">
                  {analyzing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      解读中
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      开始速览
                    </>
                  )}
                </Button>
              </form>

              {error ? <div className="alert-danger mt-4">{error}</div> : null}
            </div>
          </div>

          {selectedArchive ? (
            <div className="rounded-[12px] border border-[var(--va-border)] bg-[var(--va-card)] shadow-[var(--va-shadow-sm)]">
              <div className="border-b border-[var(--va-border)] p-5 md:p-6">
                <h3 className="text-base font-semibold leading-none tracking-tight text-[var(--va-fg)]">{getArchiveTitle(selectedArchive)}</h3>
                <p className="mt-1 text-sm text-[var(--va-muted)]">{formatRelativeTime(selectedArchive.createdAt)}</p>
              </div>
              <div className="p-5 pt-0 md:p-6 md:pt-0">
                <ArchiveDetail archive={selectedArchive} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
