"use client";

import React from "react";
import { Check, Loader2, X } from "lucide-react";
import { formatRecordingDuration } from "../utils/voice-input.helper";
import type { VoiceRecorderStatus } from "../hooks/useVoiceRecorder";

interface VoiceRecorderBarProps {
  status: Exclude<VoiceRecorderStatus, "idle">;
  durationMs: number;
  waveformBars: number[];
  onStop: () => void;
  onCancel: () => void;
}

export function VoiceRecorderBar({
  status,
  durationMs,
  waveformBars,
  onStop,
  onCancel,
}: VoiceRecorderBarProps) {
  if (status === "transcribing") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-1 flex h-9 items-center justify-between gap-2 rounded-xl border border-[#E5EEFF] dark:border-white/[0.08] bg-[#F8F9FF] dark:bg-white/[0.04] px-2.5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Loader2
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none text-[#4F46E5] dark:text-[#818CF8]"
          />
          <span className="truncate text-xs font-medium text-[#464555] dark:text-[#EFF0F6]">
            Đang chuyển giọng nói thành văn bản…
          </span>
        </div>

        <button
          type="button"
          onClick={onCancel}
          aria-label="Hủy chuyển đổi giọng nói"
          title="Hủy"
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#777587] transition-all duration-150 hover:bg-white hover:text-[#0B1C30] active:scale-95 focus-visible:outline-2 focus-visible:outline-[#4F46E5] dark:text-neutral-400 dark:hover:bg-white/[0.08] dark:hover:text-white"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Đang ghi âm giọng nói"
      className="mt-1 flex h-10 items-center justify-between gap-2 rounded-xl border border-[#E5EEFF] dark:border-white/[0.08] bg-[#F8F9FF] dark:bg-white/[0.04] px-2 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-1">
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF453A]/70 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF453A]" />
        </span>

        <span
          className="shrink-0 text-xs font-semibold tabular-nums text-[#0B1C30] dark:text-[#EFF0F6]"
          aria-label={`Thời gian ghi âm ${formatRecordingDuration(durationMs)}`}
        >
          {formatRecordingDuration(durationMs)}
        </span>

        <div
          aria-hidden="true"
          className="flex h-6 min-w-0 flex-1 items-center gap-[3px] overflow-hidden"
        >
          {waveformBars.map((level, index) => (
            <span
              key={index}
              style={{ height: `${Math.round(level * 100)}%` }}
              className="w-0.5 flex-1 rounded-full bg-[#4F46E5]/80 dark:bg-[#818CF8]/90 transition-[height] duration-75 ease-out motion-reduce:transition-none"
            />
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Hủy ghi âm"
          title="Hủy ghi âm"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#777587] transition-all duration-150 hover:bg-white hover:text-[#0B1C30] active:scale-95 focus-visible:outline-2 focus-visible:outline-[#4F46E5] dark:text-neutral-400 dark:hover:bg-white/[0.08] dark:hover:text-white"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onStop}
          aria-label="Dừng ghi âm và chuyển thành văn bản"
          title="Dừng & chuyển thành chữ"
          className="flex h-8 cursor-pointer items-center gap-1 rounded-lg bg-[#4F46E5] px-2.5 text-xs font-semibold text-white shadow-xs transition-all duration-150 hover:bg-[#3525CD] active:scale-95 focus-visible:outline-2 focus-visible:outline-[#4F46E5] focus-visible:outline-offset-2"
        >
          <Check aria-hidden="true" className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>Xong</span>
        </button>
      </div>
    </div>
  );
}
