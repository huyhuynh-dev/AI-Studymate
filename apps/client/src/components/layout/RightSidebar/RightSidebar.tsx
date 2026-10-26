"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useDocuments } from "@/hooks/useDocuments";

import { ChatComposer } from "./components/ChatComposer";
import { ChatHeader } from "./components/ChatHeader";
import { ConfirmDeleteDialog } from "./components/ConfirmDeleteDialog";
import { EmptyState } from "./components/EmptyState";
import { MessageList } from "./components/MessageList";
import { WorkspaceDocModal } from "./components/WorkspaceDocModal";
import {
  DEFAULT_EFFORT,
  DEFAULT_MODEL_ID,
  SAMPLE_ACTIVE_MESSAGES,
} from "./constants";
import { useAttachments } from "./hooks/useAttachments";
import type {
  ChatMessage,
  ChatSessionItem,
  ChatState,
  ModelConfig,
  SendMessageOptions,
} from "./types";
import { createId, formatSessionTime, formatTime } from "./utils";

// Giữ nguyên các export cũ để những file khác import từ RightSidebar vẫn chạy
export { EFFORT_LEVELS } from "./constants";
export type {
  AIModelItem,
  AttachedFile,
  ChatMessage,
  ChatSessionItem,
  ChatState,
  EffortLevel,
  SendMessageOptions,
} from "./types";

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface RightSidebarProps {
  /**
   * Id của Conversation đang mở. Dùng để:
   *  - lấy / tạo các ChatSession (đoạn chat) thuộc Conversation này
   *  - lấy tài liệu (Document) cho mục "Không gian học tập"
   */
  conversationId?: string | null;
  /** @deprecated Không còn dùng – danh sách đoạn chat giờ lấy theo `conversationId`. */
  subjectId?: string | null;
  /** Tên context tài liệu hiện tại */
  contextTitle?: string;
  /** Whether the sidebar is collapsed */
  isCollapsed?: boolean;
  /** Callback to toggle collapse */
  onToggleCollapse?: () => void;
  /**
   * Callback khi gửi tin nhắn.
   * `options` (mới, tùy chọn) chứa mô hình, mức suy luận và tệp đính kèm đã chọn.
   */
  onSendMessage?: (
    message: string,
    chatSessionId?: string,
    options?: SendMessageOptions
  ) => void;
  /** Additional container classes */
  className?: string;
}

// TODO: thay bằng phản hồi thật từ API. Hiện giữ lại câu trả lời giả lập như bản gốc.
function buildPlaceholderReply(text: string, isNewChat: boolean): ChatMessage {
  return {
    id: createId("ai"),
    role: "ai",
    content: isNewChat
      ? `Tôi đã nhận được câu hỏi "${text}". Đang tra cứu thông tin từ tài liệu liên quan...`
      : `Dựa trên tài liệu bạn cung cấp, đây là giải đáp cho câu hỏi: "${text}"`,
    timestamp: formatTime(),
  };
}

// ─────────────────────────────────────────────
// Main Component: RightSidebar
// ─────────────────────────────────────────────

