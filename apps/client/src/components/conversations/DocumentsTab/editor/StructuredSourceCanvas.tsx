"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  Search,
  Sparkles,
  Table as TableIcon,
  X,
} from 'lucide-react';
import type { DocumentEditorLanguage } from './document-format-profiles';
import { validateStructuredContent } from './structured-validation.helper';
import {
  resolveStructuredTextCitation,
  type EditorCitationTarget,
  type StructuredCitationResolution,
} from './text-anchor-resolver';

export { validateStructuredContent };

export interface StructuredSourceCanvasProps {
  value: string;
  onChange: (nextValue: string) => void;
  language: DocumentEditorLanguage;
  readOnly?: boolean;
  compactReaderMode?: boolean;
  citationTarget?: EditorCitationTarget | null;
  scrollToCitationNonce?: number;
  onCitationResolved?: (resolution: StructuredCitationResolution | null) => void;
  onCitationDismiss?: () => void;
}

function getEditedLineRange(prevText: string, nextText: string): { startLine: number; endLine: number } {
  const prevNorm = prevText.replace(/\r\n/g, '\n');
  const nextNorm = nextText.replace(/\r\n/g, '\n');
  const minLen = Math.min(prevNorm.length, nextNorm.length);

  let prefixLen = 0;
  while (prefixLen < minLen && prevNorm[prefixLen] === nextNorm[prefixLen]) {
    prefixLen += 1;
  }

  let prevEnd = prevNorm.length;
  let nextEnd = nextNorm.length;
  while (prevEnd > prefixLen && nextEnd > prefixLen && prevNorm[prevEnd - 1] === nextNorm[nextEnd - 1]) {
    prevEnd -= 1;
    nextEnd -= 1;
  }

  const startLine = prevNorm.slice(0, prefixLen).split('\n').length;
  const endLine = prevNorm.slice(0, Math.max(prefixLen, prevEnd)).split('\n').length;
  return { startLine, endLine: Math.max(startLine, endLine) };
}

function parseCsvPreviewRows(csvText: string, maxRows = 300): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentCell);
      currentCell = '';
    } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      if (ch === '\r') i += 1;
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      if (rows.length >= maxRows) break;
    } else if (ch !== '\r') {
      currentCell += ch;
    }
  }

  if (rows.length < maxRows && (currentCell.length > 0 || currentRow.length > 0)) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

