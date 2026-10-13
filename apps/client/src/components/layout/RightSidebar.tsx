"use client";

import React, { useState } from "react";
import {
  Sparkles,
  SlidersHorizontal,
  RotateCw,
  Link2,
  Bot,
  CheckCircle2,
  BookOpen,
  ArrowUpRight,
  Paperclip,
  Scan,
  ArrowUp,
  PanelRightClose,
} from "lucide-react";

export interface RightSidebarProps {
  /** Model display name, default: 'Claude 3.5 Sonnet RAG' */
  modelName?: string;
  /** Currently attached context name */
  contextTitle?: string;
  /** Whether the sidebar is collapsed */
  isCollapsed?: boolean;
  /** Callback to toggle collapse */
  onToggleCollapse?: () => void;
  /** Callback when tune/slider button clicked */
  onTuneClick?: () => void;
  /** Callback when reset/refresh chat clicked */
  onResetChat?: () => void;
  /** Callback when citation source link is clicked */
  onCitationClick?: () => void;
  /** Callback when a suggestion chip is clicked */
  onSuggestionClick?: (prompt: string) => void;
  /** Callback when message is sent */
  onSendMessage?: (message: string) => void;
  /** Additional container classes */
  className?: string;
}

export default function RightSidebar({
  modelName = "Claude 3.5 Sonnet RAG",
  contextTitle = "Trang 12 - Giáo trình CTDL",
  isCollapsed = false,
  onToggleCollapse,
  onTuneClick,
  onResetChat,
  onCitationClick,
  onSuggestionClick,
  onSendMessage,
  className = "",
}: RightSidebarProps) {
  const [inputValue, setInputValue] = useState("");

  const handleSend = () => {
    if (!inputValue.trim()) return;
    onSendMessage?.(inputValue);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <aside
      className={`flex h-full flex-col justify-between border-l border-gray-100 bg-white select-none transition-all duration-300 ease-in-out ${
        isCollapsed
          ? "w-0 p-0 border-l-0 overflow-hidden opacity-0 pointer-events-none"
          : "w-80 md:w-96 p-4 opacity-100"
      } ${className}`.trim()}
    >
      {/* ── Top Section: Header & Context ── */}
      <div className="flex flex-col space-y-3">
        {/* Header: AI Title & Tools */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-2xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-gray-900">
                  StudyMate AI
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <p className="text-[11px] text-gray-400">{modelName}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-gray-500">
            <button
              type="button"
              onClick={onTuneClick}
              aria-label="Cài đặt mô hình AI"
              title="Cài đặt mô hình AI"
              className="rounded-lg p-1.5 hover:bg-gray-100 hover:text-gray-800 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onResetChat}
              aria-label="Làm mới đoạn hội thoại"
              title="Làm mới đoạn hội thoại"
              className="rounded-lg p-1.5 hover:bg-gray-100 hover:text-gray-800 transition-colors cursor-pointer"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Thu gọn trợ lý AI"
                title="Thu gọn trợ lý AI"
                className="rounded-lg p-1.5 hover:bg-gray-100 hover:text-gray-800 transition-colors cursor-pointer"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Context Link Banner */}
        <div className="flex items-center gap-2 rounded-xl border border-blue-100/70 bg-blue-50/70 px-3 py-1.5 text-xs font-medium text-indigo-950 shadow-2xs">
          <Link2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
          <span className="truncate">Context: {contextTitle}</span>
        </div>
      </div>

      {/* ── Chat Messages Stream (Scrollable) ── */}
      <div className="my-3 flex-1 overflow-y-auto space-y-4 pr-1">
        {/* User Question */}
        <div className="flex flex-col items-end">
          <div className="max-w-[90%] rounded-2xl rounded-tr-xs bg-indigo-600 p-3 text-xs sm:text-sm leading-relaxed text-white shadow-xs">
            Giải thích cho mình vì sao cây BST cân bằng lại đảm bảo được độ phức
            tạp O(log n) khi tìm kiếm so với cây thông thường?
          </div>
          <span className="mt-1 text-[10px] text-gray-400">10:42 AM</span>
        </div>

        {/* AI Answer */}
        <div className="space-y-2">
          {/* AI Header Badge */}
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-bold text-gray-900">StudyMate AI</span>
            <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
              Đã trích dẫn
            </span>
          </div>

          {/* AI Answer Bubble */}
          <div className="space-y-2.5 rounded-2xl border border-blue-100/60 bg-blue-50/40 p-3.5 text-xs sm:text-sm text-gray-800 leading-relaxed shadow-2xs">
            <p>
              Chào bạn! Dưới đây là 3 lý do cốt lõi giúp cây BST cân bằng đạt
              hiệu năng vượt trội:
            </p>

            <div className="space-y-2">
              {/* Bullet 1 */}
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-900">
                    Chiều cao tối ưu h ≈ log₂(n):
                  </span>{" "}
                  Cây AVL hay Red-Black liên tục tự xoay cân bằng, chiều cao chỉ
                  tăng khi số phần tử tăng theo cấp số nhân.
                </div>
              </div>

              {/* Bullet 2 */}
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-900">
                    Triệt tiêu suy biến:
                  </span>{" "}
                  Ngăn chặn trường hợp cây biến chất thành danh sách liên kết
                  khiến thời gian tìm kiếm rơi về{" "}
                  <span className="font-semibold text-gray-900">O(n)</span>.
                </div>
              </div>

              {/* Bullet 3 */}
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-900">
                    Nguyên lý chia để trị:
                  </span>{" "}
                  Mỗi lần rẽ nhánh trái/phải, không gian tìm kiếm giảm đi đúng
                  50%.
                </div>
              </div>
            </div>

            {/* Citation Source Box */}
            <button
              type="button"
              onClick={onCitationClick}
              className="flex w-full items-center justify-between rounded-xl border border-blue-100/80 bg-white px-3 py-2 text-xs font-semibold text-indigo-600 shadow-2xs hover:bg-blue-50/70 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5 truncate">
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  Nguồn: Trang 12 - Mục 4.2 Cân bằng cây
                </span>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
            </button>
          </div>
        </div>

        {/* Action Suggestion Pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => onSuggestionClick?.("+ Tạo 3 Flashcards xoay cây")}
            className="rounded-full border border-indigo-100 bg-indigo-50/70 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            + Tạo 3 Flashcards xoay cây
          </button>
          <button
            type="button"
            onClick={() => onSuggestionClick?.("Cho ví dụ code C++")}
            className="rounded-full border border-indigo-100 bg-indigo-50/70 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            Cho ví dụ code C++
          </button>
        </div>
      </div>

      {/* ── Bottom Input Section ── */}
      <div className="flex flex-col space-y-2">
        <div className="rounded-2xl border border-blue-100/80 bg-blue-50/50 p-2.5 shadow-2xs focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Hỏi AI về tài liệu hoặc yêu cầu tạo câu hỏi trắc nghiệm..."
            className="w-full resize-none bg-transparent text-xs sm:text-sm text-gray-800 placeholder-gray-400 outline-none leading-relaxed"
          />

          <div className="flex items-center justify-between pt-1.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Đính kèm tài liệu"
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors cursor-pointer"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <span className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 shadow-2xs">
                <Scan className="h-3 w-3 text-gray-500" />
                Trang 12
              </span>
            </div>

            <button
              type="button"
              onClick={handleSend}
              className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <span>Gửi</span>
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] sm:text-[11px] text-gray-400">
          Nhấn <span className="font-semibold text-gray-600">Enter</span> để
          gửi, <span className="font-semibold text-gray-600">Shift + Enter</span>{" "}
          xuống dòng
        </p>
      </div>
    </aside>
  );
}

export { RightSidebar };
