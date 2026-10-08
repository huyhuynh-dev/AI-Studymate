"use client";

import React, { useEffect, useRef } from "react";
import { Edit3, Trash2 } from "lucide-react";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ConversationContextMenuProps {
  isOpen: boolean;
  position: ContextMenuPosition;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ConversationContextMenu({
  isOpen,
  position,
  onClose,
  onEdit,
  onDelete,
}: ConversationContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng context menu khi click ra ngoài hoặc cuộn trang
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Giữ menu không tràn ra ngoài màn hình
  const adjustedX = Math.min(position.x, (typeof window !== "undefined" ? window.innerWidth : 1000) - 200);
  const adjustedY = Math.min(position.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 120);

  return (
    <div
      ref={menuRef}
      style={{
        top: `${adjustedY}px`,
        left: `${adjustedX}px`,
      }}
      data-context-menu="true"
      className="fixed z-50 min-w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => {
          onEdit();
          onClose();
        }}
        className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50/60 transition-colors text-left cursor-pointer"
      >
        <Edit3 className="w-4 h-4 text-gray-400 group-hover:text-indigo-500" />
        <span>Chỉnh sửa</span>
      </button>

      <div className="h-px bg-gray-100 my-1" />

      <button
        type="button"
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer"
      >
        <Trash2 className="w-4 h-4 text-red-500" />
        <span>Xóa phiên học</span>
      </button>
    </div>
  );
}
