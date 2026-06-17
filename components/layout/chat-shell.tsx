import type { ReactNode } from "react";
import { HomeSidebar } from "@/components/home/sidebar";
import type { SerializedVideoBriefArchive } from "@/types/video-brief";

interface ChatShellProps {
  archives: SerializedVideoBriefArchive[];
  activeArchiveId?: string;
  children: ReactNode;
}

export function ChatShell({
  archives,
  activeArchiveId,
  children,
}: ChatShellProps) {
  return (
    <div className="home-shell">
      <HomeSidebar
        archives={archives}
        activeArchiveId={activeArchiveId}
      />
      <main className="home-main">{children}</main>
    </div>
  );
}
