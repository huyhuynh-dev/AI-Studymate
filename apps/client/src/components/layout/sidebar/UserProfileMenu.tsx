"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowUp,
  BarChart3,
  HelpCircle,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { useThemePreference } from "@/contexts/ThemePreferenceProvider";
import { usersApi } from "@/services/users.api";
import type { UserThemePreference } from "@/types/user";

export interface UserProfileMenuProps {
  displayName: string;
  displayEmail: string;
  userInitials: string;
  avatarUrl?: string;
  onNavigateProfile: (tab?: string) => void;
  onLogout: () => Promise<void> | void;
}

export default function UserProfileMenu({
  displayName,
  displayEmail,
  userInitials,
  avatarUrl,
  onNavigateProfile,
  onLogout,
}: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { theme, setTheme } = useThemePreference();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const handleThemeSelect = (nextTheme: UserThemePreference) => {
    setTheme(nextTheme);
    void usersApi
      .updateProfile({ preferences: { theme: nextTheme } })
      .catch(() => {});
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = menuRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]:not(:disabled)'
        );
        if (!items || items.length === 0) return;

        e.preventDefault();
        const activeIndex = Array.from(items).indexOf(
          document.activeElement as HTMLButtonElement
        );
        const nextIndex =
          e.key === "ArrowDown"
            ? (activeIndex + 1) % items.length
            : (activeIndex - 1 + items.length) % items.length;
        items[nextIndex]?.focus();
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleMenuAction = (tab?: string) => {
    setIsOpen(false);
    onNavigateProfile(tab);
  };

  const handleLogoutClick = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await onLogout();
      setIsOpen(false);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const menuItemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[0.8125rem] font-medium text-[#464555] dark:text-neutral-200 hover:bg-[#EEF2FF] dark:hover:bg-white/[0.08] hover:text-[#3525CD] dark:hover:text-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[#4F46E5] transition-[color,background-color,transform] duration-150 motion-reduce:transition-none cursor-pointer";

  return (
    <div
      ref={containerRef}
      className="relative border-t border-[#E5EEFF] dark:border-white/[0.08] pt-3 px-1 shrink-0"
    >
      {/* Upward Apple Liquid Glass Dropdown Menu */}
      <div
        ref={menuRef}
        role="menu"
        aria-label="Menu tài khoản và cài đặt"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`apple-liquid-glass absolute bottom-full left-0 right-0 mb-2 z-50 rounded-2xl p-1.5 shadow-xl shadow-[#0B1C30]/10 dark:shadow-black/40 select-none origin-bottom transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          isOpen
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
            : "opacity-0 translate-y-1.5 scale-[0.98] pointer-events-none"
        }`}
      >
            {/* Nhóm 1: Chung */}
            <div className="px-2 pt-1 pb-1">
              <p className="px-1.5 pb-1 text-[0.6875rem] font-semibold tracking-wider text-[#777587] dark:text-neutral-400 uppercase">
                Chung
              </p>
              <div className="space-y-0.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleMenuAction("settings")}
                  className={menuItemClass}
                >
                  <Settings
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-[#777587] dark:text-neutral-400"
                  />
                  <span>Cài đặt</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleMenuAction("profile")}
                  className={menuItemClass}
                >
                  <User
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-[#777587] dark:text-neutral-400"
                  />
                  <span>Hồ sơ</span>
                </button>
              </div>
            </div>

            {/* Nhóm 1.5: Giao diện */}
            <div className="my-1 border-t border-[#E5EEFF] dark:border-white/[0.08]" />
            <div className="px-2 py-1">
              <p className="px-1.5 pb-1 text-[0.6875rem] font-semibold tracking-wider text-[#777587] dark:text-neutral-400 uppercase">
                Giao diện
              </p>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#F4F6FF] dark:bg-white/[0.05] p-1">
                {(
                  [
                    { id: "light", label: "Sáng", icon: Sun },
                    { id: "dark", label: "Tối", icon: Moon },
                    { id: "system", label: "Hệ thống", icon: Monitor },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = theme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleThemeSelect(item.id)}
                      className={`flex items-center justify-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                        active
                          ? "bg-white dark:bg-[#1E2330] text-[#4F46E5] dark:text-[#818CF8] shadow-2xs"
                          : "text-[#777587] dark:text-neutral-400 hover:text-[#0B1C30] dark:hover:text-white"
                      }`}
                    >
                      <Icon className="h-3 w-3 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="my-1 border-t border-[#E5EEFF] dark:border-white/[0.08]" />

            {/* Nhóm 2: Gói & Sử dụng */}
            <div className="px-2 py-1">
              <p className="px-1.5 pb-1 text-[0.6875rem] font-semibold tracking-wider text-[#777587] dark:text-neutral-400 uppercase">
                Gói &amp; Sử dụng
              </p>
              <div className="space-y-0.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleMenuAction("upgrade")}
                  className={menuItemClass}
                >
                  <ArrowUp
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-[#777587] dark:text-neutral-400"
                  />
                  <span>Nâng cấp</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleMenuAction("usage")}
                  className={menuItemClass}
                >
                  <BarChart3
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-[#777587] dark:text-neutral-400"
                  />
                  <span>Mức sử dụng</span>
                </button>
              </div>
            </div>

            <div className="my-1 border-t border-[#E5EEFF] dark:border-white/[0.08]" />

            {/* Nhóm 3: Khác */}
            <div className="px-2 pt-1 pb-1">
              <p className="px-1.5 pb-1 text-[0.6875rem] font-semibold tracking-wider text-[#777587] dark:text-neutral-400 uppercase">
                Khác
              </p>
              <div className="space-y-0.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleMenuAction("support")}
                  className={menuItemClass}
                >
                  <HelpCircle
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-[#777587] dark:text-neutral-400"
                  />
                  <span>Hỗ trợ</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={isLoggingOut}
                  onClick={handleLogoutClick}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[0.8125rem] font-medium text-[#BA1A1A] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-rose-500 transition-[color,background-color,transform] duration-150 motion-reduce:transition-none cursor-pointer"
                >
                  {isLoggingOut ? (
                    <Loader2
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 animate-spin"
                    />
                  ) : (
                    <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
                  )}
                  <span>
                    {isLoggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
                  </span>
                </button>
              </div>
            </div>
          </div>

      {/* Trigger Area: Avatar + Name & Email */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Mở menu hồ sơ và cài đặt tài khoản"
        className={`flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition-[background-color,transform] duration-150 motion-reduce:transition-none active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-[#4F46E5] focus-visible:outline-offset-2 cursor-pointer ${
          isOpen
            ? "bg-[#EEF2FF]/80 dark:bg-white/[0.08]"
            : "hover:bg-[#F8F9FF] dark:hover:bg-white/[0.04]"
        }`}
      >
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E5EEFF] dark:border-white/[0.1] bg-gradient-to-br from-indigo-500 to-violet-600 text-[0.6875rem] font-bold text-white">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={32}
              height={32}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{userInitials}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.8125rem] font-semibold font-heading text-[#0B1C30] dark:text-neutral-100 truncate leading-snug">
            {displayName}
          </p>
          <p className="text-[0.6875rem] text-[#777587] dark:text-neutral-400 truncate leading-snug">
            {displayEmail}
          </p>
        </div>
      </button>
    </div>
  );
}
