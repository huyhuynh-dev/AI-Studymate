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
    setTitle(initialTitle);
  }, [initialTitle, isOpen]);

  if (!isOpen) return null;

  const isCreate = mode === "create";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(title.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4">
      {/* 
        Container Modal - Không đóng khi bấm ra ngoài backdrop 
      */}
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
              {isCreate ? (
                <Sparkles className="w-5 h-5" />
              ) : (
                <BookOpen className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                {isCreate ? "Tạo phiên học mới" : "Chỉnh sửa phiên học"}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {isCreate
                  ? "Nhập chủ đề hoặc tên nội dung bạn muốn học"
                  : "Cập nhật tiêu đề phiên học của bạn"}
              </p>
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label
                htmlFor="session-title"
                className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2"
              >
                Tên phiên học
              </label>
              <input
                id="session-title"
                type="text"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Cấu trúc Dữ liệu & Giải thuật nâng cao..."
                className="w-full px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 bg-gray-50/60 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50/80 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200/70 active:bg-gray-200 rounded-xl transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#4845E4] hover:bg-[#3d3bc9] active:bg-[#3432b3] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isCreate ? "Tạo phiên học" : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
