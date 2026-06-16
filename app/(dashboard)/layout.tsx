import type { ReactNode } from "react";
import { connection } from "next/server";
import { Suspense } from "react";
import { ConsoleShell } from "@/components/layout/console-shell";
import { requirePageSession } from "@/lib/auth";

function DashboardLayoutFallback() {
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar-brand">
          <div className="h-8 w-8 animate-skeleton-pulse rounded-[8px] bg-[var(--va-hover)]" />
          <div className="h-4 w-32 animate-skeleton-pulse rounded-[var(--radius-md)] bg-[var(--va-hover)]" />
        </div>
        <div className="app-topbar-actions">
          <div className="h-9 w-9 animate-skeleton-pulse rounded-[var(--radius-md)] bg-[var(--va-hover)]" />
        </div>
      </header>
      <main className="app-main">
        <div className="app-content">
          <div className="site-layout-content">
            <div className="space-y-4">
              <div className="h-28 animate-skeleton-pulse rounded-[12px] bg-[var(--va-hover)]" />
              <div className="h-48 animate-skeleton-pulse rounded-[12px] bg-[var(--va-hover)]" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

async function DashboardLayoutContent({ children }: { children: ReactNode }) {
  await connection();
  const current = await requirePageSession();

  return (
    <ConsoleShell email={current.user.email} role={current.user.role}>
      {children}
    </ConsoleShell>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<DashboardLayoutFallback />}>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
