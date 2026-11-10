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
    <div className="flex flex-col items-end gap-1.5 select-text">
      {/* File badges hiển thị phía trên bong bóng tin nhắn tương tự Composer */}
      {attachedFiles.length > 0 && (
        <div className="flex max-w-[88%] flex-wrap justify-end gap-1.5">
          {attachedFiles.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5EEFF] dark:border-white/[0.1] bg-white dark:bg-[#161922] px-2.5 py-1 text-[11px] font-semibold text-[#464555] dark:text-[#EFF0F6] shadow-2xs"
            >
              <FileText className="h-3 w-3 shrink-0 text-[#4F46E5] dark:text-[#818CF8]" />
              <span className="max-w-[140px] truncate" title={name}>
                {name}
              </span>
            </span>
          ))}
        </div>
      )}

      {textContent && (
        <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-[20px] rounded-br-[4px] bg-[#4F46E5] px-4 py-2.5 text-[13.5px] leading-relaxed text-white shadow-xs font-normal">
          {textContent}
        </div>
      )}
      {message.timestamp && (
        <span className="text-[10px] text-[#777587] dark:text-neutral-500 font-medium pr-1">
          {message.timestamp}
        </span>
      )}
    </div>
  );
});

UserMessage.displayName = "UserMessage";
