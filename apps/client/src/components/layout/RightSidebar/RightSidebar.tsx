"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  contextTitle,
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

  // Lưu danh sách documentIds được đính kèm cho lượt gửi tin nhắn hiện tại
  const pendingAttachedDocIdsRef = useRef<string[]>([]);
  // Lưu câu hỏi gần nhất của người dùng để làm ngữ cảnh phụ trợ khi sinh câu hỏi gợi ý
  const lastUserQuestionRef = useRef<string>("");

  const [inputValue, setInputValue] = useState("");
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [, setIsLoadingMessages] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChatSessionItem | null>(null);

  // ── Resizable & Fullscreen states ──
  const [sidebarWidth, setSidebarWidth] = useState<number>(384);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Xử lý bắt đầu kéo chuột dãn chiều rộng
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const maxWidth = Math.floor(window.innerWidth * 0.6);
      const minWidth = 320;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, window.innerWidth - e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging]);

  // Hỗ trợ phím ESC để thoát nhanh toàn màn hình
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Đảm bảo chiều rộng không vượt quá 60% khi resize cửa sổ
  useEffect(() => {
    const handleResize = () => {
      const maxWidth = Math.floor(window.innerWidth * 0.6);
      setSidebarWidth((prev) => Math.min(prev, Math.max(320, maxWidth)));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Follow-up Suggestions state ──
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

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
  const {
    chatSessions,
    isLoading,
    createSession,
    updateSession,
    deleteSession,
    refresh: refreshSessions,
  } = useChatSessions(conversationId);
  const { documents } = useDocuments(conversationId);

  // ── Vercel AI SDK useChat ──
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      prepareSendMessagesRequest: ({ messages }) => {
        const id = activeChatIdRef.current;
        const attachedDocumentIds = pendingAttachedDocIdsRef.current;
        pendingAttachedDocIdsRef.current = [];
        const targetApi = `/api/proxy/chat-agent/sessions/${id}/chat`;
        console.log(
          "[RightSidebar] prepareSendMessagesRequest -> Target API:",
          targetApi,
          "Messages:",
          messages,
          "AttachedDocumentIds:",
          attachedDocumentIds
        );
        return {
          api: targetApi,
          body: {
            messages,
            ...(attachedDocumentIds.length > 0 ? { attachedDocumentIds } : {}),
          },
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
      setIsLoadingSuggestions(false);
    },
    onFinish: async ({ message }) => {
      console.log("[RightSidebar] useChat onFinish -> Tin nhắn AI nhận về thành công:", message);
      refreshSessions();

      // Tự động sinh 2-3 câu hỏi gợi ý tiếp nối sau khi AI trả lời xong
      const currentSessionId = activeChatIdRef.current;
      if (message.role === "assistant" && currentSessionId) {
        const assistantText = Array.isArray(message.parts)
          ? message.parts
              .filter((p: any) => p.type === "text" && typeof p.text === "string")
              .map((p: any) => p.text)
              .join("\n\n")
              .trim()
          : "";

        if (assistantText) {
          setIsLoadingSuggestions(true);
          try {
            const generated = await chatSessionsApi.generateSuggestions(
              currentSessionId,
              {
                lastAssistantResponse: assistantText,
                lastUserQuestion: lastUserQuestionRef.current || undefined,
              }
            );
            // Đảm bảo người dùng vẫn đang mở đúng phiên chat này trước khi hiển thị gợi ý
            if (activeChatIdRef.current === currentSessionId) {
              setSuggestions(generated);
            }
          } catch (suggestionErr) {
            console.warn(
              "[RightSidebar] Lỗi khi tạo câu hỏi gợi ý:",
              suggestionErr
            );
          } finally {
            if (activeChatIdRef.current === currentSessionId) {
              setIsLoadingSuggestions(false);
            }
          }
        }
      }
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
    pendingAttachedDocIdsRef.current = [];
    lastUserQuestionRef.current = "";
    setSuggestions([]);
    setIsLoadingSuggestions(false);
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
      setSuggestions([]);
      setIsLoadingSuggestions(false);
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

      // Xóa ngay các câu hỏi gợi ý cũ khi người dùng gửi câu hỏi mới hoặc bấm chọn gợi ý
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      lastUserQuestionRef.current = text;

      let sessionId = activeChatIdRef.current;
      const isNewChat = !sessionId;

      try {
        if (isNewChat && conversationId) {
          setIsCreatingSession(true);
          try {
            const created = await createSession("Đoạn chat mới");
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

        // Trích xuất danh sách documentId từ các tài liệu Workspace đính kèm trước khi clearFiles
        const workspaceDocIds = attachedFiles
          .filter((f) => f.source === "workspace" && f.documentId)
          .map((f) => f.documentId as string);
        pendingAttachedDocIdsRef.current = workspaceDocIds;

        setInputValue("");
        clearFiles();

        console.log("[RightSidebar] Chuẩn bị gửi tin nhắn AI:", {
          text,
          sessionId,
          conversationId,
          workspaceDocIds,
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

        // Nếu là phiên mới, sau 1.2s kích hoạt tải lại tiêu đề mới do Ollama cập nhật ngầm
        if (isNewChat) {
          setTimeout(() => {
            refreshSessions();
          }, 1200);
        }
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
      refreshSessions,
    ]
  );

  // Chỉ xuất hiện ở cấp độ Conversation (khi có conversationId hợp lệ)
  if (!conversationId) {
    return null;
  }

  const sidebarContent = (
    <aside
      aria-hidden={isCollapsed}
      style={{
        width: isFullscreen
          ? "100vw"
          : isCollapsed
            ? 0
            : `${sidebarWidth}px`,
      }}
      className={`${
        isFullscreen
          ? "fixed inset-0 z-50 flex h-screen w-screen flex-col border-none bg-white select-none animate-in fade-in-50 duration-150 overflow-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          : `relative flex h-full flex-col border-l border-gray-100 bg-white select-none ${
              isDragging ? "transition-none" : "transition-all duration-300 ease-in-out"
            } ${
              isCollapsed
                ? "w-0 border-l-0 overflow-hidden opacity-0 pointer-events-none"
                : "opacity-100"
            }`
      } ${className}`.trim()}
    >
      {/* Thanh kéo dãn chiều rộng bên trái (ẩn khi đang fullscreen hoặc collapsed) */}
      {!isCollapsed && !isFullscreen && (
        <div
          onMouseDown={handleMouseDown}
          title="Kéo sang trái/phải để thay đổi kích thước (Tối đa 60%)"
          className="group absolute -left-1.5 top-0 bottom-0 z-40 w-3 cursor-col-resize select-none touch-none flex items-center justify-center hover:bg-transparent"
        >
          <div
            className={`h-full w-1 transition-colors duration-150 ${
              isDragging
                ? "bg-indigo-600 shadow-xs"
                : "bg-transparent group-hover:bg-indigo-400/80"
            }`}
          />
        </div>
      )}
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
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
        onClose={() => {
          if (isFullscreen) {
            setIsFullscreen(false);
          }
          onToggleCollapse?.();
        }}
      />

      <div
        className={`flex flex-1 flex-col min-h-0 overflow-hidden ${
          isFullscreen ? "max-w-4xl mx-auto w-full px-4" : "w-full"
        } [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
      >
        {chatState === "empty" ? (
          <EmptyState onPromptSelect={(prompt) => void sendMessage(prompt)} />
        ) : (
          <MessageList
            messages={messages as unknown as ChatMessage[]}
            isLoading={isSending}
            suggestions={suggestions}
            isLoadingSuggestions={isLoadingSuggestions}
            onSelectSuggestion={(selectedSuggestion) =>
              void sendMessage(selectedSuggestion)
            }
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
      </div>

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

  if (isFullscreen && mounted && typeof document !== "undefined") {
    return (
      <>
        {/* Placeholder trong layout flow để không gián đoạn giao diện nền */}
        <div
          style={{ width: `${sidebarWidth}px` }}
          className="shrink-0 h-full border-l border-gray-100 bg-white"
        />
        {createPortal(sidebarContent, document.body)}
      </>
    );
  }

  return sidebarContent;
}

export { RightSidebar };
