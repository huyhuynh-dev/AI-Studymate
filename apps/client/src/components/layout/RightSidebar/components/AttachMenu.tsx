"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { FileText, Plus, Upload } from "lucide-react";
import { useClickOutside } from "../hooks/useClickOutside";
import type { AttachedFile, WorkspaceDoc } from "../types";
import { IconButton } from "./IconButton";

interface AttachMenuProps {
  onSelectLocal: () => void;
  availableDocs?: WorkspaceDoc[];
  attachedFiles?: AttachedFile[];
  onSelectWorkspaceDoc: (doc: WorkspaceDoc) => void;
}

export function AttachMenu({
  onSelectLocal,
  availableDocs = [],
  attachedFiles = [],
  onSelectWorkspaceDoc,
}: AttachMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);
  useClickOutside(containerRef, close, isOpen);

  const attachedDocIds = useMemo(() => {
    return new Set(
      attachedFiles
        .filter((f) => f.source === "workspace" && f.documentId)
        .map((f) => f.documentId)
    );
  }, [attachedFiles]);

  return (
    <div ref={containerRef} className="contents">
      <IconButton
        label="Thêm tệp"
        isActive={isOpen}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
      >
        <Plus className="h-4 w-4 stroke-[2]" />
      </IconButton>

      {isOpen && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-72 max-w-[calc(100vw-32px)] rounded-[20px] border border-[#E5EEFF] dark:border-white/[0.12] bg-white/95 dark:bg-[#161922]/95 backdrop-blur-xl p-1.5 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-100 select-none">
          {/* Tùy chọn 1: Tải tệp từ thiết bị */}
          <button
            type="button"
            onClick={() => {
              close();
              onSelectLocal();
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[#EEF2FF] dark:hover:bg-white/[0.06]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] dark:bg-[#4F46E5]/20 text-[#4F46E5] dark:text-[#818CF8]">
              <Upload className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-[#0B1C30] dark:text-[#EFF0F6]">
                Tải tệp từ thiết bị...
              </span>
              <span className="block text-[10px] text-[#777587] dark:text-neutral-400">
                PDF, ảnh, Word, TXT
              </span>
            </span>
          </button>

          {/* Đường phân cách */}
          <div className="my-1 border-t border-[#E5EEFF] dark:border-white/[0.08]" />

          {/* Tiêu đề nhóm */}
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#777587] dark:text-neutral-400 select-none">
            Tài liệu trong phiên học
          </div>

          {/* Danh sách tài liệu có sẵn */}
          {availableDocs.length === 0 ? (
            <div className="px-3 py-2 text-[11px] italic text-[#777587] dark:text-neutral-500">
              Chưa có tài liệu nào trong phiên học
            </div>
          ) : (
            <div className="max-h-48 space-y-0.5 overflow-y-auto pr-0.5">
              {availableDocs.map((doc) => {
                const isAttached = attachedDocIds.has(doc.id);
                return (
                  <button
                    key={doc.id}
                    type="button"
                    disabled={isAttached}
                    onClick={() => {
                      if (!isAttached) {
                        onSelectWorkspaceDoc(doc);
                        close();
                      }
                    }}
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition-colors ${
                      isAttached
                        ? "cursor-default bg-gray-50/70 dark:bg-white/[0.02] text-[#777587]/60"
                        : "cursor-pointer text-[#464555] dark:text-[#EFF0F6] hover:bg-[#EEF2FF] dark:hover:bg-white/[0.06] hover:text-[#4F46E5]"
                    }`}
                  >
                    <FileText
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isAttached ? "text-gray-300 dark:text-neutral-600" : "text-[#4F46E5] dark:text-[#818CF8]"
                      }`}
                    />
                    <span
                      className="flex-1 truncate font-medium"
                      title={doc.file_name}
                    >
                      {doc.file_name}
                    </span>
                    {isAttached && (
                      <span className="shrink-0 text-[10px] text-[#777587]">
                        Đã chọn
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
