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

// Danh sách các màu sắc nhận diện EdTech kết hợp Apple HIG (DESIGN.md)
export const COLOR_PALETTE: ColorOption[] = [
  { name: "Indigo", hex: "#4F46E5" },
  { name: "Xanh dương", hex: "#2563EB" },
  { name: "Xanh ngọc", hex: "#0D9488" },
  { name: "Xanh lá (Sage)", hex: "#006C49" },
  { name: "Hổ phách (Amber)", hex: "#CA8A04" },
  { name: "Cam san hô", hex: "#EA580C" },
  { name: "Đỏ", hex: "#DC2626" },
  { name: "Hồng đào", hex: "#E11D48" },
  { name: "Tím đậm", hex: "#571AC0" },
  { name: "Tím hoàng gia", hex: "#9333EA" },
  { name: "Xám đá", hex: "#475569" },
  { name: "Đen tuyền", hex: "#0B1C30" },
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

  // Đóng modal khi nhấn Escape
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
      setError("Mã màu không hợp lệ. Vui lòng chọn màu HEX hợp lệ");
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
      {/* Apple Translucent Dimming Backdrop */}
      <div
        className="fixed inset-0 bg-[#0B1C30]/40 backdrop-blur-md transition-opacity duration-200"
        aria-hidden="true"
        onClick={handleClose}
      />

      {/* Modal Dialog Surface */}
      <div className="relative w-full max-w-md transform rounded-[22px] bg-white dark:bg-[#12151C] p-6 shadow-2xl transition-all border border-[#E5EEFF] dark:border-white/[0.12] z-10 select-none">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5EEFF] dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF2FF] dark:bg-white/[0.06] text-[#4F46E5] dark:text-[#818CF8]">
              {isEditMode ? <Edit3 className="h-4 w-4" /> : <FolderPlus className="h-4 w-4" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0B1C30] dark:text-[#EFF0F6] tracking-tight">
                {isEditMode ? "Chỉnh sửa không gian" : "Tạo không gian học tập"}
              </h3>
              <p className="text-xs text-[#777587] dark:text-neutral-400">
                {isEditMode
                  ? "Cập nhật tên và màu sắc nhận diện"
                  : "Tổ chức tài liệu và ghi chú theo môn học"}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleClose}
            aria-label="Đóng"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F8F9FF] dark:bg-white/[0.08] text-[#777587] hover:text-[#0B1C30] dark:hover:text-white transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Field: Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="workspace-name"
              className="block text-[11px] font-semibold text-[#777587] dark:text-neutral-400 uppercase tracking-wider"
            >
              Tên không gian <span className="text-[#BA1A1A]">*</span>
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
              className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-[#0B1C30] dark:text-white placeholder-[#777587] outline-none transition-all disabled:opacity-60 ${
                error
                  ? "border-[#BA1A1A] bg-rose-50/20 focus:border-[#BA1A1A] focus:ring-3 focus:ring-[#BA1A1A]/15"
                  : "border-[#C7C4D8] dark:border-white/[0.1] bg-[#F8F9FF] dark:bg-white/[0.03] hover:bg-white focus:bg-white dark:focus:bg-black focus:border-[#4F46E5] focus:ring-3 focus:ring-[#4F46E5]/15"
              }`}
            />
            {error && <p className="text-xs text-[#BA1A1A]">{error}</p>}
          </div>

          {/* Field: Color Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-semibold text-[#777587] dark:text-neutral-400 uppercase tracking-wider">
                Màu sắc nhận diện
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#4F46E5] hover:text-[#3525CD] font-medium transition-colors">
                <Pipette className="h-3 w-3" />
                <span className="text-[11px]">Tùy chọn mã màu</span>
                <input
                  type="color"
                  disabled={isSubmitting}
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="sr-only"
                />
              </label>
            </div>

            {/* Color Palette Grid */}
            <div className="grid grid-cols-6 gap-2.5 rounded-xl border border-[#E5EEFF] dark:border-white/[0.08] bg-[#F8F9FF] dark:bg-white/[0.02] p-3">
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
                    className={`group relative flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-150 cursor-pointer disabled:cursor-not-allowed ${
                      isSelected
                        ? "ring-2 ring-offset-2 ring-[#4F46E5] dark:ring-offset-neutral-900 scale-105 shadow-xs"
                        : "hover:scale-105 active:scale-95"
                    }`}
                    style={{ backgroundColor: color.hex }}
                  >
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-white drop-shadow-sm" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Apple Live Preview Card */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-semibold text-[#777587] dark:text-neutral-400 uppercase tracking-wider">
              Xem trước hiển thị
            </span>
            <div
              style={{
                backgroundImage: `radial-gradient(circle at 90% 15%, ${selectedColor}22 0%, transparent 65%)`,
              }}
              className="flex items-center justify-between rounded-xl bg-white dark:bg-[#161922] border border-[#E5EEFF] dark:border-white/[0.08] p-3 transition-colors shadow-xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-xs transition-colors shrink-0"
                  style={{ backgroundColor: selectedColor }}
                >
                  <Folder className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#0B1C30] dark:text-[#EFF0F6] truncate">
                    {name.trim() || "Tên không gian học tập"}
                  </p>
                  <p className="text-[10px] text-[#777587] dark:text-[#9DA3AF]">Không gian ôn luyện & tài liệu</p>
                </div>
              </div>
              <span
                className="h-2 w-2 rounded-full shrink-0 shadow-xs"
                style={{ backgroundColor: selectedColor }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#E5EEFF] dark:border-white/[0.08]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-[#464555] dark:text-neutral-300 bg-[#F8F9FF] dark:bg-white/[0.06] hover:bg-[#E5EEFF] dark:hover:bg-white/[0.1] active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] hover:bg-[#3525CD] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#4F46E5]/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-98 transition-all cursor-pointer"
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
