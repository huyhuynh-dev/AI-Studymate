"use client";

import React, { useState } from "react";
import { Plus, FolderPlus, BookOpen, Brain, Sparkles } from "lucide-react";
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
        className={`relative flex w-full max-w-xl flex-col items-center justify-center rounded-[28px] border border-[#E5EEFF] dark:border-white/[0.08] bg-white/90 dark:bg-[#12151C]/90 backdrop-blur-xl p-8 text-center shadow-[0_8px_32px_-8px_rgba(11,28,48,0.06),0_1px_3px_rgba(11,28,48,0.03)] dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.5)] transition-all sm:p-12 select-none ${className}`}
      >
        {/* ── Apple Spatial Glyph Lockup ── */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Ambient Diffused Glow */}
          <div
            className="absolute -inset-4 rounded-full bg-[#4F46E5]/10 dark:bg-[#4F46E5]/15 blur-2xl -z-10 pointer-events-none"
            aria-hidden="true"
          />

          {/* Squircle Icon Container with Concentric G2 Curve & Specular Top Hairline */}
          <div className="relative flex h-20 w-20 sm:h-22 sm:w-22 items-center justify-center rounded-[24px] sm:rounded-[26px] bg-gradient-to-b from-[#EEF2FF] to-[#E0E7FF] dark:from-[#4F46E5]/20 dark:to-[#4F46E5]/5 border border-[#C7D2FE]/70 dark:border-[#4F46E5]/30 shadow-md shadow-[#4F46E5]/10 dark:shadow-black/30 shadow-[inset_0px_1px_0px_rgba(255,255,255,0.8)] dark:shadow-[inset_0px_1px_0px_rgba(255,255,255,0.15)] ring-4 ring-[#4F46E5]/5 dark:ring-[#4F46E5]/10 apple-spring hover:scale-105">
            <FolderPlus
              className="h-9 w-9 sm:h-10 sm:w-10 text-[#4F46E5] dark:text-[#818CF8]"
              strokeWidth={1.6}
            />
          </div>
        </div>

        {/* ── Title & Subtitle with Optical Sizing ── */}
        <h2 className="text-2xl sm:text-[26px] font-bold tracking-[-0.025em] text-[#0B1C30] dark:text-[#EFF0F6] leading-tight">
          Bạn chưa có không gian học tập nào
        </h2>

        <p className="mt-2.5 max-w-md text-sm sm:text-[15px] leading-relaxed text-[#464555] dark:text-[#9DA3AF]">
          Tạo không gian cho từng môn học để lưu trữ giáo trình, tạo bộ thẻ
          Flashcard thông minh và trò chuyện ôn luyện cùng trợ lý AI.
        </p>

        {/* ── The 1 Primary CTA Button (borderedProminent Apple HIG standard) ── */}
        <div className="mt-7">
          <button
            type="button"
            onClick={handleClick}
            className="inline-flex items-center justify-center gap-2 h-12 px-6 sm:px-7 rounded-xl bg-[#4F46E5] hover:bg-[#3525CD] active:bg-[#312E81] text-white font-semibold text-[14px] sm:text-[15px] tracking-[-0.01em] shadow-[0_2px_8px_rgba(79,70,229,0.25)] shadow-[inset_0px_1px_0px_rgba(255,255,255,0.22)] apple-spring active:scale-[0.985] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/50 focus-visible:ring-offset-2"
          >
            <Plus className="h-4.5 w-4.5" strokeWidth={2.2} />
            <span>Tạo Không gian học tập đầu tiên</span>
          </button>
        </div>

        {/* ── Deferent Value Proposition Micro-Pills ── */}
        <div className="mt-8 pt-6 border-t border-[#F0F4FF] dark:border-white/[0.06] w-full flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F9FF] dark:bg-white/[0.04] border border-[#E5EEFF] dark:border-white/[0.08] text-[11px] font-medium text-[#464555] dark:text-[#9DA3AF]">
            <BookOpen className="h-3.5 w-3.5 text-[#4F46E5] dark:text-[#818CF8]" strokeWidth={1.8} />
            <span>Quản lý giáo trình</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F9FF] dark:bg-white/[0.04] border border-[#E5EEFF] dark:border-white/[0.08] text-[11px] font-medium text-[#464555] dark:text-[#9DA3AF]">
            <Brain className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.8} />
            <span>Flashcard thông minh</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F9FF] dark:bg-white/[0.04] border border-[#E5EEFF] dark:border-white/[0.08] text-[11px] font-medium text-[#464555] dark:text-[#9DA3AF]">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" strokeWidth={1.8} />
            <span>Trợ lý AI hỏi đáp</span>
          </span>
        </div>
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
