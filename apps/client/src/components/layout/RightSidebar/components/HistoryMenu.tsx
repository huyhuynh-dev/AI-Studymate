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
        <div className="absolute left-3 right-3 top-full z-50 mt-1 overflow-hidden rounded-[22px] border border-[#E5EEFF] dark:border-white/[0.12] bg-white/95 dark:bg-[#161922]/95 backdrop-blur-xl shadow-2xl animate-in fade-in-50 zoom-in-95 duration-100 select-none">
          <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-[#777587] dark:text-neutral-400">
            Đoạn chat gần đây
          </p>

          {showSearch && (
            <div className="relative mx-3 mb-1 mt-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#777587]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm đoạn chat…"
                className="w-full rounded-xl border border-[#E5EEFF] dark:border-white/[0.1] bg-[#F8F9FF] dark:bg-white/[0.04] py-1.5 pl-8 pr-7 text-xs text-[#0B1C30] dark:text-white placeholder-[#777587] outline-none transition-colors focus:border-[#4F46E5] focus:bg-white dark:focus:bg-black"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Xóa từ khóa"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-[#777587] hover:text-[#0B1C30] dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          <div className="max-h-72 overflow-y-auto p-1.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {isLoading && sessions.length === 0 ? (
              <div className="animate-pulse space-y-1 p-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2.5 px-2 py-2.5">
                    <div className="h-4 w-4 rounded-md bg-[#E5EEFF] dark:bg-white/[0.08]" />
                    <div className="h-3 flex-1 rounded-md bg-[#E5EEFF] dark:bg-white/[0.08]" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
                <MessageSquare className="h-6 w-6 text-[#C7C4D8] dark:text-neutral-600" />
                <p className="text-xs text-[#777587] dark:text-neutral-400">
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
