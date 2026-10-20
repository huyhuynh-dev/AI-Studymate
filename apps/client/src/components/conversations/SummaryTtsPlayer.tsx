"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Volume2,
  Play,
  Pause,
  Square,
  X,
  AlertTriangle,
  Info,
  ChevronRight,
} from "lucide-react";

interface SummaryTtsPlayerProps {
  blocks: any[];
  title?: string;
  isOpen: boolean;
  onClose: () => void;
}

const SPEED_OPTIONS = [0.8, 1.0, 1.25, 1.5, 1.75];

/**
 * Tìm kiếm giọng đọc Tiếng Việt theo thứ tự ưu tiên chất lượng cao nhất
 */
function findBestVietnameseVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!Array.isArray(voices) || voices.length === 0) return null;

  // 1. Ưu tiên cao nhất: Microsoft Edge Online Natural Voices (Hoài My, Nam Minh)
  const edgeNatural = voices.find(
    (v) =>
      (v.name.includes("HoaiMy") || v.name.includes("NamMinh")) &&
      (v.lang.toLowerCase().includes("vi") || v.name.toLowerCase().includes("vietnam"))
  );
  if (edgeNatural) return edgeNatural;

  // 2. Ưu tiên: Google Chrome tiếng Việt
  const googleVi = voices.find(
    (v) =>
      v.name.toLowerCase().includes("tiếng việt") ||
      (v.name.toLowerCase().includes("google") && v.lang.toLowerCase().startsWith("vi"))
  );
  if (googleVi) return googleVi;

  // 3. Ưu tiên: Giọng chuẩn mã ngôn ngữ vi-VN hoặc vi_*
  const standardVi = voices.find(
    (v) =>
      v.lang.toLowerCase().startsWith("vi") ||
      v.lang.toLowerCase().replace("_", "-") === "vi-vn"
  );
  if (standardVi) return standardVi;

  // 4. Ưu tiên: Tên chứa Vietnamese
  const nameVi = voices.find(
    (v) =>
      v.name.toLowerCase().includes("vietnamese") ||
      v.name.toLowerCase().includes("vietnam")
  );
  if (nameVi) return nameVi;

  return null;
}

/**
 * Lấy tên hiển thị ngắn gọn, thân thiện của giọng đọc
 */
