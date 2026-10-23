"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Sparkles,
  MessageSquare,
  ArrowLeft,
  Plus,
  Link2,
  Bot,
  CheckCircle2,
  Paperclip,
  ArrowUp,
  PanelRightClose,
  Search,
  ChevronDown,
  Copy,
  Lightbulb,
  Zap,
  Brain,
  Scale,
  BookOpen,
  ArrowUpRight,
  X,
  Upload,
  FolderOpen,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Check,
} from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import { useDocuments } from "@/hooks/useDocuments";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type ChatState = "empty" | "list" | "active";
export type SpeedMode = "fast" | "balanced" | "deep";

export interface AttachedFile {
  id: string;
  name: string;
  size?: number;
  source: "local" | "workspace";
}

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
  citation?: string;
  hasCitation?: boolean;
  attachedFiles?: string[];
  bullets?: { title: string; desc: string }[];
}

export interface ChatSessionItem {
  id: string;
  title: string;
  lastMessage: string;
  lastMessageRole?: "ai" | "user";
  timestamp: string;
  contextTag?: string;
  messageCount?: number;
  rawDate: Date;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const AVAILABLE_MODELS = [
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", desc: "Thông minh & Chi tiết nhất" },
  { id: "gpt-4o", name: "GPT-4o", desc: "Mạnh mẽ & Đa năng" },
  { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku", desc: "Phản hồi siêu tốc" },
  { id: "gpt-4o-mini", name: "GPT-4o mini", desc: "Nhẹ & Tiết kiệm" },
];

const SPEED_OPTIONS: {
  key: SpeedMode;
  icon: React.ReactNode;
  label: string;
  shortDesc: string;
}[] = [
  {
    key: "fast",
    icon: <Zap className="h-3.5 w-3.5 text-amber-500" />,
    label: "Nhanh",
    shortDesc: "Tối ưu tốc độ phản hồi",
  },
  {
    key: "balanced",
    icon: <Scale className="h-3.5 w-3.5 text-indigo-500" />,
    label: "Cân bằng",
    shortDesc: "Cân đối giữa tốc độ & độ sâu",
  },
  {
    key: "deep",
    icon: <Brain className="h-3.5 w-3.5 text-pink-500" />,
    label: "Suy luận sâu",
    shortDesc: "Phân tích kỹ lưỡng từng bước",
  },
];

const STARTER_PROMPTS = [
  { icon: "💡", label: "Tóm tắt 3 ý chính của tài liệu" },
  { icon: "🌳", label: "Giải thích cơ chế cây BST" },
  { icon: "❓", label: "Tạo 5 câu trắc nghiệm nhanh" },
  { icon: "📝", label: "Lập lộ trình ôn tập tuần này" },
];

const DEFAULT_SAMPLE_CONVERSATIONS: ChatSessionItem[] = [
  {
    id: "sample-1",
    title: "Hỏi về Độ phức tạp cây BST cân bằng",
    lastMessage: "AI: Chiều cao tối ưu h ≈ log2(n) giúp ngăn chặn trường hợp...",
    lastMessageRole: "ai",
    timestamp: "10:42 AM",
    contextTag: "Trang 12",
    rawDate: new Date(),
  },
  {
    id: "sample-2",
    title: "Giải thích thuật toán xoay cây AVL (Left-Right)",
    lastMessage: "Bạn: Cho mình ví dụ minh họa trực quan trường hợp mất c...",
    lastMessageRole: "user",
    timestamp: "Hôm qua",
    messageCount: 14,
    rawDate: new Date(Date.now() - 86400000),
  },
  {
    id: "sample-3",
    title: "Tạo bộ 10 câu trắc nghiệm Cây nhị phân",
    lastMessage: "AI: Đã khởi tạo 10 câu hỏi kiểm tra độ hiểu bài kèm giải thí...",
    lastMessageRole: "ai",
    timestamp: "2 ngày trước",
    messageCount: 8,
    rawDate: new Date(Date.now() - 2 * 86400000),
  },
  {
    id: "sample-4",
    title: "So sánh Red-Black Tree và AVL Tree",
    lastMessage: "Bạn: Khi nào nên ưu tiên dùng Red-Black Tree thay vì AVL...",
    lastMessageRole: "user",
    timestamp: "5 ngày trước",
    messageCount: 19,
    rawDate: new Date(Date.now() - 5 * 86400000),
  },
];

const SAMPLE_ACTIVE_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    role: "user",
    content:
      "Giải thích cho mình vì sao cây BST cân bằng lại đảm bảo được độ phức tạp O(log n) khi tìm kiếm so với cây thông thường?",
    timestamp: "10:42 AM",
  },
  {
    id: "msg-2",
    role: "ai",
    content:
      "Chào bạn! Dưới đây là 3 lý do cốt lõi giúp cây BST cân bằng đạt hiệu năng vượt trội:",
    timestamp: "10:42 AM",
    hasCitation: true,
    citation: "Nguồn: Trang 12 – Mục 4.2 Cân bằng cây",
    bullets: [
      {
        title: "Chiều cao tối ưu h ≈ log₂(n):",
        desc: "Các cây tự cân bằng (AVL, Red-Black) đảm bảo chiều cao chỉ tăng theo logarit số phần tử.",
      },
      {
        title: "Triệt tiêu suy biến:",
        desc: "Ngăn chặn trường hợp xấu nhất cây biến thành danh sách liên kết dẫn tới chi phí O(n).",
      },
      {
        title: "Nguyên lý chia để trị:",
        desc: "Mỗi bước so sánh rẽ nhánh sẽ loại bỏ ngay 50% số nút còn lại trong không gian tìm kiếm.",
      },
    ],
  },
];

