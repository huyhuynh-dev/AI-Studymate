"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Volume2,
  FileDown,
  Plus,
  ChevronDown,
  Check,
  Loader2,
  Sparkles,
  MoreVertical,
  Trash2,
  Edit2,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  List,
} from "lucide-react";
import { SummaryItem } from "@/types";
import { AutoSaveStatus } from "@/hooks/useSummaries";
import DeleteSummaryModal from "./DeleteSummaryModal";

interface SummaryToolbarProps {
  summaries: SummaryItem[];
  activeSummary: SummaryItem | null;
  onSelectSummary: (summaryId: string) => void;
  onOpenCreateModal: () => void;
  onBackToList?: () => void;
  onToggleTts: () => void;
  isTtsOpen: boolean;
  onExportPdf: () => void;
  isExportingPdf: boolean;
  onRenameSummary: (summaryId: string, newTitle: string) => void;
  onDeleteSummary: (summaryId: string) => void;
  autoSaveStatus: AutoSaveStatus;
  // Zoom controls
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  // Expanded view / Focus mode controls
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
}

export default function SummaryToolbar({
  summaries,
  activeSummary,
  onSelectSummary,
  onOpenCreateModal,
  onBackToList,
  onToggleTts,
  isTtsOpen,
  onExportPdf,
  isExportingPdf,
  onRenameSummary,
  onDeleteSummary,
  autoSaveStatus,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  isFocusMode,
  onToggleFocusMode,
}: SummaryToolbarProps) {
  // Dropdown chọn phiên bản
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
  // Menu 3 chấm (Đổi tên / Xoá)
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsVersionDropdownOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStartRename = () => {
    setIsMenuOpen(false);
    setEditTitle(activeSummary?.title || "");
    setIsRenaming(true);
  };

  const handleSaveRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeSummary && editTitle.trim()) {
      onRenameSummary(activeSummary.id, editTitle.trim());
    }
    setIsRenaming(false);
  };

  const handleConfirmDelete = () => {
    if (activeSummary) {
      onDeleteSummary(activeSummary.id);
    }
  };

  return (
    <div className="relative z-30 flex items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#12151C]/80 px-3 py-2 sm:px-4 sm:py-2.5 backdrop-blur-md select-none">
      {/* Cụm Bên Trái: Nút Quay lại danh sách + Dropdown Phiên bản + Nút Tạo mới + Trạng thái lưu */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        {/* Nút Quay lại danh sách phong cách Apple Pill */}
        {onBackToList && (
          <button
            type="button"
            onClick={onBackToList}
            title="Quay lại danh sách các bản tóm tắt"
            className="flex h-8 w-8 sm:h-8.5 sm:w-8.5 items-center justify-center rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-300 shadow-2xs hover:bg-black/[0.05] dark:hover:bg-white/[0.06] hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>
        )}

        {/* Dropdown danh sách các bản tóm tắt */}
        <div className="relative min-w-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
            title="Nhấn để đổi bản tóm tắt khác"
            className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-semibold font-heading text-neutral-800 dark:text-neutral-200 shadow-2xs hover:bg-black/[0.05] dark:hover:bg-white/[0.06] hover:border-indigo-300 dark:hover:border-indigo-700 active:scale-98 transition-all cursor-pointer max-w-[150px] xs:max-w-[190px] sm:max-w-[260px] md:max-w-[320px]"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span className="truncate">
              {activeSummary ? activeSummary.title : "Chọn bản tóm tắt"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
          </button>

          {/* Menu Dropdown - Apple Popover */}
          {isVersionDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-50 w-72 sm:w-80 rounded-[20px] border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#1A1E29] p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-3 py-2 text-[11px] font-bold font-heading uppercase tracking-wider text-neutral-400 dark:text-neutral-500 border-b border-black/[0.06] dark:border-white/[0.08]">
                <span>Các bản tóm tắt ({summaries.length})</span>
                {onBackToList && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsVersionDropdownOpen(false);
                      onBackToList();
                    }}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1 lowercase first-letter:uppercase"
                  >
                    <List className="h-3 w-3" />
                    <span>Xem tất cả</span>
                  </button>
                )}
              </div>

              {/* Danh sách các item tóm tắt */}
              <div className="max-h-64 overflow-y-auto space-y-0.5 p-1">
                {summaries.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onSelectSummary(s.id);
                      setIsVersionDropdownOpen(false);
                    }}
                    className={`flex items-start justify-between w-full rounded-xl px-2.5 py-2 text-left text-xs transition-all cursor-pointer ${
                      s.id === activeSummary?.id
                        ? "bg-indigo-50 dark:bg-indigo-950/40 font-semibold text-indigo-900 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50"
                        : "text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate">{s.title}</div>
                      <div className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 tabular-nums">
                        {new Date(s.created_at).toLocaleDateString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </div>
                    </div>
                    {s.id === activeSummary?.id && (
                      <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Nút Tạo mới nhanh */}
        <button
          type="button"
          onClick={onOpenCreateModal}
          title="Tạo bản tóm tắt mới"
          className="flex h-8 w-8 sm:h-8.5 sm:w-8.5 items-center justify-center rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-300 shadow-2xs hover:bg-black/[0.05] dark:hover:bg-white/[0.06] hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
        </button>

        {/* Trạng thái Auto-save */}
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 pl-1 shrink-0">
          {autoSaveStatus === "saving" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
              <span className="text-indigo-600 dark:text-indigo-400">Đang lưu...</span>
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

      {/* Cụm Bên Phải: Zoom Controls + Mở rộng Focus Mode + Icon Đọc tóm tắt + Icon Tải PDF + Menu 3 chấm */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Bộ điều khiển Phóng to / Thu nhỏ (Zoom) - Apple Segmented Control */}
        <div className="flex items-center rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.04] dark:bg-white/[0.06] p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={onZoomOut}
            disabled={zoomPercent <= 75}
            title="Thu nhỏ cỡ chữ"
            className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-[#1C2029] hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onZoomReset}
            title="Nhấn để đặt lại 100%"
            className="px-2 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer min-w-[40px] text-center tabular-nums"
          >
            {zoomPercent}%
          </button>

          <button
            type="button"
            onClick={onZoomIn}
            disabled={zoomPercent >= 175}
            title="Phóng to cỡ chữ"
            className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-[#1C2029] hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Nút Mở rộng giao diện / Chế độ tập trung (Focus Mode) */}
        <button
          type="button"
          onClick={onToggleFocusMode}
          title={
            isFocusMode
              ? "Thoát Chế độ mở rộng (Esc)"
              : "Mở rộng giao diện xem tóm tắt (Chế độ tập trung)"
          }
          className={`flex h-8 w-8 sm:h-8.5 sm:w-8.5 items-center justify-center rounded-full border transition-all active:scale-95 cursor-pointer ${
            isFocusMode
              ? "border-indigo-600 bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
              : "border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-300 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400"
          }`}
        >
          {isFocusMode ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>

        {/* Icon 🔊 Đọc tóm tắt (TTS) có Tooltip */}
        <button
          type="button"
          onClick={onToggleTts}
          title={isTtsOpen ? "Đang mở trình đọc giọng nói (Bấm để đóng)" : "Đọc tóm tắt bằng giọng nói"}
          className={`flex h-8 w-8 sm:h-8.5 sm:w-8.5 items-center justify-center rounded-full border transition-all active:scale-95 cursor-pointer ${
            isTtsOpen
              ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
              : "border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] hover:text-indigo-600 dark:hover:text-indigo-400"
          }`}
        >
          <Volume2 className="h-4 w-4" />
        </button>

        {/* Icon 📄 Tải về PDF có Tooltip */}
        <button
          type="button"
          onClick={onExportPdf}
          disabled={isExportingPdf}
          title={isExportingPdf ? "Đang xuất file PDF..." : "Tải về bản tóm tắt PDF"}
          className="flex h-8 w-8 sm:h-8.5 sm:w-8.5 items-center justify-center rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-300 shadow-2xs hover:bg-black/[0.05] dark:hover:bg-white/[0.06] hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
        >
          {isExportingPdf ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
          ) : (
            <FileDown className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          )}
        </button>

        {/* Menu 3 chấm (Đổi tên / Xóa) */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            title="Tùy chọn khác"
            className="flex h-8 w-8 sm:h-8.5 sm:w-8.5 items-center justify-center rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-300 shadow-2xs hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-all cursor-pointer"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-[20px] border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#1A1E29] p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={handleStartRename}
                className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <Edit2 className="h-3.5 w-3.5 text-neutral-400" />
                <span>Đổi tên tóm tắt</span>
              </button>
              <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.08]" />
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsDeleteModalOpen(true);
                }}
                className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Xóa bản tóm tắt</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Rename - Apple Alert Sheet */}
      {isRenaming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleSaveRename}
            className="w-full max-w-sm rounded-[22px] bg-white dark:bg-[#161922] p-5 shadow-2xl border border-black/[0.06] dark:border-white/[0.1] space-y-4 animate-in zoom-in-95 duration-200"
          >
            <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Đổi tên bản tóm tắt
            </h4>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1A1E29] p-2.5 text-xs sm:text-sm text-neutral-800 dark:text-neutral-100 outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsRenaming(false)}
                className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.06] active:scale-95 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!editTitle.trim()}
                className="rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50 active:scale-95 shadow-xs cursor-pointer"
              >
                Lưu
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Delete */}
      <DeleteSummaryModal
        isOpen={isDeleteModalOpen}
        summaryTitle={activeSummary?.title}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
