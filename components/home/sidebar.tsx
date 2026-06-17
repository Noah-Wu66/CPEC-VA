"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clapperboard,
  LogOut,
  Menu,
  MessageSquarePlus,
  Moon,
  Monitor,
  Sun,
  Trash2,
} from "lucide-react";
import { useAppTheme, type ThemeMode } from "@/components/layout/app-theme-provider";
import { formatRelativeTime } from "@/lib/client/date";
import { readJson } from "@/lib/client/api";
import type { SerializedVideoBriefArchive } from "@/types/video-brief";

function getArchiveTitle(archive: SerializedVideoBriefArchive) {
  return archive.title || archive.canonicalUrl || archive.sourceUrl;
}

interface HomeSidebarProps {
  currentUser: {
    email: string;
    displayName?: string;
  };
  archives: SerializedVideoBriefArchive[];
  activeArchiveId?: string;
}

export function HomeSidebar({
  currentUser,
  archives,
  activeArchiveId,
}: HomeSidebarProps) {
  const router = useRouter();
  const { themeMode, setThemeMode } = useAppTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const themeItems = useMemo<ThemeMode[]>(() => ["light", "dark", "system"], []);

  function cycleTheme() {
    const currentIndex = themeItems.indexOf(themeMode);
    const nextMode = themeItems[(currentIndex + 1) % themeItems.length];
    setThemeMode(nextMode);
  }

  const themeIcon =
    themeMode === "light" ? (
      <Sun className="h-[18px] w-[18px]" />
    ) : themeMode === "dark" ? (
      <Moon className="h-[18px] w-[18px]" />
    ) : (
      <Monitor className="h-[18px] w-[18px]" />
    );

  function handleLogout() {
    window.location.href = "/api/auth/logout";
  }

  async function handleDelete(
    archive: SerializedVideoBriefArchive,
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm("确定要删除这条视频归档吗？")) {
      return;
    }
    try {
      const response = await fetch(`/api/video-brief/archives/${archive.id}`, { method: "DELETE" });
      await readJson(response);
      router.refresh();
      if (activeArchiveId === archive.id) {
        router.push("/");
      }
    } catch {
      router.refresh();
    }
  }

  const initials = useMemo(() => {
    const name = currentUser.displayName || currentUser.email || "User";
    return name.slice(0, 2).toUpperCase();
  }, [currentUser.displayName, currentUser.email]);

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="home-mobile-menu"
        aria-label="打开菜单"
        title="打开菜单"
      >
        <Menu className="h-5 w-5" />
      </button>
      {mobileOpen ? (
        <div className="home-mobile-overlay" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      ) : null}
      <aside className={`home-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="home-sidebar-header">
          <Link
            href="/"
            className="home-new-chat"
            title="新建视频速览"
            onClick={() => setMobileOpen(false)}
          >
            <MessageSquarePlus className="h-5 w-5" />
            <span>新建速览</span>
          </Link>
        </div>

      <div className="home-sidebar-body">
        <div className="home-sidebar-section">
          <p className="home-sidebar-section-title">最近速览</p>
          <div className="home-sidebar-list">
            {archives.length === 0 ? (
              <div className="home-sidebar-empty">
                <Clapperboard className="h-4 w-4" />
                <span>还没有视频速览</span>
              </div>
            ) : (
              archives.map((archive) => {
                const selected = archive.id === activeArchiveId;
                return (
                  <div
                    key={archive.id}
                    className={`home-sidebar-item ${selected ? "active" : ""}`}
                  >
                    <Link
                      href={`/v/${archive.id}`}
                      className="home-sidebar-item-link"
                      title={getArchiveTitle(archive)}
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="home-sidebar-item-title">
                        {getArchiveTitle(archive)}
                      </span>
                      <span className="home-sidebar-item-meta">
                        {archive.platform} · {formatRelativeTime(archive.createdAt)}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={(event) => handleDelete(archive, event)}
                      className="home-sidebar-item-delete"
                      aria-label="删除归档"
                      title="删除归档"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="home-sidebar-footer">
        <button
          type="button"
          onClick={() => {
            cycleTheme();
          }}
          className="home-sidebar-footer-btn"
          aria-label="切换主题"
          title="切换主题"
        >
          {themeIcon}
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileOpen(false);
            handleLogout();
          }}
          className="home-sidebar-footer-btn"
          aria-label="退出登录"
          title="退出登录"
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileOpen(false);
            router.push("/video-brief");
          }}
          className="home-sidebar-user"
          title={currentUser.email}
        >
          <span className="home-sidebar-avatar">{initials}</span>
          <span className="home-sidebar-user-name">{currentUser.email}</span>
        </button>
      </div>
    </aside>
    </>
  );
}
