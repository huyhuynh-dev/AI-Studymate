"use client";

import React, { useMemo } from 'react';
import { ArrowUp, Loader2, X } from 'lucide-react';
import {
  BUBBLE_AI_QUICK_PROMPTS,
  normalizeSelectionText,
} from '@/lib/ask-ai-prompt.helper';

export interface SelectionAskAiPanelProps {
  selectedText: string;
  promptInput: string;
  onPromptInputChange: (value: string) => void;
  onSubmit: (rawPrompt: string) => void;
  onClose: () => void;
  isAiResponding?: boolean;
  isExtractingText?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
}

/**
 * Khung nhập liệu Prompt mở rộng tại chỗ (Bước 2) dùng chung cho cả Tiptap Editor & EmbedPDF Viewer.
 */
export const SelectionAskAiPanel = React.memo(function SelectionAskAiPanel({
  selectedText,
  promptInput,
  onPromptInputChange,
  onSubmit,
  onClose,
  isAiResponding = false,
  isExtractingText = false,
  inputRef,
  className = '',
}: SelectionAskAiPanelProps) {
  const previewSnippet = useMemo(
    () => normalizeSelectionText(selectedText, 120).replace(/\n+/g, ' '),
    [selectedText],
  );

  return (
    <div
      className={`w-[min(calc(100vw-2rem),392px)] p-2.5 space-y-2 ${className}`.trim()}
    >
      {/* Header ngữ cảnh đoạn đang chọn */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-500/15">
            <img
              src="/studymate_simple.svg"
              alt=""
              className="h-3.5 w-3.5"
            />
          </span>
          {isExtractingText ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Đang trích xuất đoạn văn bản...</span>
            </span>
          ) : (
            <span className="truncate text-[11px] font-medium italic text-neutral-500 dark:text-neutral-400">
              &ldquo;{previewSnippet}&rdquo;
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng khung Hỏi Studymate"
          title="Thu gọn (Esc)"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.08] hover:text-neutral-700 dark:hover:text-white cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Ô nhập Prompt + nút Gửi */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!isExtractingText) {
            onSubmit(promptInput);
          }
        }}
        className="flex items-center gap-1.5"
      >
        <input
          ref={inputRef}
          type="text"
          value={promptInput}
          onChange={(e) => onPromptInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
          placeholder="Hỏi Studymate về đoạn văn bản này..."
          aria-label="Nhập câu hỏi cho Studymate về đoạn đang chọn"
          className="h-8 min-w-0 flex-1 rounded-xl border border-black/[0.1] dark:border-white/[0.12] bg-neutral-50/90 dark:bg-white/[0.05] px-3 text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
        />
        <button
          type="submit"
          disabled={!promptInput.trim() || isExtractingText}
          title="Gửi sang Trợ lý AI (Enter)"
          aria-label="Gửi yêu cầu cho Studymate"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5] text-white shadow-xs transition-all hover:bg-[#4338CA] active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>

      {/* Hàng Gợi ý nhanh 1 chạm */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {BUBBLE_AI_QUICK_PROMPTS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={isExtractingText}
            onClick={() => onSubmit(item.prompt)}
            className="inline-flex h-6 items-center rounded-full border border-indigo-500/20 bg-indigo-500/[0.06] dark:bg-indigo-500/[0.12] px-2.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 transition-colors hover:bg-indigo-600 hover:text-white hover:border-indigo-600 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            {item.label}
          </button>
        ))}
      </div>

      {isAiResponding && (
        <div className="flex items-center gap-1.5 text-[10.5px] text-amber-600 dark:text-amber-400">
          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          <span>
            AI đang trả lời câu trước — yêu cầu sẽ tự gửi ngay khi xong
          </span>
        </div>
      )}
    </div>
  );
});
