"use client";

import React, { useMemo, useState } from "react";
import { Check, ShieldAlert, X, FileDiff, ShieldCheck, Ban } from "lucide-react";

export interface ToolApprovalCardProps {
  toolName: string;
  approvalId: string;
  state: string;
  input?: Record<string, unknown>;
  approved?: boolean;
  reason?: string;
  diffPreview?: string;
  riskReason?: string;
  onApprove: (params: {
    id: string;
    approved: boolean;
    reason?: string;
  }) => void;
}

const TOOL_TITLES: Record<string, string> = {
  manageNotes: "Thao tác trên Ghi chú / Tóm tắt",
  manageFlashcards: "Thao tác trên Bộ thẻ Flashcard",
  manageQuiz: "Thao tác trên Đề kiểm tra Quiz",
  manageEditableDocument: "Chỉnh sửa tài liệu văn bản",
  manageWorkspaceAndJobs: "Điều phối không gian & Tác vụ nền",
};

const ACTION_LABELS: Record<string, string> = {
  delete_note: "Xóa vĩnh viễn ghi chú",
  batch_organize: "Sắp xếp / gộp hàng loạt ghi chú",
  batch_reorganize: "Sắp xếp / gộp hàng loạt ghi chú",
  delete_deck: "Xóa bộ thẻ Flashcard",
  delete_cards: "Xóa nhiều thẻ Flashcard",
  move_cards: "Di chuyển nhiều thẻ Flashcard",
  merge_duplicates: "Gộp các thẻ Flashcard trùng lặp",
  delete_quiz: "Xóa đề kiểm tra Quiz",
  delete_questions: "Xóa nhiều câu hỏi trong Quiz",
  update_content: "Ghi đè hoặc cập nhật nội dung tài liệu",
  delete_document: "Xóa tài liệu khỏi phiên học",
};

function buildSummaryFromInput(
  toolName: string,
  input?: Record<string, unknown>,
): string | null {
  if (!input || typeof input !== "object") return null;
  const action = typeof input.action === "string" ? input.action : "";
  const actionText = ACTION_LABELS[action] || (action ? `Hành động: ${action}` : "");

  const parts: string[] = [];
  if (actionText) parts.push(actionText);

  if (typeof input.title === "string" && input.title.trim()) {
    parts.push(`Tiêu đề: "${input.title.trim()}"`);
  }
  if (Array.isArray(input.cardIds) && input.cardIds.length > 0) {
    parts.push(`Số thẻ ảnh hưởng: ${input.cardIds.length}`);
  }
  if (Array.isArray(input.questionIds) && input.questionIds.length > 0) {
    parts.push(`Số câu hỏi ảnh hưởng: ${input.questionIds.length}`);
  }
  if (Array.isArray(input.noteIds) && input.noteIds.length > 0) {
    parts.push(`Số ghi chú ảnh hưởng: ${input.noteIds.length}`);
  }
  if (typeof input.targetSection === "string" && input.targetSection.trim()) {
    parts.push(`Mục tiêu: ${input.targetSection.trim()}`);
  }

  if (parts.length === 0 && toolName) {
    return `Công cụ: ${toolName}`;
  }
  return parts.join(" · ");
}

function buildFallbackDiffPreview(input?: Record<string, unknown>): string | null {
  if (!input || typeof input !== "object") return null;
  if (typeof input.diffPreview === "string" && input.diffPreview.trim()) {
    return input.diffPreview;
  }
  if (typeof input.newContent === "string" && input.newContent.trim()) {
    const lines = input.newContent.trim().split(/\r?\n/).slice(0, 12);
    return lines.map((line) => `+ ${line}`).join("\n");
  }
  if (typeof input.markdownContent === "string" && input.markdownContent.trim()) {
    const lines = input.markdownContent.trim().split(/\r?\n/).slice(0, 12);
    return lines.map((line) => `+ ${line}`).join("\n");
  }
  return null;
}

