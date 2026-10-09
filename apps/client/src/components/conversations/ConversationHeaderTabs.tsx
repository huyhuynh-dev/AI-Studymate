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

/** Icon tài liệu (PDF) dạng filled màu Indigo với các đường sọc trắng như trong thiết kế */
function DocumentPdfSolidIcon({ isActive = false }: { isActive?: boolean }) {
    const fillColor = isActive ? "#4F46E5" : "#6B7280";
    const foldColor = isActive ? "#3730A3" : "#4B5563";

    return (
        <svg
            className="h-4.5 w-4.5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path
                d="M4 4C4 2.89543 4.89543 2 6 2H14L20 8V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V4Z"
                fill={fillColor}
            />
            <path
                d="M14 2V7C14 7.55228 14.4477 8 15 8H20"
                fill={foldColor}
                opacity="0.4"
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
            label: "Tài liệu (PDF)",
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
        switch (tabId) {
            case "documents":
                return <DocumentPdfSolidIcon isActive={isActive} />;
            case "summary":
                return (
                    <Sparkles
                        className={`h-4.5 w-4.5 shrink-0 transition-colors ${isActive ? "text-[#4F46E5]" : "text-gray-700"
                            }`}
                    />
                );
            case "flashcard":
                return (
                    <PlayingCards
                        className={`h-4.5 w-4.5 shrink-0 transition-colors ${isActive ? "text-[#4F46E5]" : "text-gray-700"
                            }`}
                    />
                );
            case "quiz":
                return (
                    <FileQuestion
                        className={`h-4.5 w-4.5 shrink-0 transition-colors ${isActive ? "text-[#4F46E5]" : "text-gray-700"
                            }`}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div
            className={`w-full rounded-t-2xl sm:rounded-t-3xl border-b border-gray-100 bg-white px-4 sm:px-6 select-none ${className}`}
        >
            <nav
                className="flex items-center gap-6 sm:gap-8 overflow-x-auto scrollbar-none"
                aria-label="Conversation Header Tabs"
            >
                {tabs.map((tab) => {
                    const isActive = currentTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleTabClick(tab.id)}
                            className={`group relative flex items-center gap-2 py-3.5 text-sm sm:text-[15px] font-medium whitespace-nowrap transition-colors cursor-pointer ${isActive
                                    ? "text-[#4F46E5] font-semibold"
                                    : "text-gray-700 hover:text-gray-900"
                                }`}
                        >
                            {/* Tab Icon */}
                            {renderIcon(tab.id, isActive)}

                            {/* Tab Label */}
                            <span>{tab.label}</span>

                            {/* Badge (e.g. Sắp có) */}
                            {tab.badge && (
                                <span className="ml-1 inline-flex items-center rounded-full bg-[#EBF0FD] px-2 py-0.5 text-xs font-normal text-[#4F46E5]">
                                    {tab.badge}
                                </span>
                            )}

                            {/* Active Indicator Underline */}
                            {isActive && (
                                <span className="absolute -bottom-px left-0 right-0 h-[2.5px] rounded-full bg-[#4F46E5]" />
                            )}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