export default function RightSidebar({
  conversationId,
  contextTitle = "Trang 12 – Giáo trình CTDL",
  isCollapsed = false,
  onToggleCollapse,
  onSendMessage,
  className = "",
}: RightSidebarProps) {
  // ── Chat state (activeChatId = id của ChatSession đang mở) ──
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChatSessionItem | null>(null);

  // ── Model / reasoning ──
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    modelId: DEFAULT_MODEL_ID,
    effort: DEFAULT_EFFORT,
    thinking: true,
  });
  const updateModelConfig = useCallback(
    (patch: Partial<ModelConfig>) => setModelConfig((prev) => ({ ...prev, ...patch })),
    []
  );

  // ── Attachments ──
  const {
    files: attachedFiles,
    inputRef: fileInputRef,
    openLocalPicker,
    handleLocalInputChange,
    isWorkspaceModalOpen,
    openWorkspaceModal,
    closeWorkspaceModal,
    addWorkspaceDoc,
    removeFile,
    clearFiles,
  } = useAttachments();

  // ── Data hooks ──
  const { chatSessions, isLoading, createSession, updateSession, deleteSession } =
    useChatSessions(conversationId);
  // Document thuộc Conversation (không thuộc ChatSession)
  const { documents } = useDocuments(conversationId);

  const sessions: ChatSessionItem[] = useMemo(
    () =>
      chatSessions.map((s) => {
        const date = new Date(s.created_at);
        return {
          id: s.id,
          title: s.title,
          lastMessage: "Nhấn để tiếp tục cuộc trò chuyện",
          lastMessageRole: "ai" as const,
          timestamp: formatSessionTime(date),
          rawDate: date,
        };
      }),
    [chatSessions]
  );

  // ── Derived ──
  const chatState: ChatState = messages.length > 0 ? "active" : "empty";

  const headerTitle = useMemo(() => {
    if (chatState === "empty") return "Đoạn chat mới";
    const session = sessions.find((s) => s.id === activeChatId);
    if (session) return session.title;
    const firstUserMessage = messages.find((m) => m.role === "user" && m.content);
    return firstUserMessage?.content.slice(0, 50) ?? "Đoạn chat hiện tại";
  }, [chatState, sessions, activeChatId, messages]);

  const shortContext = contextTitle ? contextTitle.split(" – ")[0] : undefined;

  // ── Handlers ──
  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setMessages([]);
    setInputValue("");
    clearFiles();
  }, [clearFiles]);

  // Chuyển sang Conversation khác → bỏ đoạn chat / tin nhắn của Conversation cũ
  const [trackedConversationId, setTrackedConversationId] = useState(conversationId);
  if (trackedConversationId !== conversationId) {
    setTrackedConversationId(conversationId);
    handleNewChat();
    setPendingDelete(null);
  }

  const handleSelectChat = useCallback((id: string) => {
    setActiveChatId(id);
    // TODO: tải tin nhắn thật (bảng messages) của ChatSession `id`.
    // Hiện dùng dữ liệu mẫu như bản gốc.
    setMessages(SAMPLE_ACTIVE_MESSAGES);
  }, []);

  /** Ném lỗi nếu API thất bại → HistorySessionRow tự hiển thị thông báo */
  const handleRenameChat = useCallback(
    async (id: string, newTitle: string) => {
      await updateSession(id, newTitle);
    },
    [updateSession]
  );

  /** Ném lỗi nếu API thất bại → ConfirmDeleteDialog tự hiển thị thông báo */
  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;

    await deleteSession(id);

    // Đang mở chính đoạn chat vừa xóa → quay về đoạn chat mới
    if (id === activeChatId) handleNewChat();
    setPendingDelete(null);
  }, [pendingDelete, deleteSession, activeChatId, handleNewChat]);

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if ((!text && attachedFiles.length === 0) || isSending) return;

      const isNewChat = messages.length === 0;
      const userMsg: ChatMessage = {
        id: createId("msg"),
        role: "user",
        content: text,
        timestamp: formatTime(),
        attachedFiles: attachedFiles.map((f) => f.name),
      };

      setIsSending(true);
      try {
        let sessionId = activeChatId ?? undefined;

        // Đoạn chat mới → tạo ChatSession trên server (cần conversationId)
        if (isNewChat && conversationId && text) {
          try {
            const created = await createSession(text.slice(0, 50));
            if (created?.id) {
              sessionId = created.id;
              setActiveChatId(created.id);
            }
          } catch {
            // Tạo phiên thất bại: vẫn cho chat cục bộ như bản gốc
          }
        }

        const aiMsg = buildPlaceholderReply(text, isNewChat);
        setMessages((prev) =>
          isNewChat ? [userMsg, aiMsg] : [...prev, userMsg, aiMsg]
        );
        setInputValue("");
        clearFiles();

        onSendMessage?.(text, sessionId, {
          model: modelConfig.modelId,
          effort: modelConfig.effort,
          thinking: modelConfig.thinking,
          attachedFiles,
        });
      } finally {
        setIsSending(false);
      }
    },
    [
      attachedFiles,
      isSending,
      messages.length,
      activeChatId,
      conversationId,
      createSession,
      clearFiles,
      onSendMessage,
      modelConfig,
    ]
  );

  return (
    <aside
      aria-hidden={isCollapsed}
      className={`flex h-full flex-col border-l border-gray-100 bg-white select-none transition-all duration-300 ease-in-out ${
        isCollapsed
          ? "w-0 border-l-0 overflow-hidden opacity-0 pointer-events-none"
          : "w-80 md:w-96 opacity-100"
      } ${className}`.trim()}
    >
      {/* Input ẩn để chọn tệp từ thiết bị */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleLocalInputChange}
        className="hidden"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt"
      />

      <ChatHeader
        title={headerTitle}
        sessions={sessions}
        isLoading={isLoading}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onRenameChat={handleRenameChat}
        onRequestDeleteChat={setPendingDelete}
        onNewChat={handleNewChat}
        onClose={onToggleCollapse}
      />

      {chatState === "empty" ? (
        <EmptyState onPromptSelect={(prompt) => void sendMessage(prompt)} />
      ) : (
        <MessageList messages={messages} onFollowUp={setInputValue} />
      )}

      <ChatComposer
        value={inputValue}
        onChange={setInputValue}
        onSend={() => void sendMessage(inputValue)}
        disabled={isSending}
        placeholder={
          chatState === "empty"
            ? "Hỏi AI bất cứ điều gì về tài liệu…"
            : "Hỏi tiếp về đoạn chat này…"
        }
        attachedFiles={attachedFiles}
        onRemoveFile={removeFile}
        onSelectLocalFile={openLocalPicker}
        onSelectWorkspaceDoc={openWorkspaceModal}
        modelConfig={modelConfig}
        onModelConfigChange={updateModelConfig}
        contextLabel={shortContext}
        contextTitle={contextTitle}
      />

      <WorkspaceDocModal
        isOpen={isWorkspaceModalOpen}
        onClose={closeWorkspaceModal}
        onSelect={addWorkspaceDoc}
        availableDocs={documents}
      />

      <ConfirmDeleteDialog
        session={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </aside>
  );
}

export { RightSidebar };
