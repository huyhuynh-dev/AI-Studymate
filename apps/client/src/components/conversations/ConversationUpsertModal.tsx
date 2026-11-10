"use client";

import React, { useState, useEffect } from "react";
import { X, BookOpen, Sparkles } from "lucide-react";

export interface ConversationUpsertModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  initialTitle?: string;
  onClose: () => void;
  onSubmit?: (title: string) => void;
}

export default function ConversationUpsertModal({
  isOpen,
  mode,
  initialTitle = "",
  onClose,
  onSubmit,
}: ConversationUpsertModalProps) {
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(initialTitle);
  }, [initialTitle, isOpen]);

  if (!isOpen) return null;

  const isCreate = mode === "create";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit?.(title.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Apple Translucent Dimming Backdrop */}
      <div
        className="fixed inset-0 bg-[#0B1C30]/40 backdrop-blur-md transition-opacity duration-200"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Modal Dialog Surface */}
      <div
        className="relative w-full max-w-md transform rounded-[22px] bg-white dark:bg-[#12151C] p-6 shadow-2xl transition-all border border-[#E5EEFF] dark:border-white/[0.12] z-10 select-none"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5EEFF] dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#EEF2FF] dark:bg-white/[0.06] text-[#4F46E5] dark:text-[#818CF8] shrink-0">
              {isCreate ? (
                <Sparkles className="w-5 h-5 stroke-[1.8]" />
              ) : (
                <BookOpen className="w-5 h-5 stroke-[1.8]" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0B1C30] dark:text-[#EFF0F6] leading-tight">
                {isCreate ? "Tạo phiên học mới" : "Chỉnh sửa phiên học"}
              </h2>
              <p className="text-xs text-[#777587] dark:text-neutral-400 mt-0.5">
                {isCreate
                  ? "Nhập chủ đề hoặc nội dung bạn muốn học cùng AI"
                  : "Cập nhật tiêu đề phiên học của bạn"}
              </p>
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F8F9FF] dark:bg-white/[0.08] text-[#777587] hover:text-[#0B1C30] dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="session-title"
              className="block text-[11px] font-semibold text-[#777587] dark:text-neutral-400 uppercase tracking-wider"
            >
              Tên phiên học <span className="text-[#BA1A1A]">*</span>
            </label>
            <input
              id="session-title"
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Ôn tập Cấu trúc Dữ liệu, Luyện thi IELTS..."
              className="w-full rounded-xl border border-[#C7C4D8] dark:border-white/[0.1] bg-[#F8F9FF] dark:bg-white/[0.03] px-3.5 py-2.5 text-sm text-[#0B1C30] dark:text-white placeholder-[#777587] outline-none hover:bg-white focus:bg-white dark:focus:bg-black focus:border-[#4F46E5] focus:ring-3 focus:ring-[#4F46E5]/15 transition-all"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#E5EEFF] dark:border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-[#464555] dark:text-neutral-300 bg-[#F8F9FF] dark:bg-white/[0.06] hover:bg-[#E5EEFF] dark:hover:bg-white/[0.1] active:scale-98 transition-all cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] hover:bg-[#3525CD] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#4F46E5]/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-98 transition-all cursor-pointer"
            >
              {isCreate ? "Tạo phiên học" : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
