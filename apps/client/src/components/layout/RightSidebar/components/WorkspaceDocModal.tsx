"use client";

import React, { useEffect } from "react";
import { FileText, FolderOpen, X } from "lucide-react";
import { SAMPLE_WORKSPACE_DOCS } from "../constants";
import type { WorkspaceDoc } from "../types";

interface WorkspaceDocModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (docName: string) => void;
  availableDocs: WorkspaceDoc[];
}

export function WorkspaceDocModal({
  isOpen,
  onClose,
  onSelect,
  availableDocs,
}: WorkspaceDocModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Chưa có tài liệu thật → hiển thị danh sách mẫu (giữ nguyên hành vi cũ)
  const docs = availableDocs.length > 0 ? availableDocs : SAMPLE_WORKSPACE_DOCS;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in-50 duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-doc-title"
        className="w-full max-w-sm space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-indigo-600" />
            <h3 id="workspace-doc-title" className="text-sm font-semibold text-gray-900">
              Chọn tài liệu từ Không gian học tập
            </h3>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-gray-500">
          AI sẽ đọc nội dung tài liệu bạn chọn để trả lời chính xác hơn.
        </p>

        <div className="max-h-60 space-y-1.5 overflow-y-auto">
          {docs.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => {
                onSelect(doc.file_name);
                onClose();
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 p-2.5 text-left text-xs text-gray-800 transition-colors hover:border-indigo-200 hover:bg-indigo-50/60"
            >
              <FileText className="h-4 w-4 shrink-0 text-indigo-500" />
              <span className="flex-1 truncate font-medium">{doc.file_name}</span>
              <span className="shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                Chọn
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
