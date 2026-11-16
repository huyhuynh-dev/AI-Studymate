"use client";

import React from "react";
import { ArrowUpRight, FileText } from "lucide-react";
import { useFocusMode } from "@/components/layout/FocusModeContext";
import { useCitationNavigation } from "@/contexts/CitationNavigationContext";
import { formatSourcePageLabel, type SourceReference } from "@/types";

export interface SourceReferenceButtonProps {
  sourceRefs?: SourceReference[];
  variant?: "card" | "inline" | "compact";
  align?: "left" | "center";
  className?: string;
  onBeforeNavigate?: () => void;
}

/**
 * Nút & thẻ đối chứng nguồn tài liệu gốc ("Xem nguồn trong PDF") chuẩn Apple HIG.
 * Khi bấm sẽ thoát FocusMode hiện tại (nếu có) và điều hướng qua CitationNavigationContext
 * để mở đúng trang PDF và tô sáng vùng bboxes của đoạn văn gốc.
 */
export function SourceReferenceButton({
  sourceRefs,
  variant = "inline",
  align = "left",
  className = "",
  onBeforeNavigate,
}: SourceReferenceButtonProps) {
  const { navigateToDocumentCitation } = useCitationNavigation();
  const { setFocusMode } = useFocusMode();

  const validRefs = Array.isArray(sourceRefs)
    ? sourceRefs.filter((r) => Boolean(r?.documentId))
    : [];

  if (validRefs.length === 0) {
    return null;
  }

  const primary = validRefs[0];
  const pageNo = primary.pageNumbers?.[0] ?? 1;
  const pageLabel = formatSourcePageLabel(primary.pageNumbers);
  const latestHeading =
    Array.isArray(primary.headings) && primary.headings.length > 0
      ? primary.headings[primary.headings.length - 1]
      : undefined;

  const handleNavigate = (
    ref: SourceReference,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    onBeforeNavigate?.();
    setFocusMode(false);
    navigateToDocumentCitation({
      documentId: ref.documentId,
      fileName: ref.fileName,
      pageNo: ref.pageNumbers?.[0] ?? 1,
      bboxes: ref.bboxes,
      rawContent: ref.snippet,
    });
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        data-source-ref-btn="true"
        onClick={(e) => handleNavigate(primary, e)}
        title={`Xem nguồn trong PDF: ${primary.fileName} (${pageLabel})${latestHeading ? ` · ${latestHeading}` : ""}`}
        className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-indigo-200/70 dark:border-indigo-500/30 bg-indigo-50/80 dark:bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-indigo-700 dark:text-indigo-300 transition-all hover:bg-indigo-100 dark:hover:bg-indigo-500/20 hover:border-indigo-300 active:scale-95 cursor-pointer ${className}`}
      >
        <FileText className="h-3 w-3 shrink-0" aria-hidden />
        <span>{pageLabel}</span>
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
          const label = formatSourcePageLabel(ref.pageNumbers);
          return (
            <button
              key={`${ref.documentId}-${ref.chunkId ?? idx}`}
              type="button"
              data-source-ref-btn="true"
              onClick={(e) => handleNavigate(ref, e)}
              title={
                ref.snippet
                  ? `Mở ${ref.fileName} (${label}): "${ref.snippet}"`
                  : `Mở ${ref.fileName} (${label})`
              }
              className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-indigo-200/80 dark:border-indigo-500/30 bg-indigo-50/90 dark:bg-indigo-500/12 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 shadow-2xs transition-all duration-200 hover:bg-indigo-100 dark:hover:bg-indigo-500/22 hover:border-indigo-300 dark:hover:border-indigo-400/50 active:scale-[0.97] cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
              <span className="truncate max-w-[200px] sm:max-w-[260px]">
                Xem nguồn trong PDF · {ref.fileName}
              </span>
              <span className="shrink-0 rounded-full bg-white/80 dark:bg-white/10 px-1.5 py-0.2 text-[11px] font-bold tabular-nums text-indigo-700 dark:text-indigo-200">
                {label}
              </span>
              <ArrowUpRight
                className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-2.5 rounded-2xl border border-indigo-500/15 bg-indigo-500/[0.04] dark:bg-indigo-500/[0.08] p-3.5 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/12 text-indigo-600 dark:text-indigo-400">
          <FileText className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-foreground">
            <span className="truncate max-w-[260px] sm:max-w-[360px]">
              {primary.fileName}
            </span>
            <span className="text-[var(--on-surface-variant)]">·</span>
            <span className="tabular-nums text-indigo-600 dark:text-indigo-400">
              {pageLabel}
            </span>
            {latestHeading && (
              <>
                <span className="text-[var(--on-surface-variant)]">·</span>
                <span className="truncate max-w-[200px] text-[12.5px] font-medium text-[var(--on-surface-variant)]">
                  {latestHeading}
                </span>
              </>
            )}
          </div>
          {primary.snippet && (
            <p className="mt-0.5 line-clamp-1 text-[12.5px] italic text-[var(--on-surface-variant)]">
              &ldquo;{primary.snippet}&rdquo;
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        data-source-ref-btn="true"
        onClick={(e) => handleNavigate(primary, e)}
        className="group inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-start rounded-full border border-indigo-500/25 bg-white dark:bg-white/[0.08] px-3.5 text-[13px] font-semibold text-indigo-700 dark:text-indigo-300 shadow-2xs transition-all duration-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 hover:border-indigo-400 active:scale-[0.97] sm:self-center cursor-pointer"
      >
        <span>Xem nguồn trong PDF (Trang {pageNo})</span>
        <ArrowUpRight
          className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden
        />
      </button>
    </div>
  );
}