// ─────────────────────────────────────────────
// Sub-component: Model & Speed Config Menu (Dropdown Popover)
// ─────────────────────────────────────────────

interface ModelConfigMenuProps {
  model: string;
  speed: SpeedMode;
  onModelChange: (model: string) => void;
  onSpeedChange: (speed: SpeedMode) => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function ModelConfigMenu({
  model,
  speed,
  onModelChange,
  onSpeedChange,
  isOpen,
  onToggle,
  onClose,
}: ModelConfigMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  const activeSpeed = SPEED_OPTIONS.find((s) => s.key === speed) || SPEED_OPTIONS[1];

  return (
    <div className="relative" ref={containerRef}>
      {/* Compact Header Pill Trigger */}
      <button
        type="button"
        onClick={onToggle}
        title="Cấu hình Model & Độ phản hồi"
        className="flex items-center gap-1.5 rounded-xl border border-gray-200/80 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-2xs hover:border-indigo-200 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-1">
          {activeSpeed.icon}
          <span className="max-w-[100px] truncate font-semibold text-gray-800">{model}</span>
        </span>
        <ChevronDown
          className={`h-3 w-3 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-2xl border border-gray-100 bg-white p-3 shadow-xl ring-1 ring-black/5 animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Section 1: AI Model Selector */}
          <div className="space-y-1 pb-3 border-b border-gray-100">
            <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              MÔ HÌNH AI
            </span>
            <div className="space-y-1 pt-1">
              {AVAILABLE_MODELS.map((m) => {
                const isSelected = m.name === model;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onModelChange(m.name);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50 text-indigo-900 font-semibold"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div>
                      <p className="font-medium">{m.name}</p>
                      <p className="text-[10px] text-gray-400">{m.desc}</p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-indigo-600 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Response Depth / Speed Slider Pills */}
          <div className="pt-2.5 space-y-1.5">
            <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              MỨC ĐỘ PHẢN HỒI
            </span>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-50 p-1">
              {SPEED_OPTIONS.map((opt) => {
                const isActive = opt.key === speed;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => onSpeedChange(opt.key)}
                    className={`flex flex-col items-center justify-center rounded-lg py-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-indigo-900 shadow-2xs font-semibold ring-1 ring-black/5"
                        : "text-gray-500 hover:text-gray-800 hover:bg-white/50"
                    }`}
                    title={opt.shortDesc}
                  >
                    <span className="mb-0.5">{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 text-center pt-0.5">
              {activeSpeed.shortDesc}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-component: Model & Speed Bar (Inline for State 1 & 2)
// ─────────────────────────────────────────────

interface InlineModelSpeedBarProps {
  model: string;
  speed: SpeedMode;
  onModelChange: (model: string) => void;
  onSpeedChange: (speed: SpeedMode) => void;
}

function InlineModelSpeedBar({
  model,
  speed,
  onModelChange,
  onSpeedChange,
}: InlineModelSpeedBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  return (
    <div className="flex items-center justify-between gap-1.5 py-1">
      {/* Model Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsDropdownOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200/80 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 shadow-2xs hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <Sparkles className="h-3 w-3 text-indigo-600" />
          <span className="max-w-[90px] truncate">{model}</span>
          <ChevronDown className="h-3 w-3 text-gray-400" />
        </button>

        {isDropdownOpen && (
          <div className="absolute bottom-full left-0 mb-1 z-50 w-48 rounded-xl border border-gray-100 bg-white p-1 shadow-lg ring-1 ring-black/5">
            {AVAILABLE_MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onModelChange(m.name);
                  setIsDropdownOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                  m.name === model
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span>{m.name}</span>
                {m.name === model && <Check className="h-3.5 w-3.5 text-indigo-600" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Speed Icons / Pills */}
      <div className="flex items-center gap-1">
        {SPEED_OPTIONS.map((opt) => {
          const isActive = opt.key === speed;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onSpeedChange(opt.key)}
              title={opt.label + " - " + opt.shortDesc}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-all cursor-pointer ${
                isActive
                  ? "bg-indigo-50/80 text-indigo-900 font-semibold shadow-2xs"
                  : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span>{opt.icon}</span>
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-component: File Attachment Popover
// ─────────────────────────────────────────────

interface FileAttachMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocal: () => void;
  onSelectWorkspace: () => void;
}

function FileAttachMenu({
  isOpen,
  onClose,
  onSelectLocal,
  onSelectWorkspace,
}: FileAttachMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 mb-2 z-50 w-56 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl ring-1 ring-black/5 animate-in fade-in-50 zoom-in-95 duration-100"
    >
      <button
        type="button"
        onClick={() => {
          onClose();
          onSelectLocal();
        }}
        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-900 transition-colors cursor-pointer"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Upload className="h-4 w-4" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">Tải tệp từ thiết bị</p>
          <p className="text-[10px] text-gray-400">PDF, Ảnh, Docs tối đa 50MB</p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => {
          onClose();
          onSelectWorkspace();
        }}
        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-900 transition-colors cursor-pointer mt-0.5"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <FolderOpen className="h-4 w-4" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">Không gian học tập</p>
          <p className="text-[10px] text-gray-400">Chọn tài liệu đã lưu sẵn</p>
        </div>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-component: SharedChatInputBar
// ─────────────────────────────────────────────

interface SharedChatInputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  attachedFiles: AttachedFile[];
  onRemoveFile: (fileId: string) => void;
  onAttachFileClick: () => void;
  isAttachMenuOpen: boolean;
  onCloseAttachMenu: () => void;
  onSelectLocalFile: () => void;
  onSelectWorkspaceDoc: () => void;
  placeholder?: string;
  contextLabel?: string;
  disabled?: boolean;
}

function SharedChatInputBar({
  value,
  onChange,
  onSend,
  attachedFiles,
  onRemoveFile,
  onAttachFileClick,
  isAttachMenuOpen,
  onCloseAttachMenu,
  onSelectLocalFile,
  onSelectWorkspaceDoc,
  placeholder = "Hỏi AI về tài liệu hoặc nhập lệnh...",
  contextLabel,
  disabled = false,
}: SharedChatInputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = (value.trim().length > 0 || attachedFiles.length > 0) && !disabled;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  return (
    <div className="relative rounded-2xl border border-blue-100/80 bg-blue-50/50 p-2.5 shadow-2xs focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all">
      {/* Attached Files Pills */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-2">
          {attachedFiles.map((f) => (
            <span
              key={f.id}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-white px-2 py-0.5 text-[11px] font-medium text-indigo-800 shadow-2xs"
            >
              <FileText className="h-3 w-3 text-indigo-500 shrink-0" />
              <span className="truncate max-w-[120px]">{f.name}</span>
              <button
                type="button"
                onClick={() => onRemoveFile(f.id)}
                className="text-gray-400 hover:text-rose-500 cursor-pointer ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full resize-none bg-transparent text-xs sm:text-sm text-gray-800 placeholder-gray-400 outline-none leading-relaxed min-h-[22px]"
      />

      {/* Input Action Controls */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-1.5 relative">
          {/* File Attachment Trigger Button */}
          <button
            type="button"
            onClick={onAttachFileClick}
            aria-label="Thêm tệp"
            className="flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 transition-colors cursor-pointer"
          >
            <Paperclip className="h-3.5 w-3.5 text-indigo-600" />
            <span>+ Thêm tệp</span>
          </button>

          {/* Context Badge (e.g. Context: 2 tài liệu / Trang 12) */}
          {contextLabel && (
            <span className="flex items-center gap-1 rounded-lg border border-blue-100 bg-white px-2 py-0.5 text-[11px] font-medium text-indigo-700 shadow-2xs">
              <BookOpen className="h-3 w-3 text-indigo-500 shrink-0" />
              <span className="truncate max-w-[100px]">{contextLabel}</span>
            </span>
          )}

          {/* Attachment Popover */}
          <FileAttachMenu
            isOpen={isAttachMenuOpen}
            onClose={onCloseAttachMenu}
            onSelectLocal={onSelectLocalFile}
            onSelectWorkspace={onSelectWorkspaceDoc}
          />
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          aria-label="Gửi tin nhắn"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all cursor-pointer ${
            canSend
              ? "bg-indigo-600 text-white shadow-md hover:bg-indigo-700 active:scale-95"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-component: Workspace Document Picker Modal
// ─────────────────────────────────────────────

interface WorkspaceDocModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (docName: string) => void;
  availableDocs: { id: string; file_name: string }[];
}

function WorkspaceDocModal({
  isOpen,
  onClose,
  onSelect,
  availableDocs,
}: WorkspaceDocModalProps) {
  if (!isOpen) return null;

  const defaultList =
    availableDocs.length > 0
      ? availableDocs
      : [
          { id: "ws-1", file_name: "Giao_trinh_CTDL_GT.pdf" },
          { id: "ws-2", file_name: "Slide_Chuong_4_Cay_Nhi_Phan.pdf" },
          { id: "ws-3", file_name: "De_cuong_on_tap_giua_ky.docx" },
        ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 animate-in fade-in-50 duration-150">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl border border-gray-100 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-indigo-600" />
            <h3 className="text-xs sm:text-sm font-bold text-gray-900">
              Chọn tài liệu từ Không gian học tập
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[11px] text-gray-500">
          Chọn tài liệu để AI trích xuất nội dung và trả lời chính xác:
        </p>

        <div className="max-h-60 overflow-y-auto space-y-1.5">
          {defaultList.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => {
                onSelect(doc.file_name);
                onClose();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/50 p-2 text-left text-xs text-gray-800 hover:border-indigo-200 hover:bg-indigo-50/60 transition-colors cursor-pointer"
            >
              <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
              <span className="truncate flex-1 font-medium">{doc.file_name}</span>
              <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 shrink-0">
                Chọn
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-component: EmptyStateView (State 1)
// ─────────────────────────────────────────────

interface EmptyStateViewProps {
  inputValue: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onStarterClick: (prompt: string) => void;
  model: string;
  speed: SpeedMode;
  onModelChange: (m: string) => void;
  onSpeedChange: (s: SpeedMode) => void;
  attachedFiles: AttachedFile[];
  onRemoveFile: (id: string) => void;
  onAttachFileClick: () => void;
  isAttachMenuOpen: boolean;
  onCloseAttachMenu: () => void;
  onSelectLocalFile: () => void;
  onSelectWorkspaceDoc: () => void;
  contextLabel?: string;
}

function EmptyStateView({
  inputValue,
  onInputChange,
  onSend,
  onStarterClick,
  model,
  speed,
  onModelChange,
  onSpeedChange,
  attachedFiles,
  onRemoveFile,
  onAttachFileClick,
  isAttachMenuOpen,
  onCloseAttachMenu,
  onSelectLocalFile,
  onSelectWorkspaceDoc,
  contextLabel,
}: EmptyStateViewProps) {
  return (
    <>
      {/* Friendly Center Hero */}
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-2 py-4">
        {/* Sparkle Hero Icon */}
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-2xs">
          <Sparkles className="h-8 w-8 animate-pulse" />
        </div>

        {/* Text Prompt */}
        <div className="space-y-1 text-center">
          <h3 className="text-sm font-bold text-gray-900">
            Hỏi bất cứ điều gì về tài liệu...
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed max-w-[260px] mx-auto">
            Nhập câu hỏi vào khung bên dưới để bắt đầu đoạn chat mới tự động.
          </p>
        </div>

        {/* Starter Pills */}
        <div className="w-full space-y-2 pt-1">
          {STARTER_PROMPTS.map((pill) => (
            <button
              key={pill.label}
              type="button"
              onClick={() => onStarterClick(pill.label)}
              className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white px-3.5 py-2.5 text-left text-xs font-medium text-gray-700 shadow-2xs hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-900 transition-all cursor-pointer active:scale-[0.99]"
            >
              <span className="text-base shrink-0">{pill.icon}</span>
              <span className="truncate">{pill.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Area: Model Config + Input */}
      <div className="shrink-0 space-y-2">
        <InlineModelSpeedBar
          model={model}
          speed={speed}
          onModelChange={onModelChange}
          onSpeedChange={onSpeedChange}
        />

        <SharedChatInputBar
          value={inputValue}
          onChange={onInputChange}
          onSend={onSend}
          attachedFiles={attachedFiles}
          onRemoveFile={onRemoveFile}
          onAttachFileClick={onAttachFileClick}
          isAttachMenuOpen={isAttachMenuOpen}
          onCloseAttachMenu={onCloseAttachMenu}
          onSelectLocalFile={onSelectLocalFile}
          onSelectWorkspaceDoc={onSelectWorkspaceDoc}
          placeholder="Hỏi AI bất kỳ điều gì về tài liệu hoặc nhập lệnh..."
          contextLabel={contextLabel}
        />

        <p className="text-center text-[10px] text-gray-400">
          Nhấn <span className="font-semibold text-gray-600">Enter</span> để gửi,{" "}
          <span className="font-semibold text-gray-600">Shift + Enter</span> xuống dòng
        </p>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Sub-component: ChatCard (State 2)
// ─────────────────────────────────────────────

interface ChatCardProps {
  session: ChatSessionItem;
  onClick: () => void;
}

function ChatCard({ session, onClick }: ChatCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-2.5 rounded-2xl border border-transparent p-3 text-left transition-all hover:border-indigo-100 hover:bg-indigo-50/40 active:scale-[0.99] cursor-pointer"
    >
      {/* Icon Bubble */}
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
        <MessageSquare className="h-4 w-4" />
      </div>

      {/* Card Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-xs font-bold text-gray-900 group-hover:text-indigo-900">
            {session.title}
          </p>
          <span className="shrink-0 text-[10px] font-medium text-gray-400 mt-px">
            {session.timestamp}
          </span>
        </div>

        {/* Message Preview */}
        <p className="mt-1 line-clamp-1 text-[11px] leading-relaxed text-gray-500">
          {session.lastMessage}
        </p>

        {/* Badges / Context Tag */}
        {(session.contextTag || session.messageCount) && (
          <div className="mt-2 flex items-center gap-1.5">
            {session.contextTag && (
              <span className="inline-flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50/80 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                <Link2 className="h-2.5 w-2.5" />
                {session.contextTag}
              </span>
            )}
            {session.messageCount && (
              <span className="text-[10px] text-gray-400">
                {session.messageCount} tin nhắn
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────
// Sub-component: ChatListView (State 2)
// ─────────────────────────────────────────────

interface ChatListViewProps {
  sessions: ChatSessionItem[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectChat: (id: string) => void;
  model: string;
  speed: SpeedMode;
  onModelChange: (m: string) => void;
  onSpeedChange: (s: SpeedMode) => void;
  quickInputValue: string;
  onQuickInputChange: (v: string) => void;
  onQuickSend: () => void;
  contextLabel?: string;
}

function ChatListView({
  sessions,
  isLoading,
  searchQuery,
  onSearchChange,
  onSelectChat,
  model,
  speed,
  onModelChange,
  onSpeedChange,
  quickInputValue,
  onQuickInputChange,
  onQuickSend,
  contextLabel,
}: ChatListViewProps) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      (s) => s.title.toLowerCase().includes(q) || s.lastMessage.toLowerCase().includes(q)
    );
  }, [sessions, searchQuery]);

  // Group by Today, Yesterday, This Week, Older
  const grouped = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
    const startOfWeek = new Date(startOfToday.getTime() - 6 * 86400000);

    const map: Record<string, ChatSessionItem[]> = {
      "HÔM NAY": [],
      "HÔM QUA": [],
      "TUẦN NÀY": [],
      "TRƯỚC ĐÓ": [],
    };

    for (const item of filtered) {
      if (item.rawDate >= startOfToday) {
        map["HÔM NAY"].push(item);
      } else if (item.rawDate >= startOfYesterday) {
        map["HÔM QUA"].push(item);
      } else if (item.rawDate >= startOfWeek) {
        map["TUẦN NÀY"].push(item);
      } else {
        map["TRƯỚC ĐÓ"].push(item);
      }
    }

    return Object.entries(map).filter(([, list]) => list.length > 0);
  }, [filtered]);

  return (
    <>
      {/* Search Input */}
      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm kiếm lịch sử chat..."
          className="w-full rounded-xl border border-gray-100 bg-gray-50 py-2 pl-8.5 pr-8 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-indigo-200 focus:bg-white transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Cards List */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 -mr-1 pr-1">
        {isLoading && sessions.length === 0 ? (
          <div className="space-y-3 animate-pulse pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-2xl p-3 bg-gray-50">
                <div className="h-8 w-8 rounded-xl bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 rounded bg-gray-200" />
                  <div className="h-2.5 w-1/2 rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <MessageSquare className="h-8 w-8 text-gray-200" />
            <p className="text-xs font-semibold text-gray-600">
              {searchQuery ? "Không tìm thấy đoạn chat nào" : "Chưa có lịch sử trò chuyện"}
            </p>
          </div>
        ) : (
          grouped.map(([label, list]) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {label}
                </span>
                <span className="text-[10px] font-medium text-gray-400">
                  {list.length} phiên
                </span>
              </div>
              <div className="space-y-1">
                {list.map((session) => (
                  <ChatCard
                    key={session.id}
                    session={session}
                    onClick={() => onSelectChat(session.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom Area: Model & Speed + Quick Trigger Input */}
      <div className="shrink-0 space-y-2 border-t border-gray-100 pt-2">
        <InlineModelSpeedBar
          model={model}
          speed={speed}
          onModelChange={onModelChange}
          onSpeedChange={onSpeedChange}
        />

        {/* Quick Question Bar */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-2 focus-within:border-indigo-200 focus-within:bg-white transition-all space-y-1">
          {contextLabel && (
            <div className="flex items-center gap-1 px-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-semibold text-emerald-800">
                {contextLabel}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={quickInputValue}
              onChange={(e) => onQuickInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && quickInputValue.trim()) {
                  e.preventDefault();
                  onQuickSend();
                }
              }}
              placeholder="Hỏi AI câu mới để tự động tạo phiên chat..."
              className="flex-1 min-w-0 bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none px-1"
            />
            <button
              type="button"
              onClick={onQuickSend}
              disabled={!quickInputValue.trim()}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-all ${
                quickInputValue.trim()
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-xs"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Sub-component: ActiveChatView (State 3)
// ─────────────────────────────────────────────

interface ActiveChatViewProps {
  messages: ChatMessage[];
  inputValue: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  attachedFiles: AttachedFile[];
  onRemoveFile: (id: string) => void;
  onAttachFileClick: () => void;
  isAttachMenuOpen: boolean;
  onCloseAttachMenu: () => void;
  onSelectLocalFile: () => void;
  onSelectWorkspaceDoc: () => void;
  contextLabel?: string;
  onFollowUpSuggestion?: (prompt: string) => void;
}

function ActiveChatView({
  messages,
  inputValue,
  onInputChange,
  onSend,
  attachedFiles,
  onRemoveFile,
  onAttachFileClick,
  isAttachMenuOpen,
  onCloseAttachMenu,
  onSelectLocalFile,
  onSelectWorkspaceDoc,
  contextLabel,
  onFollowUpSuggestion,
}: ActiveChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <>
      {/* Context Link Banner */}
      {contextLabel && (
        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-blue-100/70 bg-blue-50/70 px-3 py-1.5 text-xs font-semibold text-indigo-950 shadow-2xs">
          <Link2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
          <span className="truncate">Context: {contextLabel}</span>
          <ArrowUpRight className="ml-auto h-3 w-3 text-indigo-400 shrink-0" />
        </div>
      )}

      {/* Messages Stream */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1 -mr-1">
        {messages.map((msg) =>
          msg.role === "user" ? (
            /* User Message Bubble (Right aligned) */
            <div key={msg.id} className="flex flex-col items-end gap-1">
              <div className="max-w-[90%] rounded-2xl rounded-tr-xs bg-indigo-600 p-3 text-xs sm:text-sm leading-relaxed text-white shadow-xs">
                {msg.content}
              </div>
              <span className="text-[10px] text-gray-400">{msg.timestamp}</span>
            </div>
          ) : (
            /* AI Message Bubble (Left aligned) */
            <div key={msg.id} className="space-y-2">
              {/* AI Badge */}
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-bold text-gray-900">StudyMate AI</span>
                {msg.hasCitation && (
                  <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                    Đã trích dẫn
                  </span>
                )}
              </div>

              {/* AI Content Bubble */}
              <div className="space-y-2.5 rounded-2xl border border-blue-100/60 bg-blue-50/40 p-3.5 text-xs sm:text-sm text-gray-800 leading-relaxed shadow-2xs">
                <p>{msg.content}</p>

                {/* Bullets if present */}
                {msg.bullets && msg.bullets.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {msg.bullets.map((b, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
                        <div>
                          <span className="font-semibold text-gray-900">{b.title}</span>{" "}
                          <span>{b.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Citation Banner */}
                {msg.citation && (
                  <div className="flex w-full items-center justify-between rounded-xl border border-blue-100/80 bg-white px-3 py-2 text-xs font-semibold text-indigo-600 shadow-2xs">
                    <div className="flex items-center gap-1.5 truncate">
                      <BookOpen className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{msg.citation}</span>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(msg.content)}
                  className="flex items-center gap-1 rounded-lg border border-gray-100 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer"
                >
                  <Copy className="h-3 w-3" />
                  <span>Sao chép</span>
                </button>
                <button
                  type="button"
                  title="Hữu ích"
                  className="rounded-lg border border-gray-100 bg-white p-1 text-gray-500 hover:bg-gray-50 hover:text-emerald-600 transition-colors shadow-2xs cursor-pointer"
                >
                  <ThumbsUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  title="Chưa chính xác"
                  className="rounded-lg border border-gray-100 bg-white p-1 text-gray-500 hover:bg-gray-50 hover:text-rose-600 transition-colors shadow-2xs cursor-pointer"
                >
                  <ThumbsDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onFollowUpSuggestion?.("Tạo câu hỏi tiếp nối")}
                  className="flex items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50/70 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs cursor-pointer"
                >
                  <Lightbulb className="h-3 w-3" />
                  <span>Tạo câu hỏi tiếp nối</span>
                </button>
              </div>
            </div>
          )
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="shrink-0 space-y-2">
        <SharedChatInputBar
          value={inputValue}
          onChange={onInputChange}
          onSend={onSend}
          attachedFiles={attachedFiles}
          onRemoveFile={onRemoveFile}
          onAttachFileClick={onAttachFileClick}
          isAttachMenuOpen={isAttachMenuOpen}
          onCloseAttachMenu={onCloseAttachMenu}
          onSelectLocalFile={onSelectLocalFile}
          onSelectWorkspaceDoc={onSelectWorkspaceDoc}
          placeholder="Hỏi tiếp về đoạn chat này..."
          contextLabel={contextLabel}
        />

        <p className="text-center text-[10px] text-gray-400">
          Nhấn <span className="font-semibold text-gray-600">Enter</span> để gửi,{" "}
          <span className="font-semibold text-gray-600">Shift + Enter</span> xuống dòng
        </p>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Props interface
// ─────────────────────────────────────────────

export interface RightSidebarProps {
  /** subjectId để fetch danh sách conversations */
  subjectId?: string | null;
  /** Tên context tài liệu hiện tại */
  contextTitle?: string;
  /** Whether the sidebar is collapsed */
  isCollapsed?: boolean;
  /** Callback to toggle collapse */
  onToggleCollapse?: () => void;
  /** Callback when message is sent */
  onSendMessage?: (message: string, chatSessionId?: string) => void;
  /** Additional container classes */
  className?: string;
}

// ─────────────────────────────────────────────
// Main Component: RightSidebar
// ─────────────────────────────────────────────

export default function RightSidebar({
  subjectId,
  contextTitle = "Trang 12 – Giáo trình CTDL",
  isCollapsed = false,
  onToggleCollapse,
  onSendMessage,
  className = "",
}: RightSidebarProps) {
  // ── Navigation State ──
  const [userChatState, setUserChatState] = useState<ChatState | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // ── Input States ──
  const [inputValue, setInputValue] = useState("");
  const [quickInputValue, setQuickInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // ── AI Model & Speed Configuration ──
  const [selectedModel, setSelectedModel] = useState("Claude 3.5 Sonnet");
  const [speedMode, setSpeedMode] = useState<SpeedMode>("balanced");
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

  // ── File Attachments ──
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isWorkspaceDocModalOpen, setIsWorkspaceDocModalOpen] = useState(false);
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);

  // ── Messages for Active State ──
  const [activeChatMessages, setActiveChatMessages] = useState<ChatMessage[]>(
    SAMPLE_ACTIVE_MESSAGES
  );

  // ── Data Hook ──
  const { conversations, isLoading, createSession } = useConversations(subjectId);
  const { documents } = useDocuments(activeChatId);

  // Merge server conversations with sample conversations if none returned
  const allSessions: ChatSessionItem[] = useMemo(() => {
    if (conversations.length > 0) {
      return conversations.map((c) => ({
        id: c.id,
        title: c.title,
        lastMessage: "Nhấn để tiếp tục cuộc trò chuyện",
        lastMessageRole: "ai",
        timestamp: new Date(c.updated_at || c.created_at).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        rawDate: new Date(c.updated_at || c.created_at),
      }));
    }
    return DEFAULT_SAMPLE_CONVERSATIONS;
  }, [conversations]);

  // Derive active chat state
  const chatState: ChatState =
    userChatState !== null
      ? userChatState
      : allSessions.length > 0 && !isLoading
      ? "list"
      : "empty";

  const setChatState = useCallback((s: ChatState) => {
    setUserChatState(s);
  }, []);

  // ── Active session object ──
  const activeSession = useMemo(() => {
    return allSessions.find((s) => s.id === activeChatId) || allSessions[0] || null;
  }, [allSessions, activeChatId]);

  // ── Handlers ──

  const handleSelectChat = useCallback(
    (id: string) => {
      setActiveChatId(id);
      setChatState("active");
    },
    [setChatState]
  );

  const handleBackToList = useCallback(() => {
    setActiveChatId(null);
    setChatState("list");
    setInputValue("");
    setSearchQuery("");
  }, [setChatState]);

  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setActiveChatMessages([]);
    setInputValue("");
    setAttachedFiles([]);
    setChatState("empty");
  }, [setChatState]);

  const handleSendFromEmpty = useCallback(async () => {
    const text = inputValue.trim();
    if (!text && attachedFiles.length === 0) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      attachedFiles: attachedFiles.map((f) => f.name),
    };

    let newId: string | undefined;
    try {
      if (subjectId && text) {
        const created = await createSession(text.slice(0, 50));
        newId = created?.id;
      }
    } catch {
      // ignore
    }

    const aiResponse: ChatMessage = {
      id: `ai-${Date.now()}`,
      role: "ai",
      content: `Tôi đã nhận được câu hỏi "${text}". Đang tra cứu thông tin từ tài liệu liên quan...`,
      timestamp: new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setActiveChatId(newId || "sample-new");
    setActiveChatMessages([userMsg, aiResponse]);
    setInputValue("");
    setAttachedFiles([]);
    setChatState("active");
    onSendMessage?.(text, newId);
  }, [inputValue, attachedFiles, subjectId, createSession, onSendMessage, setChatState]);

  const handleSendInActiveChat = useCallback(() => {
    const text = inputValue.trim();
    if (!text && attachedFiles.length === 0) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      attachedFiles: attachedFiles.map((f) => f.name),
    };

    const aiMsg: ChatMessage = {
      id: `ai-${Date.now()}`,
      role: "ai",
      content: `Dựa trên tài liệu bạn cung cấp, đây là giải đáp cho câu hỏi: "${text}"`,
      timestamp: new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setActiveChatMessages((prev) => [...prev, userMsg, aiMsg]);
    setInputValue("");
    setAttachedFiles([]);
    onSendMessage?.(text, activeChatId || undefined);
  }, [inputValue, attachedFiles, activeChatId, onSendMessage]);

  const handleQuickSend = useCallback(async () => {
    const text = quickInputValue.trim();
    if (!text) return;

    let newId: string | undefined;
    try {
      if (subjectId) {
        const created = await createSession(text.slice(0, 50));
        newId = created?.id;
      }
    } catch {
      // ignore
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setActiveChatId(newId || "sample-new");
    setActiveChatMessages([userMsg]);
    setQuickInputValue("");
    setChatState("active");
    onSendMessage?.(text, newId);
  }, [quickInputValue, subjectId, createSession, onSendMessage, setChatState]);

  const handleStarterClick = useCallback(
    (promptText: string) => {
      setInputValue(promptText);
      setTimeout(() => {
        const userMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "user",
          content: promptText,
          timestamp: new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "ai",
          content: `Dưới đây là nội dung cho "${promptText}":`,
          timestamp: new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        setActiveChatId("starter-chat");
        setActiveChatMessages([userMsg, aiMsg]);
        setInputValue("");
        setChatState("active");
        onSendMessage?.(promptText);
      }, 0);
    },
    [onSendMessage, setChatState]
  );

  // ── File Attachment Handlers ──
  const handleSelectLocalFile = () => {
    hiddenFileInputRef.current?.click();
  };

  const handleHiddenFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttached: AttachedFile[] = Array.from(files).map((f) => ({
      id: `local-${Date.now()}-${f.name}`,
      name: f.name,
      size: f.size,
      source: "local",
    }));

    setAttachedFiles((prev) => [...prev, ...newAttached]);
    // Reset file input
    e.target.value = "";
  };

  const handleSelectWorkspaceDoc = () => {
    setIsWorkspaceDocModalOpen(true);
  };

  const handleAddWorkspaceDoc = (docName: string) => {
    const docItem: AttachedFile = {
      id: `ws-${Date.now()}-${docName}`,
      name: docName,
      source: "workspace",
    };
    setAttachedFiles((prev) => [...prev, docItem]);
  };

  const handleRemoveAttachedFile = (fileId: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // ── Render Header according to State ──
  const renderHeader = () => {
    if (chatState === "active") {
      return (
        <div className="flex items-center justify-between gap-1.5">
          {/* Left: Back button to State 2 */}
          <button
            type="button"
            onClick={handleBackToList}
            className="flex items-center gap-1.5 rounded-xl border border-gray-100 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Lịch sử</span>
          </button>

          {/* Center: Truncated Title */}
          <p
            className="truncate text-center text-xs font-bold text-gray-900 flex-1 px-1"
            title={activeSession?.title}
          >
            {activeSession?.title || "Đoạn chat hiện tại"}
          </p>

          {/* Right: Model & Speed Dropdown Menu */}
          <div className="flex items-center gap-1">
            <ModelConfigMenu
              model={selectedModel}
              speed={speedMode}
              onModelChange={setSelectedModel}
              onSpeedChange={setSpeedMode}
              isOpen={isModelMenuOpen}
              onToggle={() => setIsModelMenuOpen((v) => !v)}
              onClose={() => setIsModelMenuOpen(false)}
            />

            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Thu gọn trợ lý AI"
                title="Thu gọn"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      );
    }

    if (chatState === "list") {
      return (
        <div className="flex items-center justify-between">
          {/* Left: Title + Count badge */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-2xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-900">
                  Lịch sử trò chuyện
                </span>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                  {allSessions.length} phiên
                </span>
              </div>
            </div>
          </div>

          {/* Right: [+ Tạo Chat mới] Button */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleNewChat}
              className="flex items-center gap-1 rounded-xl bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tạo Chat mới</span>
            </button>

            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Thu gọn"
                title="Thu gọn"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      );
    }

    // State 1: Empty State Header
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-2xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-gray-900">StudyMate AI</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <p className="text-[11px] text-gray-400">{selectedModel} RAG</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {allSessions.length > 0 && (
            <button
              type="button"
              onClick={() => setChatState("list")}
              className="flex items-center gap-1 rounded-xl border border-gray-100 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-2xs hover:bg-gray-50 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Lịch sử</span>
            </button>
          )}

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Thu gọn"
              title="Thu gọn"
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside
      className={`flex h-full flex-col border-l border-gray-100 bg-white select-none transition-all duration-300 ease-in-out ${
        isCollapsed
          ? "w-0 p-0 border-l-0 overflow-hidden opacity-0 pointer-events-none"
          : "w-80 md:w-96 p-4 opacity-100"
      } ${className}`.trim()}
    >
      {/* Hidden File Input for Local File Selection */}
      <input
        type="file"
        ref={hiddenFileInputRef}
        onChange={handleHiddenFileInputChange}
        className="hidden"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt"
      />

      {/* Header */}
      <div className="shrink-0 pb-3">{renderHeader()}</div>

      {/* Divider */}
      <div className="shrink-0 border-t border-gray-100 mb-3" />

      {/* Main Body (Switch between State 1, 2, 3) */}
      <div className="flex flex-1 min-h-0 flex-col gap-3">
        {chatState === "empty" && (
          <EmptyStateView
            inputValue={inputValue}
            onInputChange={setInputValue}
            onSend={handleSendFromEmpty}
            onStarterClick={handleStarterClick}
            model={selectedModel}
            speed={speedMode}
            onModelChange={setSelectedModel}
            onSpeedChange={setSpeedMode}
            attachedFiles={attachedFiles}
            onRemoveFile={handleRemoveAttachedFile}
            onAttachFileClick={() => setIsAttachMenuOpen((v) => !v)}
            isAttachMenuOpen={isAttachMenuOpen}
            onCloseAttachMenu={() => setIsAttachMenuOpen(false)}
            onSelectLocalFile={handleSelectLocalFile}
            onSelectWorkspaceDoc={handleSelectWorkspaceDoc}
            contextLabel={contextTitle ? contextTitle.split(" – ")[0] : "2 tài liệu"}
          />
        )}

        {chatState === "list" && (
          <ChatListView
            sessions={allSessions}
            isLoading={isLoading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectChat={handleSelectChat}
            model={selectedModel}
            speed={speedMode}
            onModelChange={setSelectedModel}
            onSpeedChange={setSpeedMode}
            quickInputValue={quickInputValue}
            onQuickInputChange={setQuickInputValue}
            onQuickSend={handleQuickSend}
            contextLabel="2 tài liệu kết nối"
          />
        )}

        {chatState === "active" && (
          <ActiveChatView
            messages={activeChatMessages}
            inputValue={inputValue}
            onInputChange={setInputValue}
            onSend={handleSendInActiveChat}
            attachedFiles={attachedFiles}
            onRemoveFile={handleRemoveAttachedFile}
            onAttachFileClick={() => setIsAttachMenuOpen((v) => !v)}
            isAttachMenuOpen={isAttachMenuOpen}
            onCloseAttachMenu={() => setIsAttachMenuOpen(false)}
            onSelectLocalFile={handleSelectLocalFile}
            onSelectWorkspaceDoc={handleSelectWorkspaceDoc}
            contextLabel={contextTitle}
            onFollowUpSuggestion={(p) => setInputValue(p)}
          />
        )}
      </div>

      {/* Workspace Document Picker Modal */}
      <WorkspaceDocModal
        isOpen={isWorkspaceDocModalOpen}
        onClose={() => setIsWorkspaceDocModalOpen(false)}
        onSelect={handleAddWorkspaceDoc}
        availableDocs={documents || []}
      />
    </aside>
  );
}

export { RightSidebar };
