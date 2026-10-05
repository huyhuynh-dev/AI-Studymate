"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  FolderPlus,
  Flame,
  Folder,
  FolderOpen,
  FileText,
  Code2,
  FileQuestion,
  Settings,
  PanelLeftClose,
} from "lucide-react";

export interface LeftSidebarProps {
  /** User information for profile card at bottom */
  user?: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  /** Consecutive study streak in days */
  streakDays?: number;
  /** Experience points gained */
  xp?: number;
  /** Weekly memorization progress */
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  /** Active selected document ID */
  activeDocId?: string;
  /** Whether the sidebar is collapsed */
  isCollapsed?: boolean;
  /** Callback to toggle collapse */
  onToggleCollapse?: () => void;
  /** Callback when user selects a document */
  onSelectDocument?: (id: string) => void;
  /** Callback when new folder icon is clicked */
  onNewFolder?: () => void;
  /** Callback when settings icon is clicked */
  onSettingsClick?: () => void;
  /** Additional container classes */
  className?: string;
}

export default function LeftSidebar({
  user = {
    name: "Nguyễn Văn A",
    email: "a.nguyen@student.edu.vn",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  },
  streakDays = 14,
  xp = 180,
  progress = {
    current: 42,
    total: 50,
    percentage: 84,
  },
  activeDocId = "doc-1",
  isCollapsed = false,
  onToggleCollapse,
  onSelectDocument,
  onNewFolder,
  onSettingsClick,
  className = "",
}: LeftSidebarProps) {
  const [selectedDoc, setSelectedDoc] = useState(activeDocId);
  const [isCtdlOpen, setIsCtdlOpen] = useState(true);

  const handleDocClick = (id: string) => {
    setSelectedDoc(id);
    onSelectDocument?.(id);
  };

  return (
    <aside
      className={`flex h-full flex-col justify-between border-r border-gray-100 bg-white select-none transition-all duration-300 ease-in-out ${
        isCollapsed
          ? "w-0 p-0 border-r-0 overflow-hidden opacity-0 pointer-events-none"
          : "w-72 p-4 opacity-100"
      } ${className}`.trim()}
    >
      {/* ── Top & Main Content ── */}
      <div className="flex flex-col space-y-4 overflow-y-auto">
        {/* Section Header: Workspace Title + Add Folder + Collapse */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold tracking-wider text-gray-500 uppercase">
            KHÔNG GIAN HỌC TẬP
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onNewFolder}
              aria-label="Thêm thư mục mới"
              title="Thêm thư mục"
              className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Thu gọn sidebar trái"
                title="Thu gọn sidebar"
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Streak & XP Banner ── */}
        <div className="flex items-center justify-between rounded-2xl border border-blue-100/60 bg-blue-50/60 p-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-600 shadow-2xs">
              <Flame className="h-5 w-5 fill-emerald-500 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                Chuỗi {streakDays} ngày
              </p>
              <p className="text-xs text-gray-500">Học tích cực</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-300 px-2.5 py-1 text-xs font-bold text-emerald-950 shadow-2xs">
            +{xp} XP
          </span>
        </div>

        {/* ── Document Folders Section ── */}
        <div className="space-y-2">
          <p className="px-1 text-xs font-bold tracking-wider text-gray-400 uppercase">
            THƯ MỤC TÀI LIỆU
          </p>

          {/* Active Folder: CTDL & Giải thuật */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setIsCtdlOpen(!isCtdlOpen)}
              className="flex w-full items-center justify-between rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                {isCtdlOpen ? (
                  <FolderOpen className="h-4 w-4 shrink-0" />
                ) : (
                  <Folder className="h-4 w-4 shrink-0" />
                )}
                <span className="font-semibold text-xs sm:text-sm">
                  CTDL & Giải thuật
                </span>
              </div>
              <span className="rounded-md bg-indigo-500/70 px-1.5 py-0.5 text-xs font-bold text-white">
                14
              </span>
            </button>

            {/* Folder Sub-items */}
            {isCtdlOpen && (
              <div className="space-y-1 rounded-xl bg-indigo-50/40 p-1.5">
                {/* Item 1: Đồ thị & Cây BST (Active) */}
                <button
                  type="button"
                  onClick={() => handleDocClick("doc-1")}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-all cursor-pointer ${
                    selectedDoc === "doc-1"
                      ? "bg-white shadow-xs border border-gray-100"
                      : "hover:bg-white/60"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText
                      className={`h-4 w-4 shrink-0 ${
                        selectedDoc === "doc-1"
                          ? "text-indigo-600"
                          : "text-gray-500"
                      }`}
                    />
                    <span
                      className={`text-xs font-semibold truncate ${
                        selectedDoc === "doc-1"
                          ? "text-indigo-600"
                          : "text-gray-700"
                      }`}
                    >
                      Đồ thị & Cây BST
                    </span>
                  </div>
                  {selectedDoc === "doc-1" && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-600" />
                  )}
                </button>

                {/* Item 2: Giải thuật tìm kiếm */}
                <button
                  type="button"
                  onClick={() => handleDocClick("doc-2")}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-all cursor-pointer ${
                    selectedDoc === "doc-2"
                      ? "bg-white shadow-xs border border-gray-100"
                      : "hover:bg-white/60"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Code2 className="h-4 w-4 shrink-0 text-gray-500" />
                    <span className="text-xs font-medium text-gray-700 truncate">
                      Giải thuật tìm kiếm
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">4 bài</span>
                </button>

                {/* Item 3: Đề thi giữa kỳ 2023 */}
                <button
                  type="button"
                  onClick={() => handleDocClick("doc-3")}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-all cursor-pointer ${
                    selectedDoc === "doc-3"
                      ? "bg-white shadow-xs border border-gray-100"
                      : "hover:bg-white/60"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileQuestion className="h-4 w-4 shrink-0 text-gray-500" />
                    <span className="text-xs font-medium text-gray-700 truncate">
                      Đề thi giữa kỳ 2023
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase shrink-0">
                    PDF
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Folder 2: Học máy (Machine Learning) */}
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-gray-50 cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Folder className="h-4 w-4 text-purple-600 shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">
                Học máy (Machine Learni...
              </span>
            </div>
            <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 font-medium shrink-0">
              8
            </span>
          </button>

          {/* Folder 3: Tiếng Anh chuyên ngành */}
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-gray-50 cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Folder className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">
                Tiếng Anh chuyên ngành...
              </span>
            </div>
            <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 font-medium shrink-0">
              12
            </span>
          </button>
        </div>

        {/* ── Weekly Goal Progress Card ── */}
        <div className="rounded-2xl border border-blue-100/60 bg-blue-50/50 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-700">
              Chỉ tiêu ghi nhớ tuần
            </span>
            <span className="font-bold text-indigo-600 text-sm">
              {progress.percentage}%
            </span>
          </div>

          <div className="my-2 h-2 w-full overflow-hidden rounded-full bg-indigo-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          <p className="text-xs text-gray-500">
            {progress.current} / {progress.total} khái niệm cốt lõi
          </p>
        </div>
      </div>

      {/* ── Bottom: User Profile & Settings ── */}
      <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-gray-200 shadow-2xs">
            <Image
              src={
                user.avatarUrl ||
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
              }
              alt={user.name}
              width={36}
              height={36}
              unoptimized
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
              {user.name}
            </p>
            <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSettingsClick}
          aria-label="Cài đặt"
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors cursor-pointer shrink-0"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

export { LeftSidebar };
