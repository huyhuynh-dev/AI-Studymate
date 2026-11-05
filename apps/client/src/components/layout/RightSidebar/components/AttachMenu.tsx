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

/**
 * Nút "+" và Popover Menu dạng nhúng (Embedded List) ngay phía trên ô chat.
 * Tinh gọn tương tác: người dùng chỉ cần click (+) rồi click vào tên file có sẵn là gắn ngay.
 */
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
        <Plus className="h-4 w-4" />
      </IconButton>

      {isOpen && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-72 max-w-[calc(100vw-32px)] rounded-2xl border border-gray-200/90 bg-white p-1.5 shadow-xl animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Tùy chọn 1: Tải tệp từ thiết bị */}
          <button
            type="button"
            onClick={() => {
              close();
              onSelectLocal();
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-indigo-50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Upload className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-gray-900">
                Tải tệp từ thiết bị...
              </span>
              <span className="block text-[10px] text-gray-500">
                Mở Explorer (PDF, ảnh, Word, TXT)
              </span>
            </span>
          </button>

          {/* Đường phân cách */}
          <div className="my-1 border-t border-gray-100" />

          {/* Tiêu đề nhóm: ĐÍNH KÈM TÀI LIỆU CÓ SẴN */}
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 select-none">
            Đính kèm tài liệu có sẵn
          </div>

          {/* Danh sách tài liệu có sẵn */}
          {availableDocs.length === 0 ? (
            <div className="px-3 py-2 text-[11px] italic text-gray-400">
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
                        ? "cursor-default bg-gray-50/70 text-gray-400"
                        : "cursor-pointer text-gray-700 hover:bg-indigo-50 hover:text-indigo-900"
                    }`}
                  >
                    <FileText
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isAttached ? "text-gray-300" : "text-indigo-500"
                      }`}
                    />
                    <span
                      className="flex-1 truncate font-medium"
                      title={doc.file_name}
                    >
                      {doc.file_name}
                    </span>
                    {isAttached && (
                      <span className="shrink-0 text-[10px] text-gray-400">
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
