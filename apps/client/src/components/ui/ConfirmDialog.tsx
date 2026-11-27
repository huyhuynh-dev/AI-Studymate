"use client";

import React, { useId, useRef, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { ModalFooter, ModalHeader, ModalShell } from "./ModalShell";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  description: React.ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

/**
 * Hộp thoại xác nhận hành động quan trọng hoặc không thể hoàn tác.
 * Mặc định đặt focus vào nút Hủy để tránh người dùng vô ý nhấn Enter.
 */
export function ConfirmDialog({
  isOpen,
  title,
  subtitle = "Hành động này không thể hoàn tác",
  description,
  confirmLabel = "Xác nhận xóa",
  pendingLabel = "Đang xóa…",
  cancelLabel = "Hủy",
  tone = "danger",
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  const handleClose = () => {
    if (isPending) return;
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    try {
      setIsPending(true);
      setError(null);
      await onConfirm();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể hoàn tất thao tác. Vui lòng thử lại."
      );
    } finally {
      setIsPending(false);
    }
  };

  const confirmButtonClass =
    tone === "danger"
      ? "bg-[#BA1A1A] hover:bg-[#93000A] focus-visible:outline-[#BA1A1A]"
      : "bg-[#4F46E5] hover:bg-[#3525CD] focus-visible:outline-[#4F46E5]";

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      role="alertdialog"
      size="md"
      disableDismiss={isPending}
      initialFocusRef={cancelRef}
      labelledBy={titleId}
      describedBy={descId}
    >
      <ModalHeader
        titleId={titleId}
        title={title}
        subtitle={subtitle}
        icon={<AlertTriangle className="h-5 w-5" />}
        iconClassName={
          tone === "danger"
            ? "bg-rose-50 dark:bg-rose-950/40 text-[#BA1A1A] dark:text-[#F87171] shadow-2xs"
            : "bg-[#EEF2FF] dark:bg-white/[0.06] text-[#4F46E5] dark:text-[#818CF8]"
        }
        onClose={handleClose}
        closeDisabled={isPending}
      />

      <div className="mt-4 space-y-3">
        <p
          id={descId}
          className="text-sm text-[#464555] dark:text-neutral-300 leading-relaxed"
        >
          {description}
        </p>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 p-3 text-xs text-[#BA1A1A] dark:text-[#F87171]"
          >
            {error}
          </div>
        ) : null}
      </div>

      <ModalFooter>
        <button
          ref={cancelRef}
          type="button"
          disabled={isPending}
          onClick={handleClose}
          className="rounded-xl px-4 py-2 text-xs font-semibold text-[#464555] dark:text-neutral-300 bg-[#F8F9FF] dark:bg-white/[0.06] hover:bg-[#E5EEFF] dark:hover:bg-white/[0.1] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5] transition-[background-color,transform] duration-150 motion-reduce:transition-none cursor-pointer disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => void handleConfirm()}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 transition-[background-color,transform] duration-150 motion-reduce:transition-none cursor-pointer ${confirmButtonClass}`}
        >
          {isPending ? (
            <>
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
              <span>{pendingLabel}</span>
            </>
          ) : (
            <>
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              <span>{error ? "Thử lại" : confirmLabel}</span>
            </>
          )}
        </button>
      </ModalFooter>
    </ModalShell>
  );
}
