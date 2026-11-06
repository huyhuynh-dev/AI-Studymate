"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Volume2,
  Play,
  Pause,
  Square,
  X,
  AlertTriangle,
  ChevronDown,
  Check,
  Languages,
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
 * Rút gọn tên hiển thị thân thiện cho giọng đọc
 */
function formatVoiceName(voice: SpeechSynthesisVoice): string {
  const name = voice.name;
  if (name.includes("HoaiMy")) return "Hoài My (Edge Natural)";
  if (name.includes("NamMinh")) return "Nam Minh (Edge Natural)";
  if (name.includes("Google") && name.toLowerCase().includes("tiếng việt"))
    return "Google Tiếng Việt";
  if (name.includes("An") && voice.lang.includes("VN"))
    return "Microsoft An (Việt Nam)";
  if (name.includes("Jenny")) return "Jenny (Edge Natural)";
  if (name.includes("Guy")) return "Guy (Edge Natural)";
  if (name.includes("Aria")) return "Aria (Edge Natural)";
  if (name.includes("David")) return "David (US English)";
  if (name.includes("Zira")) return "Zira (US English)";
  if (name.includes("Mark")) return "Mark (US English)";

  // Rút ngắn tên nếu quá dài
  const clean = name.replace(/\s*-\s*English.*$/i, "").replace(/\s*-\s*Vietnamese.*$/i, "");
  return clean.length > 20 ? `${clean.slice(0, 18)}...` : clean;
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
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState<boolean>(false);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Theo dõi vị trí ký tự đang đọc để không bị đọc lại từ đầu khi đổi tốc độ hoặc đổi giọng
  const currentWordCharIndexRef = useRef<number>(0);
  const textRemainingOffsetRef = useRef<number>(0);

  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(event.target as Node)
      ) {
        setIsVoiceDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        if (!selectedVoice) {
          const bestVi = findBestVietnameseVoice(availableVoices);
          setSelectedVoice(bestVi || availableVoices[0] || null);
        }
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [selectedVoice]);

  // Phân loại danh sách giọng đọc theo Tiếng Việt và Tiếng Anh
  const { vietnameseVoices, englishVoices } = useMemo(() => {
    const vi = voices.filter(
      (v) =>
        v.lang.toLowerCase().startsWith("vi") ||
        v.lang.toLowerCase().includes("vn") ||
        v.name.toLowerCase().includes("vietnam") ||
        v.name.toLowerCase().includes("tiếng việt")
    );

    const en = voices
      .filter((v) => v.lang.toLowerCase().startsWith("en"))
      .sort((a, b) => {
        const aNat = a.name.includes("Natural") || a.name.includes("Online");
        const bNat = b.name.includes("Natural") || b.name.includes("Online");
        if (aNat && !bNat) return -1;
        if (!aNat && bNat) return 1;
        return 0;
      })
      .slice(0, 8); // Lấy tối đa 8 giọng tiếng Anh tốt nhất

    return { vietnameseVoices: vi, englishVoices: en };
  }, [voices]);

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
  const stopSpeech = useCallback((resetPosition = true) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
    if (resetPosition) {
      currentWordCharIndexRef.current = 0;
      textRemainingOffsetRef.current = 0;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopSpeech(true);
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

  /**
   * Phát âm thanh từ vị trí ký tự chỉ định (startIndex)
   */
  const playFromIndex = (
    startIndex: number,
    currentRate: number,
    voiceToUse: SpeechSynthesisVoice | null
  ) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const fullText = extractFullText();
    if (!fullText) return;

    // Giới hạn startIndex hợp lệ
    const safeStart = Math.max(0, Math.min(startIndex, fullText.length - 1));
    const textToSpeak = fullText.slice(safeStart);
    if (!textToSpeak.trim()) {
      currentWordCharIndexRef.current = 0;
      textRemainingOffsetRef.current = 0;
      setIsPlaying(false);
      return;
    }

    textRemainingOffsetRef.current = safeStart;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = currentRate;

    const activeVoice = voiceToUse || selectedVoice;
    if (activeVoice) {
      utterance.voice = activeVoice;
      utterance.lang = activeVoice.lang || (activeVoice.name.includes("English") ? "en-US" : "vi-VN");
    } else {
      utterance.lang = "vi-VN";
    }

    // Lắng nghe sự kiện boundary để cập nhật chính xác vị trí ký tự đang đọc dở
    utterance.onboundary = (e: SpeechSynthesisEvent) => {
      if (typeof e.charIndex === "number") {
        currentWordCharIndexRef.current = textRemainingOffsetRef.current + e.charIndex;
      }
    };

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
      startKeepAlive();
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      currentWordCharIndexRef.current = 0;
      textRemainingOffsetRef.current = 0;
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

  const handlePlay = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
      startKeepAlive();
      return;
    }

    // Phát từ vị trí hiện tại (mặc định là 0 nếu chưa phát)
    playFromIndex(currentWordCharIndexRef.current, rate, selectedVoice);
  };

  const handlePause = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      setIsPaused(true);
      if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
    }
  };

  /**
   * Đổi tốc độ đọc mà KHÔNG bị đọc lại từ đầu: tiếp tục ngay tại từ đang phát
   */
  const handleCycleRate = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(rate);
    const nextRate =
      currentIndex !== -1 && currentIndex < SPEED_OPTIONS.length - 1
        ? SPEED_OPTIONS[currentIndex + 1]
        : SPEED_OPTIONS[0];

    setRate(nextRate);

    if (isPlaying) {
      // Đang phát: dừng utterance hiện tại và tiếp tục ngay từ ký tự đang đọc dở với tốc độ mới
      const resumeIndex = currentWordCharIndexRef.current;
      playFromIndex(resumeIndex, nextRate, selectedVoice);
    }
  };

  /**
   * Đổi giọng đọc: nếu đang phát thì tiếp tục ngay tại vị trí hiện tại với giọng mới
   */
  const handleSelectVoice = (voice: SpeechSynthesisVoice) => {
    setSelectedVoice(voice);
    setIsVoiceDropdownOpen(false);

    if (isPlaying) {
      const resumeIndex = currentWordCharIndexRef.current;
      playFromIndex(resumeIndex, rate, voice);
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

  const isCurrentVoiceEnglish = selectedVoice?.lang.toLowerCase().startsWith("en");

  return (
    <>
      {/* Floating Action Widget: Mini-Player dạng Viên thuốc (Pill) cố định ở đáy màn hình */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 sm:gap-2.5 rounded-full bg-white/95 px-3 sm:px-3.5 py-2 text-gray-800 shadow-xl shadow-indigo-950/15 border border-indigo-100/90 backdrop-blur-md select-none animate-in fade-in zoom-in-95 slide-in-from-bottom-3 duration-200"
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

        {/* Nút Stop: Dừng hẳn và đặt lại vị trí về đầu */}
        {(isPlaying || isPaused || currentWordCharIndexRef.current > 0) && (
          <button
            type="button"
            onClick={() => stopSpeech(true)}
            title="Dừng và đọc lại từ đầu"
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
          title="Nhấn để đổi tốc độ đọc (0.8x -> 1x -> 1.25x -> 1.5x -> 1.75x) - Không làm gián đoạn vị trí đọc"
          className="flex items-center gap-0.5 rounded-full bg-gray-100/90 px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 transition-all cursor-pointer"
        >
          <span>{rate}x</span>
        </button>

        <div className="h-4 w-px bg-gray-200 shrink-0" />

        {/* Dropdown Chọn Ngôn ngữ & Giọng đọc (Tiếng Việt & Tiếng Anh) */}
        <div className="relative" ref={dropdownContainerRef}>
          <button
            type="button"
            onClick={() => setIsVoiceDropdownOpen(!isVoiceDropdownOpen)}
            title="Nhấn để chọn giọng đọc (Tiếng Việt hoặc Tiếng Anh)"
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all cursor-pointer max-w-[150px] xs:max-w-[180px] sm:max-w-[210px] ${
              isCurrentVoiceEnglish
                ? "bg-blue-50/90 text-blue-800 border-blue-200 hover:bg-blue-100"
                : selectedVoice
                  ? "bg-emerald-50/90 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                  : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
            }`}
          >
            <span className="shrink-0 text-sm">
              {isCurrentVoiceEnglish ? "🇺🇸" : selectedVoice ? "🇻🇳" : "⚠️"}
            </span>
            <span className="truncate">
              {selectedVoice ? formatVoiceName(selectedVoice) : "Chọn giọng"}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
          </button>

          {/* Menu Dropdown danh sách các giọng đọc */}
          {isVoiceDropdownOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 sm:w-80 rounded-2xl bg-white p-2 shadow-2xl border border-gray-200 text-xs text-gray-800 animate-in fade-in zoom-in-95 duration-150 z-50">
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-100 mb-1">
                <div className="flex items-center gap-1.5 font-bold text-gray-900">
                  <Languages className="h-4 w-4 text-indigo-600" />
                  <span>Chọn giọng đọc</span>
                </div>
                <span className="text-[10px] text-gray-400">Tiếng Việt & Tiếng Anh</span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 p-1">
                {/* Nhóm 1: Tiếng Việt */}
                <div>
                  <div className="px-2 py-1 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                    <span>🇻🇳</span>
                    <span>Tiếng Việt</span>
                  </div>
                  {vietnameseVoices.length > 0 ? (
                    <div className="space-y-0.5">
                      {vietnameseVoices.map((v) => {
                        const isSelected = selectedVoice?.name === v.name;
                        return (
                          <button
                            key={v.name}
                            type="button"
                            onClick={() => handleSelectVoice(v)}
                            className={`flex items-center justify-between w-full rounded-xl px-2.5 py-1.5 text-left text-xs transition-all cursor-pointer ${
                              isSelected
                                ? "bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200"
                                : "text-gray-700 hover:bg-gray-50 border border-transparent"
                            }`}
                          >
                            <span className="truncate pr-2">{formatVoiceName(v)}</span>
                            {isSelected && (
                              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-2.5 py-1.5 text-[11px] text-amber-700 bg-amber-50 rounded-xl">
                      Không tìm thấy giọng Tiếng Việt trên máy. Khuyên dùng Microsoft Edge hoặc Chrome.
                    </div>
                  )}
                </div>

                {/* Nhóm 2: Tiếng Anh */}
                <div>
                  <div className="px-2 py-1 text-[11px] font-bold text-blue-700 flex items-center gap-1 border-t border-gray-100 pt-2">
                    <span>🇺🇸</span>
                    <span>Tiếng Anh (English)</span>
                  </div>
                  {englishVoices.length > 0 ? (
                    <div className="space-y-0.5">
                      {englishVoices.map((v) => {
                        const isSelected = selectedVoice?.name === v.name;
                        return (
                          <button
                            key={v.name}
                            type="button"
                            onClick={() => handleSelectVoice(v)}
                            className={`flex items-center justify-between w-full rounded-xl px-2.5 py-1.5 text-left text-xs transition-all cursor-pointer ${
                              isSelected
                                ? "bg-blue-50 text-blue-900 font-semibold border border-blue-200"
                                : "text-gray-700 hover:bg-gray-50 border border-transparent"
                            }`}
                          >
                            <span className="truncate pr-2">{formatVoiceName(v)}</span>
                            {isSelected && (
                              <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-2.5 py-1.5 text-[11px] text-gray-500">
                      Không tìm thấy giọng tiếng Anh.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nút Đóng Widget */}
        <button
          type="button"
          onClick={() => {
            stopSpeech(true);
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
