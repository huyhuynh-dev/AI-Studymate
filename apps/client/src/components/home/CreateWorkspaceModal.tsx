"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, FolderPlus, Check, Folder, Pipette } from "lucide-react";

export interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate?: (workspace: { name: string; color: string }) => void;
}

export interface ColorOption {
  name: string;
  hex: string;
}

// Danh sách các màu sắc trực quan có sẵn
export const COLOR_PALETTE: ColorOption[] = [
  { name: "Đen", hex: "#000000" },
  { name: "Indigo", hex: "#4F46E5" },
  { name: "Xanh dương", hex: "#2563EB" },
  { name: "Xanh biển", hex: "#0284C7" },
  { name: "Xanh ngọc", hex: "#0D9488" },
  { name: "Xanh lá", hex: "#16A34A" },
  { name: "Hổ phách", hex: "#CA8A04" },
  { name: "Cam san hô", hex: "#EA580C" },
  { name: "Đỏ", hex: "#DC2626" },
  { name: "Hồng đào", hex: "#E11D48" },
  { name: "Tím hoàng gia", hex: "#9333EA" },
  { name: "Xám đá", hex: "#475569" },
];

export default function CreateWorkspaceModal({
  isOpen,
  onClose,
  onCreate,
}: CreateWorkspaceModalProps) {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState("#000000"); // Mặc định là đen
  const [error, setError] = useState("");

  const handleClose = useCallback(() => {
    setName("");
    setSelectedColor("#000000");
    setError("");
    onClose();
  }, [onClose]);

  // Đóng modal khi nhấn phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Vui lòng nhập tên cho không gian học tập");
      return;
    }

    onCreate?.({
      name: trimmedName,
      color: selectedColor,
    });

    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop (Không đóng khi click ra ngoài) */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-md transform rounded-2xl bg-white p-6 shadow-2xl transition-all border border-gray-100 z-10">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-2xs">
              <FolderPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Tạo không gian học tập mới
              </h3>
              <p className="text-xs text-gray-500">
                Tổ chức tài liệu và ghi chú theo từng môn học
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng modal"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Field: Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="workspace-name"
              className="block text-xs font-semibold text-gray-700 uppercase tracking-wider"
            >
              Tên không gian <span className="text-rose-500">*</span>
            </label>
            <input
              id="workspace-name"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              placeholder="VD: Cấu trúc dữ liệu, Ôn thi IELTS..."
              className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all ${error
                  ? "border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                  : "border-gray-200 bg-gray-50/50 hover:bg-white focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
                }`}
            />
            {error && <p className="text-xs text-rose-500">{error}</p>}
          </div>

          {/* Field: Color Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Màu sắc nhận diện
              </label>
              {/* <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>Mã HEX:</span>
                <span className="font-mono font-semibold text-gray-800 uppercase">
                  {selectedColor}
                </span>
              </div> */}
            </div>

            {/* Color Palette Grid */}
            <div className="grid grid-cols-6 gap-2.5 rounded-xl border border-gray-100 bg-gray-50/40 p-3">
              {COLOR_PALETTE.map((color) => {
                const isSelected =
                  selectedColor.toLowerCase() === color.hex.toLowerCase();
                return (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setSelectedColor(color.hex)}
                    title={`${color.name} (${color.hex})`}
                    className={`group relative flex h-9 w-9 items-center justify-center rounded-xl transition-transform hover:scale-110 cursor-pointer shadow-2xs ${isSelected
                        ? "ring-2 ring-indigo-500 ring-offset-2 scale-105"
                        : "hover:ring-1 hover:ring-gray-300"
                      }`}
                    style={{ backgroundColor: color.hex }}
                  >
                    {isSelected && (
                      <Check className="h-4 w-4 text-white drop-shadow-md" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom Color Input Option */}
            <div className="flex items-center justify-between pt-1 text-xs text-gray-500">
              <span className="text-[11px]">Chọn màu tùy chỉnh khác:</span>
              <label className="flex items-center gap-1.5 cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs">
                <Pipette className="h-3 w-3 text-gray-500" />
                <span>Bảng màu mở rộng</span>
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Xem trước hiển thị
            </span>
            <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 p-3 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-2xs transition-colors shrink-0"
                  style={{ backgroundColor: selectedColor }}
                >
                  <Folder className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">
                    {name.trim() || "Tên không gian học tập"}
                  </p>
                  <p className="text-[10px] text-gray-400">0 tài liệu</p>
                </div>
              </div>
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: selectedColor }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span>Tạo không gian</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { CreateWorkspaceModal };
