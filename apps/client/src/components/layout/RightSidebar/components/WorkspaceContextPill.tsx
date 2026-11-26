"use client";

import React from "react";
import {
  BarChart3,
  Eye,
  EyeOff,
  FileQuestion,
  FileText,
  Layers,
  NotebookPen,
  ShieldCheck,
} from "lucide-react";
import {
  useWorkspaceContextBadge,
  useWorkspaceContextStore,
} from "@/contexts/WorkspaceContextProvider";
import type { ConversationTabId } from "@/contexts/workspace-context.types";

function renderTabIcon(tab: ConversationTabId | "global", isExamGuard: boolean) {
  if (isExamGuard) {
    return <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  }
  switch (tab) {
    case "documents":
      return <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    case "summary":
      return <NotebookPen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    case "flashcard":
      return <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    case "quiz":
      return <FileQuestion className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    case "analytics":
      return <BarChart3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    default:
      return <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  }
}

export function WorkspaceContextPill({
  hideWhenWordActive = false,
}: {
  hideWhenWordActive?: boolean;
}) {
  const badge = useWorkspaceContextBadge();
  const store = useWorkspaceContextStore();

  if (!badge || !store) {
    return null;
  }

  // Khi WordAgentContextBar đang hiển thị, giữ pill gọn chỉ như nút bật/tắt ngữ cảnh màn hình nếu muốn, hoặc ẩn nhãn trùng
  if (hideWhenWordActive && badge.isWordActive && badge.enabled) {
    return null;
  }

  const toneClass = !badge.enabled
    ? "border-black/[0.08] dark:border-white/[0.1] bg-neutral-100/80 dark:bg-white/[0.04] text-neutral-500 dark:text-neutral-400"
    : badge.isExamGuard
      ? "border-amber-500/30 bg-amber-50/90 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300"
      : "border-indigo-500/20 bg-indigo-50/75 dark:bg-[#4F46E5]/15 text-[#4F46E5] dark:text-[#A5B4FC]";

  return (
    <div className="mx-4 mb-1.5 flex items-center justify-between gap-2 select-none">
      <div
        title={
          badge.enabled
            ? `${badge.title} (AI tự nhận biết vị trí này khi bạn gửi câu hỏi)`
            : "Đã tạm tắt gửi ngữ cảnh màn hình cho AI"
        }
        className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${toneClass}`}
      >
        {renderTabIcon(badge.tab, badge.enabled && badge.isExamGuard)}
        <span
          className={`truncate ${!badge.enabled ? "line-through opacity-75" : ""}`}
        >
          {badge.enabled ? badge.label : "Đã tắt ngữ cảnh màn hình"}
        </span>
        {badge.enabled && badge.isExamGuard && (
          <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.2 text-[9.5px] font-bold uppercase tracking-wide">
            Exam Guard
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => store.setEnabled(!badge.enabled)}
        aria-pressed={badge.enabled}
        aria-label={
          badge.enabled
            ? "Tạm tắt gửi ngữ cảnh màn hình cho AI"
            : "Bật gửi ngữ cảnh màn hình cho AI"
        }
        title={
          badge.enabled
            ? "Nhấn để tạm tắt gửi ngữ cảnh màn hình"
            : "Nhấn để bật lại ngữ cảnh màn hình"
        }
        className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white/80 dark:bg-white/[0.05] px-2 text-[10.5px] font-semibold text-neutral-600 dark:text-neutral-300 hover:border-indigo-400/50 hover:text-[#4F46E5] dark:hover:text-[#818CF8] transition-colors cursor-pointer"
      >
        {badge.enabled ? (
          <>
            <Eye className="h-3 w-3" aria-hidden="true" />
            <span className="hidden sm:inline">Đang bật</span>
          </>
        ) : (
          <>
            <EyeOff className="h-3 w-3" aria-hidden="true" />
            <span className="hidden sm:inline">Đã tắt</span>
          </>
        )}
      </button>
    </div>
  );
}
