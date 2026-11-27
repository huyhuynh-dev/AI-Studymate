"use client";

import React from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export interface DeleteWorkspaceModalProps {
  isOpen: boolean;
  subject: {
    id: string;
    name: string;
  } | null;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export default function DeleteWorkspaceModal({
  isOpen,
  subject,
  onClose,
  onConfirm,
}: DeleteWorkspaceModalProps) {
  if (!isOpen || !subject) return null;

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="Xác nhận xóa không gian"
      subtitle="Hành động này không thể hoàn tác"
      confirmLabel="Xác nhận xóa"
      pendingLabel="Đang xóa…"
      description={
        <>
          Bạn có chắc chắn muốn xóa không gian học tập{" "}
          <span className="font-bold text-[#0B1C30] dark:text-white break-words">
            &ldquo;{subject.name}&rdquo;
          </span>
          ? Mọi tài liệu và ghi chú liên quan sẽ bị xóa vĩnh viễn khỏi không gian này.
        </>
      }
      onClose={onClose}
      onConfirm={async () => {
        await onConfirm();
        onClose();
      }}
    />
  );
}
