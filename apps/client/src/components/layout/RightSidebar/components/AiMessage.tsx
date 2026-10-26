"use client";

import React, { useMemo } from "react";
import { ArrowUpRight, BookOpen, Bot, Brain, CheckCircle2, ChevronDown } from "lucide-react";
import { ASSISTANT_NAME } from "../constants";
import type { ChatMessage } from "../types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { MessageActions } from "./MessageActions";

interface AiMessageProps {
  message: ChatMessage;
  onFollowUp?: (prompt: string) => void;
}

export const AiMessage = React.memo(function AiMessage({
  message,
  onFollowUp,
}: AiMessageProps) {
  const parts = message.parts;

  // Chuẩn hóa parts để hỗ trợ cả định dạng phẳng lẫn lồng nhau
  const normalizedParts = useMemo(() => {
    if (!parts || parts.length === 0) return [];
    if (parts.length > 0 && (parts[0] as any)?.role && Array.isArray((parts[0] as any)?.content)) {
      return (parts[0] as any).content;
    }
    return parts;
  }, [parts]);

  // Trích xuất toàn bộ text để dùng cho hành động Sao chép
  const fullText = useMemo(() => {
    if (normalizedParts && normalizedParts.length > 0) {
      return normalizedParts
        .filter((p: any) => p.type === "text" || typeof p.text === "string")
        .map((p: any) => p.text || "")
        .join("\n\n");
    }
    return message.content || "";
  }, [normalizedParts, message.content]);

  const hasCitation =
    message.hasCitation || (normalizedParts && normalizedParts.some((p: any) => p.type === "source"));

  return (
    <div className="space-y-2">
      {/* Tên trợ lý */}
      <div className="flex items-center gap-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <Bot className="h-3.5 w-3.5" />
        </span>
        <span className="text-xs font-semibold text-gray-900">{ASSISTANT_NAME}</span>
        {hasCitation && (
          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            Đã trích dẫn
          </span>
        )}
        {message.timestamp && (
          <span className="ml-auto text-[10px] text-gray-400">{message.timestamp}</span>
        )}
      </div>

      {/* Nội dung */}
      <div className="space-y-3 rounded-2xl rounded-tl-sm border border-gray-100 bg-gray-50 p-3.5 text-[13px] leading-relaxed text-gray-800">
        {/* Render theo Typed Parts (chuẩn Vercel AI SDK 6) */}
        {normalizedParts && normalizedParts.length > 0 ? (
          normalizedParts.map((part: any, index: number) => {
            if (part.type === "text" || typeof part.text === "string") {
              return <MarkdownRenderer key={index} content={part.text || ""} />;
            }

            if (part.type === "reasoning") {
              return (
                <details
                  key={index}
                  className="group my-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5 text-xs text-indigo-900"
                >
                  <summary className="flex cursor-pointer items-center gap-1.5 font-medium select-none">
                    <Brain className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Quá trình suy luận</span>
                    <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2 text-gray-700 leading-relaxed pl-5 border-l border-indigo-200">
                    <MarkdownRenderer content={part.reasoning || part.text || ""} />
                  </div>
                </details>
              );
            }

            if (part.type === "source") {
              return (
                <div
                  key={index}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-indigo-600"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{part.title || part.url}</span>
                  </div>
                  {part.url && (
                    <a
                      href={part.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 hover:text-indigo-800"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              );
            }

            if (part.type === "tool-invocation") {
              const invocation = part.toolInvocation;
              return (
                <div
                  key={index}
                  className="my-2 rounded-xl border border-gray-200 bg-white p-2.5 text-xs text-gray-700"
                >
                  <span className="font-semibold text-gray-900">
                    Công cụ: {invocation?.toolName}
                  </span>
                  <div className="text-[11px] text-gray-500">
                    Trạng thái: {invocation?.state}
                  </div>
                </div>
              );
            }

            return null;
          })
        ) : (
          <MarkdownRenderer content={message.content || ""} />
        )}

        {/* Bullets bổ trợ nếu có */}
        {message.bullets && message.bullets.length > 0 && (
          <ul className="space-y-2">
            {message.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                <p>
                  <span className="font-semibold text-gray-900">{b.title}</span>{" "}
                  <span>{b.desc}</span>
                </p>
              </li>
            ))}
          </ul>
        )}

        {/* Trích dẫn riêng nếu có */}
        {message.citation && (
          <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-indigo-600">
            <div className="flex min-w-0 items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{message.citation}</span>
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
          </div>
        )}
      </div>

      <MessageActions content={fullText} onFollowUp={onFollowUp} />
    </div>
  );
});

AiMessage.displayName = "AiMessage";
