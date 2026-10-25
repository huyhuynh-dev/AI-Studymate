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
  // key theo id → mỗi lần mở là một state mới (không dính lỗi / trạng thái đang xóa của lần trước)
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in-50 duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-desc"
        className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <Trash2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3
              id="confirm-delete-title"
              className="text-sm font-semibold text-gray-900"
            >
              Xóa đoạn chat này?
            </h3>
            <p
              id="confirm-delete-desc"
              className="mt-1 text-xs leading-relaxed text-gray-500"
            >
              <span className="font-medium text-gray-800 wrap-break-word">
                “{session.title}”
              </span>{" "}
              sẽ bị xóa vĩnh viễn cùng toàn bộ tin nhắn trong đoạn chat. Hành
              động này không thể hoàn tác. Tài liệu và tóm tắt của bạn không bị
              ảnh hưởng.
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="cursor-pointer rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isDeleting}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isDeleting ? "Đang xóa…" : error ? "Thử lại" : "Xóa đoạn chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
