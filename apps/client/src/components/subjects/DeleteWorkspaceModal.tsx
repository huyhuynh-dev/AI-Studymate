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
      {/* Apple Translucent Dimming Backdrop */}
      <div
        className="fixed inset-0 bg-[#0B1C30]/40 backdrop-blur-md transition-opacity duration-200"
        aria-hidden="true"
        onClick={handleClose}
      />

      {/* Modal Dialog Surface */}
      <div className="relative w-full max-w-md transform rounded-[22px] bg-white dark:bg-[#12151C] p-6 shadow-2xl transition-all border border-[#E5EEFF] dark:border-white/[0.12] z-10 select-none">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#E5EEFF] dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-[#BA1A1A] dark:text-[#EF4444] shrink-0 shadow-2xs">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-heading text-[#0B1C30] dark:text-white tracking-tight">
                Xác nhận xóa không gian
              </h3>
              <p className="text-xs text-[#777587] dark:text-neutral-400">
                Hành động này không thể hoàn tác
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isDeleting}
            onClick={handleClose}
            aria-label="Đóng"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F8F9FF] dark:bg-white/[0.08] text-[#777587] hover:text-[#0B1C30] dark:hover:text-white transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-3">
          <p className="text-sm text-[#464555] dark:text-neutral-300 leading-relaxed">
            Bạn có chắc chắn muốn xóa không gian học tập{" "}
            <span className="font-bold text-[#0B1C30] dark:text-white break-words">
              &ldquo;{subject.name}&rdquo;
            </span>
            ? Mọi tài liệu và ghi chú liên quan sẽ bị xóa vĩnh viễn khỏi không gian này.
          </p>

          {error && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/20 p-3 text-xs text-[#BA1A1A] dark:text-rose-400">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-[#E5EEFF] dark:border-white/[0.08]">
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-[#464555] dark:text-neutral-300 bg-[#F8F9FF] dark:bg-white/[0.06] hover:bg-[#E5EEFF] dark:hover:bg-white/[0.1] active:scale-98 transition-all cursor-pointer disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#BA1A1A] hover:bg-[#93000A] px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed active:scale-98 transition-all cursor-pointer"
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
