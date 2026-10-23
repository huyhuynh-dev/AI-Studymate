"use client";

import React from "react";
import { Plus, X } from "lucide-react";
import type { ChatSessionItem } from "../types";
import { HistoryMenu } from "./HistoryMenu";
import { IconButton } from "./IconButton";

interface ChatHeaderProps {
  title: string;
  sessions: ChatSessionItem[];
  isLoading: boolean;
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  /** Nếu không truyền, nút đóng sẽ được ẩn */
  onClose?: () => void;
}

export function ChatHeader({
  title,
  sessions,
  isLoading,
  activeChatId,
  onSelectChat,
  onNewChat,
  onClose,
}: ChatHeaderProps) {
  return (
    // `relative` để HistoryMenu căn popover theo chiều ngang của header
    <header className="relative flex h-14 shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-4">
      <h2
        className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900"
        title={title}
      >
        {title}
      </h2>

      <div className="flex shrink-0 items-center gap-0.5">
        <HistoryMenu
          sessions={sessions}
          isLoading={isLoading}
          activeChatId={activeChatId}
          onSelect={onSelectChat}
        />
        <IconButton label="Tạo đoạn chat mới" onClick={onNewChat}>
          <Plus className="h-4 w-4" />
        </IconButton>
        {onClose && (
          <IconButton label="Thu gọn trợ lý AI" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        )}
      </div>
    </header>
  );
}
