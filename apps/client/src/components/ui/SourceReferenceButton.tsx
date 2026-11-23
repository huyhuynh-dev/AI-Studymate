"use client";

import React, { useState } from "react";
import { ArrowUpRight, ChevronDown, FileText } from "lucide-react";
import { useFocusMode } from "@/components/layout/FocusModeContext";
import { useCitationNavigation } from "@/contexts/CitationNavigationContext";
import {
  formatCitationLocationLabel,
  formatCitationTooltipLabel,
} from "@/lib/citation-label.helper";
import type { SourceReference } from "@/types";

export interface SourceReferenceButtonProps {
  sourceRefs?: SourceReference[];
  variant?: "card" | "inline" | "compact";
  align?: "left" | "center";
  /**
   * - `"side-panel"` (mặc định): mở PDF đối chứng tạm thời ở cột RightSidebar, giữ nguyên tab/thẻ/câu hỏi hiện tại.
   * - `"main"`: chuyển sang Tab Tài liệu và mở PDF ở khung chính.
   */
  targetMode?: "side-panel" | "main";
  className?: string;
  onBeforeNavigate?: () => void;
}

/**
 * Thẻ & nút đối chứng nguồn tài liệu gốc ("Xem nguồn") chuẩn Apple HIG:
 * - Nhấn vùng thông tin bên trái (hoặc mũi tên) để mở rộng/thu gọn toàn bộ đoạn trích dẫn.
 * - Nhấn nút "Xem nguồn" bên phải để mở trình xem PDF nhanh ở cột phải (mặc định).
 */
