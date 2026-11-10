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
  const adjustedX = Math.min(position.x, (typeof window !== "undefined" ? window.innerWidth : 1000) - 180);
  const adjustedY = Math.min(position.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 120);

  return (
    <div
      ref={menuRef}
      style={{
        top: `${adjustedY}px`,
        left: `${adjustedX}px`,
      }}
      data-context-menu="true"
      className="fixed z-50 min-w-44 bg-white/95 dark:bg-[#161922]/95 backdrop-blur-xl rounded-xl shadow-xl shadow-[#0B1C30]/5 dark:shadow-black/40 border border-[#E5EEFF] dark:border-white/[0.12] p-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => {
          onEdit();
          onClose();
        }}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-medium text-[#464555] dark:text-[#EFF0F6] hover:bg-[#4F46E5] hover:text-white rounded-lg transition-colors text-left cursor-pointer"
      >
        <Edit3 className="w-3.5 h-3.5" />
        <span>Chỉnh sửa tên</span>
      </button>

      <div className="h-px bg-[#E5EEFF] dark:bg-white/[0.08] my-1" />

      <button
        type="button"
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-medium text-[#BA1A1A] dark:text-rose-400 hover:bg-[#BA1A1A] hover:text-white rounded-lg transition-colors text-left cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Xóa phiên học</span>
      </button>
    </div>
  );
}
