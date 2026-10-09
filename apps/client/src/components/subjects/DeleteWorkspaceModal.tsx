"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Trash2, X, Loader2 } from "lucide-react";

export interface DeleteWorkspaceModalProps {
  isOpen: boolean;
  subject: {
    id: string;
    name: string;
  } | null;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export default function DeleteWorkspaceModal({
  isOpen,
  subject,
  onClose,
  onConfirm,
}: DeleteWorkspaceModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (isDeleting) return;
    setError(null);
    onClose();
  }, [isDeleting, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isDeleting) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDeleting, handleClose]);

  if (!isOpen || !subject) return null;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      await onConfirm();
      handleClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể xóa không gian học tập. Vui lòng thử lại sau."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
        aria-hidden="true"
        onClick={handleClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-md transform rounded-2xl bg-white p-6 shadow-2xl transition-all border border-gray-100 z-10">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shadow-2xs shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Xác nhận xóa không gian
              </h3>
              <p className="text-xs text-gray-500">
                Hành động này không thể hoàn tác
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isDeleting}
            onClick={handleClose}
            aria-label="Đóng modal"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed">
            Bạn có chắc chắn muốn xóa không gian học tập{" "}
            <span className="font-semibold text-gray-900 break-words">
              &ldquo;{subject.name}&rdquo;
            </span>
            ? Mọi tài liệu và dữ liệu liên quan sẽ bị loại bỏ khỏi không gian này.
          </p>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-gray-100">
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleClose}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDelete}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Đang xóa...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Xác nhận xóa</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
