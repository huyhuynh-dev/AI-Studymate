"use client";

import React, { useState, useMemo } from "react";
import {
  Sparkles,
  Plus,
  Search,
  FileText,
  Clock,
  MoreVertical,
  Edit2,
  Trash2,
  FileDown,
  ArrowRight,
  BookOpen,
  Calendar,
  X,
  Loader2,
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
function extractPreviewText(contentJson: any[]): string {
  if (!Array.isArray(contentJson) || contentJson.length === 0) {
    return "Bản tóm tắt học tập được xây dựng bởi AI StudyMate.";
  }

  const parts: string[] = [];

  for (const block of contentJson) {
    if (!block) continue;

    if (Array.isArray(block.content)) {
      for (const item of block.content) {
        if (typeof item === "string" && item.trim()) {
          parts.push(item.trim());
        } else if (typeof item?.text === "string" && item.text.trim()) {
          parts.push(item.text.trim());
        }
      }
    } else if (typeof block.content === "string" && block.content.trim()) {
      parts.push(block.content.trim());
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
    <div className="flex w-full flex-1 flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-gray-200/80 bg-white shadow-2xs">
      {/* Header Bar của Danh sách */}
      <div className="flex flex-col gap-3.5 border-b border-gray-100 bg-white/95 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-2xs">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                Danh sách bản Tóm tắt AI
              </h2>
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                {summaries.length}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Quản lý và tra cứu các bản tóm tắt học tập trong cuộc trò chuyện này
            </p>
          </div>
        </div>

        {/* Thanh tìm kiếm & Nút Tạo mới */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm tóm tắt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 pl-9 pr-8 text-xs text-gray-800 placeholder:text-gray-400 outline-hidden transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition-all hover:bg-indigo-700 active:scale-[0.98] cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Tạo tóm tắt mới</span>
          </button>
        </div>
      </div>

      {/* Grid Danh sách các bản tóm tắt */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/40">
        {filteredSummaries.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 mb-3">
              <Search className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold text-gray-800">
              Không tìm thấy bản tóm tắt nào
            </h4>
            <p className="mt-1 text-xs text-gray-500 max-w-sm">
              {searchQuery
                ? `Không có tóm tắt nào khớp với từ khóa "${searchQuery}". Hãy thử tìm kiếm với từ khóa khác.`
                : "Chưa có bản tóm tắt nào được tạo trong cuộc trò chuyện này."}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
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
                  className="group relative flex flex-col justify-between rounded-2xl border border-gray-200/90 bg-white p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md cursor-pointer"
                >
                  <div>
                    {/* Top row: Icon + Menu 3 chấm */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                        <Sparkles className="h-4.5 w-4.5" />
                      </div>

                      {/* Dropdown Menu CRUD */}
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setActiveMenuId(isMenuOpen ? null : s.id)}
                          title="Tùy chọn"
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {isMenuOpen && (
                          <div
                            className="absolute right-0 top-full mt-1 z-30 w-44 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150"
                            onMouseLeave={() => setActiveMenuId(null)}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleOpenRename(s, e)}
                              className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-gray-500" />
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
                                className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <FileDown className="h-3.5 w-3.5 text-indigo-600" />
                                <span>Tải về PDF</span>
                              </button>
                            )}

                            <div className="my-1 border-t border-gray-100" />

                            <button
                              type="button"
                              onClick={(e) => handleOpenDelete(s, e)}
                              className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Xóa tóm tắt</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                      {s.title}
                    </h3>

                    {/* Preview snippet */}
                    <p className="mt-2 text-xs leading-relaxed text-gray-500 line-clamp-3">
                      {preview}
                    </p>
                  </div>

                  {/* Card Footer: Ngày tạo + Nút mở */}
                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-[11px] text-gray-400">
                    <div className="flex items-center gap-1.5">
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

                    <div className="flex items-center gap-1 font-semibold text-indigo-600 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
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

      {/* Modal Rename */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <form
            onSubmit={handleSaveRename}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900">
                Đổi tên bản tóm tắt
              </h4>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-800 outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Nhập tên tóm tắt..."
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!renameTitle.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
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