export function SourceReferenceButton({
  sourceRefs,
  variant = "inline",
  align = "left",
  targetMode = "side-panel",
  className = "",
  onBeforeNavigate,
}: SourceReferenceButtonProps) {
  const { navigateToDocumentCitation, openSidePanelCitation } =
    useCitationNavigation();
  const { setFocusMode } = useFocusMode();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const validRefs = Array.isArray(sourceRefs)
    ? sourceRefs.filter((r) => Boolean(r?.documentId))
    : [];

  if (validRefs.length === 0) {
    return null;
  }

  const safeIdx = selectedIdx < validRefs.length ? selectedIdx : 0;
  const activeRef = validRefs[safeIdx];
  const pageNo = activeRef.pageNumbers?.[0] ?? 1;
  const locationBadgeLabel = formatCitationLocationLabel({
    fileName: activeRef.fileName,
    pageNumbers: activeRef.pageNumbers,
    pageNo,
    textAnchor: activeRef.textAnchor,
    headings: activeRef.headings,
    chunkIndex: activeRef.chunkIndex,
    variant: "compact",
  });
  const tooltipLabel = formatCitationTooltipLabel({
    fileName: activeRef.fileName,
    pageNumbers: activeRef.pageNumbers,
    pageNo,
    textAnchor: activeRef.textAnchor,
    headings: activeRef.headings,
    chunkIndex: activeRef.chunkIndex,
  });
  const latestHeading =
    Array.isArray(activeRef.headings) && activeRef.headings.length > 0
      ? activeRef.headings[activeRef.headings.length - 1]
      : undefined;
  const hasSnippet = Boolean(activeRef.snippet && activeRef.snippet.trim().length > 0);

  const handleNavigate = (
    ref: SourceReference,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    onBeforeNavigate?.();

    const payload = {
      documentId: ref.documentId,
      fileName: ref.fileName,
      pageNo: ref.pageNumbers?.[0] ?? 1,
      bboxes: ref.bboxes,
      rawContent: ref.textAnchor?.quoteExact || ref.snippet,
      chunkId: ref.chunkId,
      chunkIndex: ref.chunkIndex,
      headings: ref.headings,
      textAnchor: ref.textAnchor,
    };

    if (targetMode === "side-panel") {
      openSidePanelCitation(payload);
      return;
    }

    setFocusMode(false);
    navigateToDocumentCitation(payload);
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        data-source-ref-btn="true"
        onClick={(e) => handleNavigate(activeRef, e)}
        title={`Xem nguồn: ${activeRef.fileName} (${locationBadgeLabel})${latestHeading && !locationBadgeLabel.startsWith("§ ") ? ` · ${latestHeading}` : ""}`}
        aria-label={`Xem nguồn (${locationBadgeLabel})`}
        className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-indigo-200/70 dark:border-indigo-500/30 bg-indigo-50/80 dark:bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-indigo-700 dark:text-indigo-300 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-500/20 hover:border-indigo-300 active:scale-95 focus-visible:outline-2 focus-visible:outline-[#4F46E5] cursor-pointer ${className}`}
      >
        <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{locationBadgeLabel}</span>
      </button>
    );
  }

  if (variant === "inline") {
    return (
      <div
        className={`flex flex-wrap items-center gap-2 ${
          align === "center" ? "justify-center" : "justify-start"
        } ${className}`}
      >
        {validRefs.map((ref, idx) => {
          const label = formatCitationLocationLabel({
            fileName: ref.fileName,
            pageNumbers: ref.pageNumbers,
            pageNo: ref.pageNumbers?.[0] ?? 1,
            textAnchor: ref.textAnchor,
            headings: ref.headings,
            chunkIndex: ref.chunkIndex,
            variant: "compact",
          });
          return (
            <button
              key={`${ref.documentId}-${ref.chunkId ?? idx}`}
              type="button"
              data-source-ref-btn="true"
              onClick={(e) => handleNavigate(ref, e)}
              title={
                ref.snippet
                  ? `Xem nguồn ${ref.fileName} (${label}): "${ref.snippet}"`
                  : `Xem nguồn ${ref.fileName} (${label})`
              }
              className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-indigo-200/80 dark:border-indigo-500/30 bg-indigo-50/90 dark:bg-indigo-500/12 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 shadow-2xs transition-colors duration-200 hover:bg-indigo-100 dark:hover:bg-indigo-500/22 hover:border-indigo-300 dark:hover:border-indigo-400/50 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[#4F46E5] cursor-pointer"
            >
              <FileText
                className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400"
                aria-hidden="true"
              />
              <span>Xem nguồn</span>
              <span className="shrink-0 rounded-full bg-white/80 dark:bg-white/10 px-1.5 py-0.2 text-[11px] font-bold tabular-nums text-indigo-700 dark:text-indigo-200">
                {label}
              </span>
              <ArrowUpRight
                className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`rounded-2xl border border-indigo-500/15 bg-indigo-500/[0.04] dark:bg-indigo-500/[0.08] p-3.5 transition-colors ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Vùng thông tin bên trái — Nhấn để xổ / thu gọn đoạn trích dẫn */}
        {hasSnippet ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? "Thu gọn đoạn trích dẫn nguồn"
                : "Mở rộng để xem đầy đủ đoạn trích dẫn nguồn"
            }
            className="group/expand flex min-w-0 flex-1 items-start gap-2.5 rounded-xl p-1 -m-1 text-left transition-colors hover:bg-indigo-500/[0.05] dark:hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-[#4F46E5] cursor-pointer"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/12 text-indigo-600 dark:text-indigo-400">
              <FileText className="h-4 w-4" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-foreground">
                <span className="truncate max-w-[220px] sm:max-w-[320px]">
                  {activeRef.fileName}
                </span>
                <span className="text-[var(--on-surface-variant)]">·</span>
                <span className="tabular-nums text-indigo-600 dark:text-indigo-400">
                  {locationBadgeLabel}
                </span>
                {latestHeading && !locationBadgeLabel.startsWith("§ ") && (
                  <>
                    <span className="text-[var(--on-surface-variant)]">·</span>
                    <span className="truncate max-w-[180px] text-[12.5px] font-medium text-[var(--on-surface-variant)]">
                      {latestHeading}
                    </span>
                  </>
                )}
                <ChevronDown
                  aria-hidden="true"
                  className={`ml-0.5 h-3.5 w-3.5 shrink-0 text-[#777587] dark:text-neutral-400 transition-transform duration-200 ${
                    isExpanded ? "rotate-180 text-indigo-600 dark:text-indigo-400" : ""
                  }`}
                />
              </div>

              {!isExpanded && (
                <p className="mt-0.5 line-clamp-1 text-[12.5px] italic text-[var(--on-surface-variant)]">
                  &ldquo;{activeRef.snippet}&rdquo;
                </p>
              )}
            </div>
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/12 text-indigo-600 dark:text-indigo-400">
              <FileText className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-foreground">
                <span className="truncate max-w-[220px] sm:max-w-[320px]">
                  {activeRef.fileName}
                </span>
                <span className="text-[var(--on-surface-variant)]">·</span>
                <span className="tabular-nums text-indigo-600 dark:text-indigo-400">
                  {locationBadgeLabel}
                </span>
                {latestHeading && !locationBadgeLabel.startsWith("§ ") && (
                  <>
                    <span className="text-[var(--on-surface-variant)]">·</span>
                    <span className="truncate max-w-[180px] text-[12.5px] font-medium text-[var(--on-surface-variant)]">
                      {latestHeading}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Nút Xem nguồn tối giản bên phải */}
        <button
          type="button"
          data-source-ref-btn="true"
          onClick={(e) => handleNavigate(activeRef, e)}
          aria-label={tooltipLabel}
          title={`Mở ${activeRef.fileName} (${locationBadgeLabel})`}
          className="group inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-start rounded-full border border-indigo-500/25 bg-white dark:bg-white/[0.08] px-3.5 text-[13px] font-semibold text-indigo-700 dark:text-indigo-300 shadow-2xs transition-colors duration-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 hover:border-indigo-400 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[#4F46E5] sm:self-center cursor-pointer"
        >
          <span>Xem nguồn</span>
          <ArrowUpRight
            className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Vùng đoạn trích dẫn mở rộng đầy đủ */}
      {isExpanded && hasSnippet && (
        <div className="mt-2.5 space-y-2 border-t border-indigo-500/10 pt-2.5 animate-in fade-in-50 slide-in-from-top-1 duration-150">
          {validRefs.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {validRefs.map((ref, idx) => (
                <button
                  key={`${ref.documentId}-${ref.chunkId ?? idx}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIdx(idx);
                  }}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                    idx === safeIdx
                      ? "bg-[#4F46E5] text-white"
                      : "bg-white/80 dark:bg-white/[0.06] text-[var(--on-surface-variant)] hover:text-foreground"
                  }`}
                >
                  Nguồn {idx + 1} ·{" "}
                  {formatCitationLocationLabel({
                    fileName: ref.fileName,
                    pageNumbers: ref.pageNumbers,
                    pageNo: ref.pageNumbers?.[0] ?? 1,
                    textAnchor: ref.textAnchor,
                    headings: ref.headings,
                    chunkIndex: ref.chunkIndex,
                    variant: "compact",
                  })}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-indigo-500/12 bg-white/80 dark:bg-white/[0.04] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#0B1C30] dark:text-neutral-200 select-text whitespace-pre-line">
            &ldquo;{activeRef.snippet}&rdquo;
          </div>
        </div>
      )}
    </div>
  );
}
