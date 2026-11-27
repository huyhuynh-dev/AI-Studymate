"use client";

import React from "react";
import { Plus, X, Maximize2, Minimize2 } from "lucide-react";
import type { ChatSessionItem } from "../types";
import { HistoryMenu } from "./HistoryMenu";
import { IconButton } from "./IconButton";

interface ChatHeaderProps {
  title: string;
  sessions: ChatSessionItem[];
  isLoading: boolean;
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => Promise<void>;
  onDeleteChat: (id: string) => Promise<void>;
  onNewChat: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /** Slot bổ sung bên phải (ví dụ khay tác vụ nền) */
  headerRightSlot?: React.ReactNode;
  /** Nếu không truyền, nút đóng sẽ được ẩn */
  onClose?: () => void;
}

export function ChatHeader({
  title,
  sessions,
  isLoading,
  activeChatId,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  onNewChat,
  isFullscreen = false,
  onToggleFullscreen,
  headerRightSlot,
  onClose,
}: ChatHeaderProps) {
  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[#E5EEFF] dark:border-white/[0.08] bg-white dark:bg-[#12151C] px-4 select-none">
      <div className="min-w-0 flex-1 flex items-center gap-2">
        <h2
          className="truncate text-[14px] font-bold font-heading text-[#0B1C30] dark:text-[#EFF0F6] tracking-tight leading-tight"
          title={title}
        >
          {title}
        </h2>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {headerRightSlot}
        <HistoryMenu
          sessions={sessions}
          isLoading={isLoading}
          activeChatId={activeChatId}
          onSelect={onSelectChat}
          onRename={onRenameChat}
          onDelete={onDeleteChat}
        />
        <IconButton label="Tạo đoạn chat mới" onClick={onNewChat}>
          <Plus className="h-4 w-4" />
        </IconButton>
        {onToggleFullscreen && (
          <IconButton
            label={isFullscreen ? "Thu nhỏ về mặc định (ESC)" : "Phóng to toàn màn hình"}
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </IconButton>
        )}
        {onClose && (
          <IconButton label="Thu gọn trợ lý AI" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        )}
      </div>
    </header>
  );
}
