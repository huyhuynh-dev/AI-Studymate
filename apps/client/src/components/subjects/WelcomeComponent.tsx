"use client";

import React, { useState } from "react";
import { Plus, FolderPlus, BookOpen, Brain } from "lucide-react";
import { StudyMateAiIcon } from "@/components/ui/StudyMateAiIcon";
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
    await createSubject(data);
    setIsModalOpen(false);
  };

  return (
    <>
      <div
        className={`relative flex w-full max-w-xl flex-col items-center justify-center rounded-[24px] border border-[#E5EEFF] dark:border-white/[0.08] bg-white dark:bg-[#12151C] p-7 text-center shadow-[0_8px_32px_-8px_rgba(11,28,48,0.06),0_1px_3px_rgba(11,28,48,0.03)] dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.5)] sm:p-11 ${className}`.trim()}
      >
        {/* Spatial Glyph Lockup */}
        <div className="relative mb-6 flex items-center justify-center">
          <div
            className="absolute -inset-4 rounded-full bg-[#4F46E5]/10 dark:bg-[#4F46E5]/15 blur-2xl -z-10 pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative flex h-20 w-20 items-center justify-center rounded-[22px] bg-gradient-to-b from-[#EEF2FF] to-[#E0E7FF] dark:from-[#4F46E5]/20 dark:to-[#4F46E5]/5 border border-[#C7D2FE]/70 dark:border-[#4F46E5]/30 shadow-md shadow-[#4F46E5]/10 dark:shadow-black/30 ring-4 ring-[#4F46E5]/5 dark:ring-[#4F46E5]/10 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 motion-reduce:transform-none">
            <FolderPlus
              aria-hidden="true"
              className="h-9 w-9 text-[#4F46E5] dark:text-[#818CF8]"
              strokeWidth={1.6}
            />
          </div>
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-2xl sm:text-[26px] font-bold font-heading tracking-[-0.025em] text-[#0B1C30] dark:text-[#EFF0F6] leading-tight text-balance">
          Bạn chưa có không gian học tập nào
        </h1>

        <p className="mt-2.5 max-w-md text-sm sm:text-[15px] leading-relaxed text-[#464555] dark:text-[#9DA3AF]">
          Tạo không gian cho từng môn học để lưu trữ giáo trình, tạo bộ thẻ
          Flashcard thông minh và trò chuyện ôn luyện cùng trợ lý AI.
        </p>

        {/* Primary CTA */}
        <div className="mt-7">
          <button
            type="button"
            onClick={handleClick}
            className="inline-flex items-center justify-center gap-2 h-12 px-6 sm:px-7 rounded-xl bg-[#4F46E5] hover:bg-[#3525CD] active:bg-[#312E81] text-white font-semibold text-sm sm:text-[15px] tracking-[-0.01em] shadow-[0_2px_8px_rgba(79,70,229,0.25)] transition-[background-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5] select-none"
          >
            <Plus aria-hidden="true" className="h-4.5 w-4.5" strokeWidth={2.2} />
            <span>Tạo không gian học tập đầu tiên</span>
          </button>
        </div>

        {/* Value Proposition Micro-Pills */}
        <div className="mt-8 pt-6 border-t border-[#F0F4FF] dark:border-white/[0.06] w-full flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F9FF] dark:bg-white/[0.04] border border-[#E5EEFF] dark:border-white/[0.08] text-xs font-medium text-[#464555] dark:text-[#9DA3AF]">
            <BookOpen aria-hidden="true" className="h-3.5 w-3.5 text-[#4F46E5] dark:text-[#818CF8]" strokeWidth={1.8} />
            <span>Quản lý giáo trình</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F9FF] dark:bg-white/[0.04] border border-[#E5EEFF] dark:border-white/[0.08] text-xs font-medium text-[#464555] dark:text-[#9DA3AF]">
            <Brain aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.8} />
            <span>Flashcard thông minh</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F9FF] dark:bg-white/[0.04] border border-[#E5EEFF] dark:border-white/[0.08] text-xs font-medium text-[#464555] dark:text-[#9DA3AF]">
            <StudyMateAiIcon variant="simple" className="h-3.5 w-3.5 text-amber-500" />
            <span>Trợ lý AI hỏi đáp</span>
          </span>
        </div>
      </div>

      {!onCreateWorkspace ? (
        <CreateWorkspaceModal
          isOpen={isModalOpen}
          mode="create"
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleWorkspaceCreated}
        />
      ) : null}
    </>
  );
}

export { WelcomeComponent };
