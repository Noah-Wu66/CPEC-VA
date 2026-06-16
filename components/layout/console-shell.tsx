import type { ReactNode } from "react";
import { Topbar } from "@/components/layout/topbar";
import type { Role } from "@/types/domain";

interface ConsoleShellProps {
  email: string;
  role: Role;
  children: ReactNode;
  fullBleed?: boolean;
}

export function ConsoleShell({ email, role, children }: ConsoleShellProps) {
  return (
    <div className="app-shell">
      <Topbar email={email} role={role} />
      <main className="app-main">
        <div className="app-content">
          <div className="site-layout-content animate-fade-in">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
