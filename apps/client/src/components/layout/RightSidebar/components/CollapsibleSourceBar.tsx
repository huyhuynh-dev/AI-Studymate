"use client";

import React, { useState, useMemo } from "react";
import {
  BookOpen,
  ChevronDown,
  FileText,
  Globe,
  ArrowUpRight,
  Calendar,
  Layers,
} from "lucide-react";
import { useCitationNavigation } from "@/contexts/CitationNavigationContext";
import type { CitationBadgeMeta, DocumentCitationItem, WebCitationItem } from "@/lib/citation-parser";

interface CollapsibleSourceBarProps {
  citedList: CitationBadgeMeta[];
  className?: string;
}

export const CollapsibleSourceBar = React.memo(function CollapsibleSourceBar({
  citedList,
  className = "",
}: CollapsibleSourceBarProps) {
  const { navigateToCitation, navigateToWebCitation } = useCitationNavigation();
  const [isExpanded, setIsExpanded] = useState(false);

  // Tính toán số liệu thống kê nguồn trích dẫn
  const stats = useMemo(() => {
    let docSnippetsCount = 0;
    const distinctDocs = new Set<string>();
    let webSourcesCount = 0;

    for (const c of citedList) {
      if (c.sourceType === "document") {
        docSnippetsCount++;
        const docItem = c.item as DocumentCitationItem | undefined;
        if (docItem?.documentId) {
          distinctDocs.add(docItem.documentId);
        } else if (docItem?.fileName) {
          distinctDocs.add(docItem.fileName);
        }
      } else {
        webSourcesCount++;
      }
    }

    const docCount = distinctDocs.size || (docSnippetsCount > 0 ? 1 : 0);
    const totalSources = docSnippetsCount + webSourcesCount;

    let summaryText = "";
    if (webSourcesCount === 0) {
      summaryText = `Đã tham khảo ${docSnippetsCount} đoạn trích từ ${docCount} tài liệu`;
    } else if (docSnippetsCount === 0) {
      summaryText = `Đã tham khảo ${webSourcesCount} nguồn từ Internet`;
    } else {
      summaryText = `Đã tham khảo ${totalSources} nguồn (${docSnippetsCount} đoạn trích từ tài liệu, ${webSourcesCount} trang web)`;
    }

    return {
      totalSources,
      docSnippetsCount,
      docCount,
      webSourcesCount,
      summaryText,
    };
  }, [citedList]);

  if (!citedList || citedList.length === 0) {
    return null;
  }

  const toggleExpand = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  const handleCardClick = (
    e: React.MouseEvent,
    meta: CitationBadgeMeta
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (meta.sourceType === "web") {
      const webItem = meta.item as WebCitationItem | undefined;
      if (webItem?.url) {
        navigateToWebCitation(webItem.url);
      }
      return;
    }

    if (meta.item) {
      navigateToCitation(meta.item);
    } else {
      navigateToCitation({
        documentId: "",
        pageNo: 1,
        citationId: meta.citationId,
      });
    }
  };

  return (
    <div
      className={`my-2 overflow-hidden rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-white/[0.02] shadow-2xs transition-all ${className}`}
    >
      {/* Header thanh tóm tắt bấm để thu gọn / mở rộng */}
      <button
        type="button"
        onClick={toggleExpand}
        className="flex w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-neutral-100/60 dark:hover:bg-white/[0.04]"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <BookOpen className="h-3.5 w-3.5" />
          </span>
          <span className="truncate font-semibold text-neutral-800 dark:text-neutral-200">
            {stats.summaryText}
          </span>
          <span className="shrink-0 text-[11px] text-neutral-400 dark:text-neutral-500">
            {isExpanded ? "(Bấm để thu gọn)" : "(Bấm để mở rộng)"}
          </span>
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 ${
            isExpanded ? "rotate-180 text-indigo-600 dark:text-indigo-400" : ""
          }`}
        />
      </button>

      {/* Danh sách thẻ nguồn mở rộng */}
      {isExpanded && (
        <div className="space-y-2 border-t border-black/[0.05] dark:border-white/[0.06] p-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="grid grid-cols-1 gap-2">
            {citedList.map((meta) => {
              const isWeb = meta.sourceType === "web";
              const docItem = !isWeb ? (meta.item as DocumentCitationItem | undefined) : undefined;
              const webItem = isWeb ? (meta.item as WebCitationItem | undefined) : undefined;

              const pageNo =
                (Array.isArray(docItem?.pageNumbers) && docItem!.pageNumbers.length > 0
                  ? docItem!.pageNumbers[0]
                  : (docItem as any)?.pageNo) || 1;

              const heading =
                Array.isArray(docItem?.headings) && docItem!.headings.length > 0
                  ? docItem!.headings[docItem!.headings.length - 1]
                  : undefined;

              const snippet =
                (docItem?.previewSnippet || docItem?.rawContent || docItem?.content || webItem?.previewSnippet || "")
                  .trim()
                  .slice(0, 200);

              return (
                <div
                  key={meta.citationId}
                  onClick={(e) => handleCardClick(e, meta)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleCardClick(e as any, meta);
                    }
                  }}
                  className="group relative flex cursor-pointer flex-col gap-1.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#12151C] p-2.5 transition-all hover:border-indigo-500/40 hover:shadow-xs active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={`flex h-5 min-w-[20px] items-center justify-center rounded px-1 text-[10px] font-bold tabular-nums border ${
                          isWeb
                            ? "border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                            : "border-indigo-200/60 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                        }`}
                      >
                        {meta.displayNumber}
                      </span>

                      {isWeb ? (
                        webItem?.favicon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={webItem.favicon}
                            alt=""
                            className="h-3 w-3 shrink-0 rounded-xs object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <Globe className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        )
                      ) : (
                        <FileText className="h-3 w-3 shrink-0 text-indigo-600 dark:text-indigo-400" />
                      )}

                      <span className="truncate text-xs font-bold text-neutral-800 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {isWeb
                          ? webItem?.title || webItem?.domain || "Nguồn Web"
                          : docItem?.fileName || "Tài liệu học tập"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!isWeb ? (
                        <span className="rounded bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/30">
                          Trang {pageNo}
                        </span>
                      ) : webItem?.domain ? (
                        <span className="rounded bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">
                          {webItem.domain}
                        </span>
                      ) : null}
                      <ArrowUpRight className="h-3.5 w-3.5 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                    </div>
                  </div>

                  {heading && (
                    <div className="text-[10.5px] font-medium text-neutral-500 dark:text-neutral-400 truncate">
                      {heading}
                    </div>
                  )}

                  {snippet && (
                    <p className="line-clamp-2 text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400 italic">
                      &ldquo;{snippet}&hellip;&rdquo;
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

CollapsibleSourceBar.displayName = "CollapsibleSourceBar";
