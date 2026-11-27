"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  FileDiff,
  Loader2,
  RotateCcw,
} from "lucide-react";

export interface MutationResultCardProps {
  toolName: string;
  state: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  onOpenSummary?: (summaryId: string) => void;
  onOpenFlashcardDeck?: (deckId: string) => void;
  onOpenQuiz?: (quizId: string) => void;
  onOpenDocument?: (documentId: string) => void;
  onUndoAction?: (actionLogId: string) => Promise<void>;
}

const RUNNING_LABELS: Record<string, string> = {
  manageNotes: "Đang cập nhật ghi chú học tập…",
  manageFlashcards: "Đang cập nhật bộ thẻ Flashcard…",
  manageQuiz: "Đang cập nhật bài kiểm tra Quiz…",
  manageEditableDocument: "Đang chỉnh sửa tài liệu văn bản…",
  manageWorkspaceAndJobs: "Đang xử lý điều hướng / tác vụ không gian…",
};

const DONE_BADGES: Record<string, string> = {
  manageNotes: "Ghi chú",
  manageFlashcards: "Flashcard",
  manageQuiz: "Quiz",
  manageEditableDocument: "Tài liệu",
  manageWorkspaceAndJobs: "Không gian học",
};

export function MutationResultCard({
  toolName,
  state,
  input,
  output,
  onOpenSummary,
  onOpenFlashcardDeck,
  onOpenQuiz,
  onOpenDocument,
  onUndoAction,
}: MutationResultCardProps) {
  const [isUndoing, setIsUndoing] = useState(false);
  const [isUndone, setIsUndone] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);

  const isRunning = state === "input-streaming" || state === "input-available";
  const outputSuccess = output?.success !== false;
  const isError =
    state === "output-error" || (state === "output-available" && !outputSuccess);

  if (isRunning) {
    return (
      <div className="my-2 flex items-center gap-2.5 rounded-2xl border border-[#C7D2FE] dark:border-[#4F46E5]/30 bg-[#EEF2FF] dark:bg-[#4F46E5]/10 px-3.5 py-2.5 text-xs text-[#4F46E5] dark:text-[#818CF8]">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <span className="font-semibold">
          {RUNNING_LABELS[toolName] || "Đang thực thi thay đổi…"}
        </span>
      </div>
    );
  }

  if (isError) {
    const errMsg =
      (typeof output?.error === "string" && output.error) ||
      (typeof output?.message === "string" && output.message) ||
      "Không thể hoàn tất thao tác. Vui lòng thử lại.";
    return (
      <div className="my-2 flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/20 px-3 py-2.5 text-xs text-[#BA1A1A] dark:text-rose-300">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{errMsg}</span>
      </div>
    );
  }

  if (state !== "output-available") {
    return null;
  }

  const summaryText =
    (typeof output?.summary === "string" && output.summary) ||
    (typeof output?.message === "string" && output.message) ||
    (typeof output?.title === "string" && output.title) ||
    (typeof input?.action === "string" && `Đã thực hiện: ${input.action}`) ||
    "Đã cập nhật thành công";

  const actionLogId =
    typeof output?.actionLogId === "string" && output.actionLogId.length > 0
      ? output.actionLogId
      : null;
  const undoAllowed = Boolean(actionLogId && output?.undoAvailable !== false);

  const entityId =
    (typeof output?.entityId === "string" && output.entityId) ||
    (typeof output?.summaryId === "string" && output.summaryId) ||
    (typeof output?.deckId === "string" && output.deckId) ||
    (typeof output?.quizId === "string" && output.quizId) ||
    (typeof output?.documentId === "string" && output.documentId) ||
    "";

  const diffPreview =
    typeof output?.diffPreview === "string" && output.diffPreview.trim()
      ? output.diffPreview
      : null;

  const canOpenEntity =
    Boolean(entityId) &&
    ((toolName === "manageNotes" && Boolean(onOpenSummary)) ||
      (toolName === "manageFlashcards" && Boolean(onOpenFlashcardDeck)) ||
      (toolName === "manageQuiz" && Boolean(onOpenQuiz)) ||
      (toolName === "manageEditableDocument" && Boolean(onOpenDocument)));

  const handleOpenEntity = () => {
    if (!entityId) return;
    if (toolName === "manageNotes") onOpenSummary?.(entityId);
    else if (toolName === "manageFlashcards") onOpenFlashcardDeck?.(entityId);
    else if (toolName === "manageQuiz") onOpenQuiz?.(entityId);
    else if (toolName === "manageEditableDocument") onOpenDocument?.(entityId);
  };

  const handleUndo = async () => {
    if (!actionLogId || !onUndoAction || isUndoing || isUndone) return;
    setIsUndoing(true);
    setUndoError(null);
    try {
      await onUndoAction(actionLogId);
      setIsUndone(true);
    } catch (err) {
      setUndoError(
        err instanceof Error ? err.message : "Không thể hoàn tác thao tác này.",
      );
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div className="my-2 space-y-2 rounded-2xl border border-[#C7D2FE]/80 dark:border-[#4F46E5]/30 bg-[#F8FAFF] dark:bg-white/[0.03] p-3 text-xs text-[#0B1C30] dark:text-[#EFF0F6] shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <CheckCircle2
            className={`h-4 w-4 shrink-0 ${
              isUndone
                ? "text-amber-500"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-[#EEF2FF] dark:bg-[#4F46E5]/25 px-1.5 py-0.5 text-[10px] font-bold text-[#4F46E5] dark:text-[#A5B4FC]">
                {DONE_BADGES[toolName] || "AI Action"}
              </span>
              {isUndone && (
                <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                  Đã hoàn tác
                </span>
              )}
            </div>
            <p className="mt-1 font-medium text-[#0B1C30] dark:text-white">
              {summaryText}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {undoAllowed && onUndoAction && !isUndone && (
            <button
              type="button"
              disabled={isUndoing}
              onClick={() => void handleUndo()}
              className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#E5EEFF] dark:border-white/[0.12] bg-white dark:bg-[#12151C] px-2.5 py-1 text-[11px] font-semibold text-[#464555] dark:text-neutral-200 hover:border-amber-300 hover:text-amber-600 disabled:opacity-50 transition-colors"
            >
              {isUndoing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              <span>Hoàn tác</span>
            </button>
          )}

          {canOpenEntity && !isUndone && (
            <button
              type="button"
              onClick={handleOpenEntity}
              className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#E5EEFF] dark:border-white/[0.12] bg-white dark:bg-[#12151C] px-2.5 py-1 text-[11px] font-semibold text-[#4F46E5] dark:text-[#818CF8] hover:bg-[#4F46E5] hover:text-white transition-colors"
            >
              <span>Mở</span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {undoError && (
        <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
          {undoError}
        </p>
      )}

      {diffPreview && (
        <details className="rounded-xl border border-[#E5EEFF] dark:border-white/[0.08] bg-white dark:bg-[#0D1017] p-2">
          <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-[#777587] dark:text-neutral-400 select-none">
            <FileDiff className="h-3.5 w-3.5 text-[#4F46E5]" />
            <span>Xem chi tiết thay đổi (Diff)</span>
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto font-mono text-[10.5px] leading-relaxed">
            {diffPreview}
          </pre>
        </details>
      )}
    </div>
  );
}
