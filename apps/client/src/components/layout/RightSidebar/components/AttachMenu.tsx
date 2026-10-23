"use client";

import React, { useCallback, useRef, useState } from "react";
import { FolderOpen, Plus, Upload } from "lucide-react";
import { useClickOutside } from "../hooks/useClickOutside";
import { IconButton } from "./IconButton";

interface AttachMenuProps {
  onSelectLocal: () => void;
  onSelectWorkspace: () => void;
}

/**
 * Nút "+" và menu thêm tệp.
 * Menu được căn theo ô nhập (ChatComposer, đang là `relative`),
 * nên wrapper dùng `display: contents`.
 */
export function AttachMenu({ onSelectLocal, onSelectWorkspace }: AttachMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);
  useClickOutside(containerRef, close, isOpen);

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
        <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl animate-in fade-in-50 zoom-in-95 duration-100">
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
            <span>
              <span className="block text-xs font-semibold text-gray-900">
                Tải tệp từ thiết bị
              </span>
              <span className="block text-[10px] text-gray-500">
                PDF, ảnh, Word, TXT
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              close();
              onSelectWorkspace();
            }}
            className="mt-0.5 flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-indigo-50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <FolderOpen className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-xs font-semibold text-gray-900">
                Không gian học tập
              </span>
              <span className="block text-[10px] text-gray-500">
                Chọn tài liệu đã lưu sẵn
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
