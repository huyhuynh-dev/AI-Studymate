"use client";

import React, { useState, useMemo } from "react";
import {
  Sparkles,
  Plus,
  Search,
  Clock,
  MoreVertical,
  Edit2,
  Trash2,
  FileDown,
  ArrowRight,
  BookOpen,
  X,
} from "lucide-react";
import { SummaryItem } from "@/types";
import DeleteSummaryModal from "./DeleteSummaryModal";

interface SummaryListViewProps {
  summaries: SummaryItem[];
  onSelectSummary: (summaryId: string) => void;
  onCreateNew: () => void;
  onRenameSummary: (summaryId: string, newTitle: string) => void;
  onDeleteSummary: (summaryId: string) => void;
  onExportPdf?: (summaryId: string) => void;
  isExportingPdf?: boolean;
}

/**
 * Trích xuất đoạn text ngắn từ BlockNote JSON để làm preview
 */
function extractPreviewText(contentJson: unknown[]): string {
  if (!Array.isArray(contentJson) || contentJson.length === 0) {
    return "Bản tóm tắt học tập được xây dựng bởi AI StudyMate.";
  }

  const parts: string[] = [];

  for (const block of contentJson) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;

    if (Array.isArray(b.content)) {
      for (const item of b.content) {
        if (typeof item === "string" && item.trim()) {
          parts.push(item.trim());
        } else if (item && typeof item === "object") {
          const textObj = item as Record<string, unknown>;
          if (typeof textObj.text === "string" && textObj.text.trim()) {
            parts.push(textObj.text.trim());
          }
        }
      }
    } else if (typeof b.content === "string" && b.content.trim()) {
      parts.push(b.content.trim());
    }

    if (parts.join(" ").length >= 160) {
      break;
    }
  }

  const fullText = parts.join(" ").trim();
  if (!fullText) return "Bản tóm tắt học tập được xây dựng bởi AI StudyMate.";
  return fullText.length > 160 ? `${fullText.slice(0, 157)}...` : fullText;
}

