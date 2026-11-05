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
    // select-text: cho phép bôi đen / sao chép nội dung dù <aside> đang để select-none
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
              <div className="pt-1">
                {isLoadingSuggestions && (
                  <div
                    aria-label="Đang xử lý..."
                    className="flex items-center gap-1 px-1 py-1 text-gray-400"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" />
                  </div>
                )}

                {!isLoadingSuggestions &&
                  suggestions.length > 0 &&
                  onSelectSuggestion && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-gray-500">
                        Gợi ý câu hỏi tiếp theo:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map((item, sIdx) => (
                          <button
                            key={`${item}-${sIdx}`}
                            type="button"
                            onClick={() => onSelectSuggestion(item)}
                            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50/70 px-3 py-1.5 text-left text-xs font-medium text-indigo-700 shadow-2xs transition-all hover:border-indigo-200 hover:bg-indigo-100/80 active:scale-[0.99]"
                          >
                            <Lightbulb className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
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
