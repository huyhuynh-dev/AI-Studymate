"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, FolderPlus, Edit3, Check, Folder, Pipette, Loader2 } from "lucide-react";

export interface CreateWorkspaceModalProps {
  isOpen: boolean;
  mode?: "create" | "edit";
  initialData?: {
    id?: string;
    name: string;
    color?: string | null;
  } | null;
  onClose: () => void;
  onSubmit?: (workspace: { name: string; color: string }) => Promise<void> | void;
  /** Giữ lại prop cũ để tương thích ngược */
  onCreate?: (workspace: { name: string; color: string }) => void;
}

export interface ColorOption {
  name: string;
  hex: string;
}

// Danh sách các màu sắc trực quan có sẵn
export const COLOR_PALETTE: ColorOption[] = [
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
  { name: "Đen", hex: "#000000" },
];

interface WorkspaceDialogProps {
  mode: "create" | "edit";
  initialData?: {
    id?: string;
    name: string;
    color?: string | null;
  } | null;
  onClose: () => void;
  onSubmit?: (workspace: { name: string; color: string }) => Promise<void> | void;
  onCreate?: (workspace: { name: string; color: string }) => void;
}

function WorkspaceDialog({
  mode,
  initialData,
  onClose,
  onSubmit,
  onCreate,
}: WorkspaceDialogProps) {
  const isEditMode = mode === "edit";
  const [name, setName] = useState(isEditMode && initialData ? initialData.name : "");
  const [selectedColor, setSelectedColor] = useState(
    isEditMode && initialData?.color ? initialData.color : "#4F46E5"
  );
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    onClose();
  }, [isSubmitting, onClose]);

  // Đóng modal khi nhấn phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, handleClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Vui lòng nhập tên cho không gian học tập");
      return;
    }

    if (trimmedName.length > 255) {
      setError("Tên không gian học tập không được vượt quá 255 ký tự");
      return;
    }

    const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
    if (!hexRegex.test(selectedColor)) {
      setError("Mã màu không hợp lệ. Vui lòng chọn màu có định dạng HEX (vd: #4F46E5)");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      if (onSubmit) {
        await onSubmit({
          name: trimmedName,
          color: selectedColor,
        });
      } else if (onCreate) {
        onCreate({
          name: trimmedName,
          color: selectedColor,
        });
      }

      handleClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Đã có lỗi xảy ra. Vui lòng thử lại."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
        aria-hidden="true"
        onClick={handleClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-md transform rounded-2xl bg-white p-6 shadow-2xl transition-all border border-gray-100 z-10">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-2xs">
              {isEditMode ? <Edit3 className="h-5 w-5" /> : <FolderPlus className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {isEditMode ? "Chỉnh sửa không gian học tập" : "Tạo không gian học tập mới"}
              </h3>
              <p className="text-xs text-gray-500">
                {isEditMode
                  ? "Cập nhật tên và màu sắc nhận diện của không gian"
                  : "Tổ chức tài liệu và ghi chú theo từng môn học"}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleClose}
            aria-label="Đóng modal"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer disabled:opacity-40"
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
              disabled={isSubmitting}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              placeholder="VD: Cấu trúc dữ liệu, Ôn thi IELTS..."
              className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all disabled:opacity-60 ${error
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
                    disabled={isSubmitting}
                    onClick={() => setSelectedColor(color.hex)}
                    title={`${color.name} (${color.hex})`}
                    className={`group relative flex h-9 w-9 items-center justify-center rounded-xl transition-transform hover:scale-110 cursor-pointer shadow-2xs disabled:cursor-not-allowed ${isSelected
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
                  disabled={isSubmitting}
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
                  <p className="text-[10px] text-gray-400">Không gian học tập</p>
                </div>
              </div>
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: selectedColor }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClose}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors cursor-pointer disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{isEditMode ? "Đang lưu..." : "Đang tạo..."}</span>
                </>
              ) : isEditMode ? (
                <>
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Lưu thay đổi</span>
                </>
              ) : (
                <>
                  <FolderPlus className="h-3.5 w-3.5" />
                  <span>Tạo không gian</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CreateWorkspaceModal({
  isOpen,
  mode = "create",
  initialData,
  onClose,
  onSubmit,
  onCreate,
}: CreateWorkspaceModalProps) {
  if (!isOpen) return null;

  return (
    <WorkspaceDialog
      key={`${mode}-${initialData?.id || "new"}`}
      mode={mode}
      initialData={initialData}
      onClose={onClose}
      onSubmit={onSubmit}
      onCreate={onCreate}
    />
  );
}

export { CreateWorkspaceModal, CreateWorkspaceModal as WorkspaceModal };
