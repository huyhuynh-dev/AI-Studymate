// ─────────────────────────────────────────────
// Types dùng chung cho toàn bộ RightSidebar
// ─────────────────────────────────────────────

/** Trạng thái hiển thị của khung chat: chưa có tin nhắn / đang trò chuyện */
export type ChatState = "empty" | "active";

export type EffortLevel = "low" | "medium" | "high" | "extra" | "max";

export interface AttachedFile {
  id: string;
  name: string;
  size?: number;
  source: "local" | "workspace";
  /** File gốc (chỉ có với source = "local") – dùng khi cần upload thật */
  file?: File;
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

export interface AIModelItem {
  id: string;
  name: string;
  desc: string;
}

export interface EffortOption {
  key: EffortLevel;
  label: string;
  isDefault?: boolean;
}

/** Cấu hình mô hình đang chọn trong ô nhập */
export interface ModelConfig {
  modelId: string;
  effort: EffortLevel;
  thinking: boolean;
}

/** Tài liệu trong Không gian học tập */
export interface WorkspaceDoc {
  id: string;
  file_name: string;
}

/** Thông tin kèm theo mỗi lần gửi tin (tham số thứ 3 của onSendMessage) */
export interface SendMessageOptions {
  model: string;
  effort: EffortLevel;
  thinking: boolean;
  attachedFiles: AttachedFile[];
}
