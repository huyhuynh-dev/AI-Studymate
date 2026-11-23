"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import type { TrackChangePointHit } from "superdoc/ui";
import { useSuperDocUI } from "superdoc/ui/react";

interface WordTrackedChangePopoverProps {
  stageContainerRef: React.RefObject<HTMLElement | null>;
  onDecisionSettled?: () => void;
}

interface PopoverState {
  hit: TrackChangePointHit;
  x: number;
  y: number;
}

function getChangeTypeMeta(type: string | undefined, hasDelete: boolean, hasInsert: boolean): {
  label: string;
  badgeClass: string;
} {
  if (hasInsert && hasDelete) {
    return {
      label: "Đề xuất thay thế",
      badgeClass:
        "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    };
  }
  switch (type) {
    case "insert":
    case "insertion":
      return {
        label: "Đề xuất thêm",
        badgeClass:
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
      };
    case "delete":
    case "deletion":
      return {
        label: "Đề xuất xóa",
        badgeClass:
          "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
      };
    case "format":
    case "formatting":
      return {
        label: "Đề xuất định dạng",
        badgeClass:
          "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
      };
    default:
      return {
        label: "Đề xuất chỉnh sửa",
        badgeClass:
          "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
      };
  }
}

export const WordTrackedChangePopover = React.memo(function WordTrackedChangePopover({
  stageContainerRef,
  onDecisionSettled,
}: WordTrackedChangePopoverProps) {
  const ui = useSuperDocUI();
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [pendingAction, setPendingAction] = useState<"accept" | "reject" | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const closePopover = useCallback(() => {
    setPopover(null);
    setActionError(null);
  }, []);

  useEffect(() => {
    if (!ui) return undefined;

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (popoverRef.current?.contains(target)) {
        return;
      }

      const stageEl = stageContainerRef.current;
      if (!stageEl || !stageEl.contains(target)) {
        closePopover();
        return;
      }

      const hit = ui.trackChanges.getAt({
        x: event.clientX,
        y: event.clientY,
      });
      if (!hit) {
        closePopover();
        return;
      }

      ui.trackChanges.setActive({ id: hit.id, story: hit.story });
      setActionError(null);
      setPopover({
        hit,
        x: event.clientX,
        y: event.clientY,
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePopover();
      }
    };

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [ui, stageContainerRef, closePopover]);

  useEffect(() => {
    if (!ui || !popover) return undefined;

    return ui.trackChanges.subscribe(({ snapshot }) => {
      const stillPresent = snapshot.items.some(
        (item) => item.id === popover.hit.id,
      );
      if (!stillPresent) {
        closePopover();
      }
    });
  }, [ui, popover, closePopover]);

  const handleDecision = useCallback(
    async (kind: "accept" | "reject") => {
      if (!ui || !popover || pendingAction) return;

      setPendingAction(kind);
      setActionError(null);
      try {
        const target = { id: popover.hit.id, story: popover.hit.story };
        const result =
          kind === "accept"
            ? await ui.trackChanges.acceptAsync(target)
            : await ui.trackChanges.rejectAsync(target);

        if (result === false) {
          setActionError(
            "Không thể áp dụng quyết định với đề xuất này ở trạng thái hiện tại.",
          );
          return;
        }
        onDecisionSettled?.();
        closePopover();
      } catch (err) {
        setActionError(
          err instanceof Error
            ? err.message
            : "Đã xảy ra lỗi khi xử lý thay đổi.",
        );
      } finally {
        setPendingAction(null);
      }
    },
    [ui, popover, pendingAction, onDecisionSettled, closePopover],
  );

  if (!popover) return null;

  const { item } = popover.hit;
  const insertedText = item.insertedText ?? "";
  const deletedText = item.deletedText ?? "";
  const formatSummary = item.formattingDeltaSummary ?? "";
  const excerpt = !insertedText && !deletedText ? (item.excerpt ?? "") : "";
  const meta = getChangeTypeMeta(
    item.type,
    Boolean(deletedText),
    Boolean(insertedText),
  );

  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 800;
  const cardWidth = 320;
  const left = Math.max(
    12,
    Math.min(popover.x - 24, viewportWidth - cardWidth - 12),
  );
  const openAbove = popover.y + 230 > viewportHeight;
  const top = openAbove
    ? Math.max(12, popover.y - 196)
    : Math.min(popover.y + 12, viewportHeight - 200);

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Chi tiết đề xuất chỉnh sửa"
      style={{ top, left, width: cardWidth }}
      className="fixed z-50 rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#191d28]/95 backdrop-blur-md shadow-xl p-3.5 text-[13px] text-neutral-800 dark:text-neutral-100"
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium shrink-0 ${meta.badgeClass}`}
          >
            {meta.label}
          </span>
          {item.author && (
            <span className="truncate text-[11.5px] font-medium text-neutral-500 dark:text-neutral-400">
              {item.author}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={closePopover}
          aria-label="Đóng hộp thoại duyệt"
          className="rounded-full p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="py-2.5 space-y-1.5 max-h-40 overflow-y-auto text-[12.5px] leading-relaxed">
        {deletedText && (
          <div className="rounded-lg bg-rose-500/[0.08] px-2.5 py-1.5 text-rose-700 dark:text-rose-300 line-through break-words">
            {deletedText}
          </div>
        )}
        {insertedText && (
          <div className="rounded-lg bg-emerald-500/[0.08] px-2.5 py-1.5 text-emerald-700 dark:text-emerald-300 break-words">
            {insertedText}
          </div>
        )}
        {formatSummary && (
          <div className="rounded-lg bg-indigo-500/[0.08] px-2.5 py-1.5 text-indigo-700 dark:text-indigo-300 break-words">
            Định dạng: {formatSummary}
          </div>
        )}
        {excerpt && (
          <div className="rounded-lg bg-black/[0.04] dark:bg-white/[0.05] px-2.5 py-1.5 text-neutral-700 dark:text-neutral-200 break-words">
            {excerpt}
          </div>
        )}
      </div>

      {actionError && (
        <p className="mb-2 text-[11.5px] text-rose-600 dark:text-rose-400">
          {actionError}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
        <button
          type="button"
          disabled={pendingAction !== null}
          onClick={() => void handleDecision("reject")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.1] dark:border-white/[0.14] bg-white dark:bg-white/[0.05] px-3 py-1.5 text-[12px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300 hover:border-rose-300 dark:hover:border-rose-500/30 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {pendingAction === "reject" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Từ chối
        </button>
        <button
          type="button"
          disabled={pendingAction !== null}
          onClick={() => void handleDecision("accept")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-[12px] font-medium shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
        >
          {pendingAction === "accept" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Chấp nhận
        </button>
      </div>
    </div>
  );
});
