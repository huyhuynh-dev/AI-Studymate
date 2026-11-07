"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Copy, ThumbsDown, ThumbsUp } from "lucide-react";

interface MessageActionsProps {
  content: string;
}

const actionBase =
  "flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 select-none active:scale-95";

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
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      <button
        type="button"
        onClick={handleCopy}
        className={`${actionBase} border-[#E5EEFF] dark:border-white/[0.08] bg-white dark:bg-[#161922] text-[#777587] dark:text-neutral-400 hover:text-[#0B1C30] dark:hover:text-white hover:bg-[#F8F9FF] dark:hover:bg-white/[0.06] shadow-2xs`}
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
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
        className={`${actionBase} px-2 ${
          feedback === "up"
            ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
            : "border-[#E5EEFF] dark:border-white/[0.08] bg-white dark:bg-[#161922] text-[#777587] dark:text-neutral-400 hover:bg-[#F8F9FF] dark:hover:bg-white/[0.06] hover:text-emerald-600"
        } shadow-2xs`}
      >
        <ThumbsUp className="h-3 w-3" />
      </button>

      <button
        type="button"
        title="Chưa chính xác"
        aria-label="Chưa chính xác"
        aria-pressed={feedback === "down"}
        onClick={() => toggleFeedback("down")}
        className={`${actionBase} px-2 ${
          feedback === "down"
            ? "border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
            : "border-[#E5EEFF] dark:border-white/[0.08] bg-white dark:bg-[#161922] text-[#777587] dark:text-neutral-400 hover:bg-[#F8F9FF] dark:hover:bg-white/[0.06] hover:text-rose-600"
        } shadow-2xs`}
      >
        <ThumbsDown className="h-3 w-3" />
      </button>
    </div>
  );
}
