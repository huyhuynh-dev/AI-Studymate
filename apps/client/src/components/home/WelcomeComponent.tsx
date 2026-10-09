"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSubjects } from "@/hooks/useSubjects";
import CreateWorkspaceModal from "./CreateWorkspaceModal";

export interface WelcomeComponentProps {
    /**
     * Callback tùy chọn khi người dùng bấm nút tạo không gian học tập.
     * Nếu không truyền, component sẽ tự mở CreateWorkspaceModal mặc định.
     */
    onCreateWorkspace?: () => void;
    /** Class tùy chọn cho container bên ngoài */
    className?: string;
}

export default function WelcomeComponent({
    onCreateWorkspace,
    className = "",
}: WelcomeComponentProps) {
    const router = useRouter();
    const { createSubject } = useSubjects();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleClick = () => {
        if (onCreateWorkspace) {
            onCreateWorkspace();
        } else {
            setIsModalOpen(true);
        }
    };

    const handleWorkspaceCreated = async (data: { name: string; color: string }) => {
        try {
            const created = await createSubject(data);
            setIsModalOpen(false);
            if (created?.id) {
                router.push(`/home/${created.id}`);
            }
        } catch (err) {
            console.error("Lỗi khi tạo không gian học tập:", err);
        }
    };

    return (
        <>
            <div
                className={`flex w-full max-w-2xl flex-col items-center justify-center rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-xs transition-all sm:p-12 sm:shadow-sm ${className}`}
            >
                {/* Minh họa đồ họa trung tâm */}
                <div className="relative mb-6 flex items-center justify-center sm:mb-8">
                    <svg
                        className="h-44 w-44 sm:h-52 sm:w-52 select-none"
                        viewBox="0 0 200 200"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                    >
                        {/* Vòng tròn nền pastel xanh tím nhạt */}
                        <circle cx="100" cy="100" r="72" fill="#F0F4FF" />

                        {/* Các hạt bong bóng trang trí mờ nhẹ */}
                        <circle cx="152" cy="44" r="5" fill="#C7D2FE" opacity="0.85" />
                        <circle cx="44" cy="116" r="4.5" fill="#A5B4FC" opacity="0.85" />
                        <circle cx="100" cy="154" r="3" fill="#818CF8" opacity="0.9" />

                        {/* Ngôi sao lấp lánh màu hồng (bên trái) */}
                        <path
                            d="M42 50 C42 56 46 60 52 60 C46 60 42 64 42 70 C42 64 38 60 32 60 C38 60 42 56 42 50 Z"
                            fill="#F43F5E"
                        />

                        {/* Ngôi sao lấp lánh màu tím xanh (bên phải) */}
                        <path
                            d="M162 62 C162 68 166 72 172 72 C166 72 162 76 162 82 C162 76 158 72 152 72 C158 72 162 68 162 62 Z"
                            fill="#6366F1"
                        />

                        {/* Lá cờ xanh lá cắm trên màn hình */}
                        <line
                            x1="126"
                            y1="44"
                            x2="126"
                            y2="24"
                            stroke="#10B981"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                        />
                        <circle cx="126" cy="23" r="2.5" fill="#10B981" />
                        <path d="M126 25 L144 32 L126 39 Z" fill="#10B981" />

                        {/* Màn hình máy tính / thiết bị học tập */}
                        <rect
                            x="67"
                            y="38"
                            width="66"
                            height="48"
                            rx="8"
                            fill="#FFFFFF"
                            stroke="#312E81"
                            strokeWidth="3.5"
                        />
                        {/* Vùng hiển thị màn hình bên trong */}
                        <rect x="71" y="42" width="58" height="40" rx="5" fill="#F8FAFC" />

                        {/* Biểu tượng huy hiệu tròn ở trung tâm màn hình */}
                        <circle
                            cx="100"
                            cy="62"
                            r="11"
                            fill="#EEF2FF"
                            stroke="#4F46E5"
                            strokeWidth="2"
                        />
                        {/* Dấu cộng / biểu tượng AI */}
                        <path
                            d="M100 57 V67 M95 62 H105"
                            stroke="#4F46E5"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                        />

                        {/* Các tầng đế xếp tầng dưới máy tính */}
                        {/* Tầng trên (tím sáng) */}
                        <rect x="68" y="86" width="64" height="10" rx="5" fill="#6366F1" />
                        {/* Tầng giữa (xanh tím) */}
                        <rect x="60" y="96" width="80" height="12" rx="6" fill="#4F46E5" />
                        {/* Tầng đáy (xanh navy đậm) */}
                        <rect x="52" y="108" width="96" height="14" rx="7" fill="#1E1B4B" />

                        {/* Bóng mờ bên dưới đế */}
                        <ellipse cx="100" cy="130" rx="34" ry="4" fill="#C7D2FE" opacity="0.6" />
                    </svg>
                </div>

                {/* Tiêu đề chính */}
                <h2 className="mb-3 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                    Bạn chưa có Không gian học tập nào
                </h2>

                {/* Mô tả phụ */}
                <p className="mb-8 max-w-lg text-sm leading-relaxed text-gray-500 sm:text-base">
                    Hãy tạo một không gian mới để bắt đầu thêm tài liệu, học Flashcard và trò chuyện cùng AI.
                </p>

                {/* Nút bấm Tạo Không gian học tập đầu tiên */}
                <button
                    type="button"
                    onClick={handleClick}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:bg-indigo-700 hover:shadow-indigo-500/35 active:scale-98 sm:text-base"
                >
                    <Plus className="h-5 w-5 stroke-[2.5]" />
                    <span>Tạo Không gian học tập đầu tiên</span>
                    {/* Biểu tượng ngôi sao 4 cánh */}
                    <svg
                        className="h-4 w-4 fill-white"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                    </svg>
                </button>
            </div>

            {/* Modal tạo không gian học tập dự phòng nếu không truyền callback */}
            {!onCreateWorkspace && (
                <CreateWorkspaceModal
                    isOpen={isModalOpen}
                    mode="create"
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleWorkspaceCreated}
                />
            )}
        </>
    );
}

export { WelcomeComponent };
