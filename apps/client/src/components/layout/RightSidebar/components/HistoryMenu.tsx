"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { History, MessageSquare, Search, X } from "lucide-react";
import type { ChatSessionItem } from "../types";
import { useClickOutside } from "../hooks/useClickOutside";
import { HistorySessionRow } from "./HistorySessionRow";
import { IconButton } from "./IconButton";

/** Chỉ hiện ô tìm kiếm khi có nhiều hơn số đoạn chat này */
const SEARCH_THRESHOLD = 5;

interface HistoryMenuProps {
  sessions: ChatSessionItem[];
  isLoading: boolean;
  activeChatId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, newTitle: string) => Promise<void>;
  onRequestDelete: (session: ChatSessionItem) => void;
}

/**
 * Nút lịch sử + popover "Đoạn chat gần đây".
 * Popover được căn theo phần tử `relative` gần nhất (ChatHeader),
 * nên wrapper dùng `display: contents` để không tạo thêm hộp bao.
 */
export function HistoryMenu({
  sessions,
  isLoading,
  activeChatId,
  onSelect,
  onRename,
  onRequestDelete,
}: HistoryMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);
  useClickOutside(containerRef, close, isOpen);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.lastMessage.toLowerCase().includes(q)
    );
  }, [sessions, query]);

  const showSearch = sessions.length > SEARCH_THRESHOLD;

  return (
    <div ref={containerRef} className="contents">
      <IconButton
        label="Lịch sử trò chuyện"
        isActive={isOpen}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? close() : setIsOpen(true))}
      >
        <History className="h-4 w-4" />
      </IconButton>

      {isOpen && (
        <div className="absolute left-3 right-3 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-100">
          <p className="px-4 pb-1 pt-3 text-xs font-medium text-gray-500">
            Đoạn chat gần đây
          </p>

          {showSearch && (
            <div className="relative mx-3 mb-1 mt-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm đoạn chat…"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-7 text-xs text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-indigo-300 focus:bg-white"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Xóa từ khóa"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          <div className="max-h-72 overflow-y-auto p-1.5">
            {isLoading && sessions.length === 0 ? (
              <div className="animate-pulse space-y-1 p-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2.5 px-2 py-2.5">
                    <div className="h-4 w-4 rounded bg-gray-200" />
                    <div className="h-3 flex-1 rounded bg-gray-200" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
                <MessageSquare className="h-6 w-6 text-gray-200" />
                <p className="text-xs text-gray-500">
                  {query ? "Không tìm thấy đoạn chat nào" : "Chưa có lịch sử trò chuyện"}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((session) => (
                  <HistorySessionRow
                    key={session.id}
                    session={session}
                    isActive={session.id === activeChatId}
                    onSelect={() => {
                      onSelect(session.id);
                      close();
                    }}
                    onRename={(newTitle) => onRename(session.id, newTitle)}
                    onRequestDelete={() => {
                      close();
                      onRequestDelete(session);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