export function StructuredSourceCanvas({
  value,
  onChange,
  language,
  readOnly = false,
  compactReaderMode = false,
  citationTarget,
  scrollToCitationNonce = 0,
  onCitationResolved,
  onCitationDismiss,
}: StructuredSourceCanvasProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const csvContainerRef = useRef<HTMLDivElement>(null);
  const onCitationResolvedRef = useRef(onCitationResolved);
  const lastAutoScrollKeyRef = useRef<string | null>(null);

  const [csvViewMode, setCsvViewMode] = useState<'source' | 'table'>('source');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    onCitationResolvedRef.current = onCitationResolved;
  });

  const lines = useMemo(() => value.replace(/\r\n/g, '\n').split('\n'), [value]);
  const jsonError = useMemo(
    () => validateStructuredContent(language, value),
    [language, value],
  );
  const csvRows = useMemo(
    () => (language === 'csv' && csvViewMode === 'table' ? parseCsvPreviewRows(value) : []),
    [language, csvViewMode, value],
  );

  const citationResolution = useMemo(
    () => resolveStructuredTextCitation(value, citationTarget),
    [value, citationTarget],
  );

  const highlightedLineRange = useMemo(() => {
    if (
      !citationResolution ||
      citationResolution.tier === 4 ||
      !citationResolution.startLine ||
      !citationResolution.endLine
    ) {
      return null;
    }
    return {
      startLine: citationResolution.startLine,
      endLine: citationResolution.endLine,
      tier: citationResolution.tier,
    };
  }, [citationResolution]);

  useEffect(() => {
    queueMicrotask(() => {
      onCitationResolvedRef.current?.(citationResolution);
    });
  }, [citationResolution]);

  useEffect(() => {
    if (!citationTarget) {
      lastAutoScrollKeyRef.current = null;
      return;
    }
    if (!highlightedLineRange) return;

    const scrollKey = `${citationTarget.nonce}:${scrollToCitationNonce}:${csvViewMode}`;
    if (lastAutoScrollKeyRef.current === scrollKey) {
      return;
    }
    lastAutoScrollKeyRef.current = scrollKey;

    requestAnimationFrame(() => {
      if (language === 'csv' && csvViewMode === 'table') {
        const container = csvContainerRef.current;
        if (!container) return;
        const firstRow = container.querySelector<HTMLElement>(
          '[data-csv-citation-highlight="true"]',
        );
        firstRow?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const ta = textareaRef.current;
      if (!ta) return;
      const lineMid = (highlightedLineRange.startLine + highlightedLineRange.endLine) / 2;
      const lineMidPx = 16 + (lineMid - 0.5) * 24;
      const targetTop = Math.max(0, lineMidPx - ta.clientHeight / 2);
      ta.scrollTo({ top: targetTop, behavior: 'smooth' });
    });
  }, [citationTarget, scrollToCitationNonce, highlightedLineRange, language, csvViewMode]);

  const handleSyncScroll = () => {
    if (textareaRef.current) {
      setScrollTop(textareaRef.current.scrollTop);
      if (gutterRef.current) {
        gutterRef.current.scrollTop = textareaRef.current.scrollTop;
      }
    }
  };

  const handleSourceTextChange = (nextValue: string) => {
    if (highlightedLineRange && onCitationDismiss) {
      const edited = getEditedLineRange(value, nextValue);
      if (
        edited.startLine <= highlightedLineRange.endLine &&
        edited.endLine >= highlightedLineRange.startLine
      ) {
        onCitationDismiss();
      }
    }
    onChange(nextValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      setIsSearchOpen(true);
      return;
    }

    if (e.key === 'Tab' && !readOnly) {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;

      if (e.shiftKey) {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        if (value.slice(lineStart, lineStart + 2) === '  ') {
          const next = value.slice(0, lineStart) + value.slice(lineStart + 2);
          onChange(next);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              const offset = Math.max(lineStart, start - 2);
              textareaRef.current.setSelectionRange(offset, Math.max(offset, end - 2));
            }
          });
        }
        return;
      }

      const next = `${value.slice(0, start)}  ${value.slice(end)}`;
      onChange(next);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(start + 2, start + 2);
        }
      });
    }
  };

  const handlePrettyPrintJson = () => {
    if (language !== 'json' || readOnly || jsonError) return;
    try {
      const formatted = JSON.stringify(JSON.parse(value), null, 2);
      onChange(formatted);
    } catch {
      // Đã có banner hiển thị lỗi cú pháp
    }
  };

  const handleFindNext = () => {
    if (!searchQuery || !textareaRef.current) return;
    const el = textareaRef.current;
    const lowerText = value.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const startFrom = el.selectionEnd;
    let idx = lowerText.indexOf(lowerQuery, startFrom);
    if (idx === -1) {
      idx = lowerText.indexOf(lowerQuery, 0);
    }
    if (idx !== -1) {
      el.focus();
      el.setSelectionRange(idx, idx + searchQuery.length);
    }
  };

  const handleReplaceAll = () => {
    if (!searchQuery || readOnly) return;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const next = value.replace(new RegExp(escaped, 'g'), replaceQuery);
    onChange(next);
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      {/* Toolbar phụ trợ cho Structured Markup */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.08] bg-neutral-50/90 dark:bg-[#131722] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {language === 'json' && (
            <>
              <div
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  jsonError
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {jsonError ? (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>JSON chưa hợp lệ</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>JSON hợp lệ</span>
                  </>
                )}
              </div>

              {!readOnly && (
                <button
                  type="button"
                  onClick={handlePrettyPrintJson}
                  disabled={Boolean(jsonError)}
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] px-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/[0.12] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Định dạng đẹp (Prettify)</span>
                </button>
              )}
            </>
          )}

          {language === 'csv' && (
            <div className="inline-flex items-center rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-neutral-100/80 dark:bg-white/[0.05] p-0.5">
              <button
                type="button"
                onClick={() => setCsvViewMode('source')}
                className={`inline-flex h-6 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold transition-all cursor-pointer ${
                  csvViewMode === 'source'
                    ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >
                <Code2 className="h-3 w-3" />
                <span>Mã CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setCsvViewMode('table')}
                className={`inline-flex h-6 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold transition-all cursor-pointer ${
                  csvViewMode === 'table'
                    ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >
                <TableIcon className="h-3 w-3" />
                <span>Xem bảng</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsSearchOpen((prev) => !prev)}
            title="Tìm kiếm & Thay thế (Ctrl+F)"
            className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors cursor-pointer ${
              isSearchOpen
                ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                : 'border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.12]'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            {!compactReaderMode && <span>Tìm kiếm</span>}
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
          <span>{lines.length.toLocaleString()} dòng</span>
          <span>•</span>
          <span>{value.length.toLocaleString()} ký tự</span>
        </div>
      </div>

      {/* Thanh báo lỗi cú pháp JSON (nếu có) */}
      {language === 'json' && jsonError && (
        <div className="flex items-center gap-2 border-b border-rose-500/20 bg-rose-500/[0.08] px-3.5 py-2 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="truncate font-mono">{jsonError}</span>
        </div>
      )}

      {/* Thanh Tìm kiếm & Thay thế */}
      {isSearchOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/95 dark:bg-[#161922] px-3 py-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleFindNext();
              }
            }}
            placeholder="Tìm chuỗi..."
            className="h-7 w-40 sm:w-52 rounded-lg border border-black/[0.1] dark:border-white/[0.12] bg-neutral-50 dark:bg-white/[0.04] px-2.5 text-xs text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={handleFindNext}
            className="h-7 rounded-lg bg-indigo-500/10 px-2.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 cursor-pointer"
          >
            Tìm tiếp
          </button>
          {!readOnly && csvViewMode !== 'table' && (
            <>
              <input
                type="text"
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                placeholder="Thay bằng..."
                className="h-7 w-36 sm:w-44 rounded-lg border border-black/[0.1] dark:border-white/[0.12] bg-neutral-50 dark:bg-white/[0.04] px-2.5 text-xs text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleReplaceAll}
                className="h-7 rounded-lg bg-neutral-100 dark:bg-white/[0.08] px-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-white/[0.14] cursor-pointer"
              >
                Thay tất cả
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setIsSearchOpen(false)}
            aria-label="Đóng thanh tìm kiếm"
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Bảng CSV (nếu bật) hoặc Canvas Monospace + Số dòng */}
      {language === 'csv' && csvViewMode === 'table' ? (
        <div
          ref={csvContainerRef}
          className="flex-1 overflow-auto p-4 bg-white dark:bg-[#0D1017]"
        >
          {csvRows.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Tệp CSV không có dữ liệu.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-black/[0.08] dark:border-white/[0.08]">
              <table className="w-full border-collapse text-left text-xs sm:text-[13px]">
                <thead className="bg-neutral-100/90 dark:bg-white/[0.05] font-semibold text-neutral-800 dark:text-neutral-100">
                  <tr
                    data-csv-citation-highlight={
                      highlightedLineRange &&
                      highlightedLineRange.startLine <= 1 &&
                      highlightedLineRange.endLine >= 1
                        ? 'true'
                        : undefined
                    }
                    className={
                      highlightedLineRange &&
                      highlightedLineRange.startLine <= 1 &&
                      highlightedLineRange.endLine >= 1
                        ? highlightedLineRange.tier === 3
                          ? 'studymate-source-line-highlight--partial'
                          : 'studymate-source-line-highlight'
                        : ''
                    }
                  >
                    <th className="w-10 border-b border-r border-black/[0.06] dark:border-white/[0.08] px-2.5 py-2 text-center text-[11px] font-mono text-neutral-400">
                      #
                    </th>
                    {csvRows[0].map((cell, cIdx) => (
                      <th
                        key={`h-${cIdx}`}
                        className="border-b border-r last:border-r-0 border-black/[0.06] dark:border-white/[0.08] px-3 py-2"
                      >
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvRows.slice(1).map((row, rIdx) => {
                    const fileLineNumber = rIdx + 2;
                    const isRowHighlighted =
                      highlightedLineRange !== null &&
                      fileLineNumber >= highlightedLineRange.startLine &&
                      fileLineNumber <= highlightedLineRange.endLine;

                    return (
                      <tr
                        key={`r-${rIdx}`}
                        data-csv-citation-highlight={isRowHighlighted ? 'true' : undefined}
                        className={
                          isRowHighlighted
                            ? highlightedLineRange?.tier === 3
                              ? 'studymate-source-line-highlight--partial'
                              : 'studymate-source-line-highlight'
                            : 'even:bg-neutral-50/60 dark:even:bg-white/[0.02] hover:bg-indigo-500/[0.04]'
                        }
                      >
                        <td className="border-b border-r border-black/[0.05] dark:border-white/[0.06] px-2.5 py-2 text-center text-[11px] font-mono text-neutral-400">
                          {rIdx + 1}
                        </td>
                        {csvRows[0].map((_, cIdx) => (
                          <td
                            key={`c-${rIdx}-${cIdx}`}
                            className="border-b border-r last:border-r-0 border-black/[0.05] dark:border-white/[0.06] px-3 py-2 text-neutral-700 dark:text-neutral-300"
                          >
                            {row[cIdx] ?? ''}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="relative flex flex-1 min-h-0 overflow-hidden bg-white dark:bg-[#0D1017]">
          {/* Cột đánh số dòng */}
          <div
            ref={gutterRef}
            aria-hidden="true"
            className="w-12 shrink-0 overflow-hidden border-r border-black/[0.06] dark:border-white/[0.08] bg-neutral-50/80 dark:bg-[#11141D] py-4 pr-2.5 text-right font-mono text-[12px] leading-6 text-neutral-400 dark:text-neutral-500 select-none tabular-nums"
          >
            {lines.map((_, idx) => {
              const lineNum = idx + 1;
              const isHighlighted =
                highlightedLineRange !== null &&
                lineNum >= highlightedLineRange.startLine &&
                lineNum <= highlightedLineRange.endLine;
              return (
                <div
                  key={idx}
                  className={
                    isHighlighted
                      ? highlightedLineRange?.tier === 3
                        ? 'rounded-l bg-amber-500/20 font-semibold text-amber-700 dark:text-amber-300 -mr-2.5 pr-2.5'
                        : 'rounded-l bg-indigo-500/15 font-semibold text-indigo-700 dark:text-indigo-300 -mr-2.5 pr-2.5'
                      : undefined
                  }
                >
                  {lineNum}
                </div>
              );
            })}
          </div>

          <div className="relative flex-1 min-w-0 overflow-hidden">
            {highlightedLineRange && (
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute left-0 right-0 z-0 ${
                  highlightedLineRange.tier === 3
                    ? 'studymate-source-line-highlight--partial'
                    : 'studymate-source-line-highlight'
                }`}
                style={{
                  top: `${16 + (highlightedLineRange.startLine - 1) * 24 - scrollTop}px`,
                  height: `${Math.max(1, highlightedLineRange.endLine - highlightedLineRange.startLine + 1) * 24}px`,
                }}
              />
            )}

            <textarea
              ref={textareaRef}
              value={value}
              readOnly={readOnly}
              onChange={(e) => handleSourceTextChange(e.target.value)}
              onScroll={handleSyncScroll}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              aria-label={`Trình soạn thảo mã nguồn ${language.toUpperCase()}`}
              className="relative z-10 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent p-4 font-mono text-[13px] leading-6 text-neutral-900 dark:text-neutral-100 outline-none selection:bg-indigo-500/20"
            />
          </div>
        </div>
      )}
    </div>
  );
}
