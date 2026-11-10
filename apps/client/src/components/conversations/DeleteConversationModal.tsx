"use client";

import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

export interface DeleteConversationModalProps {
  isOpen: boolean;
  conversationTitle?: string;
  onClose: () => void;
  onConfirm?: () => void;
}

export default function DeleteConversationModal({
  isOpen,
  conversationTitle,
  onClose,
  onConfirm,
}: DeleteConversationModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm?.();
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
        role="alertdialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#E5EEFF] dark:border-white/[0.08]">
          <div className="flex items-center gap-3.5">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-50 text-[#BA1A1A] dark:text-[#EF4444] shrink-0 shadow-2xs">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0B1C30] dark:text-[#EFF0F6] leading-tight">
                Xóa phiên học
              </h2>
              <p className="text-xs text-[#777587] dark:text-neutral-400 mt-0.5">
                Hành động này không thể hoàn tác
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F8F9FF] dark:bg-white/[0.08] text-[#777587] hover:text-[#0B1C30] dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="mt-4 space-y-3">
          <p className="text-sm text-[#464555] dark:text-neutral-300 leading-relaxed">
            Bạn có chắc chắn muốn xóa phiên học{" "}
            {conversationTitle ? (
              <span className="font-bold text-[#0B1C30] dark:text-white break-words">
                &ldquo;{conversationTitle}&rdquo;
              </span>
            ) : (
              "này"
            )}
            ? Tất cả tin nhắn và tài liệu liên quan sẽ bị xóa vĩnh viễn khỏi danh sách.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-[#E5EEFF] dark:border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-[#464555] dark:text-neutral-300 bg-[#F8F9FF] dark:bg-white/[0.06] hover:bg-[#E5EEFF] dark:hover:bg-white/[0.1] active:scale-98 transition-all cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#BA1A1A] hover:bg-[#93000A] px-4 py-2 text-xs font-semibold text-white shadow-xs active:scale-98 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xác nhận xóa</span>
          </button>
        </div>
      </div>
    </div>
  );
}
