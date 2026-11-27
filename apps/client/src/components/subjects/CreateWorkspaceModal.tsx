"use client";

import React, { useState, useRef } from "react";
import { FolderPlus, Edit3, Check, Pipette, Loader2 } from "lucide-react";
import { ModalFooter, ModalHeader, ModalShell } from "@/components/ui/ModalShell";
import { SubjectIconBadge } from "@/components/ui/SubjectIconBadge";

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

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

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
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isFinePointer =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: fine)").matches;

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Vui lòng nhập tên cho không gian học tập");
      nameInputRef.current?.focus();
      return;
    }

    if (trimmedName.length > 255) {
      setError("Tên không gian học tập không được vượt quá 255 ký tự");
      nameInputRef.current?.focus();
      return;
    }

    if (!HEX_COLOR_REGEX.test(selectedColor)) {
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

      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Đã có lỗi xảy ra. Vui lòng thử lại."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen
      onClose={handleClose}
      role="dialog"
      size="md"
      disableDismiss={isSubmitting}
      initialFocusRef={isFinePointer ? nameInputRef : undefined}
      labelledBy="workspace-dialog-title"
    >
      <ModalHeader
        titleId="workspace-dialog-title"
        title={isEditMode ? "Chỉnh sửa không gian" : "Tạo không gian học tập"}
        subtitle={
          isEditMode
            ? "Cập nhật tên và màu sắc nhận diện"
            : "Tổ chức tài liệu và ghi chú theo môn học"
        }
        icon={
          isEditMode ? (
            <Edit3 className="h-4 w-4" />
          ) : (
            <FolderPlus className="h-4 w-4" />
          )
        }
        onClose={handleClose}
        closeDisabled={isSubmitting}
      />

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {/* Field: Name */}
        <div className="space-y-1.5">
          <label
            htmlFor="workspace-name"
            className="block text-[11px] font-semibold font-heading text-[#5E5C6E] dark:text-[#9DA3AF] uppercase tracking-wider"
          >
            Tên không gian <span className="text-[#BA1A1A] dark:text-[#F87171]">*</span>
          </label>
          <input
            ref={nameInputRef}
            id="workspace-name"
            name="workspaceName"
            type="text"
            autoComplete="off"
            disabled={isSubmitting}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "workspace-name-error" : undefined}
            placeholder="VD: Cấu trúc dữ liệu, Ôn thi IELTS…"
            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-[#0B1C30] dark:text-white placeholder-[#5E5C6E] dark:placeholder-[#9DA3AF] outline-none transition-[border-color,background-color,box-shadow] duration-150 motion-reduce:transition-none disabled:opacity-60 ${
              error
                ? "border-[#BA1A1A] bg-rose-50/20 focus:border-[#BA1A1A] focus:ring-3 focus:ring-[#BA1A1A]/15"
                : "border-[#C7C4D8] dark:border-white/[0.12] bg-[#F8F9FF] dark:bg-white/[0.03] hover:bg-white dark:hover:bg-white/[0.06] focus:bg-white dark:focus:bg-[#090B10] focus:border-[#4F46E5] focus:ring-3 focus:ring-[#4F46E5]/15"
            }`}
          />
          {error ? (
            <p
              id="workspace-name-error"
              role="alert"
              className="text-xs text-[#BA1A1A] dark:text-[#F87171]"
            >
              {error}
            </p>
          ) : null}
        </div>

        {/* Field: Color Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="block text-[11px] font-semibold font-heading text-[#5E5C6E] dark:text-[#9DA3AF] uppercase tracking-wider">
              Màu sắc nhận diện
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#4F46E5] dark:text-[#818CF8] hover:text-[#3525CD] font-medium transition-colors rounded-md px-1.5 py-0.5 focus-within:outline-2 focus-within:outline-[#4F46E5]">
              <Pipette aria-hidden="true" className="h-3 w-3" />
              <span className="text-[11px]">Tùy chọn mã màu</span>
              <input
                type="color"
                aria-label="Chọn mã màu tùy chỉnh"
                disabled={isSubmitting}
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="sr-only"
              />
            </label>
          </div>

          <div
            role="group"
            aria-label="Bảng màu gợi ý"
            className="grid grid-cols-6 gap-2.5 rounded-xl border border-[#E5EEFF] dark:border-white/[0.08] bg-[#F8F9FF] dark:bg-white/[0.02] p-3"
          >
            {COLOR_PALETTE.map((color) => {
              const isSelected =
                selectedColor.toLowerCase() === color.hex.toLowerCase();
              return (
                <button
                  key={color.hex}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setSelectedColor(color.hex)}
                  aria-label={`Chọn màu ${color.name}`}
                  aria-pressed={isSelected}
                  title={`${color.name} (${color.hex})`}
                  className={`relative flex h-8 w-8 items-center justify-center rounded-xl transition-transform duration-150 motion-reduce:transition-none cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5] ${
                    isSelected
                      ? "ring-2 ring-offset-2 ring-[#4F46E5] dark:ring-offset-[#12151C] scale-105 shadow-xs"
                      : "hover:scale-105 active:scale-95"
                  }`}
                  style={{ backgroundColor: color.hex }}
                >
                  {isSelected ? (
                    <Check aria-hidden="true" className="h-3.5 w-3.5 text-white drop-shadow-sm" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="space-y-1.5 pt-1">
          <span className="block text-[11px] font-semibold text-[#5E5C6E] dark:text-[#9DA3AF] uppercase tracking-wider">
            Xem trước hiển thị
          </span>
          <div
            style={{
              backgroundImage: `radial-gradient(circle at 90% 15%, ${selectedColor}22 0%, transparent 65%)`,
            }}
            className="flex items-center justify-between rounded-xl bg-white dark:bg-[#161922] border border-[#E5EEFF] dark:border-white/[0.08] p-3 transition-colors shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <SubjectIconBadge color={selectedColor} size="md" variant="solid" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#0B1C30] dark:text-[#EFF0F6] truncate">
                  {name.trim() || "Tên không gian học tập"}
                </p>
                <p className="text-[11px] text-[#5E5C6E] dark:text-[#9DA3AF]">
                  Sẵn sàng ôn luyện &amp; quản lý tài liệu
                </p>
              </div>
            </div>
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full shrink-0 shadow-xs"
              style={{ backgroundColor: selectedColor }}
            />
          </div>
        </div>

        <ModalFooter>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-[#464555] dark:text-neutral-300 bg-[#F8F9FF] dark:bg-white/[0.06] hover:bg-[#E5EEFF] dark:hover:bg-white/[0.1] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5] transition-[background-color,transform] duration-150 motion-reduce:transition-none cursor-pointer disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] hover:bg-[#3525CD] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#4F46E5]/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5] transition-[background-color,transform] duration-150 motion-reduce:transition-none cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                <span>{isEditMode ? "Đang lưu…" : "Đang tạo…"}</span>
              </>
            ) : isEditMode ? (
              <>
                <Edit3 aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Lưu thay đổi</span>
              </>
            ) : (
              <>
                <FolderPlus aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Tạo không gian</span>
              </>
            )}
          </button>
        </ModalFooter>
      </form>
    </ModalShell>
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
