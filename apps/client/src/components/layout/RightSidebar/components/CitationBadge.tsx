"use client";

import React, { useState, useRef } from "react";
import {
  FileText,
  Globe,
  ArrowUpRight,
  Calendar,
  Image as ImageIcon,
  Table as TableIcon,
  Layers,
} from "lucide-react";
import { useCitationNavigation } from "@/contexts/CitationNavigationContext";
import type { CitationItem, DocumentCitationItem, WebCitationItem, RetrievedChunkAsset } from "@/lib/citation-parser";

interface CitationBadgeProps {
  displayNumber: string | number;
  citationId: string;
  item?: CitationItem;
  className?: string;
}

export const CitationBadge = React.memo(function CitationBadge({
  displayNumber,
  citationId,
  item,
  className = "",
}: CitationBadgeProps) {
  const { navigateToCitation, navigateToWebCitation } = useCitationNavigation();
  const [isOpen, setIsOpen] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isWeb = citationId.startsWith("w") || item?.sourceType === "web";
  const webItem = isWeb ? (item as WebCitationItem | undefined) : undefined;
  const docItem = !isWeb ? (item as DocumentCitationItem | undefined) : undefined;

  // Xử lý assets nếu có (ảnh / biểu đồ / bảng)
  const assets: RetrievedChunkAsset[] = Array.isArray(docItem?.assets)
    ? (docItem!.assets as RetrievedChunkAsset[])
    : [];
  const hasImages = assets.some((a) => a.assetType === "image" || a.assetType === "chart");
  const hasTables = assets.some((a) => a.assetType === "table");

  // Xử lý số trang
  const pageNo =
    (Array.isArray(docItem?.pageNumbers) && docItem!.pageNumbers.length > 0
      ? docItem!.pageNumbers[0]
      : (docItem as any)?.pageNo) || 1;

  // Xử lý heading
  const heading =
    Array.isArray(docItem?.headings) && docItem!.headings.length > 0
      ? docItem!.headings[docItem!.headings.length - 1]
      : undefined;

  // Đoạn trích dẫn
  const snippet =
    (docItem?.previewSnippet || docItem?.rawContent || docItem?.content || webItem?.previewSnippet || "")
      .trim()
      .slice(0, 240);

  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Ngăn sự kiện click lan ra ngoài gây đóng highlight

    if (isWeb && webItem?.url) {
      navigateToWebCitation(webItem.url);
      return;
    }

    if (docItem) {
      navigateToCitation(docItem);
    } else {
      // Fallback nếu item chưa kịp nạp vào map
      navigateToCitation({
        documentId: "",
        pageNo: 1,
        citationId,
      });
    }
  };

  return (
    <span
      className="relative inline-flex items-center align-baseline mx-0.5 select-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Trích dẫn ${displayNumber}: ${isWeb ? webItem?.title || webItem?.domain : docItem?.fileName || citationId}`}
        className={`group inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums transition-all active:scale-95 cursor-pointer shadow-2xs border ${
          isWeb
            ? "border-emerald-200/70 dark:border-emerald-800/40 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 hover:border-emerald-300 dark:hover:bg-emerald-900/50"
            : "border-indigo-200/70 dark:border-indigo-800/40 bg-indigo-50/90 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 hover:border-indigo-300 dark:hover:bg-indigo-900/50"
        } ${className}`}
      >
        {isWeb ? (
          webItem?.favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={webItem.favicon}
              alt=""
              className="h-2.5 w-2.5 shrink-0 rounded-xs object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none";
              }}
            />
          ) : (
            <Globe className="h-2.5 w-2.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          )
        ) : (
          <FileText className="h-2.5 w-2.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
        )}
        <span>{displayNumber}</span>
      </button>

      {/* Popover xem trước nổi chuẩn Apple HIG Glassmorphism */}
      {isOpen && (
        <div
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 sm:w-80 rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#161922]/95 backdrop-blur-xl p-3 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150 text-left pointer-events-auto"
        >
          {/* Header Popover */}
          <div className="flex items-start justify-between gap-2 border-b border-black/[0.05] dark:border-white/[0.08] pb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${
                  isWeb
                    ? "border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                    : "border-indigo-200/60 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                }`}
              >
                {displayNumber}
              </span>
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-neutral-900 dark:text-white">
                  {isWeb
                    ? webItem?.title || webItem?.domain || "Nguồn Internet"
                    : docItem?.fileName || "Tài liệu học tập"}
                </div>
                <div className="flex items-center gap-1.5 text-[10.5px] text-neutral-500 dark:text-neutral-400">
                  {isWeb ? (
                    <>
                      {webItem?.favicon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={webItem.favicon}
                          alt=""
                          className="h-3 w-3 shrink-0 rounded-xs object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                      )}
                      <span className="truncate">{webItem?.domain || "Web"}</span>
                      {webItem?.publishedDate && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Calendar className="h-2.5 w-2.5" />
                            {webItem.publishedDate}
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        Trang {pageNo}
                      </span>
                      {heading && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[140px]">{heading}</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClick}
              title={isWeb ? "Mở liên kết web" : `Mở trang ${pageNo}`}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/80 dark:bg-white/[0.05] text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 cursor-pointer"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Body Snippet */}
          {snippet && (
            <p className="mt-2 line-clamp-3 text-[11.5px] leading-relaxed text-neutral-600 dark:text-neutral-300 italic">
              &ldquo;{snippet}&hellip;&rdquo;
            </p>
          )}

          {/* Badges bổ trợ Assets / Bảng biểu */}
          {!isWeb && (hasImages || hasTables) && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {hasImages && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/80 dark:bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                  <ImageIcon className="h-3 w-3" />
                  <span>Có hình minh họa</span>
                </span>
              )}
              {hasTables && (
                <span className="inline-flex items-center gap-1 rounded-md border border-cyan-200/60 dark:border-cyan-800/40 bg-cyan-50/80 dark:bg-cyan-950/30 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700 dark:text-cyan-400">
                  <TableIcon className="h-3 w-3" />
                  <span>Có bảng số liệu</span>
                </span>
              )}
            </div>
          )}

          {/* Action Button ở chân Popover */}
          <div className="mt-2.5 pt-2 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-end">
            <button
              type="button"
              onClick={handleClick}
              className={`inline-flex items-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                isWeb
                  ? "text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                  : "text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
              }`}
            >
              <span>{isWeb ? "Mở bài viết gốc" : `Nhảy tới Trang ${pageNo}`}</span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </span>
  );
});

CitationBadge.displayName = "CitationBadge";
