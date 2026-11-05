"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Copy, ThumbsDown, ThumbsUp } from "lucide-react";

interface MessageActionsProps {
  content: string;
}

const actionBase =
  "flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors";

export function MessageActions({ content }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Trình duyệt chặn clipboard – bỏ qua
    }
  };

  const toggleFeedback = (value: "up" | "down") =>
    setFeedback((prev) => (prev === value ? null : value));

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
      <button
        type="button"
        onClick={handleCopy}
        className={`${actionBase} border-gray-200 bg-white text-gray-600 hover:bg-gray-50`}
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-600" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
        <span>{copied ? "Đã sao chép" : "Sao chép"}</span>
      </button>

      <button
        type="button"
        title="Hữu ích"
        aria-label="Hữu ích"
        aria-pressed={feedback === "up"}
        onClick={() => toggleFeedback("up")}
        className={`${actionBase} px-1.5 ${
          feedback === "up"
            ? "border-emerald-200 bg-emerald-50 text-emerald-600"
            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-emerald-600"
        }`}
      >
        <ThumbsUp className="h-3 w-3" />
      </button>

      <button
        type="button"
        title="Chưa chính xác"
        aria-label="Chưa chính xác"
        aria-pressed={feedback === "down"}
        onClick={() => toggleFeedback("down")}
        className={`${actionBase} px-1.5 ${
          feedback === "down"
            ? "border-rose-200 bg-rose-50 text-rose-600"
            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-rose-600"
        }`}
      >
        <ThumbsDown className="h-3 w-3" />
      </button>
    </div>
  );
}
