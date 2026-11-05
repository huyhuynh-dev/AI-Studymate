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
      className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${
        danger
          ? "hover:bg-rose-50 hover:text-rose-600"
          : "hover:bg-white hover:text-indigo-600"
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
      <div className="rounded-xl bg-indigo-50/60 px-2 py-1.5">
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
                e.stopPropagation(); // chỉ hủy sửa, không đóng cả popover
                cancel();
              }
            }}
            className="h-8 min-w-0 flex-1 rounded-lg border border-indigo-300 bg-white px-2.5 text-[13px] text-gray-900 outline-none ring-2 ring-indigo-500/10"
          />

          {/* onMouseDown preventDefault: giữ focus ở ô nhập để không kích hoạt blur */}
          {isSaving ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-600" />
          ) : (
            <>
              <button
                type="button"
                aria-label="Lưu tên mới"
                title="Lưu (Enter)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void commit()}
                className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-700"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Hủy"
                title="Hủy (Esc)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={cancel}
                className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white hover:text-gray-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="px-1 pt-1.5 text-[11px] text-rose-600">
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
        isActive ? "bg-indigo-50" : "hover:bg-gray-50 focus-within:bg-gray-50"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-xl py-2 pl-2.5 pr-1 text-left ${
          isActive ? "text-indigo-900" : "text-gray-700"
        }`}
      >
        <MessageSquare
          className={`h-4 w-4 shrink-0 ${
            isActive ? "text-indigo-600" : "text-gray-400"
          }`}
        />
        <span className="min-w-0 flex-1 truncate text-[13px]" title={session.title}>
          {session.title}
        </span>
      </button>

      {/* Cột phải cố định bề rộng: giờ ↔ nút thao tác (hover/focus; luôn hiện trên màn hình cảm ứng) */}
      <div className="flex h-8 w-16 shrink-0 items-center justify-end pr-1.5">
        <span className="truncate text-[10px] text-gray-400 group-hover:hidden group-focus-within:hidden [@media(pointer:coarse)]:hidden">
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
