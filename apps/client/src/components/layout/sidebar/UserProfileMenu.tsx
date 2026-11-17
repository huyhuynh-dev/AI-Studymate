"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowUp,
  BarChart3,
  HelpCircle,
  Loader2,
  LogOut,
  Settings,
  User,
} from "lucide-react";

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
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div
      ref={containerRef}
      className="relative border-t border-[#E5EEFF] dark:border-white/[0.08] pt-3 px-1 shrink-0"
    >
      {/* Upward Apple Liquid Glass Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-label="Menu tài khoản và cài đặt"
          className="apple-liquid-glass absolute bottom-full left-0 right-0 mb-2 z-50 rounded-2xl p-1.5 shadow-xl shadow-[#0B1C30]/10 dark:shadow-black/40 animate-in fade-in-50 slide-in-from-bottom-2 duration-150 motion-reduce:animate-none select-none"
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
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[0.8125rem] font-medium text-[#464555] dark:text-neutral-200 hover:bg-[#EEF2FF] dark:hover:bg-white/[0.08] hover:text-[#3525CD] dark:hover:text-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[#4F46E5] transition-all motion-reduce:transition-none cursor-pointer"
              >
                <Settings className="h-4 w-4 shrink-0 text-[#777587] dark:text-neutral-400" />
                <span>Cài đặt</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleMenuAction("profile")}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[0.8125rem] font-medium text-[#464555] dark:text-neutral-200 hover:bg-[#EEF2FF] dark:hover:bg-white/[0.08] hover:text-[#3525CD] dark:hover:text-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[#4F46E5] transition-all motion-reduce:transition-none cursor-pointer"
              >
                <User className="h-4 w-4 shrink-0 text-[#777587] dark:text-neutral-400" />
                <span>Hồ sơ</span>
              </button>
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
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[0.8125rem] font-medium text-[#464555] dark:text-neutral-200 hover:bg-[#EEF2FF] dark:hover:bg-white/[0.08] hover:text-[#3525CD] dark:hover:text-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[#4F46E5] transition-all motion-reduce:transition-none cursor-pointer"
              >
                <ArrowUp className="h-4 w-4 shrink-0 text-[#777587] dark:text-neutral-400" />
                <span>Nâng cấp</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleMenuAction("usage")}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[0.8125rem] font-medium text-[#464555] dark:text-neutral-200 hover:bg-[#EEF2FF] dark:hover:bg-white/[0.08] hover:text-[#3525CD] dark:hover:text-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[#4F46E5] transition-all motion-reduce:transition-none cursor-pointer"
              >
                <BarChart3 className="h-4 w-4 shrink-0 text-[#777587] dark:text-neutral-400" />
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
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[0.8125rem] font-medium text-[#464555] dark:text-neutral-200 hover:bg-[#EEF2FF] dark:hover:bg-white/[0.08] hover:text-[#3525CD] dark:hover:text-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[#4F46E5] transition-all motion-reduce:transition-none cursor-pointer"
              >
                <HelpCircle className="h-4 w-4 shrink-0 text-[#777587] dark:text-neutral-400" />
                <span>Hỗ trợ</span>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={isLoggingOut}
                onClick={handleLogoutClick}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[0.8125rem] font-medium text-[#BA1A1A] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-rose-500 transition-all motion-reduce:transition-none cursor-pointer"
              >
                {isLoggingOut ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4 shrink-0" />
                )}
                <span>{isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trigger Area: Avatar + Name & Email */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Mở menu hồ sơ và cài đặt tài khoản"
        className={`flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition-all motion-reduce:transition-none active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-[#4F46E5] focus-visible:outline-offset-2 cursor-pointer ${
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
