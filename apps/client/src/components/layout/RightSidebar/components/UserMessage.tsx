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

  const attachedFiles = useMemo(() => {
    if (message.attachedFiles && message.attachedFiles.length > 0) {
      return message.attachedFiles;
    }
    const meta = (message as any)?.metadata;
    if (meta?.attachedFiles && Array.isArray(meta.attachedFiles)) {
      return meta.attachedFiles as string[];
    }
    return [];
  }, [message.attachedFiles, (message as any)?.metadata]);

  return (
    <div className="flex flex-col items-end gap-1.5">
      {/* File badges hiển thị phía trên bong bóng tin nhắn tương tự Composer */}
      {attachedFiles.length > 0 && (
        <div className="flex max-w-[90%] flex-wrap justify-end gap-1.5">
          {attachedFiles.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 shadow-2xs"
            >
              <FileText className="h-3 w-3 shrink-0 text-indigo-500" />
              <span className="max-w-[140px] truncate" title={name}>
                {name}
              </span>
            </span>
          ))}
        </div>
      )}

      {textContent && (
        <div className="max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-indigo-600 px-3.5 py-2.5 text-[13px] leading-[1.3] text-white">
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
