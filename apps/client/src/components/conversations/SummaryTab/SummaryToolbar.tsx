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
  ArrowLeft,
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
  // Expanded view / Focus mode controls (giống DocumentsTab)
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
    <div className="relative z-30 flex items-center justify-between gap-2 border-b border-gray-100 bg-white/95 px-3 py-2 sm:px-4 sm:py-2.5 backdrop-blur-xs select-none">
      {/* Cụm Bên Trái: Nút Quay lại danh sách + Dropdown Phiên bản + Nút Tạo mới + Trạng thái lưu */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        {/* Nút Quay lại danh sách */}
        {onBackToList && (
          <button
            type="button"
            onClick={onBackToList}
            title="Quay lại danh sách các bản tóm tắt"
            className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            {/* <span className="hidden sm:inline">Danh sách</span> */}
          </button>
        )}

        {/* Dropdown danh sách các bản tóm tắt */}
        <div className="relative min-w-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
            title="Nhấn để đổi bản tóm tắt khác"
            className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-gray-200 bg-white px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold text-gray-800 shadow-2xs hover:bg-gray-50 hover:border-indigo-300 transition-all cursor-pointer max-w-[160px] xs:max-w-[200px] sm:max-w-[280px] md:max-w-[340px]"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-indigo-600" />
            <span className="truncate">
              {activeSummary ? activeSummary.title : "Chọn bản tóm tắt"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          </button>

          {/* Menu Dropdown - cố định z-50 với shadow lớn */}
          {isVersionDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-50 w-72 sm:w-80 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-50">
                <span>Các bản tóm tắt ({summaries.length})</span>
                {onBackToList && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsVersionDropdownOpen(false);
                      onBackToList();
                    }}
                    className="text-indigo-600 hover:underline cursor-pointer flex items-center gap-1 lowercase first-letter:uppercase"
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
                    className={`flex items-start justify-between w-full rounded-xl px-2.5 py-2 text-left text-xs transition-all cursor-pointer ${s.id === activeSummary?.id
                      ? "bg-indigo-50 font-semibold text-indigo-900 border border-indigo-100"
                      : "text-gray-700 hover:bg-gray-50 border border-transparent"
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

              {/* Footer Dropdown: Nút Tạo mới
              <div className="mt-1 border-t border-gray-100 pt-1">
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
              */}
            </div>
          )}
        </div>

        {/* Nút Tạo mới nhanh */}
        <button
          type="button"
          onClick={onOpenCreateModal}
          title="Tạo bản tóm tắt mới"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-2xs hover:bg-gray-50 hover:text-indigo-600 transition-all cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
        </button>

        {/* Trạng thái Auto-save */}
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-gray-400 pl-1 shrink-0">
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

      {/* Cụm Bên Phải: Zoom Controls + Mở rộng Focus Mode + Icon Đọc tóm tắt + Icon Tải PDF + Menu 3 chấm */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Bộ điều khiển Phóng to / Thu nhỏ (Zoom) */}
        <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50/60 p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={onZoomOut}
            disabled={zoomPercent <= 75}
            title="Thu nhỏ cỡ chữ"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-600 hover:bg-white hover:text-indigo-600 transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onZoomReset}
            title="Nhấn để đặt lại 100%"
            className="px-1.5 text-[11px] font-semibold text-gray-700 hover:text-indigo-600 transition-colors cursor-pointer min-w-[38px] text-center"
          >
            {zoomPercent}%
          </button>

          <button
            type="button"
            onClick={onZoomIn}
            disabled={zoomPercent >= 175}
            title="Phóng to cỡ chữ"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-600 hover:bg-white hover:text-indigo-600 transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Nút Mở rộng giao diện / Chế độ tập trung (Focus Mode tương tự DocumentsTab) */}
        <button
          type="button"
          onClick={onToggleFocusMode}
          title={
            isFocusMode
              ? "Thoát Chế độ mở rộng (Esc)"
              : "Mở rộng giao diện xem tóm tắt (Chế độ tập trung)"
          }
          className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all active:scale-95 cursor-pointer ${isFocusMode
            ? "border-indigo-600 bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
            : "border-gray-200 bg-white text-gray-700 shadow-2xs hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
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
          className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all cursor-pointer ${isTtsOpen
            ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
            : "border-gray-200 bg-white text-gray-600 shadow-2xs hover:bg-gray-50 hover:text-indigo-600"
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
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-2xs hover:bg-gray-50 hover:text-indigo-600 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
        >
          {isExportingPdf ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          ) : (
            <FileDown className="h-4 w-4 text-indigo-600" />
          )}
        </button>

        {/* Menu 3 chấm (Đổi tên / Xóa - Sẵn sàng mở rộng) */}
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
            <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={handleStartRename}
                className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <Edit2 className="h-3.5 w-3.5 text-gray-500" />
                <span>Đổi tên tóm tắt</span>
              </button>
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsDeleteModalOpen(true);
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

      {/* Modal Rename */}
      {isRenaming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <form
            onSubmit={handleSaveRename}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-gray-100 space-y-4"
          >
            <h4 className="text-sm font-bold text-gray-900">
              Đổi tên bản tóm tắt
            </h4>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-800 outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsRenaming(false)}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!editTitle.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
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