export function ToolApprovalCard({
  toolName,
  approvalId,
  state,
  input,
  approved,
  reason,
  diffPreview,
  riskReason,
  onApprove,
}: ToolApprovalCardProps) {
  const [submittedChoice, setSubmittedChoice] = useState<boolean | null>(null);

  const summary = useMemo(
    () => buildSummaryFromInput(toolName, input),
    [toolName, input],
  );
  const resolvedDiff = useMemo(
    () => diffPreview || buildFallbackDiffPreview(input),
    [diffPreview, input],
  );

  const isDenied =
    state === "output-denied" ||
    (state === "approval-responded" && approved === false);
  const isApprovedResponded =
    state === "approval-responded" && approved === true;

  if (isDenied) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-xl border border-[#E5EEFF] dark:border-white/[0.08] bg-[#F8F9FF] dark:bg-white/[0.03] px-3 py-2 text-xs text-[#777587] dark:text-neutral-400">
        <Ban className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span>
          Đã từ chối thao tác: {summary || TOOL_TITLES[toolName] || toolName}
          {reason ? ` (${reason})` : ""}
        </span>
      </div>
    );
  }

  if (isApprovedResponded) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        <span>
          Đã phê duyệt: {summary || TOOL_TITLES[toolName] || toolName} — đang hoàn tất…
        </span>
      </div>
    );
  }

  const handleDecision = (allow: boolean) => {
    if (submittedChoice !== null || !approvalId) return;
    setSubmittedChoice(allow);
    onApprove({
      id: approvalId,
      approved: allow,
      reason: allow ? undefined : "Người dùng đã từ chối qua hộp thoại xác nhận",
    });
  };

  return (
    <div className="my-2.5 space-y-3 rounded-2xl border border-amber-300/80 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/25 p-3.5 text-xs text-[#0B1C30] dark:text-[#EFF0F6] shadow-xs">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-[#0B1C30] dark:text-white">
              Cần bạn xác nhận trước khi thực hiện
            </span>
            <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
              Rủi ro cao
            </span>
          </div>
          <p className="text-[11.5px] font-medium text-[#464555] dark:text-neutral-200">
            {TOOL_TITLES[toolName] || toolName}
            {summary ? ` — ${summary}` : ""}
          </p>
          {riskReason && (
            <p className="text-[11px] text-[#777587] dark:text-neutral-400">
              {riskReason}
            </p>
          )}
        </div>
      </div>

      {resolvedDiff && (
        <div className="overflow-hidden rounded-xl border border-[#E5EEFF] dark:border-white/[0.1] bg-white dark:bg-[#0D1017]">
          <div className="flex items-center gap-1.5 border-b border-[#E5EEFF] dark:border-white/[0.08] px-2.5 py-1.5 text-[10.5px] font-semibold text-[#777587] dark:text-neutral-400">
            <FileDiff className="h-3.5 w-3.5 text-[#4F46E5]" />
            <span>Xem trước thay đổi (Diff Preview)</span>
          </div>
          <pre className="max-h-48 overflow-auto p-2.5 font-mono text-[11px] leading-relaxed">
            {resolvedDiff.split("\n").map((line, idx) => {
              const colorClass = line.startsWith("+")
                ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10"
                : line.startsWith("-")
                  ? "text-rose-700 dark:text-rose-400 bg-rose-500/10"
                  : line.startsWith("@@")
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-[#464555] dark:text-neutral-300";
              return (
                <div key={idx} className={`px-1 rounded-xs ${colorClass}`}>
                  {line || " "}
                </div>
              );
            })}
          </pre>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-0.5">
        <button
          type="button"
          disabled={submittedChoice !== null}
          onClick={() => handleDecision(false)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#E5EEFF] dark:border-white/[0.12] bg-white dark:bg-white/[0.04] px-3 py-1.5 text-[11.5px] font-semibold text-[#464555] dark:text-neutral-200 hover:border-rose-300 hover:text-rose-600 disabled:opacity-50 transition-all"
        >
          <X className="h-3.5 w-3.5" />
          <span>Từ chối</span>
        </button>
        <button
          type="button"
          disabled={submittedChoice !== null}
          onClick={() => handleDecision(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4F46E5] px-3.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-[#4338CA] disabled:opacity-50 shadow-xs transition-all active:scale-95"
        >
          <Check className="h-3.5 w-3.5" />
          <span>Cho phép thực hiện</span>
        </button>
      </div>
    </div>
  );
}
