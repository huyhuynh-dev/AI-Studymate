"use client";

import React, { useEffect, useRef } from "react";
import { ArrowUp } from "lucide-react";
import type { AttachedFile, ModelConfig } from "../types";
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
  onSelectWorkspaceDoc: () => void;

  modelConfig: ModelConfig;
  onModelConfigChange: (patch: Partial<ModelConfig>) => void;

  /** Nhãn ngắn hiển thị trên chip ngữ cảnh, ví dụ "Trang 12" */
  contextLabel?: string;
  /** Nhãn đầy đủ, hiển thị khi rê chuột vào chip */
  contextTitle?: string;
}

/**
 * Ô nhập + thanh công cụ + dòng lưu ý.
 * - Chiều ngang cố định, tự xuống dòng.
 * - Chiều cao co giãn trong [44px, 160px], vượt quá thì cuộn dọc.
 * - Là mốc `relative` để AttachMenu / ModelSelector mở popover phía trên ô nhập.
 */
export function ChatComposer({
  value,
  onChange,
  onSend,
  placeholder = "Hỏi AI bất cứ điều gì về tài liệu…",
  disabled = false,
  attachedFiles,
  onRemoveFile,
  onSelectLocalFile,
  onSelectWorkspaceDoc,
  modelConfig,
  onModelConfigChange,
  contextLabel,
  contextTitle,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend =
    (value.trim().length > 0 || attachedFiles.length > 0) && !disabled;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Bỏ qua Enter khi đang gõ dấu bằng bộ gõ tiếng Việt (Telex/VNI)
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  const hasChips = Boolean(contextLabel) || attachedFiles.length > 0;

  return (
    <div className="shrink-0 px-4 pb-3 pt-2">
      <div className="relative w-full rounded-2xl border border-gray-200 bg-gray-50/70 p-3 transition-all focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10">
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
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={placeholder}
          aria-label="Nhập câu hỏi"
          className="block max-h-40 min-h-11 w-full resize-none overflow-y-auto wrap-break-word bg-transparent text-sm leading-relaxed text-gray-900 placeholder-gray-400 outline-none"
        />

        <div className="mt-1 flex items-center justify-between gap-2">
          <AttachMenu
            onSelectLocal={onSelectLocalFile}
            onSelectWorkspace={onSelectWorkspaceDoc}
          />

          <div className="flex min-w-0 items-center gap-1.5">
            <ModelSelector config={modelConfig} onChange={onModelConfigChange} />

            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              aria-label="Gửi tin nhắn"
              title="Gửi (Enter)"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${canSend
                  ? "cursor-pointer bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 active:scale-95"
                  : "cursor-not-allowed bg-gray-200 text-gray-400"
                }`}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-[10px] text-gray-400">
        AI có thể mắc lỗi. Hãy kiểm tra lại thông tin quan trọng.
      </p>
    </div>
  );
}
