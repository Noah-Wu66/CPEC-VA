import type { ReactNode } from "react";
import { HomeSidebar } from "@/components/home/sidebar";
import type { SerializedVideoBriefArchive } from "@/types/video-brief";

interface ChatShellProps {
  currentUser: {
    email: string;
    displayName?: string;
  };
  archives: SerializedVideoBriefArchive[];
  activeArchiveId?: string;
  children: ReactNode;
}

export function ChatShell({
  currentUser,
  archives,
  activeArchiveId,
  children,
}: ChatShellProps) {
  return (
    <div className="home-shell">
      <HomeSidebar
        currentUser={currentUser}
        archives={archives}
        activeArchiveId={activeArchiveId}
      />
      <main className="home-main">{children}</main>
    </div>
  );
}
