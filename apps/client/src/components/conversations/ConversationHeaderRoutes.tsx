"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";
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
            className={`flex flex-wrap items-center gap-2.5 sm:gap-3 text-sm select-none ${className}`}
        >
            {/* Nút Quay lại */}
            <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-xs transition-all hover:bg-gray-50 hover:text-gray-900 active:scale-[0.98] cursor-pointer"
            >
                <ArrowLeft className="h-4 w-4 text-gray-700" />
                <span>Quay lại</span>
            </button>

            {/* Dấu phân cách 1 */}
            <span className="text-gray-300 font-light" aria-hidden="true">
                /
            </span>

            {/* Tên môn học */}
            {subjectHref ? (
                <Link
                    href={subjectHref}
                    className="font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                    {subjectName}
                </Link>
            ) : (
                <span className="font-medium text-gray-700">{subjectName}</span>
            )}

            {/* Dấu phân cách 2 */}
            <span className="text-gray-300 font-light" aria-hidden="true">
                /
            </span>

            {/* Tiêu đề phiên học */}
            <span className="font-semibold text-gray-900">{sessionTitle}</span>

            {/* Huy hiệu trạng thái (e.g. Phiên mới) */}
            {badgeText && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#A7F3D0]/70 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
                    <span>{badgeText}</span>
                </div>
            )}
        </div>
    );
}
