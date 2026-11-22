"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import type { TrackChangesItem } from "superdoc/ui";
import {
  useSuperDocTrackChanges,
  useSuperDocUI,
} from "superdoc/ui/react";
import { useWordAgent } from "@/contexts/WordAgentContext";

interface WordAiReviewBannerProps {
  documentId: string;
  forceExpandSignal?: number;
  onDecisionSettled?: () => void;
}

function summarizeChange(item: TrackChangesItem): {
  kindLabel: string;
  preview: string;
  toneClass: string;
} {
  const inserted = item.insertedText?.trim() ?? "";
  const deleted = item.deletedText?.trim() ?? "";
  const format = item.formattingDeltaSummary?.trim() ?? "";

  if (inserted && deleted) {
    return {
      kindLabel: "Thay thế",
      preview: `“${deleted}” → “${inserted}”`,
      toneClass:
        "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    };
  }
  if (inserted) {
    return {
      kindLabel: "Thêm mới",
      preview: inserted,
      toneClass:
        "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    };
  }
  if (deleted) {
    return {
      kindLabel: "Xóa",
      preview: deleted,
      toneClass:
        "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
    };
  }
  if (format) {
    return {
      kindLabel: "Định dạng",
      preview: format,
      toneClass:
        "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
    };
  }
  return {
    kindLabel: "Thay đổi",
    preview: item.excerpt?.trim() || `Thay đổi #${item.id.slice(0, 6)}`,
    toneClass:
      "bg-neutral-500/10 text-neutral-700 dark:text-neutral-300 border-neutral-500/20",
  };
}

export function WordAiReviewBanner({
  documentId,
  forceExpandSignal = 0,
  onDecisionSettled,
}: WordAiReviewBannerProps) {
  const ui = useSuperDocUI();
  const trackChanges = useSuperDocTrackChanges();
  const {
    lastAgentUpdate,
    isApplyingSnapshot,
    snapshotSyncError,
    clearAgentSyncState,
  } = useWordAgent();

  const [isListExpanded, setIsListExpanded] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  useEffect(() => {
    if (forceExpandSignal > 0 && trackChanges.total > 0) {
      setIsListExpanded(true);
    }
  }, [forceExpandSignal, trackChanges.total]);

  const handleNavigate = useCallback(
    async (direction: "prev" | "next") => {
      if (!ui || trackChanges.total === 0) return;
      setBannerError(null);
      if (direction === "next") {
        await ui.trackChanges.navigateNext();
      } else {
        await ui.trackChanges.navigatePrevious();
      }
    },
    [ui, trackChanges.total],
  );

  const handleBulkDecision = useCallback(
    async (decision: "acceptAll" | "rejectAll") => {
      if (!ui || busyKey) return;
      setBusyKey(decision);
      setBannerError(null);
      try {
        const result =
          decision === "acceptAll"
            ? await ui.trackChanges.acceptAllAsync()
            : await ui.trackChanges.rejectAllAsync();
        if (result === false) {
          setBannerError(
            "Không thể áp dụng hàng loạt các đề xuất tại trạng thái hiện tại.",
          );
          return;
        }
        onDecisionSettled?.();
        setIsListExpanded(false);
      } catch (err) {
        setBannerError(
          err instanceof Error
            ? err.message
            : "Đã xảy ra lỗi khi duyệt toàn bộ đề xuất.",
        );
      } finally {
        setBusyKey(null);
      }
    },
    [ui, busyKey, onDecisionSettled],
  );

  const handleSingleDecision = useCallback(
    async (item: TrackChangesItem, decision: "accept" | "reject") => {
      if (!ui || busyKey) return;
      const opKey = `${decision}:${item.id}`;
      setBusyKey(opKey);
      setBannerError(null);
      try {
        const result =
          decision === "accept"
            ? await ui.trackChanges.acceptAsync(item.id)
            : await ui.trackChanges.rejectAsync(item.id);
        if (result === false) {
          setBannerError("Không thể cập nhật trạng thái đề xuất này.");
          return;
        }
        onDecisionSettled?.();
      } catch (err) {
        setBannerError(
          err instanceof Error
            ? err.message
            : "Đã xảy ra lỗi khi xử lý đề xuất.",
        );
      } finally {
        setBusyKey(null);
      }
    },
    [ui, busyKey, onDecisionSettled],
  );

  const handleFocusItem = useCallback(
    async (item: TrackChangesItem) => {
      if (!ui) return;
      ui.trackChanges.setActive(item.id);
      await ui.trackChanges.scrollTo(item.id);
    },
    [ui],
  );

  const hasTrackedChanges = trackChanges.total > 0;
  const isNoticeForThisDoc = lastAgentUpdate?.documentId === documentId;
  const showDirectNotice =
    !hasTrackedChanges &&
    isNoticeForThisDoc &&
    lastAgentUpdate?.changeMode === "direct";

  if (
    !hasTrackedChanges &&
    !isApplyingSnapshot &&
    !snapshotSyncError &&
    !showDirectNotice
  ) {
    return null;
  }

  return (
    <div className="shrink-0 border-b border-black/[0.06] dark:border-white/[0.08] bg-gradient-to-r from-indigo-50/85 via-white to-emerald-50/60 dark:from-indigo-500/[0.1] dark:via-[#161a24] dark:to-emerald-500/[0.08] px-3 sm:px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 shrink-0">
            {isApplyingSnapshot ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </span>

          {isApplyingSnapshot ? (
            <span className="text-[12.5px] font-medium text-indigo-700 dark:text-indigo-200">
              Đang đồng bộ đề xuất từ AI Agent lên trình soạn thảo...
            </span>
          ) : hasTrackedChanges ? (
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="text-[12.5px] font-semibold text-neutral-800 dark:text-neutral-100">
                {trackChanges.total} đề xuất chỉnh sửa chờ duyệt
              </span>
              <span className="hidden sm:inline text-[11.5px] text-neutral-500 dark:text-neutral-400">
                • Bấm vào phần đánh dấu trên trang hoặc duyệt nhanh tại đây, sau đó bấm Lưu (Ctrl+S)
              </span>
            </div>
          ) : showDirectNotice ? (
            <span className="text-[12.5px] font-medium text-emerald-700 dark:text-emerald-300">
              AI Agent vừa cập nhật trực tiếp nội dung tài liệu. Hãy kiểm tra và bấm Lưu (Ctrl+S) để ghi nhận phiên bản mới.
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {hasTrackedChanges && (
            <>
              <div className="inline-flex items-center rounded-lg border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-white/[0.05] overflow-hidden">
                <button
                  type="button"
                  onClick={() => void handleNavigate("prev")}
                  title="Đề xuất trước"
                  className="px-2 py-1 text-[11.5px] font-medium text-neutral-600 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.08] flex items-center gap-0.5 cursor-pointer"
                >
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                  Trước
                </button>
                <span className="h-3.5 w-px bg-black/[0.08] dark:bg-white/[0.12]" />
                <button
                  type="button"
                  onClick={() => void handleNavigate("next")}
                  title="Đề xuất tiếp theo"
                  className="px-2 py-1 text-[11.5px] font-medium text-neutral-600 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.08] flex items-center gap-0.5 cursor-pointer"
                >
                  Tiếp
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsListExpanded((prev) => !prev)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition-colors cursor-pointer ${
                  isListExpanded
                    ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-700 dark:text-indigo-200"
                    : "border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-white/[0.05] text-neutral-700 dark:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
                }`}
              >
                <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                Danh sách ({trackChanges.items.length})
              </button>

              <button
                type="button"
                disabled={busyKey !== null}
                onClick={() => void handleBulkDecision("rejectAll")}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-500/25 bg-white/90 dark:bg-white/[0.05] px-2.5 py-1 text-[11.5px] font-medium text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/15 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {busyKey === "rejectAll" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Từ chối tất cả
              </button>

              <button
                type="button"
                disabled={busyKey !== null}
                onClick={() => void handleBulkDecision("acceptAll")}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-[11.5px] font-medium shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
              >
                {busyKey === "acceptAll" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Chấp nhận tất cả
              </button>
            </>
          )}

          {showDirectNotice && (
            <button
              type="button"
              onClick={clearAgentSyncState}
              aria-label="Ẩn thông báo"
              className="rounded-full p-1 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {(snapshotSyncError || bannerError) && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 px-2.5 py-1.5 text-[12px] text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{snapshotSyncError || bannerError}</span>
        </div>
      )}

      {isListExpanded && trackChanges.items.length > 0 && (
        <div className="mt-2.5 max-h-48 overflow-y-auto rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white/95 dark:bg-[#12151f] divide-y divide-black/[0.05] dark:divide-white/[0.07]">
          {trackChanges.items.map((item) => {
            const summary = summarizeChange(item);
            const isActive = trackChanges.activeId === item.id;
            const isItemAccepting = busyKey === `accept:${item.id}`;
            const isItemRejecting = busyKey === `reject:${item.id}`;
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-3 px-3 py-2 text-[12px] transition-colors ${
                  isActive
                    ? "bg-indigo-500/[0.08]"
                    : "hover:bg-black/[0.025] dark:hover:bg-white/[0.03]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void handleFocusItem(item)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                >
                  <span
                    className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium ${summary.toneClass}`}
                  >
                    {summary.kindLabel}
                  </span>
                  <span className="truncate text-neutral-700 dark:text-neutral-200">
                    {summary.preview}
                  </span>
                  {item.author && (
                    <span className="hidden md:inline shrink-0 text-[11px] text-neutral-400">
                      • {item.author}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={busyKey !== null}
                    onClick={() => void handleSingleDecision(item, "reject")}
                    title="Từ chối đề xuất này"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-black/[0.08] dark:border-white/[0.12] text-neutral-500 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/15 disabled:opacity-50 cursor-pointer"
                  >
                    {isItemRejecting ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={busyKey !== null}
                    onClick={() => void handleSingleDecision(item, "accept")}
                    title="Chấp nhận đề xuất này"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {isItemAccepting ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
