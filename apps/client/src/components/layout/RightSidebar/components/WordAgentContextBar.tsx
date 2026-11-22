"use client";

import React from "react";
import { FileEdit, FileText, GitPullRequest, Sparkles, X } from "lucide-react";
import type { WordAgentChangeMode } from "@/contexts/WordAgentContext";
import type { DocumentItem } from "@/types/document";

interface WordAgentContextBarProps {
  document: DocumentItem;
  changeMode: WordAgentChangeMode;
  onChangeMode: (mode: WordAgentChangeMode) => void;
  selectedText?: string | null;
  onClearSelection?: () => void;
}

export function WordAgentContextBar({
  document,
  changeMode,
  onChangeMode,
  selectedText,
  onClearSelection,
}: WordAgentContextBarProps) {
  const clippedSelection = selectedText?.trim() ?? "";

  return (
    <div className="mb-2 rounded-2xl border border-indigo-500/25 bg-gradient-to-r from-indigo-50/90 via-white to-blue-50/70 dark:from-indigo-500/[0.12] dark:via-[#161a26] dark:to-blue-500/[0.08] px-3 py-2 text-xs shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-600/15 text-indigo-600 dark:text-indigo-300">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
          </span>
          <FileText
            className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          />
          <span
            title={`AI Agent đang kết nối trực tiếp với ${document.file_name}`}
            className="truncate font-semibold text-neutral-800 dark:text-neutral-100"
          >
            {document.file_name}
          </span>
        </div>

        <div
          role="group"
          aria-label="Chế độ AI chỉnh sửa tài liệu Word"
          className="inline-flex items-center rounded-lg border border-black/[0.08] dark:border-white/[0.12] bg-white/85 dark:bg-white/[0.05] p-0.5 shrink-0"
        >
          <button
            type="button"
            onClick={() => onChangeMode("tracked")}
            aria-pressed={changeMode === "tracked"}
            title="Mọi thay đổi được đánh dấu Tracked Changes để bạn Chấp nhận hoặc Từ chối"
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
              changeMode === "tracked"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "text-neutral-600 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
            }`}
          >
            <GitPullRequest className="h-3 w-3" aria-hidden="true" />
            <span>Đề xuất</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeMode("direct")}
            aria-pressed={changeMode === "direct"}
            title="AI áp dụng trực tiếp vào nội dung bản nháp (bấm Lưu để ghi đè)"
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
              changeMode === "direct"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "text-neutral-600 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
            }`}
          >
            <FileEdit className="h-3 w-3" aria-hidden="true" />
            <span>Sửa trực tiếp</span>
          </button>
        </div>
      </div>

      {clippedSelection && (
        <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl border border-indigo-500/20 bg-white/90 dark:bg-white/[0.05] px-2.5 py-1 text-[11px] text-neutral-700 dark:text-neutral-200">
          <p className="min-w-0 truncate">
            <span className="font-semibold text-indigo-600 dark:text-indigo-300">
              Đoạn đang chọn:{" "}
            </span>
            <span className="italic">“{clippedSelection}”</span>
          </p>
          {onClearSelection && (
            <button
              type="button"
              onClick={onClearSelection}
              aria-label="Bỏ ngữ cảnh đoạn đang chọn"
              title="Bỏ đoạn đang chọn"
              className="shrink-0 rounded-full p-0.5 text-neutral-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
