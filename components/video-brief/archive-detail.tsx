import { useMemo } from "react";
import { Clock, Clapperboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SerializedVideoBriefArchive } from "@/types/video-brief";

function formatDuration(seconds: number) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  if (!value) return "";
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  if (minutes < 60) return `${minutes}分${rest.toString().padStart(2, "0")}秒`;
  const hours = Math.floor(minutes / 60);
  return `${hours}时${(minutes % 60).toString().padStart(2, "0")}分`;
}

export function ArchiveDetail({ archive }: { archive: SerializedVideoBriefArchive }) {
  const duration = formatDuration(archive.durationSeconds);

  const entities = useMemo(
    () => [
      ...archive.analysis.people,
      ...archive.analysis.places,
      ...archive.analysis.organizations,
    ],
    [archive.analysis]
  );

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
              {archive.title || archive.canonicalUrl || archive.sourceUrl}
            </h2>
            {archive.author ? <p className="mt-2 text-sm text-[var(--va-muted)]">{archive.author}</p> : null}
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

          {entities.length ? (
            <section className="rounded-[var(--radius-md)] border border-[var(--va-border)] bg-[var(--va-card)] p-4">
              <p className="text-sm font-semibold text-[var(--va-fg)]">实体</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {entities.map((item) => (
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
