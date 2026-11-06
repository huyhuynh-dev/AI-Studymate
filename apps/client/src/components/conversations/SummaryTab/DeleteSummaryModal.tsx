"use client";

import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

export interface DeleteSummaryModalProps {
  isOpen: boolean;
  summaryTitle?: string;
  onClose: () => void;
  onConfirm?: () => void;
}

export default function DeleteSummaryModal({
  isOpen,
  summaryTitle,
  onClose,
  onConfirm,
}: DeleteSummaryModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-[22px] bg-white dark:bg-[#161922] shadow-2xl border border-black/[0.06] dark:border-white/[0.1] overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 select-none"
        role="alertdialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="flex items-center justify-center w-11 h-11 rounded-[14px] bg-rose-500/10 dark:bg-rose-500/20 text-[#BA1A1A] dark:text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
                Xóa bản tóm tắt
              </h2>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                Hành động này không thể hoàn tác
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-full transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="px-6 py-2">
          <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
            Bạn có chắc chắn muốn xóa bản tóm tắt{" "}
            {summaryTitle ? (
              <span className="font-semibold text-neutral-900 dark:text-white">
                &ldquo;{summaryTitle}&rdquo;
              </span>
            ) : (
              "này"
            )}
            ? Toàn bộ ghi chú, cấu trúc và định dạng của bản tóm tắt này sẽ bị xóa khỏi cuộc trò chuyện.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 mt-4 bg-neutral-50/80 dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-white/[0.06] active:scale-95 rounded-xl transition-all cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-4.5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#BA1A1A] hover:bg-[#9B1313] dark:bg-rose-600 dark:hover:bg-rose-700 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Xác nhận xóa</span>
          </button>
        </div>
      </div>
    </div>
  );
}
