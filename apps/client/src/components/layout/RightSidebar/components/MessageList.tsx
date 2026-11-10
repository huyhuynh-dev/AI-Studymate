"use client";

import React, { useEffect, useRef } from "react";
import { Lightbulb } from "lucide-react";
import type { ChatMessage } from "../types";
import { AiMessage } from "./AiMessage";
import { UserMessage } from "./UserMessage";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  suggestions?: string[];
  isLoadingSuggestions?: boolean;
  onSelectSuggestion?: (suggestion: string) => void;
  onAddToolOutput?: (params: {
    tool: string;
    toolCallId: string;
    output: unknown;
  }) => void;
  onOpenSummary?: (summaryId: string) => void;
}

export function MessageList({
  messages,
  isLoading,
  suggestions = [],
  isLoadingSuggestions = false,
  onSelectSuggestion,
  onAddToolOutput,
  onOpenSummary,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, suggestions, isLoadingSuggestions]);

  // Xác định vị trí của tin nhắn AI cuối cùng để hiển thị Follow-up Chips bên dưới
  const lastAssistantIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role !== "user") {
        return i;
      }
    }
    return -1;
  })();

  return (
    <div className="min-h-0 flex-1 select-text space-y-5 overflow-y-auto px-4 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {messages.map((msg, index) => {
        const isLastAssistantMessage =
          msg.role !== "user" &&
          index === lastAssistantIndex &&
          index === messages.length - 1;

        return (
          <div key={msg.id} className="space-y-2.5">
            {msg.role === "user" ? (
              <UserMessage message={msg} />
            ) : (
              <AiMessage
                message={msg}
                onAddToolOutput={onAddToolOutput}
                onOpenSummary={onOpenSummary}
              />
            )}

            {/* Hiển thị Follow-up Pill Chips ngay bên dưới tin nhắn Assistant cuối cùng */}
            {isLastAssistantMessage && !isLoading && (
              <div className="pt-1.5 select-none">
                {isLoadingSuggestions && (
                  <div
                    aria-label="Đang xử lý..."
                    className="flex items-center gap-1.5 px-2 py-1 text-[#777587] dark:text-neutral-500"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#4F46E5] animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#4F46E5] animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#4F46E5] animate-bounce" />
                  </div>
                )}

                {!isLoadingSuggestions &&
                  suggestions.length > 0 &&
                  onSelectSuggestion && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#777587] dark:text-neutral-400">
                        Gợi ý câu hỏi tiếp theo
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map((item, sIdx) => (
                          <button
                            key={`${item}-${sIdx}`}
                            type="button"
                            onClick={() => onSelectSuggestion(item)}
                            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[#C7D2FE] dark:border-[#4F46E5]/30 bg-[#EEF2FF] dark:bg-[#4F46E5]/15 px-3.5 py-1.5 text-left text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8] shadow-2xs transition-all hover:bg-[#E0E7FF] dark:hover:bg-[#4F46E5]/25 active:scale-[0.98]"
                          >
                            <Lightbulb className="h-3.5 w-3.5 shrink-0 text-[#4F46E5] dark:text-[#818CF8]" />
                            <span>{item}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
