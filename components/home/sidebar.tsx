"use client";

import { useEffect, useMemo, useState } from "react";
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
import { BrandMark } from "@/components/brand/brand-logo";
import { useAppTheme, type ThemeMode } from "@/components/layout/app-theme-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatRelativeTime } from "@/lib/client/date";
import { readJson } from "@/lib/client/api";
import type { SerializedVideoBriefArchive } from "@/types/video-brief";

function getArchiveTitle(archive: SerializedVideoBriefArchive) {
  return archive.title || archive.canonicalUrl || archive.sourceUrl;
}

interface HomeSidebarProps {
  archives: SerializedVideoBriefArchive[];
  activeArchiveId?: string;
}

export function HomeSidebar({
  archives,
  activeArchiveId,
}: HomeSidebarProps) {
  const router = useRouter();
  const { themeMode, setThemeMode } = useAppTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SerializedVideoBriefArchive | null>(null);
  const [deleting, setDeleting] = useState(false);
  // 相对时间依赖当前时间和本地时区，只能在浏览器端算，否则服务端/客户端渲染不一致会触发水合错误
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  function handleDelete(
    archive: SerializedVideoBriefArchive,
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    event.preventDefault();
    event.stopPropagation();
    setDeleteTarget(archive);
  }

  async function confirmDelete() {
    const archive = deleteTarget;
    if (!archive || deleting) {
      return;
    }
    setDeleting(true);
    try {
      const response = await fetch(`/api/video-brief/archives/${archive.id}`, { method: "DELETE" });
      await readJson(response);
      router.refresh();
      if (activeArchiveId === archive.id) {
        router.push("/");
      }
    } catch {
      router.refresh();
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

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
          <div className="home-brand">
            <BrandMark className="h-7 w-7 text-[var(--va-fg)]" />
            <span className="home-brand-name">视频速览</span>
          </div>
          <Link
            href="/"
            className="home-new-chat"
            title="新建视频速览"
            onClick={() => setMobileOpen(false)}
          >
            <MessageSquarePlus className="h-4 w-4" />
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
                          {mounted
                            ? `${archive.platform} · ${formatRelativeTime(archive.createdAt)}`
                            : archive.platform}
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
        </div>
      </aside>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除视频归档</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{deleteTarget ? getArchiveTitle(deleteTarget) : ""}」吗？删除后无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
            >
              {deleting ? "删除中…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
