"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Volume2,
  FileDown,
  RefreshCw,
  Plus,
  ChevronDown,
  Check,
  Loader2,
  Sparkles,
  MoreVertical,
  Trash2,
  Edit2,
  Send,
  X,
} from "lucide-react";
import { SummaryItem } from "@/types";
import { AutoSaveStatus } from "@/hooks/useSummaries";

interface SummaryToolbarProps {
  summaries: SummaryItem[];
  activeSummary: SummaryItem | null;
  onSelectSummary: (summaryId: string) => void;
  onOpenCreateModal: () => void;
  onToggleTts: () => void;
  isTtsOpen: boolean;
  onExportPdf: () => void;
  isExportingPdf: boolean;
  onRefineSummary: (instruction: string) => Promise<any>;
  isRefining: boolean;
  onRenameSummary: (summaryId: string, newTitle: string) => void;
  onDeleteSummary: (summaryId: string) => void;
  autoSaveStatus: AutoSaveStatus;
}

export default function SummaryToolbar({
  summaries,
  activeSummary,
  onSelectSummary,
  onOpenCreateModal,
  onToggleTts,
  isTtsOpen,
  onExportPdf,
  isExportingPdf,
  onRefineSummary,
  isRefining,
  onRenameSummary,
  onDeleteSummary,
  autoSaveStatus,
}: SummaryToolbarProps) {
  // Dropdown chọn phiên bản
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
  // Popover Yêu cầu AI chỉnh lại
  const [isRefinePopoverOpen, setIsRefinePopoverOpen] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState("");
  // Menu 3 chấm (Đổi tên / Xoá)
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editTitle, setEditTitle] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const refineRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsVersionDropdownOpen(false);
      }
      if (refineRef.current && !refineRef.current.contains(event.target as Node)) {
        setIsRefinePopoverOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRefineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refinePrompt.trim() || isRefining) return;
    const prompt = refinePrompt;
    setRefinePrompt("");
    setIsRefinePopoverOpen(false);
    await onRefineSummary(prompt);
  };

  const handleQuickPrompt = (prompt: string) => {
    setRefinePrompt(prompt);
  };

  const handleStartRename = () => {
    setIsMenuOpen(false);
    setEditTitle(activeSummary?.title || "");
    setIsRenaming(true);
  };

  const handleSaveRename = () => {
    if (activeSummary && editTitle.trim()) {
      onRenameSummary(activeSummary.id, editTitle.trim());
    }
    setIsRenaming(false);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-xs">
      {/* Cụm Bên Trái: Dropdown Phiên bản & Nút Tạo mới & Trạng thái lưu */}
      <div className="flex items-center gap-2.5">
        {/* Dropdown danh sách các bản tóm tắt */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-gray-800 shadow-2xs hover:bg-gray-50 transition-all cursor-pointer max-w-[220px] sm:max-w-[300px]"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-indigo-600" />
            <span className="truncate">
              {activeSummary ? activeSummary.title : "Chọn bản tóm tắt"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          </button>

          {isVersionDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-30 w-72 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Các bản tóm tắt trong cuộc trò chuyện
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {summaries.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onSelectSummary(s.id);
                      setIsVersionDropdownOpen(false);
                    }}
                    className={`flex items-start justify-between w-full rounded-xl px-3 py-2 text-left text-xs transition-all cursor-pointer ${
                      s.id === activeSummary?.id
                        ? "bg-indigo-50 font-semibold text-indigo-900"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate">{s.title}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(s.created_at).toLocaleDateString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </div>
                    </div>
                    {s.id === activeSummary?.id && (
                      <Check className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                    )}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 border-t border-gray-100 pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsVersionDropdownOpen(false);
                    onOpenCreateModal();
                  }}
                  className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tạo bản tóm tắt mới</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Nút Tạo mới nhanh */}
        <button
          type="button"
          onClick={onOpenCreateModal}
          title="Tạo bản tóm tắt mới"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-2xs hover:bg-gray-50 hover:text-indigo-600 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
        </button>

        {/* Trạng thái Auto-save */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-gray-400 pl-1">
          {autoSaveStatus === "saving" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
              <span className="text-indigo-600">Đang lưu...</span>
            </>
          )}
          {autoSaveStatus === "saved" && (
            <>
              <Check className="h-3 w-3 text-emerald-500" />
              <span>Đã lưu</span>
            </>
          )}
          {autoSaveStatus === "unsaved" && (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span>Chưa lưu</span>
            </>
          )}
        </div>
      </div>

      {/* Cụm Bên Phải: Nút Đọc tóm tắt, Yêu cầu AI chỉnh lại, Tải về PDF, Menu */}
      <div className="flex items-center gap-2">
        {/* Nút 🔊 Đọc tóm tắt */}
        <button
          type="button"
          onClick={onToggleTts}
          title="Đọc tóm tắt bằng giọng nói"
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            isTtsOpen
              ? "bg-indigo-600 text-white shadow-xs"
              : "border border-gray-200 bg-white text-gray-700 shadow-2xs hover:bg-gray-50 hover:text-indigo-600"
          }`}
        >
          <Volume2 className="h-4 w-4" />
          <span className="hidden md:inline">Đọc tóm tắt</span>
        </button>

        {/* Nút 🔄 Yêu cầu AI chỉnh lại (Popover) */}
        <div className="relative" ref={refineRef}>
          <button
            type="button"
            onClick={() => setIsRefinePopoverOpen(!isRefinePopoverOpen)}
            disabled={isRefining}
            title="Yêu cầu AI chỉnh sửa lại bản tóm tắt"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 hover:text-indigo-600 transition-all cursor-pointer disabled:opacity-50"
          >
            {isRefining ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
            ) : (
              <RefreshCw className="h-4 w-4 text-indigo-600" />
            )}
            <span className="hidden md:inline">
              {isRefining ? "Đang chỉnh..." : "Yêu cầu AI chỉnh lại"}
            </span>
          </button>

          {isRefinePopoverOpen && (
            <div className="absolute right-0 top-full mt-2 z-40 w-80 sm:w-96 rounded-2xl border border-indigo-100 bg-white p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <h4 className="text-xs font-bold text-gray-900">
                    Yêu cầu AI tinh chỉnh tóm tắt
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRefinePopoverOpen(false)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Quick suggestion chips */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {[
                  "Hãy viết ngắn gọn hơn",
                  "Bổ sung ví dụ thực tế",
                  "Làm rõ các công thức",
                  "Chuyển thành bảng so sánh",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleQuickPrompt(chip)}
                    className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <form onSubmit={handleRefineSubmit} className="space-y-3">
                <textarea
                  rows={3}
                  placeholder="Nhập yêu cầu cụ thể (ví dụ: Hãy bổ sung ví dụ thực tế cho phần cây đỏ đen)..."
                  value={refinePrompt}
                  onChange={(e) => setRefinePrompt(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-800 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-hidden resize-none"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRefinePopoverOpen(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={!refinePrompt.trim() || isRefining}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Cập nhật</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Nút 📄 Tải về PDF */}
        <button
          type="button"
          onClick={onExportPdf}
          disabled={isExportingPdf}
          title="Tải bản tóm tắt dưới dạng file PDF"
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-75"
        >
          {isExportingPdf ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang xuất file...</span>
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4" />
              <span>Tải về PDF</span>
            </>
          )}
        </button>

        {/* Menu More (Đổi tên / Xóa) */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            title="Tùy chọn khác"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-2xs hover:bg-gray-50 transition-all cursor-pointer"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-30 w-44 rounded-2xl border border-gray-100 bg-white p-1 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={handleStartRename}
                className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <Edit2 className="h-3.5 w-3.5 text-gray-500" />
                <span>Đổi tên tóm tắt</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  if (activeSummary && confirm("Bạn có chắc chắn muốn xóa bản tóm tắt này?")) {
                    onDeleteSummary(activeSummary.id);
                  }
                }}
                className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Xóa bản tóm tắt</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Rename mini */}
      {isRenaming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-gray-900">Đổi tên bản tóm tắt</h4>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-800 outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRenaming(false)}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveRename}
                className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
