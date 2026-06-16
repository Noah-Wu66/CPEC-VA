"use client";

import { useAppTheme, type ThemeMode } from "@/components/layout/app-theme-provider";
import { LogoutButton } from "@/components/layout/logout-button";
import { BrandMark } from "@/components/brand/brand-logo";
import { APP_NAME } from "@/lib/constants";
import { formatRoleLabel } from "@/lib/labels";
import type { Role } from "@/types/domain";
import { Moon, Sun, Monitor } from "lucide-react";

interface TopbarProps {
  email: string;
  role: Role;
}

export function Topbar({ email, role }: TopbarProps) {
  const { themeMode, setThemeMode } = useAppTheme();

  function cycleTheme() {
    const modes: ThemeMode[] = ["light", "dark", "system"];
    const currentIndex = modes.indexOf(themeMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setThemeMode(nextMode);
  }

  const themeIcon = themeMode === "light"
    ? <Sun className="h-4 w-4" />
    : themeMode === "dark"
      ? <Moon className="h-4 w-4" />
      : <Monitor className="h-4 w-4" />;
  const themeTitle = themeMode === "light" ? "浅色模式（点击切换）" : themeMode === "dark" ? "深色模式（点击切换）" : "跟随系统（点击切换）";

  return (
    <header className="app-topbar">
      <div className="app-topbar-brand">
        <BrandMark />
        <span className="app-topbar-name">{APP_NAME}</span>
      </div>

      <div className="app-topbar-actions">
        <button
          type="button"
          className="app-theme-toggle"
          aria-label={themeTitle}
          title={themeTitle}
          onClick={cycleTheme}
        >
          {themeIcon}
        </button>

        <div className="app-topbar-user">
          <span className="app-topbar-user-email" title={email}>{email}</span>
          <span className="app-topbar-user-role">{formatRoleLabel(role)}</span>
        </div>

        <LogoutButton />
      </div>
    </header>
  );
}