function formatVoiceDisplayName(voice: SpeechSynthesisVoice | null): string {
  if (!voice) return "Giọng mặc định";
  const name = voice.name;
  if (name.includes("HoaiMy")) return "Hoài My (Edge Natural)";
  if (name.includes("NamMinh")) return "Nam Minh (Edge Natural)";
  if (name.includes("Google") && name.toLowerCase().includes("tiếng việt"))
    return "Google Tiếng Việt";
  if (name.includes("An")) return "Microsoft An (Việt Nam)";
  return name.length > 20 ? `${name.slice(0, 18)}...` : name;
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
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [showVoiceHelp, setShowVoiceHelp] = useState<boolean>(false);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Tải danh sách Voices và lắng nghe sự kiện onvoiceschanged của trình duyệt
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsSupported(false);
      return;
    }

    const updateVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices && availableVoices.length > 0) {
        setVoices(availableVoices);
        const bestVi = findBestVietnameseVoice(availableVoices);
        setSelectedVoice(bestVi);
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

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
                  const cellText = cell
                    .map((c: any) => c.text || c || "")
                    .join("")
                    .trim();
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

  // Dọn dẹp âm thanh khi unmount hoặc khi đóng player
  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopSpeech();
    }
  }, [isOpen, stopSpeech]);

  // Chromium bug keep-alive: Chromium tự dừng speech sau ~15s nếu không kích hoạt pause/resume
  const startKeepAlive = () => {
    if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
    keepAliveIntervalRef.current = setInterval(() => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }
    }, 12000);
  };

  const handlePlay = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
      startKeepAlive();
      return;
    }

    window.speechSynthesis.cancel();

    const fullText = extractFullText();
    if (!fullText) return;

    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.rate = rate;
    utterance.lang = "vi-VN";

    // Tìm lại giọng tiếng Việt mới nhất nếu lúc khởi tạo chưa kịp nạp
    const currentVoices = window.speechSynthesis.getVoices();
    const voiceToUse = selectedVoice || findBestVietnameseVoice(currentVoices);

    if (voiceToUse) {
      utterance.voice = voiceToUse;
      if (!selectedVoice) setSelectedVoice(voiceToUse);
    }

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
      startKeepAlive();
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
    };

    utterance.onerror = (e) => {
      console.warn("Speech synthesis error:", e);
      setIsPlaying(false);
      setIsPaused(false);
      if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handlePause = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      setIsPaused(true);
      if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
    }
  };

  // Chuyển đổi vòng tròn tốc độ đọc: 0.8x -> 1x -> 1.25x -> 1.5x -> 1.75x -> 0.8x
  const handleCycleRate = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(rate);
    const nextRate =
      currentIndex !== -1 && currentIndex < SPEED_OPTIONS.length - 1
        ? SPEED_OPTIONS[currentIndex + 1]
        : SPEED_OPTIONS[0];

    setRate(nextRate);

    if (isPlaying || isPaused) {
      stopSpeech();
      setTimeout(() => {
        setRate(nextRate);
        handlePlay();
      }, 100);
    }
  };

  if (!isOpen) return null;

  if (!isSupported) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 rounded-full bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 border border-amber-200 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <span>Trình duyệt không hỗ trợ Web Speech API.</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-1 rounded-full p-1 text-amber-600 hover:bg-amber-100 hover:text-amber-900 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const hasVietnameseVoice = Boolean(selectedVoice);

  return (
    <>
      {/* Floating Action Widget: Mini-Player dạng Viên thuốc (Pill) cố định ở đáy màn hình */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 rounded-full bg-white/95 px-3.5 py-2 text-gray-800 shadow-xl shadow-indigo-950/15 border border-indigo-100/90 backdrop-blur-md select-none animate-in fade-in zoom-in-95 slide-in-from-bottom-3 duration-200"
        role="region"
        aria-label="Trình đọc văn bản tóm tắt"
      >
        {/* Animated Waveform / Icon Loa */}
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-50 text-indigo-600 shrink-0">
          {isPlaying ? (
            <div className="flex items-center gap-0.5 h-3.5 px-0.5">
              <span className="w-0.5 h-3 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-0.5 h-3.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-0.5 h-2.5 bg-indigo-600 rounded-full animate-bounce" />
            </div>
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </div>

        {/* Nút Play / Pause chính */}
        {isPlaying ? (
          <button
            type="button"
            onClick={handlePause}
            title="Tạm dừng đọc"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
          >
            <Pause className="h-4 w-4 fill-white" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePlay}
            title={isPaused ? "Tiếp tục đọc" : "Bắt đầu đọc tóm tắt"}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
          >
            <Play className="h-4 w-4 fill-white translate-x-0.5" />
          </button>
        )}

        {/* Nút Stop nếu đang phát hoặc tạm dừng */}
        {(isPlaying || isPaused) && (
          <button
            type="button"
            onClick={stopSpeech}
            title="Dừng phát và quay về đầu"
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors cursor-pointer"
          >
            <Square className="h-3 w-3 fill-gray-500" />
          </button>
        )}

        <div className="h-4 w-px bg-gray-200 shrink-0" />

        {/* Nút điều chỉnh tốc độ đọc dạng Cycle Pill */}
        <button
          type="button"
          onClick={handleCycleRate}
          title="Nhấn để đổi tốc độ đọc (0.8x -> 1x -> 1.25x -> 1.5x -> 1.75x)"
          className="flex items-center gap-0.5 rounded-full bg-gray-100/90 px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
        >
          <span>{rate}x</span>
        </button>

        <div className="h-4 w-px bg-gray-200 shrink-0" />

        {/* Badge nhận diện giọng đọc Tiếng Việt & Cảnh báo */}
        <div className="relative">
          {hasVietnameseVoice ? (
            <div
              title={`Đang sử dụng: ${selectedVoice?.name}`}
              className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50/90 px-2.5 py-1 rounded-full border border-emerald-100 max-w-[130px] sm:max-w-[170px] truncate"
            >
              <span className="shrink-0">🇻🇳</span>
              <span className="truncate">{formatVoiceDisplayName(selectedVoice)}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowVoiceHelp(!showVoiceHelp)}
              title="Nhấn để xem hướng dẫn bật giọng Tiếng Việt"
              className="flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
            >
              <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
              <span className="hidden sm:inline">Chưa có giọng VN</span>
              <span className="sm:hidden">Thiếu giọng VN</span>
            </button>
          )}

          {/* Popover hướng dẫn bật giọng Tiếng Việt khi thiết bị chưa có */}
          {showVoiceHelp && !hasVietnameseVoice && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 rounded-2xl bg-white p-3.5 shadow-2xl border border-amber-200 text-xs text-gray-700 animate-in fade-in zoom-in-95 duration-150 z-50">
              <div className="flex items-start justify-between gap-2 mb-2 font-bold text-amber-900">
                <div className="flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Cách kích hoạt giọng Tiếng Việt</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVoiceHelp(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-1.5 text-[11px] leading-relaxed text-gray-600">
                <p>
                  Thiết bị của bạn hiện chỉ có giọng đọc tiếng Anh của hệ điều hành, nên máy sẽ phát âm tiếng Anh.
                </p>
                <div className="rounded-xl bg-indigo-50/80 p-2 text-indigo-900 font-medium">
                  💡 <strong>Khuyên dùng:</strong> Mở ứng dụng trên <strong>Microsoft Edge</strong> hoặc <strong>Google Chrome</strong> để tự động dùng giọng Tiếng Việt tự nhiên (Hoài My / Nam Minh).
                </div>
                <p className="text-[10px] text-gray-500">
                  Hoặc vào <em>Windows Settings → Time & Language → Speech → Add voices → Tải gói Tiếng Việt</em>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Nút Đóng Widget */}
        <button
          type="button"
          onClick={() => {
            stopSpeech();
            onClose();
          }}
          title="Tắt trình đọc âm thanh"
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer ml-0.5 shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  );
}
