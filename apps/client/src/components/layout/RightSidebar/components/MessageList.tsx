"use client";

import React, { useEffect, useRef } from "react";
import type { ChatMessage } from "../types";
import { AiMessage } from "./AiMessage";
import { UserMessage } from "./UserMessage";

interface MessageListProps {
  messages: ChatMessage[];
  onFollowUp?: (prompt: string) => void;
  isLoading?: boolean;
}

export function MessageList({ messages, onFollowUp, isLoading }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    // select-text: cho phép bôi đen / sao chép nội dung dù <aside> đang để select-none
    <div className="min-h-0 flex-1 select-text space-y-5 overflow-y-auto px-4 py-4">
      {messages.map((msg) =>
        msg.role === "user" ? (
          <UserMessage key={msg.id} message={msg} />
        ) : (
          <AiMessage key={msg.id} message={msg} onFollowUp={onFollowUp} />
        )
      )}
      <div ref={endRef} />
    </div>
  );
}
