import React from "react";
import { ArrowUpRight, BookOpen, Bot, CheckCircle2 } from "lucide-react";
import { ASSISTANT_NAME } from "../constants";
import type { ChatMessage } from "../types";
import { MessageActions } from "./MessageActions";

interface AiMessageProps {
  message: ChatMessage;
  onFollowUp?: (prompt: string) => void;
}

export function AiMessage({ message, onFollowUp }: AiMessageProps) {
  return (
    <div className="space-y-2">
      {/* Tên trợ lý */}
      <div className="flex items-center gap-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <Bot className="h-3.5 w-3.5" />
        </span>
        <span className="text-xs font-semibold text-gray-900">{ASSISTANT_NAME}</span>
        {message.hasCitation && (
          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            Đã trích dẫn
          </span>
        )}
        <span className="ml-auto text-[10px] text-gray-400">{message.timestamp}</span>
      </div>

      {/* Nội dung */}
      <div className="space-y-3 rounded-2xl rounded-tl-sm border border-gray-100 bg-gray-50 p-3.5 text-[13px] leading-relaxed text-gray-800">
        <p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>

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

      <MessageActions content={message.content} onFollowUp={onFollowUp} />
    </div>
  );
}
