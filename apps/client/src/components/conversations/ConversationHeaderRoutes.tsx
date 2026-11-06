"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface ConversationHeaderRoutesProps {
    /** Callback khi bấm nút "Quay lại". Nếu không truyền, mặc định sẽ gọi router.back() hoặc chuyển về backHref */
    onBack?: () => void;
    /** Đường dẫn quay lại mặc định nếu không truyền onBack */
    backHref?: string;
    /** Tên môn học / không gian học tập (mặc định: "Cấu Trúc Dữ Liệu") */
    subjectName?: string;
    /** Đường dẫn tới môn học nếu muốn bấm vào tên môn học */
    subjectHref?: string;
    /** Tiêu đề phiên học hiện tại (mặc định: "Phiên học mới") */
    sessionTitle?: string;
    /** Nội dung nhãn trạng thái (mặc định: "Phiên mới") */
    badgeText?: string;
    /** Class tùy chọn cho container ngoài cùng */
    className?: string;
}

export default function ConversationHeaderRoutes({
    onBack,
    backHref,
    subjectName = "Cấu Trúc Dữ Liệu",
    subjectHref,
    sessionTitle = "Phiên học mới",
    badgeText = "Phiên mới",
    className = "",
}: ConversationHeaderRoutesProps) {
    const router = useRouter();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else if (backHref) {
            router.push(backHref);
        } else {
            router.back();
        }
    };

    return (
        <div
            className={`flex flex-wrap items-center gap-2 sm:gap-2.5 text-sm select-none ${className}`}
        >
            {/* Nút Quay lại phong cách Apple Navigation Bar */}
            <button
                type="button"
                onClick={handleBack}
                aria-label="Quay lại"
                className="group inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#12151C]/80 backdrop-blur-md px-3 py-1.5 text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 shadow-2xs transition-all duration-200 hover:bg-neutral-100/80 dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-white active:scale-95 cursor-pointer"
            >
                <ChevronLeft className="h-4 w-4 text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200 transition-colors" />
                <span>Quay lại</span>
            </button>

            {/* Dấu phân cách Apple Chevron */}
            <ChevronRight className="h-3.5 w-3.5 text-neutral-300 dark:text-neutral-600 shrink-0" aria-hidden="true" />

            {/* Tên môn học / Không gian học tập */}
            {subjectHref ? (
                <Link
                    href={subjectHref}
                    className="font-medium text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate max-w-[140px] sm:max-w-[200px]"
                >
                    {subjectName}
                </Link>
            ) : (
                <span className="font-medium text-neutral-600 dark:text-neutral-400 truncate max-w-[140px] sm:max-w-[200px]">
                    {subjectName}
                </span>
            )}

            {/* Dấu phân cách Apple Chevron */}
            <ChevronRight className="h-3.5 w-3.5 text-neutral-300 dark:text-neutral-600 shrink-0" aria-hidden="true" />

            {/* Tiêu đề phiên học */}
            <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[160px] sm:max-w-[280px]">
                {sessionTitle}
            </span>

            {/* Huy hiệu trạng thái Apple Capsule Pill */}
            {badgeText && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                    <span>{badgeText}</span>
                </div>
            )}
        </div>
    );
}
