"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Search, Timer, Bell } from "lucide-react";

export interface HomeHeaderProps {
    /** User display information */
    user?: {
        name?: string;
        avatarUrl?: string;
    };
    /** Focus timer display text, default: '25:00' */
    focusTime?: string;
    /** Whether the user has unread notifications */
    hasNotifications?: boolean;
    /** Callback when search value changes */
    onSearch?: (query: string) => void;
    /** Callback when focus timer button is clicked */
    onFocusClick?: () => void;
    /** Callback when notification bell is clicked */
    onNotificationClick?: () => void;
    /** Callback when user avatar is clicked */
    onProfileClick?: () => void;
    /** Additional custom container CSS classes */
    className?: string;
}

export default function HomeHeader({
    user = {
        name: "User",
        avatarUrl:
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    },
    focusTime = "25:00",
    hasNotifications = true,
    onSearch,
    onFocusClick,
    onNotificationClick,
    onProfileClick,
    className = "",
}: HomeHeaderProps) {
    const [searchValue, setSearchValue] = useState("");

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchValue(value);
        onSearch?.(value);
    };

    return (
        <header
            className={`sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-gray-100 bg-white/95 px-4 sm:px-6 backdrop-blur-md transition-colors ${className}`.trim()}
        >
            {/* ── Left: Logo & Plan Badge ── */}
            <div className="flex items-center gap-3 shrink-0">
                <Link href="/" className="flex items-center gap-2.5 group">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition-transform group-hover:scale-105">
                        <BookOpen className="h-5 w-5" />
                    </div>
                    <span className="text-base sm:text-lg font-bold tracking-tight text-gray-900 group-hover:text-indigo-600 transition-colors">
                        AI StudyMate
                    </span>
                </Link>

                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 border border-indigo-100/80">
                    Pro v2.4
                </span>
            </div>

            {/* ── Center: Search Bar ── */}
            <div className="hidden md:flex flex-1 max-w-xl mx-6">
                <div className="relative w-full">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                        <Search className="h-4 w-4" />
                    </div>
                    <input
                        type="text"
                        value={searchValue}
                        onChange={handleSearchChange}
                        placeholder="Tìm kiếm giáo trình, flashcards, đề thi... (⌘K)"
                        className="w-full rounded-xl border border-transparent bg-slate-100/80 py-2 pl-10 pr-4 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all hover:bg-slate-100 focus:border-indigo-300 focus:bg-white focus:ring-3 focus:ring-indigo-500/10"
                    />
                </div>
            </div>

            {/* ── Right: Focus Timer, Notifications & Profile ── */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                {/* Focus Timer Button */}
                <button
                    type="button"
                    onClick={onFocusClick}
                    className="flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50/50 px-3 py-1.5 text-xs sm:text-sm font-medium text-emerald-800 shadow-2xs hover:bg-emerald-100/70 hover:border-emerald-300 transition-all cursor-pointer"
                >
                    <Timer className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Tập trung: {focusTime}</span>
                </button>

                {/* Notification Bell */}
                <button
                    type="button"
                    onClick={onNotificationClick}
                    aria-label="Thông báo"
                    className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer"
                >
                    <Bell className="h-5 w-5" />
                    {hasNotifications && (
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-600 ring-2 ring-white" />
                    )}
                </button>

                {/* User Avatar */}
                <button
                    type="button"
                    onClick={onProfileClick}
                    aria-label="Tài khoản cá nhân"
                    className="relative flex items-center justify-center rounded-full ring-2 ring-transparent hover:ring-indigo-500/20 transition-all cursor-pointer"
                >
                    <div className="relative h-9 w-9 overflow-hidden rounded-full border border-gray-200 shadow-2xs">
                        <Image
                            src={user.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                            alt={user.name || "User Avatar"}
                            width={36}
                            height={36}
                            unoptimized
                            className="h-full w-full object-cover"
                        />
                    </div>
                </button>
            </div>
        </header>
    );
}

export { HomeHeader };

