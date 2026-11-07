"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import type { ChatSessionItem } from "../types";

interface ConfirmDeleteDialogProps {
  /** null = đóng hộp thoại */
  session: ChatSessionItem | null;
  onCancel: () => void;
  /** Ném lỗi nếu xóa thất bại – hộp thoại giữ nguyên và báo lỗi */
  onConfirm: () => Promise<void>;
}

export function ConfirmDeleteDialog({
  session,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  if (!session) return null;
  return (
    <DialogBody
      key={session.id}
      session={session}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function DialogBody({
  session,
  onCancel,
  onConfirm,
}: Omit<ConfirmDeleteDialogProps, "session"> & { session: ChatSessionItem }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Mặc định focus vào "Hủy" để tránh lỡ tay nhấn Enter xóa
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDeleting, onCancel]);

  const handleConfirm = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError("Không thể xóa đoạn chat. Vui lòng thử lại.");
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1C30]/40 backdrop-blur-md p-4 animate-in fade-in-50 duration-150 select-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-desc"
        className="w-full max-w-sm rounded-[22px] border border-[#E5EEFF] dark:border-white/[0.12] bg-white dark:bg-[#12151C] p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/40 text-[#BA1A1A] dark:text-rose-400 shadow-2xs">
            <Trash2 className="h-5 w-5 stroke-[2]" />
          </span>
          <div className="min-w-0">
            <h3
              id="confirm-delete-title"
              className="text-base font-bold text-[#0B1C30] dark:text-[#EFF0F6] tracking-tight"
            >
              Xóa đoạn chat này?
            </h3>
            <p
              id="confirm-delete-desc"
              className="mt-1 text-xs leading-relaxed text-[#777587] dark:text-[#9DA3AF]"
            >
              <span className="font-bold text-[#0B1C30] dark:text-white wrap-break-word">
                “{session.title}”
              </span>{" "}
              sẽ bị xóa vĩnh viễn cùng toàn bộ tin nhắn. Hành động này không thể hoàn tác.
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 px-3 py-2 text-xs text-[#BA1A1A] dark:text-rose-400">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2.5 pt-2 border-t border-[#E5EEFF] dark:border-white/[0.08]">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="cursor-pointer rounded-xl border border-[#E5EEFF] dark:border-white/[0.1] bg-[#F8F9FF] dark:bg-white/[0.06] px-4 py-2 text-xs font-semibold text-[#464555] dark:text-neutral-300 transition-colors hover:bg-[#E5EEFF] dark:hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isDeleting}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#BA1A1A] hover:bg-[#93000A] px-4 py-2 text-xs font-semibold text-white transition-all shadow-xs disabled:cursor-not-allowed disabled:opacity-70 active:scale-98"
          >
            {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isDeleting ? "Đang xóa…" : error ? "Thử lại" : "Xóa đoạn chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
