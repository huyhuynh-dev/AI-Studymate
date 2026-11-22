"use client";

import React from 'react';
import {
  AlertTriangle,
  BookmarkCheck,
  LocateFixed,
  Sparkles,
  X,
} from 'lucide-react';
import { formatCitationLocationLabel } from '@/lib/citation-label.helper';
import type {
  CitationResolutionTier,
  EditorCitationTarget,
} from './text-anchor-resolver';

export interface CitationEvidenceBannerProps {
  target: EditorCitationTarget;
  resolvedTier: CitationResolutionTier;
  resolvedStartLine?: number | null;
  resolvedEndLine?: number | null;
  onScrollToLocation: () => void;
  onDismiss: () => void;
}

const TIER_META: Record<
  CitationResolutionTier,
  {
    badgeLabel: string;
    toneClass: string;
    containerClass: string;
    icon: 'exact' | 'relocated' | 'partial' | 'deleted';
  }
> = {
  1: {
    badgeLabel: 'Khớp chính xác',
    toneClass:
      'border-indigo-500/25 bg-indigo-500/12 text-indigo-700 dark:text-indigo-300',
    containerClass:
      'border-indigo-500/20 bg-indigo-500/[0.06] dark:bg-indigo-500/[0.1]',
    icon: 'exact',
  },
  2: {
    badgeLabel: 'Đã dịch chuyển vị trí',
    toneClass:
      'border-sky-500/25 bg-sky-500/12 text-sky-700 dark:text-sky-300',
    containerClass:
      'border-sky-500/20 bg-sky-500/[0.06] dark:bg-sky-500/[0.1]',
    icon: 'relocated',
  },
  3: {
    badgeLabel: 'Đoạn gốc đã sửa — gần nhất',
    toneClass:
      'border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300',
    containerClass:
      'border-amber-500/25 bg-amber-500/[0.07] dark:bg-amber-500/[0.1]',
    icon: 'partial',
  },
  4: {
    badgeLabel: 'Không còn trong bản hiện tại',
    toneClass:
      'border-rose-500/30 bg-rose-500/12 text-rose-700 dark:text-rose-300',
    containerClass:
      'border-rose-500/25 bg-rose-500/[0.06] dark:bg-rose-500/[0.1]',
    icon: 'deleted',
  },
};

export function CitationEvidenceBanner({
  target,
  resolvedTier,
  resolvedStartLine,
  resolvedEndLine,
  onScrollToLocation,
  onDismiss,
}: CitationEvidenceBannerProps) {
  const meta = TIER_META[resolvedTier];

  const effectiveAnchor =
    typeof resolvedStartLine === 'number' && typeof resolvedEndLine === 'number'
      ? {
          ...(target.textAnchor ?? {
            charStart: 0,
            charEnd: 0,
            quoteExact: target.rawContent ?? '',
          }),
          startLine: resolvedStartLine,
          endLine: resolvedEndLine,
        }
      : target.textAnchor;

  const locationLabel = formatCitationLocationLabel({
    fileName: target.fileName,
    pageNo: target.pageNo,
    textAnchor: effectiveAnchor,
    headings: target.headings,
    chunkIndex: target.chunkIndex,
    variant: 'detailed',
  });

  const historicalQuote = (target.textAnchor?.quoteExact || target.rawContent || '')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <div
      role="region"
      aria-label="Thông tin đối chứng nguồn trích dẫn"
      className={`mx-3 mt-2.5 shrink-0 rounded-xl border px-3 py-2 backdrop-blur-md transition-colors ${meta.containerClass}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.toneClass}`}
          >
            {meta.icon === 'deleted' || meta.icon === 'partial' ? (
              <AlertTriangle className="h-3 w-3 shrink-0" />
            ) : meta.icon === 'relocated' ? (
              <Sparkles className="h-3 w-3 shrink-0" />
            ) : (
              <BookmarkCheck className="h-3 w-3 shrink-0" />
            )}
            <span>{meta.badgeLabel}</span>
          </span>

          <span className="truncate text-[12px] font-semibold text-foreground">
            {locationLabel}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {resolvedTier !== 4 && (
            <button
              type="button"
              onClick={onScrollToLocation}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-white/80 dark:bg-white/[0.08] px-2.5 text-[11.5px] font-semibold text-foreground shadow-2xs transition-colors hover:bg-white dark:hover:bg-white/[0.14] cursor-pointer"
            >
              <LocateFixed className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Cuộn tới vị trí</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDismiss}
            title="Đóng tô sáng (Esc)"
            aria-label="Đóng tô sáng trích dẫn"
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] px-2 text-[11.5px] font-medium text-neutral-600 dark:text-neutral-300 transition-colors hover:bg-white dark:hover:bg-white/[0.12] hover:text-foreground cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
            <span>Đóng</span>
          </button>
        </div>
      </div>

      {resolvedTier === 4 && historicalQuote && (
        <div className="mt-2 rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-white/75 dark:bg-black/25 px-2.5 py-2 text-[12px] leading-relaxed text-neutral-700 dark:text-neutral-300">
          <p className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
            Trích dẫn gốc tại thời điểm AI phản hồi
          </p>
          <p className="line-clamp-3 italic">&ldquo;{historicalQuote}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
