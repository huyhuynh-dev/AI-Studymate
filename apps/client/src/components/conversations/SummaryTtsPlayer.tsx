"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  FastForward,
  X,
  Sparkles,
} from "lucide-react";

interface SummaryTtsPlayerProps {
  blocks: any[];
  title?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function SummaryTtsPlayer({
  blocks,
  title,
  isOpen,
  onClose,
}: SummaryTtsPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState<number>(1.0);
  const [voiceName, setVoiceName] = useState<string>("");
  const [isSupported, setIsSupported] = useState<boolean>(true);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Trích xuất toàn bộ văn bản thuần từ BlockNote JSON blocks
  const extractFullText = useCallback((): string => {
    const parts: string[] = [];
    if (title) parts.push(title);

    const extractBlockText = (b: any) => {
      if (!b) return;

      if (b.type === "table" && (b.content?.rows || b.rows)) {
        const rows = b.content?.rows || b.rows;
        if (Array.isArray(rows)) {
          rows.forEach((row: any) => {
            if (Array.isArray(row?.cells)) {
              row.cells.forEach((cell: any) => {
                if (Array.isArray(cell)) {
                  const cellText = cell.map((c: any) => c.text || c || "").join("").trim();
                  if (cellText) parts.push(cellText);
                } else if (typeof cell === "string" && cell.trim()) {
                  parts.push(cell.trim());
                }
              });
            }
          });
        }
      } else if (Array.isArray(b.content)) {
        const text = b.content
          .map((c: any) => {
            if (typeof c === "string") return c;
            if (c?.type === "link") {
              return typeof c.content === "string" ? c.content : "";
            }
            return c?.text || "";
          })
          .join("")
          .trim();
        if (text) parts.push(text);
      } else if (typeof b.content === "string" && b.content.trim()) {
        parts.push(b.content.trim());
      } else if (b.props?.caption) {
        parts.push(b.props.caption);
      }

      if (Array.isArray(b.children)) {
        b.children.forEach(extractBlockText);
      }
    };

    if (Array.isArray(blocks)) {
      blocks.forEach(extractBlockText);
    }

    return parts.join(". ");
  }, [blocks, title]);

  // Kiểm tra hỗ trợ Web Speech API
  useEffect(() => {
    if (typeof window !== "undefined" && !("speechSynthesis" in window)) {
      setIsSupported(false);
    }
  }, []);

  // Dọn dẹp âm thanh khi unmount hoặc khi đóng player
  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopSpeech();
    }
  }, [isOpen, stopSpeech]);

  const handlePlay = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
      return;
    }

    window.speechSynthesis.cancel();

    const fullText = extractFullText();
    if (!fullText) return;

    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.rate = rate;
    utterance.lang = "vi-VN";

    // Tìm giọng đọc tiếng Việt nếu có
    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find(
      (v) => v.lang.startsWith("vi") || v.lang.includes("VN")
    );
    if (viVoice) {
      utterance.voice = viVoice;
      setVoiceName(viVoice.name);
    }

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = (e) => {
      console.warn("Speech synthesis error:", e);
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handlePause = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      setIsPaused(true);
    }
  };

  const handleRateChange = (newRate: number) => {
    setRate(newRate);
    if (isPlaying || isPaused) {
      // Khởi động lại với tốc độ mới
      stopSpeech();
      setTimeout(() => {
        setRate(newRate);
        handlePlay();
      }, 100);
    }
  };

  if (!isOpen) return null;

  if (!isSupported) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-2.5 text-xs text-amber-800 border border-amber-200 animate-in fade-in">
        <span>Trình duyệt hiện tại không hỗ trợ Web Speech API đọc văn bản.</span>
        <button
          type="button"
          onClick={onClose}
          className="text-amber-600 hover:text-amber-900 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-indigo-50/80 border border-indigo-100/90 px-4 py-2.5 shadow-2xs backdrop-blur-xs animate-in slide-in-from-top-2 duration-150">
      {/* Label and Voice Badge */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
          <Volume2 className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-gray-900">
              {isPlaying ? "Đang đọc bản tóm tắt..." : isPaused ? "Tạm dừng đọc" : "Sẵn sàng đọc tóm tắt"}
            </span>
            {isPlaying && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500">
            Giọng đọc Tiếng Việt (Web Speech API)
          </p>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-2">
        {isPlaying ? (
          <button
            type="button"
            onClick={handlePause}
            className="flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-200 shadow-2xs hover:bg-gray-50 transition-all cursor-pointer"
          >
            <Pause className="h-3.5 w-3.5" />
            <span>Tạm dừng</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePlay}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-all cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 fill-white" />
            <span>{isPaused ? "Tiếp tục" : "Bắt đầu đọc"}</span>
          </button>
        )}

        {(isPlaying || isPaused) && (
          <button
            type="button"
            onClick={stopSpeech}
            title="Dừng phát"
            className="flex h-7 w-7 items-center justify-center rounded-xl bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all cursor-pointer"
          >
            <Square className="h-3 w-3 fill-gray-600" />
          </button>
        )}

        {/* Speed Controls */}
        <div className="flex items-center gap-1 rounded-xl bg-white/90 p-1 border border-gray-200/80 text-[11px]">
          {[0.8, 1.0, 1.25, 1.5].map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => handleRateChange(speed)}
              className={`px-2 py-0.5 rounded-lg font-semibold transition-all cursor-pointer ${
                rate === speed
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Close Player */}
        <button
          type="button"
          onClick={() => {
            stopSpeech();
            onClose();
          }}
          title="Đóng trình đọc"
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-200/50 hover:text-gray-700 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
