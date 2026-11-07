"use client";

import React, { useState } from "react";
import { Sparkles, PlayingCards, FileQuestion } from "lucide-react";

export type TabKey = "documents" | "summary" | "flashcard" | "quiz";

export interface TabConfig<T extends string = TabKey> {
  id: T;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
  disabled?: boolean;
  tooltip?: string;
}

export interface ConversationHeaderTabsProps {
  /** Tab hiện tại đang được chọn (Controlled) */
  activeTab?: TabKey;
  /** Callback khi người dùng chuyển tab */
  onTabChange?: (tabId: TabKey) => void;
  /** Danh sách cấu hình các Tab (Tùy chọn, mặc định sử dụng DEFAULT_TABS_CONFIG) */
  tabs?: TabConfig<TabKey>[];
  /** Class tùy chọn cho container ngoài cùng */
  className?: string;
}

/** Icon tài liệu phong cách Apple Vector */
function DocumentPdfIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4 4C4 2.89543 4.89543 2 6 2H14L20 8V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V4Z"
        fill="currentColor"
        fillOpacity="0.8"
      />
      <path
        d="M14 2V7C14 7.55228 14.4477 8 15 8H20"
        fill="currentColor"
        fillOpacity="0.4"
      />
      <line
        x1="7.5"
        y1="12"
        x2="16.5"
        y2="12"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="7.5"
        y1="16"
        x2="14"
        y2="16"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Cấu hình mặc định cho các Tab trong Conversation Workspace */
export const DEFAULT_TABS_CONFIG: TabConfig<TabKey>[] = [
  {
    id: "documents",
    label: "Tài liệu",
    shortLabel: "Tài liệu",
    icon: DocumentPdfIcon,
    tooltip: "Tài liệu học tập & Đính kèm",
  },
  {
    id: "summary",
    label: "Tóm tắt",
    shortLabel: "Tóm tắt",
    icon: Sparkles,
    badge: (
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
    ),
    tooltip: "Bản tóm tắt bài giảng AI",
  },
  {
    id: "flashcard",
    label: "Flashcard",
    shortLabel: "Thẻ nhớ",
    icon: PlayingCards,
    tooltip: "Ôn tập qua thẻ ghi nhớ",
  },
  {
    id: "quiz",
    label: "Trắc nghiệm",
    shortLabel: "Quiz",
    icon: FileQuestion,
    tooltip: "Kiểm tra kiến thức trắc nghiệm",
  },
];

export default function ConversationHeaderTabs({
  activeTab: controlledActiveTab,
  onTabChange,
  tabs = DEFAULT_TABS_CONFIG,
  className = "",
}: ConversationHeaderTabsProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<TabKey>("documents");

  const currentTab = controlledActiveTab ?? internalActiveTab;

  const handleTabClick = (tabId: TabKey, disabled?: boolean) => {
    if (disabled) return;
    if (controlledActiveTab === undefined) {
      setInternalActiveTab(tabId);
    }
    onTabChange?.(tabId);
  };

  return (
    <nav
      className={`w-full bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] select-none ${className}`}
      aria-label="Conversation Segmented Tabs"
    >
      <div className="flex items-center gap-1 w-full">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              disabled={tab.disabled}
              onClick={() => handleTabClick(tab.id, tab.disabled)}
              title={tab.tooltip || tab.label}
              className={`group relative flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-1.5 sm:px-3 text-xs sm:text-[13.5px] font-medium rounded-xl transition-all duration-200 cursor-pointer ${
                tab.disabled
                  ? "opacity-40 pointer-events-none"
                  : isActive
                    ? "bg-white dark:bg-[#1E2330] text-[#4F46E5] dark:text-[#818CF8] font-semibold shadow-xs"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
              }`}
            >
              {/* Tab Icon */}
              <Icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isActive
                    ? "text-[#4F46E5] dark:text-[#818CF8]"
                    : "text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300"
                }`}
              />

              {/* Responsive Tab Label */}
              <span className="truncate hidden sm:inline">{tab.label}</span>
              <span className="truncate sm:hidden">{tab.shortLabel || tab.label}</span>

              {/* Optional Mini Status Badge */}
              {tab.badge && (
                <span className="shrink-0 flex items-center">{tab.badge}</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
