"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Archive,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page";
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
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--oa-card-border)] bg-[var(--oa-paper-soft)]">
          {archive.coverUrl ? (
            <img src={archive.coverUrl} alt="" className="aspect-video w-full object-cover" />
          ) : (
            <div className="flex aspect-video items-center justify-center text-[var(--oa-muted)]">
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
            <h2 className="mt-3 break-words font-heading text-2xl font-bold leading-tight text-[var(--oa-ink)]">
              {getArchiveTitle(archive)}
            </h2>
            {archive.author ? (
              <p className="mt-2 text-sm text-[var(--oa-muted)]">{archive.author}</p>
            ) : null}
          </div>

          <div className="rounded-[var(--radius-md)] border border-[var(--oa-card-border)] bg-[var(--oa-paper-soft)] p-4">
            <p className="text-sm font-bold text-[var(--oa-ink)]">视频速览</p>
            <p className="mt-2 text-sm leading-7 text-[var(--oa-ink-2)]">{archive.analysis.summary}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <div className="space-y-4">
          <section className="rounded-[var(--radius-md)] border border-[var(--oa-card-border)] bg-[var(--oa-card-bg)] p-4">
            <p className="text-sm font-bold text-[var(--oa-ink)]">重点解读</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--oa-ink-2)]">{archive.analysis.interpretation}</p>
          </section>

          <section className="rounded-[var(--radius-md)] border border-[var(--oa-card-border)] bg-[var(--oa-card-bg)] p-4">
            <p className="text-sm font-bold text-[var(--oa-ink)]">关键片段</p>
            <div className="mt-3 space-y-3">
              {archive.analysis.timeline.map((item, index) => (
                <div key={`${item.time}-${index}`} className="grid gap-2 rounded-[var(--radius-md)] bg-[var(--oa-paper-soft)] p-3 sm:grid-cols-[108px_minmax(0,1fr)]">
                  <div className="text-xs font-bold text-[var(--oa-red)]">{item.time || "时间未标注"}</div>
                  <div className="text-sm leading-6 text-[var(--oa-ink-2)]">{item.content}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-[var(--radius-md)] border border-[var(--oa-card-border)] bg-[var(--oa-card-bg)] p-4">
            <p className="text-sm font-bold text-[var(--oa-ink)]">AI 标签</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {archive.analysis.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          </section>

          <section className="rounded-[var(--radius-md)] border border-[var(--oa-card-border)] bg-[var(--oa-card-bg)] p-4">
            <p className="text-sm font-bold text-[var(--oa-ink)]">重点信息</p>
            <div className="mt-3 grid gap-2">
              {archive.analysis.keyPoints.map((point) => (
                <div key={point} className="rounded-[var(--radius-md)] bg-[var(--oa-paper-soft)] px-3 py-2 text-sm text-[var(--oa-ink-2)]">
                  {point}
                </div>
              ))}
            </div>
          </section>

          {archive.analysis.people.length || archive.analysis.places.length || archive.analysis.organizations.length ? (
            <section className="rounded-[var(--radius-md)] border border-[var(--oa-card-border)] bg-[var(--oa-card-bg)] p-4">
              <p className="text-sm font-bold text-[var(--oa-ink)]">实体</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[...archive.analysis.people, ...archive.analysis.places, ...archive.analysis.organizations].map((item) => (
                  <Badge key={item} variant="secondary">{item}</Badge>
                ))}
              </div>
            </section>
          ) : null}

          {archive.analysis.uncertainPoints.length ? (
            <section className="rounded-[var(--radius-md)] border border-[var(--oa-card-border)] bg-[var(--oa-card-bg)] p-4">
              <p className="text-sm font-bold text-[var(--oa-ink)]">待确认</p>
              <div className="mt-3 grid gap-2">
                {archive.analysis.uncertainPoints.map((item) => (
                  <div key={item} className="rounded-[var(--radius-md)] bg-[var(--oa-paper-soft)] px-3 py-2 text-sm text-[var(--oa-muted)]">
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

export default function VideoBriefPage() {
  const [url, setUrl] = useState("");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [archives, setArchives] = useState<SerializedVideoBriefArchive[]>([]);
  const [currentArchive, setCurrentArchive] = useState<SerializedVideoBriefArchive | null>(null);
  const [expandedId, setExpandedId] = useState("");
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
    setCurrentArchive(null);
    setExpandedId("");

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
      setCurrentArchive(data.archive);
      await fetchArchives(1);
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
      setArchives((items) => items.filter((item) => item.id !== archive.id));
      setCurrentArchive((current) => current?.id === archive.id ? null : current);
      setExpandedId((current) => current === archive.id ? "" : current);
      setTotal((value) => Math.max(0, value - 1));
    } catch (deleteError) {
      setArchiveError(getErrorMessage(deleteError, "删除失败"));
    }
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    fetchArchives(1, { q, tag });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="bg-[var(--oa-paper-soft)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--oa-red-soft-bg)] text-[var(--oa-red)]">
                <Clapperboard className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>视频速览</CardTitle>
                <CardDescription>输入公开视频地址，生成可归档的解读和标签。</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--oa-muted)]">
              <Archive className="h-4 w-4" />
              {total} 条归档
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAnalyze} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative min-w-0">
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://..."
                className="h-12 w-full pr-12 text-base"
                disabled={analyzing}
              />
              <ExternalLink className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--oa-muted)]" />
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
        </CardContent>
      </Card>

      {currentArchive ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[rgba(31,138,112,0.08)] text-[var(--oa-green)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">最新解读</CardTitle>
                <CardDescription>{formatRelativeTime(currentArchive.createdAt)}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ArchiveDetail archive={currentArchive} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--oa-paper-soft)] text-[var(--oa-blue)]">
                <Archive className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">视频归档</CardTitle>
                <CardDescription>按时间保存每次视频速览结果。</CardDescription>
              </div>
            </div>

            <form onSubmit={handleSearch} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] xl:w-[460px]">
              <div className="relative min-w-0">
                <input
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="搜索标题、摘要、标签"
                  className="h-10 w-full pr-10"
                />
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--oa-muted)]" />
              </div>
              <Button type="submit" variant="outline">
                <Search className="mr-2 h-4 w-4" />
                搜索
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {archiveError ? <div className="alert-danger mb-4">{archiveError}</div> : null}

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button type="button" variant={tag ? "outline" : "secondary"} size="sm" onClick={() => { setTag(""); fetchArchives(1, { q, tag: "" }); }}>
              <Tags className="mr-2 h-4 w-4" />
              全部标签
            </Button>
            {selectedTags.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setTag(item);
                  fetchArchives(1, { q, tag: item });
                }}
                className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-bold transition ${
                  tag === item
                    ? "border-[var(--oa-red-soft-border)] bg-[var(--oa-red-soft-bg)] text-[var(--oa-red)]"
                    : "border-[var(--oa-card-border)] bg-[var(--oa-card-bg)] text-[var(--oa-muted)] hover:bg-[var(--oa-paper-soft)] hover:text-[var(--oa-ink)]"
                }`}
              >
                {item}
              </button>
            ))}
            <Button type="button" variant="ghost" size="icon" onClick={() => fetchArchives(page)} disabled={loadingArchives} aria-label="刷新归档">
              <RefreshCw className={`h-4 w-4 ${loadingArchives ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {loadingArchives ? (
            <div className="grid gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-28 animate-skeleton-pulse rounded-[var(--radius-md)] bg-[var(--oa-paper-soft)]" />
              ))}
            </div>
          ) : archives.length === 0 ? (
            <EmptyState
              icon={<Clapperboard className="h-6 w-6" />}
              title="还没有视频归档"
              description="完成一次视频速览后，结果会出现在这里。"
            />
          ) : (
            <div className="space-y-4">
              {archives.map((archive) => {
                const expanded = expandedId === archive.id;
                const duration = formatDuration(archive.durationSeconds);
                return (
                  <div key={archive.id} className="rounded-[var(--radius-md)] border border-[var(--oa-card-border)] bg-[var(--oa-card-bg)] p-4 shadow-[var(--oa-shadow-soft)]">
                    <div className="grid gap-4 lg:grid-cols-[128px_minmax(0,1fr)_auto]">
                      <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--oa-card-border)] bg-[var(--oa-paper-soft)]">
                        {archive.coverUrl ? (
                          <img src={archive.coverUrl} alt="" className="aspect-video h-full w-full object-cover" />
                        ) : (
                          <div className="flex aspect-video items-center justify-center text-[var(--oa-muted)]">
                            <Clapperboard className="h-6 w-6" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{archive.platform}</Badge>
                          <span className="text-xs text-[var(--oa-muted)]">{formatRelativeTime(archive.createdAt)}</span>
                          {duration ? <span className="text-xs text-[var(--oa-muted)]">{duration}</span> : null}
                        </div>
                        <h3 className="mt-2 break-words font-heading text-lg font-bold leading-snug text-[var(--oa-ink)]">
                          {getArchiveTitle(archive)}
                        </h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--oa-ink-2)]">{archive.analysis.summary}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {archive.analysis.tags.slice(0, 8).map((item) => (
                            <Badge key={item} variant="outline">{item}</Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 lg:flex-col">
                        <Button type="button" variant="outline" size="sm" onClick={() => setExpandedId(expanded ? "" : archive.id)}>
                          {expanded ? "收起" : "详情"}
                        </Button>
                        <Button type="button" variant="outline" size="icon" onClick={() => handleDelete(archive)} aria-label="删除归档">
                          <Trash2 className="h-4 w-4 text-[var(--oa-red)]" />
                        </Button>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="mt-5 border-t border-[var(--oa-card-head-border)] pt-5">
                        <ArchiveDetail archive={archive} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 border-t border-[var(--oa-card-head-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-[var(--oa-muted)]">
              第 {page} / {totalPages} 页
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={loadingArchives || page <= 1} onClick={() => fetchArchives(page - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                上一页
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={loadingArchives || page >= totalPages} onClick={() => fetchArchives(page + 1)}>
                下一页
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
