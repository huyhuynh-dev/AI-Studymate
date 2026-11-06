"use client";

import React, { useState } from "react";
import { Sparkles, PlayingCards, FileQuestion } from "lucide-react";

export type TabKey = "documents" | "summary" | "flashcard" | "quiz";

export interface TabItem {
    id: TabKey;
    label: string;
    badge?: string;
    disabled?: boolean;
}

export interface ConversationHeaderTabsProps {
    /** Tab hiện tại đang được chọn (nếu dùng dạng controlled) */
    activeTab?: TabKey;
    /** Callback khi người dùng chuyển tab */
    onTabChange?: (tabId: TabKey) => void;
    /** Class tùy chọn cho container ngoài cùng */
    className?: string;
}

/** Icon tài liệu (PDF) phong cách Apple với vector sắc sảo */
function DocumentPdfSolidIcon({ isActive = false }: { isActive?: boolean }) {
    const fillColor = isActive ? "currentColor" : "currentColor";

    return (
        <svg
            className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                isActive
                    ? "text-[#4F46E5] dark:text-[#818CF8]"
                    : "text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300"
            }`}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path
                d="M4 4C4 2.89543 4.89543 2 6 2H14L20 8V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V4Z"
                fill={fillColor}
                fillOpacity={isActive ? "0.9" : "0.75"}
            />
            <path
                d="M14 2V7C14 7.55228 14.4477 8 15 8H20"
                fill={fillColor}
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
                y1="16.5"
                x2="14"
                y2="16.5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
}

export default function ConversationHeaderTabs({
    activeTab: controlledActiveTab,
    onTabChange,
    className = "",
}: ConversationHeaderTabsProps) {
    const [internalActiveTab, setInternalActiveTab] = useState<TabKey>("documents");

    const currentTab = controlledActiveTab ?? internalActiveTab;

    const handleTabClick = (tabId: TabKey) => {
        if (controlledActiveTab === undefined) {
            setInternalActiveTab(tabId);
        }
        onTabChange?.(tabId);
    };

    const tabs: TabItem[] = [
        {
            id: "documents",
            label: "Tài liệu",
        },
        {
            id: "summary",
            label: "Tóm tắt AI",
            badge: "Sắp có",
        },
        {
            id: "flashcard",
            label: "Flashcard",
        },
        {
            id: "quiz",
            label: "Quiz / Trắc nghiệm",
        },
    ];

    const renderIcon = (tabId: TabKey, isActive: boolean) => {
        const iconClasses = `h-4.5 w-4.5 shrink-0 transition-colors ${
            isActive
                ? "text-[#4F46E5] dark:text-[#818CF8]"
                : "text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300"
        }`;

        switch (tabId) {
            case "documents":
                return <DocumentPdfSolidIcon isActive={isActive} />;
            case "summary":
                return <Sparkles className={iconClasses} />;
            case "flashcard":
                return <PlayingCards className={iconClasses} />;
            case "quiz":
                return <FileQuestion className={iconClasses} />;
            default:
                return null;
        }
    };

    return (
        <div
            className={`w-full rounded-t-[20px] sm:rounded-t-[24px] border-b border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#12151C] px-3 sm:px-6 select-none ${className}`}
        >
            <nav
                className="flex items-center gap-2 sm:gap-6 overflow-x-auto scrollbar-none"
                aria-label="Conversation Header Tabs"
            >
                {tabs.map((tab) => {
                    const isActive = currentTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleTabClick(tab.id)}
                            className={`group relative flex items-center gap-2 px-3 py-3.5 text-sm sm:text-[14.5px] font-medium whitespace-nowrap transition-all duration-200 rounded-t-xl cursor-pointer ${
                                isActive
                                    ? "text-[#4F46E5] dark:text-[#818CF8] font-semibold"
                                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                            }`}
                        >
                            {/* Tab Icon */}
                            {renderIcon(tab.id, isActive)}

                            {/* Tab Label */}
                            <span>{tab.label}</span>

                            {/* Apple Capsule Badge (e.g. Sắp có) */}
                            {tab.badge && (
                                <span className="ml-0.5 inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/50 dark:border-indigo-800/40 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                                    {tab.badge}
                                </span>
                            )}

                            {/* Apple Active Indicator: pill underline cong mềm mại */}
                            {isActive && (
                                <span className="absolute -bottom-px left-2 right-2 h-[2.5px] rounded-full bg-[#4F46E5] dark:bg-[#818CF8] shadow-[0_1px_4px_rgba(79,70,229,0.3)] dark:shadow-[0_1px_6px_rgba(129,140,248,0.4)]" />
                            )}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
