"use client";

import React, { useEffect, useRef } from "react";
import { Lightbulb, Loader2 } from "lucide-react";
import { StudyMateAiIcon } from "@/components/ui/StudyMateAiIcon";
import { ASSISTANT_NAME } from "../constants";
import type { AgentStatusEvent, ChatMessage } from "../types";
import { AiMessage } from "./AiMessage";
import { UserMessage } from "./UserMessage";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  liveAgentStatus?: AgentStatusEvent | null;
  suggestions?: string[];
  isLoadingSuggestions?: boolean;
  onSelectSuggestion?: (suggestion: string) => void;
  onAddToolOutput?: (params: {
    tool: string;
    toolCallId: string;
    output: unknown;
  }) => void;
  onApproveTool?: (params: {
    id: string;
    approved: boolean;
    reason?: string;
  }) => void;
  onUndoAction?: (actionLogId: string) => Promise<void>;
  onOpenSummary?: (summaryId: string) => void;
  onOpenFlashcardDeck?: (deckId: string) => void;
  onOpenQuiz?: (quizId: string) => void;
}

export function MessageList({
  messages,
  isLoading,
  liveAgentStatus = null,
  suggestions = [],
  isLoadingSuggestions = false,
  onSelectSuggestion,
  onAddToolOutput,
  onApproveTool,
  onUndoAction,
  onOpenSummary,
  onOpenFlashcardDeck,
  onOpenQuiz,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, liveAgentStatus, suggestions, isLoadingSuggestions]);

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
                isStreaming={Boolean(isLoading && isLastAssistantMessage)}
                liveAgentStatus={isLastAssistantMessage ? liveAgentStatus : null}
                onAddToolOutput={onAddToolOutput}
                onApproveTool={onApproveTool}
                onUndoAction={onUndoAction}
                onOpenSummary={onOpenSummary}
                onOpenFlashcardDeck={onOpenFlashcardDeck}
                onOpenQuiz={onOpenQuiz}
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
      {isLoading &&
        messages.length > 0 &&
        messages[messages.length - 1]?.role === "user" && (
          <div className="space-y-2 select-none">
            <div className="flex items-center gap-2">
              <StudyMateAiIcon variant="full" className="h-6 w-6 shrink-0" />
              <span className="text-xs font-bold text-[#0B1C30] dark:text-[#EFF0F6]">
                {ASSISTANT_NAME}
              </span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-[20px] rounded-tl-[4px] border border-[#E5EEFF] dark:border-white/[0.08] bg-white dark:bg-[#161922] px-4 py-2.5 text-xs font-medium text-[#4F46E5] dark:text-[#818CF8] shadow-xs">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              <span>
                {liveAgentStatus?.label || "Đang xem ngữ cảnh và suy nghĩ…"}
              </span>
            </div>
          </div>
        )}
      <div ref={endRef} />
    </div>
  );
}
