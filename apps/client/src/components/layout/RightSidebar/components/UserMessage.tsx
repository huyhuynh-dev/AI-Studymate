"use client";

import React, { useMemo } from "react";
import { FileText } from "lucide-react";
import type { ChatMessage } from "../types";

export const UserMessage = React.memo(function UserMessage({
  message,
}: {
  message: ChatMessage;
}) {
  const parts = message.parts;

  const textContent = useMemo(() => {
    if (parts && parts.length > 0) {
      return parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("\n\n");
    }
    return message.content || "";
  }, [parts, message.content]);

  return (
    <div className="flex flex-col items-end gap-1">
      {message.attachedFiles && message.attachedFiles.length > 0 && (
        <div className="flex max-w-[90%] flex-wrap justify-end gap-1.5">
          {message.attachedFiles.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-600"
            >
              <FileText className="h-3 w-3 shrink-0 text-indigo-500" />
              <span className="max-w-[140px] truncate">{name}</span>
            </span>
          ))}
        </div>
      )}

      {textContent && (
        <div className="max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-indigo-600 px-3.5 py-2.5 text-[13px] leading-relaxed text-white">
          {textContent}
        </div>
      )}
      {message.timestamp && (
        <span className="text-[10px] text-gray-400">{message.timestamp}</span>
      )}
    </div>
  );
});

UserMessage.displayName = "UserMessage";
