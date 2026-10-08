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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4">
      {/* 
        Container Modal - Không đóng khi bấm ra ngoài backdrop 
      */}
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200"
        role="alertdialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-red-50 text-red-600 shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                Xóa phiên học
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Hành động này không thể hoàn tác
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="px-6 py-2">
          <p className="text-sm text-gray-600 leading-relaxed">
            Bạn có chắc chắn muốn xóa phiên học{" "}
            {conversationTitle ? (
              <span className="font-semibold text-gray-900">
                &ldquo;{conversationTitle}&rdquo;
              </span>
            ) : (
              "này"
            )}
            ? Tất cả tin nhắn và tài liệu liên quan sẽ bị xóa vĩnh viễn khỏi danh sách.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 mt-4 bg-gray-50/80 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200/70 active:bg-gray-200 rounded-xl transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Xác nhận xóa</span>
          </button>
        </div>
      </div>
    </div>
  );
}