export default function SummaryListView({
  summaries,
  onSelectSummary,
  onCreateNew,
  onRenameSummary,
  onDeleteSummary,
  onExportPdf,
  isExportingPdf,
}: SummaryListViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Modal rename state
  const [renameTarget, setRenameTarget] = useState<SummaryItem | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  // Modal delete state
  const [deleteTarget, setDeleteTarget] = useState<SummaryItem | null>(null);

  // Lọc summaries theo từ khóa tìm kiếm
  const filteredSummaries = useMemo(() => {
    if (!searchQuery.trim()) return summaries;
    const query = searchQuery.toLowerCase().trim();
    return summaries.filter((s) => s.title.toLowerCase().includes(query));
  }, [summaries, searchQuery]);

  const handleOpenRename = (s: SummaryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setRenameTarget(s);
    setRenameTitle(s.title);
  };

  const handleSaveRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (renameTarget && renameTitle.trim()) {
      onRenameSummary(renameTarget.id, renameTitle.trim());
    }
    setRenameTarget(null);
  };

  const handleOpenDelete = (s: SummaryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setDeleteTarget(s);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      onDeleteSummary(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex w-full flex-1 flex-col overflow-hidden select-none">
      {/* Header Bar của Danh sách */}
      <div className="flex flex-col gap-3.5 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#12151C]/80 px-4 sm:px-6 py-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-indigo-50 dark:bg-indigo-950/50 text-[#4F46E5] dark:text-[#818CF8] shadow-2xs">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100">
                Danh sách bản Tóm tắt AI
              </h2>
              <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/40 tabular-nums">
                {summaries.length}
              </span>
            </div>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
              Quản lý và tra cứu các bản tóm tắt học tập trong cuộc trò chuyện này
            </p>
          </div>
        </div>

        {/* Thanh tìm kiếm Spotlight & Nút Tạo mới */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Tìm kiếm tóm tắt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.04] py-1.5 sm:py-2 pl-9 pr-8 text-xs text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 outline-hidden transition-all focus:border-indigo-500 focus:bg-white dark:focus:bg-[#1A1E29] focus:ring-2 focus:ring-indigo-500/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">Tạo tóm tắt mới</span>
            <span className="xs:hidden">Tạo mới</span>
          </button>
        </div>
      </div>

      {/* Grid Danh sách các bản tóm tắt */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-black/[0.01] dark:bg-transparent">
        {filteredSummaries.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-[20px] border border-dashed border-black/[0.1] dark:border-white/[0.1] bg-white/50 dark:bg-[#161922]/50 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-black/[0.03] dark:bg-white/[0.05] text-neutral-400 mb-3">
              <Search className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              Không tìm thấy bản tóm tắt nào
            </h4>
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500 max-w-sm">
              {searchQuery
                ? `Không có tóm tắt nào khớp với từ khóa "${searchQuery}". Hãy thử tìm kiếm với từ khóa khác.`
                : "Chưa có bản tóm tắt nào được tạo trong cuộc trò chuyện này."}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-3 text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8] hover:underline cursor-pointer"
              >
                Xóa tìm kiếm
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSummaries.map((s) => {
              const preview = extractPreviewText(s.content_json);
              const isMenuOpen = activeMenuId === s.id;

              return (
                <div
                  key={s.id}
                  onClick={() => onSelectSummary(s.id)}
                  className="group relative flex flex-col justify-between rounded-[20px] border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#161922] p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <div>
                    {/* Top row: Icon + Menu 3 chấm */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-indigo-50 dark:bg-indigo-950/50 text-[#4F46E5] dark:text-[#818CF8] transition-colors group-hover:bg-[#4F46E5] group-hover:text-white">
                        <Sparkles className="h-4.5 w-4.5" />
                      </div>

                      {/* Dropdown Menu CRUD */}
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setActiveMenuId(isMenuOpen ? null : s.id)}
                          title="Tùy chọn"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {isMenuOpen && (
                          <div
                            className="absolute right-0 top-full mt-1 z-30 w-44 rounded-[18px] border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#1A1E29] p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                            onMouseLeave={() => setActiveMenuId(null)}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleOpenRename(s, e)}
                              className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-neutral-400" />
                              <span>Đổi tên tóm tắt</span>
                            </button>

                            {onExportPdf && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                  onExportPdf(s.id);
                                }}
                                disabled={isExportingPdf}
                                className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <FileDown className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                <span>Tải về PDF</span>
                              </button>
                            )}

                            <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.08]" />

                            <button
                              type="button"
                              onClick={(e) => handleOpenDelete(s, e)}
                              className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Xóa tóm tắt</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm sm:text-[15px] font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                      {s.title}
                    </h3>

                    {/* Preview snippet */}
                    <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400 line-clamp-3">
                      {preview}
                    </p>
                  </div>

                  {/* Card Footer: Ngày tạo + Nút mở */}
                  <div className="mt-4 flex items-center justify-between border-t border-black/[0.05] dark:border-white/[0.06] pt-3 text-[11px] text-neutral-400 dark:text-neutral-500">
                    <div className="flex items-center gap-1.5 tabular-nums">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {new Date(s.created_at).toLocaleDateString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 opacity-90 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                      <span>Xem chi tiết</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Rename - Apple Alert Sheet */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleSaveRename}
            className="w-full max-w-sm rounded-[22px] bg-white dark:bg-[#161922] p-5 shadow-2xl border border-black/[0.06] dark:border-white/[0.1] space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Đổi tên bản tóm tắt
              </h4>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="rounded-full p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1A1E29] p-2.5 text-xs sm:text-sm text-neutral-800 dark:text-neutral-100 outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Nhập tên tóm tắt..."
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.06] active:scale-95 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!renameTitle.trim()}
                className="rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] px-4 py-1.5 text-xs font-semibold text-white active:scale-95 disabled:opacity-50 shadow-xs cursor-pointer"
              >
                Lưu thay đổi
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Delete */}
      <DeleteSummaryModal
        isOpen={!!deleteTarget}
        summaryTitle={deleteTarget?.title}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
