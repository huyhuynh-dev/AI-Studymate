"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Howl } from "howler";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Languages,
  Loader2,
  Pause,
  Play,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

interface SummaryTtsPlayerProps {
  blocks: unknown[];
  title?: string;
  isOpen: boolean;
  onClose: () => void;
}

interface EdgeVoice {
  id: string;
  name: string;
  locale: "vi-VN" | "en-US";
}

const EDGE_VOICES: EdgeVoice[] = [
  { id: "vi-VN-HoaiMyNeural", name: "Hoài My (Nữ)", locale: "vi-VN" },
  { id: "vi-VN-NamMinhNeural", name: "Nam Minh (Nam)", locale: "vi-VN" },
  { id: "en-US-AriaNeural", name: "Aria (Nữ)", locale: "en-US" },
  { id: "en-US-GuyNeural", name: "Guy (Nam)", locale: "en-US" },
];

const SPEED_OPTIONS = [0.8, 1.0, 1.25, 1.5, 1.75];

export default function SummaryTtsPlayer({
  blocks,
  title,
  isOpen,
  onClose,
}: SummaryTtsPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [selectedVoice, setSelectedVoice] = useState<EdgeVoice>(EDGE_VOICES[0]);
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const howlRef = useRef<Howl | null>(null);
  const soundIdRef = useRef<number | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  const extractFullText = useCallback((): string => {
    const parts: string[] = [];
    if (title) parts.push(title);

    const inlineText = (item: unknown): string => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      const record = item as Record<string, unknown>;
      if (typeof record.text === "string") return record.text;
      if (typeof record.content === "string") return record.content;
      return "";
    };

    const extractBlock = (block: unknown): void => {
      if (!block || typeof block !== "object") return;
      const record = block as Record<string, unknown>;

      if (record.type === "table") {
        const content = record.content as { rows?: unknown[] } | undefined;
        const rows = content?.rows ?? (record.rows as unknown[] | undefined);
        if (Array.isArray(rows)) {
          for (const row of rows) {
            if (!row || typeof row !== "object") continue;
            const cells = (row as Record<string, unknown>).cells;
            if (!Array.isArray(cells)) continue;
            for (const cell of cells) {
              if (Array.isArray(cell)) {
                const text = cell.map(inlineText).join("").trim();
                if (text) parts.push(text);
              } else if (typeof cell === "string" && cell.trim()) {
                parts.push(cell.trim());
              }
            }
          }
        }
      } else if (Array.isArray(record.content)) {
        const text = record.content.map(inlineText).join("").trim();
        if (text) parts.push(text);
      } else if (typeof record.content === "string" && record.content.trim()) {
        parts.push(record.content.trim());
      }

      if (Array.isArray(record.children)) {
        record.children.forEach(extractBlock);
      }
    };

    if (Array.isArray(blocks)) blocks.forEach(extractBlock);
    return parts.join(". ").trim().slice(0, 12000);
  }, [blocks, title]);

  const fullText = useMemo(() => extractFullText(), [extractFullText]);

  const clearProgressInterval = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const stopSpeech = useCallback((resetPosition = true) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    clearProgressInterval();

    if (howlRef.current) {
      howlRef.current.stop();
      howlRef.current.unload();
      howlRef.current = null;
    }
    soundIdRef.current = null;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setIsPlaying(false);
    setIsPaused(false);
    setIsLoading(false);
    if (resetPosition) {
      setCurrentTime(0);
      setDuration(0);
    }
  }, [clearProgressInterval]);

  const startProgressUpdates = useCallback(() => {
    clearProgressInterval();
    progressIntervalRef.current = setInterval(() => {
      const howl = howlRef.current;
      const id = soundIdRef.current;
      if (!howl || id === null) return;
      const seek = howl.seek(id);
      if (typeof seek === "number") setCurrentTime(seek);
    }, 250);
  }, [clearProgressInterval]);

  const unloadCurrentAudio = useCallback(() => {
    stopSpeech(true);
  }, [stopSpeech]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(event.target as Node)
      ) {
        setIsVoiceDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!isOpen) stopSpeech(true);
  }, [isOpen, stopSpeech]);

  useEffect(() => {
    unloadCurrentAudio();
  }, [fullText, unloadCurrentAudio]);

  useEffect(() => {
    const handlePageHide = () => stopSpeech(true);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      stopSpeech(true);
    };
  }, [stopSpeech]);

  const synthesizeAndPlay = useCallback(async (voice = selectedVoice, nextRate = rate) => {
    if (!fullText) {
      setError("Ghi chú không có nội dung để đọc.");
      return;
    }

    unloadCurrentAudio();
    setError(null);
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      console.info(
        `[TTS] Synthesis started | voice=${voice.id} | textLength=${fullText.length}`,
      );
      const response = await fetch("/api/tts/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: fullText,
          voice: voice.id,
          volume: Math.round(volume * 100),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let message = "Không thể tổng hợp giọng đọc.";
        let retryable = false;
        try {
          const body = await response.json();
          if (typeof body.error === "string") message = body.error;
          retryable = body.retryable === true;
        } catch {
          // Keep the generic message.
        }
        console.warn(
          `[TTS] Synthesis failed | voice=${voice.id} | status=${response.status} | retryable=${retryable} | message=${message}`,
        );
        throw new Error(message);
      }

      const audio = await response.blob();
      console.info(
        `[TTS] Audio received | voice=${voice.id} | bytes=${audio.size} | type=${audio.type}`,
      );
      const objectUrl = URL.createObjectURL(audio);
      objectUrlRef.current = objectUrl;

      const howl = new Howl({
        src: [objectUrl],
        format: ["mp3"],
        html5: false,
        preload: true,
        volume,
        rate: nextRate,
        onload: () => {
          const loadedDuration = howl.duration();
          console.info(
            `[TTS] Audio loaded | voice=${voice.id} | duration=${loadedDuration}`,
          );
          setDuration(Number.isFinite(loadedDuration) ? loadedDuration : 0);
          const id = howl.play();
          soundIdRef.current = id;
          setIsLoading(false);
          setIsPlaying(true);
          setIsPaused(false);
          startProgressUpdates();
        },
        onplay: () => {
          setIsLoading(false);
          setIsPlaying(true);
          setIsPaused(false);
        },
        onpause: () => {
          setIsPlaying(false);
          setIsPaused(true);
          clearProgressInterval();
        },
        onstop: () => {
          setIsPlaying(false);
          clearProgressInterval();
        },
        onend: () => {
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentTime(0);
          clearProgressInterval();
        },
        onloaderror: (_id, loadError) => {
          setIsLoading(false);
          const message = String(loadError ?? "lỗi không xác định");
          console.error(
            `[TTS] Audio load failed | voice=${voice.id} | error=${message}`,
          );
          setError(`Không thể tải audio: ${message}`);
        },
        onplayerror: (_id, playError) => {
          setIsLoading(false);
          const message = String(playError ?? "lỗi không xác định");
          console.error(
            `[TTS] Audio playback failed | voice=${voice.id} | error=${message}`,
          );
          setError(`Không thể phát audio: ${message}`);
        },
      });

      howlRef.current = howl;
    } catch (synthesisError) {
      if (controller.signal.aborted) return;
      setIsLoading(false);
      setError(
        synthesisError instanceof Error
          ? synthesisError.message
          : "Không thể tổng hợp giọng đọc.",
      );
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [
    clearProgressInterval,
    fullText,
    rate,
    selectedVoice,
    startProgressUpdates,
    unloadCurrentAudio,
    volume,
  ]);

  const handlePlay = () => {
    if (howlRef.current && soundIdRef.current !== null) {
      if (isPaused) {
        howlRef.current.play(soundIdRef.current);
        startProgressUpdates();
        return;
      }
      howlRef.current.play();
      return;
    }
    void synthesizeAndPlay();
  };

  const handlePause = () => {
    if (howlRef.current && soundIdRef.current !== null) {
      howlRef.current.pause(soundIdRef.current);
    }
  };

  const handleCycleRate = () => {
    const index = SPEED_OPTIONS.indexOf(rate);
    const nextRate =
      index >= 0 && index < SPEED_OPTIONS.length - 1
        ? SPEED_OPTIONS[index + 1]
        : SPEED_OPTIONS[0];
    setRate(nextRate);
    if (howlRef.current && soundIdRef.current !== null) {
      howlRef.current.rate(nextRate, soundIdRef.current);
    }
  };

  const handleSeek = (seconds: number) => {
    if (!howlRef.current || soundIdRef.current === null) return;
    howlRef.current.seek(seconds, soundIdRef.current);
    setCurrentTime(seconds);
  };

  const handleVolume = (nextVolume: number) => {
    setVolume(nextVolume);
    if (howlRef.current) howlRef.current.volume(nextVolume);
  };

  const handleSelectVoice = (voice: EdgeVoice) => {
    setSelectedVoice(voice);
    setIsVoiceDropdownOpen(false);
    unloadCurrentAudio();
  };

  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60);
    return `${minutes}:${remaining.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-black/[0.08] bg-white/95 px-3 py-2 text-neutral-800 shadow-2xl backdrop-blur-xl dark:border-white/[0.12] dark:bg-[#1A1E29]/95 dark:text-neutral-100"
      role="region"
      aria-label="Trình đọc nội dung ghi chú"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPlaying ? (
          <div className="flex h-3.5 items-center gap-0.5 px-0.5">
            <span className="h-3 w-0.5 animate-bounce rounded-full bg-indigo-600 [animation-delay:-0.3s] dark:bg-indigo-400" />
            <span className="h-3.5 w-0.5 animate-bounce rounded-full bg-indigo-600 [animation-delay:-0.15s] dark:bg-indigo-400" />
            <span className="h-2.5 w-0.5 animate-bounce rounded-full bg-indigo-600 dark:bg-indigo-400" />
          </div>
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </div>

      {isPlaying ? (
        <button
          type="button"
          onClick={handlePause}
          title="Tạm dừng đọc"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4F46E5] text-white shadow-xs transition-all hover:bg-[#4338CA] active:scale-95"
        >
          <Pause className="h-4 w-4 fill-white" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handlePlay}
          title={isPaused ? "Tiếp tục đọc" : "Bắt đầu đọc ghi chú"}
          disabled={isLoading}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4F46E5] text-white shadow-xs transition-all hover:bg-[#4338CA] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Play className="h-4 w-4 translate-x-0.5 fill-white" />
        </button>
      )}

      {(isPlaying || isPaused) && (
        <button
          type="button"
          onClick={() => stopSpeech(true)}
          title="Dừng và đọc lại từ đầu"
          className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-black/[0.04] hover:text-neutral-700 dark:hover:bg-white/[0.06] dark:hover:text-neutral-200"
        >
          <Square className="h-3 w-3 fill-current" />
        </button>
      )}

      {duration > 0 && (
        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="w-8 text-right text-[10px] tabular-nums text-neutral-500">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={Math.min(currentTime, duration)}
            onChange={(event) => handleSeek(Number(event.target.value))}
            aria-label="Vị trí phát"
            className="h-1 w-24 cursor-pointer accent-indigo-600"
          />
          <span className="w-8 text-[10px] tabular-nums text-neutral-500">
            {formatTime(duration)}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={handleCycleRate}
        title="Đổi tốc độ đọc"
        className="rounded-full bg-black/[0.04] px-2.5 py-1 text-xs font-bold text-neutral-700 transition-all hover:bg-indigo-50 hover:text-indigo-600 dark:bg-white/[0.06] dark:text-neutral-200 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400"
      >
        {rate}x
      </button>

      <button
        type="button"
        onClick={() => handleVolume(volume === 0 ? 1 : 0)}
        title={volume === 0 ? "Bật âm thanh" : "Tắt âm thanh"}
        className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
      >
        {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(event) => handleVolume(Number(event.target.value))}
        aria-label="Âm lượng"
        className="hidden h-1 w-16 cursor-pointer accent-indigo-600 md:block"
      />

      <div className="relative" ref={dropdownContainerRef}>
        <button
          type="button"
          onClick={() => setIsVoiceDropdownOpen((open) => !open)}
          className={`flex max-w-[180px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
            selectedVoice.locale === "en-US"
              ? "border-blue-200 bg-blue-50/90 text-blue-800 dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-blue-300"
              : "border-emerald-200 bg-emerald-50/90 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}
        >
          <Languages className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{selectedVoice.name}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </button>

        {isVoiceDropdownOpen && (
          <div className="absolute bottom-full left-1/2 mb-3 w-72 -translate-x-1/2 rounded-[20px] border border-black/[0.08] bg-white p-2 shadow-2xl dark:border-white/[0.12] dark:bg-[#1A1E29]">
            {(["vi-VN", "en-US"] as const).map((locale) => (
              <div key={locale} className="py-1">
                <div className="px-2 py-1 text-[11px] font-bold text-neutral-500">
                  {locale === "vi-VN" ? "🇻🇳 Tiếng Việt" : "🇺🇸 Tiếng Anh"}
                </div>
                {EDGE_VOICES.filter((voice) => voice.locale === locale).map((voice) => (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => handleSelectVoice(voice)}
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs ${
                      selectedVoice.id === voice.id
                        ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                        : "text-neutral-700 hover:bg-black/[0.03] dark:text-neutral-300 dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    <span>{voice.name}</span>
                    {selectedVoice.id === voice.id && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="absolute bottom-full mb-3 flex max-w-sm items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/50 dark:text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          stopSpeech(true);
          onClose();
        }}
        title="Đóng trình đọc"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-black/[0.04] hover:text-neutral-700 dark:hover:bg-white/[0.06] dark:hover:text-neutral-200"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
