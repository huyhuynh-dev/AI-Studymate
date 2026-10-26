"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useDocuments } from "@/hooks/useDocuments";
import { chatSessionsApi } from "@/services/chatSessions.api";

import { ChatComposer } from "./components/ChatComposer";
import { ChatHeader } from "./components/ChatHeader";
import { ConfirmDeleteDialog } from "./components/ConfirmDeleteDialog";
import { EmptyState } from "./components/EmptyState";
import { MessageList } from "./components/MessageList";
import { WorkspaceDocModal } from "./components/WorkspaceDocModal";
import {
  DEFAULT_EFFORT,
  DEFAULT_MODEL_ID,
} from "./constants";
import { useAttachments } from "./hooks/useAttachments";
import type {
  ChatMessage,
  ChatSessionItem,
  ChatState,
  ModelConfig,
  SendMessageOptions,
} from "./types";
import { formatSessionTime } from "./utils";

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

// ─────────────────────────────────────────────
// Main Component: RightSidebar
// ─────────────────────────────────────────────

export default function RightSidebar({
  conversationId: propConversationId,
  contextTitle = "Trang 12 – Giáo trình CTDL",
  isCollapsed = false,
  onToggleCollapse,
  onSendMessage,
  className = "",
}: RightSidebarProps) {
  // Tự động trích xuất conversationId từ URL params (/home/[subjectId]/[conversationId]) nếu prop không truyền vào
  const params = useParams();
  const routeConversationId =
    typeof params?.conversationId === "string"
      ? params.conversationId
      : Array.isArray(params?.conversationId)
        ? params.conversationId[0]
        : null;

  const conversationId = propConversationId || routeConversationId;

  // ── Chat state (activeChatId = id của ChatSession đang mở) ──
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const activeChatIdRef = useRef<string | null>(null);
  activeChatIdRef.current = activeChatId;

  const [inputValue, setInputValue] = useState("");
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [, setIsLoadingMessages] = useState(false);
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
  const { documents } = useDocuments(conversationId);

  // ── Vercel AI SDK useChat ──
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      prepareSendMessagesRequest: ({ messages }) => {
        const id = activeChatIdRef.current;
        const targetApi = `/api/proxy/chat-agent/sessions/${id}/chat`;
        console.log("[RightSidebar] prepareSendMessagesRequest -> Target API:", targetApi, "Messages:", messages);
        return {
          api: targetApi,
          body: { messages },
        };
      },
    });
  }, []);

  const {
    messages,
    setMessages,
    sendMessage: aiSendMessage,
    status,
    error: chatError,
  } = useChat({
    transport,
    onError: (err) => {
      console.error("[RightSidebar] useChat onError:", err);
    },
    onFinish: ({ message }) => {
      console.log("[RightSidebar] useChat onFinish -> Tin nhắn AI nhận về thành công:", message);
    },
  });

  if (chatError) {
    console.warn("[RightSidebar] Trạng thái chatError:", chatError);
  }

  const isSending =
    status === "submitted" || status === "streaming" || isCreatingSession;

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
    const firstUserMsg = messages.find((m) => m.role === "user");
    if (firstUserMsg) {
      if (firstUserMsg.parts && firstUserMsg.parts.length > 0) {
        const textPart = firstUserMsg.parts.find((p) => p.type === "text");
        if (textPart && "text" in textPart) {
          return (textPart as { text: string }).text.slice(0, 50);
        }
      }
      if ((firstUserMsg as unknown as { content?: string }).content) {
        return (firstUserMsg as unknown as { content: string }).content.slice(0, 50);
      }
    }
    return "Đoạn chat hiện tại";
  }, [chatState, sessions, activeChatId, messages]);

  const shortContext = contextTitle ? contextTitle.split(" – ")[0] : undefined;

  // ── Handlers ──
  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    activeChatIdRef.current = null;
    setMessages([]);
    setInputValue("");
    clearFiles();
  }, [setMessages, clearFiles]);

  // Chuyển sang Conversation khác → bỏ đoạn chat / tin nhắn của Conversation cũ
  const [trackedConversationId, setTrackedConversationId] = useState(conversationId);
  if (trackedConversationId !== conversationId) {
    setTrackedConversationId(conversationId);
    handleNewChat();
    setPendingDelete(null);
  }

  const handleSelectChat = useCallback(
    async (id: string) => {
      setActiveChatId(id);
      activeChatIdRef.current = id;
      try {
        setIsLoadingMessages(true);
        const history = await chatSessionsApi.getMessages(id);
        setMessages(history);
      } catch (err) {
        console.error("Lỗi khi tải lịch sử tin nhắn:", err);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [setMessages]
  );

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

      let sessionId = activeChatIdRef.current;
      const isNewChat = !sessionId;

      try {
        if (isNewChat && conversationId) {
          setIsCreatingSession(true);
          try {
            const created = await createSession(text.slice(0, 50));
            if (created?.id) {
              sessionId = created.id;
              activeChatIdRef.current = created.id;
              setActiveChatId(created.id);
            }
          } catch (createError) {
            console.error("Lỗi khi tạo ChatSession trên server:", createError);
          }
        }

        if (!sessionId) {
          console.warn(
            "Không thể gửi tin nhắn do chưa có ChatSession. conversationId:",
            conversationId
          );
          return;
        }

        setInputValue("");
        clearFiles();

        console.log("[RightSidebar] Chuẩn bị gửi tin nhắn AI:", {
          text,
          sessionId,
          conversationId,
        });

        onSendMessage?.(text, sessionId, {
          model: modelConfig.modelId,
          effort: modelConfig.effort,
          thinking: modelConfig.thinking,
          attachedFiles,
        });

        console.log("[RightSidebar] Kích hoạt aiSendMessage({ text })...");
        await aiSendMessage({ text });
        console.log("[RightSidebar] aiSendMessage đã gọi xong.");
      } catch (error) {
        console.error("Lỗi khi gửi tin nhắn:", error);
      } finally {
        setIsCreatingSession(false);
      }
    },
    [
      attachedFiles,
      isSending,
      conversationId,
      createSession,
      clearFiles,
      onSendMessage,
      modelConfig,
      aiSendMessage,
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
        <MessageList
          messages={messages as unknown as ChatMessage[]}
          onFollowUp={setInputValue}
          isLoading={isSending}
        />
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
