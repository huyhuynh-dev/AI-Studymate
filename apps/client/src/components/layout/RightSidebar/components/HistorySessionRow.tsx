"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Loader2, MessageSquare, Pencil, Trash2, X } from "lucide-react";
import type { ChatSessionItem } from "../types";

/** Giới hạn cột title trong DB là VarChar(255); giữ ngắn hơn cho dễ đọc */
const MAX_TITLE_LENGTH = 100;

interface HistorySessionRowProps {
  session: ChatSessionItem;
  isActive: boolean;
  onSelect: () => void;
  /** Ném lỗi nếu đổi tên thất bại – dòng sẽ giữ nguyên chế độ sửa và báo lỗi */
  onRename: (newTitle: string) => Promise<void>;
  onRequestDelete: () => void;
}

function RowAction({
  label,
  danger = false,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg text-[#777587] transition-colors focus-visible:outline-2 focus-visible:outline-[#4F46E5] ${
        danger
          ? "hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400"
          : "hover:bg-white dark:hover:bg-[#12151C] hover:text-[#4F46E5] dark:hover:text-[#818CF8]"
      }`}
    >
      {children}
    </button>
  );
}

export function HistorySessionRow({
  session,
  isActive,
  onSelect,
  onRename,
  onRequestDelete,
}: HistorySessionRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(session.title);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Chặn lưu hai lần (Enter rồi blur) hoặc lưu sau khi đã hủy bằng Esc */
  const settledRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const startEditing = () => {
    settledRef.current = false;
    setDraft(session.title);
    setError(null);
    setIsEditing(true);
  };

  const cancel = () => {
    settledRef.current = true;
    setIsEditing(false);
    setError(null);
  };

  const commit = async () => {
    if (settledRef.current) return;
    const next = draft.trim();
    if (!next || next === session.title) {
      cancel();
      return;
    }

    settledRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await onRename(next);
      setIsEditing(false);
    } catch {
      settledRef.current = false;
      setError("Không thể đổi tên. Vui lòng thử lại.");
      inputRef.current?.focus();
    } finally {
      setIsSaving(false);
    }
  };

  // ── Chế độ sửa tên ──
  if (isEditing) {
    return (
      <div className="rounded-xl bg-[#EEF2FF] dark:bg-white/[0.06] px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            value={draft}
            maxLength={MAX_TITLE_LENGTH}
            readOnly={isSaving}
            aria-label="Tên đoạn chat"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void commit()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void commit();
              } else if (e.key === "Escape") {
                e.stopPropagation();
                cancel();
              }
            }}
            className="h-8 min-w-0 flex-1 rounded-lg border border-[#C7D2FE] bg-white dark:bg-[#12151C] px-2.5 text-[13px] text-[#0B1C30] dark:text-white outline-none ring-2 ring-[#4F46E5]/10"
          />

          {isSaving ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#4F46E5]" />
          ) : (
            <>
              <button
                type="button"
                aria-label="Lưu tên mới"
                title="Lưu (Enter)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void commit()}
                className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#4F46E5] text-white transition-colors hover:bg-[#3525CD]"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Hủy"
                title="Hủy (Esc)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={cancel}
                className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#777587] transition-colors hover:bg-white dark:hover:bg-[#12151C] hover:text-[#0B1C30] dark:hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="px-1 pt-1.5 text-[11px] text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  // ── Chế độ xem ──
  return (
    <div
      className={`group flex items-center rounded-xl transition-colors ${
        isActive
          ? "bg-[#EEF2FF] dark:bg-[#4F46E5]/20"
          : "hover:bg-[#F8F9FF] dark:hover:bg-white/[0.04] focus-within:bg-[#F8F9FF]"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-xl py-2 pl-2.5 pr-1 text-left ${
          isActive
            ? "text-[#4F46E5] dark:text-[#818CF8] font-bold"
            : "text-[#464555] dark:text-[#EFF0F6] font-medium"
        }`}
      >
        <MessageSquare
          className={`h-4 w-4 shrink-0 ${
            isActive ? "text-[#4F46E5] dark:text-[#818CF8]" : "text-[#777587]"
          }`}
        />
        <span className="min-w-0 flex-1 truncate text-[13px]" title={session.title}>
          {session.title}
        </span>
      </button>

      {/* Cột phải cố định bề rộng */}
      <div className="flex h-8 w-16 shrink-0 items-center justify-end pr-1.5">
        <span className="truncate text-[10px] text-[#777587] group-hover:hidden group-focus-within:hidden [@media(pointer:coarse)]:hidden">
          {session.timestamp}
        </span>
        <div className="hidden items-center gap-0.5 group-hover:flex group-focus-within:flex [@media(pointer:coarse)]:flex">
          <RowAction label="Đổi tên" onClick={startEditing}>
            <Pencil className="h-3.5 w-3.5" />
          </RowAction>
          <RowAction label="Xóa đoạn chat" danger onClick={onRequestDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </RowAction>
        </div>
      </div>
    </div>
  );
}
