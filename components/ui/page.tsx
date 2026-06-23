import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "blue" | "green" | "gold" | "red";

const toneClass: Record<Tone, string> = {
  blue: "!border-[var(--va-accent-border)] !bg-[var(--va-accent-soft)] !text-[var(--va-accent)]",
  green: "!border-[var(--va-success-border)] !bg-[var(--va-success-soft)] !text-[var(--va-success)]",
  gold: "!border-[var(--warning-border)] !bg-[var(--warning-light)] !text-hsl(var(--warning))",
  red: "!border-[var(--va-danger-border)] !bg-[var(--va-danger-soft)] !text-[var(--va-danger)]"
};

interface MetricCardProps {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
}

export function MetricCard({ label, value, description, icon, tone = "blue", className }: MetricCardProps) {
  return (
    <div className={cn("group rounded-[var(--radius-lg)] border border-[var(--va-border)] bg-[var(--va-card)] p-5 shadow-[var(--va-shadow-sm)] transition-colors hover:border-[var(--va-accent-border)]", className)}>
      <div className="flex items-start gap-3">
        {icon ? (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border", toneClass[tone])}>
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--va-muted)]">{label}</p>
          <div className="mt-1 text-2xl font-bold leading-none tracking-tight text-[var(--va-fg)]">{value}</div>
          {description ? <div className="mt-2 text-xs leading-5 text-[var(--va-muted)]">{description}</div> : null}
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("empty-state", className)}>
      {icon ? <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[10px] border border-[var(--va-border)] bg-[var(--va-card-soft)] text-[var(--va-muted)]">{icon}</div> : null}
      <h3 className="text-lg font-semibold text-[var(--va-fg)]">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm leading-6 text-[var(--va-muted)]">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
