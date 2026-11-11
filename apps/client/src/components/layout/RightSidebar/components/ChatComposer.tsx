"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, FileText } from "lucide-react";
import { useClickOutside } from "../hooks/useClickOutside";
import type { AttachedFile, ModelConfig, WorkspaceDoc } from "../types";
import { AttachMenu } from "./AttachMenu";
import { ContextChip, FileChip } from "./ComposerChips";
import { ModelSelector } from "./ModelSelector";

const MIN_HEIGHT = 44;
const MAX_HEIGHT = 160;

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;

  attachedFiles: AttachedFile[];
  onRemoveFile: (id: string) => void;
  onSelectLocalFile: () => void;
  onPasteFiles?: (files: File[]) => void;
  availableDocs?: WorkspaceDoc[];
  onSelectWorkspaceDoc: (doc: WorkspaceDoc) => void;

  modelConfig: ModelConfig;
  onModelConfigChange: (patch: Partial<ModelConfig>) => void;

  /** Nhãn ngắn hiển thị trên chip ngữ cảnh, ví dụ "Trang 12" */
  contextLabel?: string;
  /** Nhãn đầy đủ, hiển thị khi rê chuột vào chip */
  contextTitle?: string;
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  placeholder = "Hỏi AI bất cứ điều gì về tài liệu…\nGõ @ để gắn tài liệu",
  disabled = false,
  attachedFiles,
  onRemoveFile,
  onSelectLocalFile,
  onPasteFiles,
  availableDocs = [],
  onSelectWorkspaceDoc,
  modelConfig,
  onModelConfigChange,
  contextLabel,
  contextTitle,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionContainerRef = useRef<HTMLDivElement>(null);

  // Trạng thái autocomplete popup khi gõ '@'
  const [mentionState, setMentionState] = useState<{
    isOpen: boolean;
    query: string;
    atIndex: number;
    cursorPos: number;
  } | null>(null);

  const [mentionIndex, setMentionIndex] = useState(0);

  const closeMention = useCallback(() => setMentionState(null), []);
  useClickOutside(mentionContainerRef, closeMention, mentionState?.isOpen ?? false);

  const isAnyFilePending = attachedFiles.some(
    (f) => f.status === "uploading" || f.status === "processing"
  );

  const canSend =
    (value.trim().length > 0 || attachedFiles.length > 0) &&
    !disabled;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
  }, [value]);

  // Lọc danh sách tài liệu theo từ khóa sau ký tự '@'
  const matchingMentionDocs = useMemo(() => {
    if (!mentionState?.isOpen) return [];
    const q = mentionState.query.toLowerCase().trim();
    if (!q) return availableDocs;
    return availableDocs.filter((doc) =>
      doc.file_name.toLowerCase().includes(q)
    );
  }, [mentionState, availableDocs]);

  // Giữ mentionIndex luôn nằm trong phạm vi danh sách gợi ý
  useEffect(() => {
    setMentionIndex(0);
  }, [matchingMentionDocs.length]);

  // Hành vi khi chọn tài liệu từ danh sách Mention @
  const handleSelectMentionDoc = useCallback(
    (doc: WorkspaceDoc) => {
      if (!mentionState) return;

      // 1. Đính kèm tài liệu vào danh sách
      onSelectWorkspaceDoc(doc);

      // 2. Xóa sạch đoạn "@query" khỏi text để không làm rác nội dung câu hỏi
      const beforeAt = value.slice(0, mentionState.atIndex);
      const afterCursor = value.slice(mentionState.cursorPos);
      const nextValue = `${beforeAt}${afterCursor}`;
      onChange(nextValue);

      // 3. Đóng popup mention
      setMentionState(null);

      // 4. Focus lại textarea và đặt con trỏ tại vị trí vừa xóa @
      setTimeout(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          const targetPos = beforeAt.length;
          el.setSelectionRange(targetPos, targetPos);
        }
      }, 0);
    },
    [mentionState, value, onSelectWorkspaceDoc, onChange]
  );

  // Xử lý khi thay đổi nội dung ô nhập để phát hiện ký tự '@'
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart ?? newValue.length;
    onChange(newValue);

    // Kiểm tra ký tự '@' trước con trỏ
    const textBeforeCursor = newValue.slice(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const isStartOrAfterSpace =
        lastAtIndex === 0 || /\s/.test(textBeforeCursor[lastAtIndex - 1]);
      const query = textBeforeCursor.slice(lastAtIndex + 1);

      // Chỉ kích hoạt nếu sau '@' không chứa khoảng trắng hay ký tự xuống dòng
      if (isStartOrAfterSpace && !/\s/.test(query)) {
        setMentionState({
          isOpen: true,
          query,
          atIndex: lastAtIndex,
          cursorPos: cursor,
        });
        return;
      }
    }

    setMentionState(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 1. Điều hướng danh sách gợi ý Mention @
    if (mentionState?.isOpen) {
      if (matchingMentionDocs.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionIndex((prev) => (prev + 1) % matchingMentionDocs.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIndex((prev) =>
            prev - 1 < 0 ? matchingMentionDocs.length - 1 : prev - 1
          );
          return;
        }
        if (
          (e.key === "Enter" || e.key === "Tab") &&
          !e.shiftKey &&
          !e.nativeEvent.isComposing
        ) {
          e.preventDefault();
          const selectedDoc = matchingMentionDocs[mentionIndex];
          if (selectedDoc) {
            handleSelectMentionDoc(selectedDoc);
          }
          return;
        }
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setMentionState(null);
        return;
      }
    }

    // 2. Gửi tin nhắn khi nhấn Enter (bỏ qua khi đang dùng Telex/VNI gõ dấu)
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  // 3. Xử lý dán tệp (Ctrl + V) từ Clipboard hoặc File Explorer
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardFiles = e.clipboardData?.files;
    if (clipboardFiles && clipboardFiles.length > 0) {
      const filesArray = Array.from(clipboardFiles);
      if (filesArray.length > 0) {
        e.preventDefault();
        onPasteFiles?.(filesArray);
      }
    }
  };

  const hasChips = Boolean(contextLabel) || attachedFiles.length > 0;

  return (
    <div className="shrink-0 px-4 pb-3 pt-2 select-none">
      <div className="relative w-full rounded-[22px] border border-[#E5EEFF] dark:border-white/[0.1] bg-white dark:bg-[#161922] p-3.5 transition-all shadow-[0_4px_20px_-4px_rgba(11,28,48,0.06)] focus-within:border-[#4F46E5] focus-within:ring-4 focus-within:ring-[#4F46E5]/12">
        {/* Autocomplete Popup khi gõ '@' */}
        {mentionState?.isOpen && (
          <div
            ref={mentionContainerRef}
            className="absolute bottom-full left-0 z-50 mb-2 w-72 max-w-[calc(100vw-32px)] rounded-[20px] border border-[#E5EEFF] dark:border-white/[0.12] bg-white/95 dark:bg-[#161922]/95 backdrop-blur-xl p-1.5 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-100 select-none"
          >
            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#777587] dark:text-neutral-400 select-none">
              Đính kèm tài liệu
            </div>

            {matchingMentionDocs.length === 0 ? (
              <div className="px-3 py-2 text-[11px] italic text-[#777587] dark:text-neutral-500">
                {availableDocs.length === 0
                  ? "Không có tài liệu nào trong phiên học"
                  : "Không tìm thấy tài liệu phù hợp"}
              </div>
            ) : (
              <div className="max-h-48 space-y-0.5 overflow-y-auto pr-0.5">
                {matchingMentionDocs.map((doc, idx) => {
                  const isSelected = idx === mentionIndex;
                  const isAttached = attachedFiles.some(
                    (f) => f.source === "workspace" && f.documentId === doc.id
                  );

                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onMouseEnter={() => setMentionIndex(idx)}
                      onClick={() => handleSelectMentionDoc(doc)}
                      className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition-colors ${
                        isSelected
                          ? "bg-[#EEF2FF] dark:bg-[#4F46E5]/20 font-bold text-[#4F46E5] dark:text-[#818CF8]"
                          : "text-[#464555] dark:text-[#EFF0F6] hover:bg-[#F8F9FF] dark:hover:bg-white/[0.04]"
                      }`}
                    >
                      <FileText
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isSelected ? "text-[#4F46E5] dark:text-[#818CF8]" : "text-[#777587]"
                        }`}
                      />
                      <span className="flex-1 truncate" title={doc.file_name}>
                        {doc.file_name}
                      </span>
                      {isAttached && (
                        <span className="shrink-0 text-[10px] text-[#777587]">
                          Đã chọn
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {hasChips && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {contextLabel && <ContextChip label={contextLabel} title={contextTitle} />}
            {attachedFiles.map((f) => (
              <FileChip key={f.id} file={f} onRemove={onRemoveFile} />
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={2}
          placeholder={placeholder}
          aria-label="Nhập câu hỏi"
          className="block max-h-40 min-h-11 w-full resize-none overflow-y-auto wrap-break-word bg-transparent text-[13.5px] leading-relaxed text-[#0B1C30] dark:text-[#EFF0F6] placeholder-[#777587] dark:placeholder-neutral-500 outline-none select-text"
        />

        <div className="mt-1 flex items-center justify-between gap-2">
          {/* Nút (+) Popover menu nhúng danh sách tài liệu */}
          <AttachMenu
            onSelectLocal={onSelectLocalFile}
            availableDocs={availableDocs}
            attachedFiles={attachedFiles}
            onSelectWorkspaceDoc={onSelectWorkspaceDoc}
          />

          <div className="flex min-w-0 items-center gap-1.5">
            <ModelSelector config={modelConfig} onChange={onModelConfigChange} />

            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              aria-label="Gửi tin nhắn"
              title={
                disabled
                  ? "Đang gửi tin nhắn..."
                  : isAnyFilePending
                  ? "Gửi (sẽ tự động gửi khi tài liệu xử lý xong)"
                  : "Gửi (Enter)"
              }
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
                canSend
                  ? "cursor-pointer bg-[#4F46E5] hover:bg-[#3525CD] text-white shadow-xs active:scale-95"
                  : "cursor-not-allowed bg-[#E5EEFF] dark:bg-white/[0.06] text-[#777587] dark:text-neutral-500"
              }`}
            >
              <ArrowUp className="h-4 w-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-[10.5px] text-[#777587] dark:text-neutral-500">
        AI có thể mắc lỗi. Hãy kiểm tra lại thông tin quan trọng.
      </p>
    </div>
  );
}
