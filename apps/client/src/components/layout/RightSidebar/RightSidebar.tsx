"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { useCitationNavigation } from "@/contexts/CitationNavigationContext";
import { useAskAi } from "@/contexts/AskAiContext";
import { useThemePreference } from "@/contexts/ThemePreferenceProvider";
import { useWordAgent } from "@/contexts/WordAgentContext";
import { useWorkspaceContextStore } from "@/contexts/WorkspaceContextProvider";
import { useWorkspaceRestore } from "@/contexts/WorkspaceRestoreContext";
import { useFocusMode } from "@/components/layout/FocusModeContext";
import { isValidUuid } from "@/lib/workspace-state-rules";
import { workspaceStateCoordinator } from "@/lib/workspace-state.singleton";
import { useAgentJobs } from "@/hooks/useAgentJobs";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useDocuments } from "@/hooks/useDocuments";
import type { AgentStatusEvent } from "./types";
import { formatSelectionAskPrompt } from "@/lib/ask-ai-prompt.helper";
import {
  handleChatStreamDataPart,
  parseWorkspaceActionDataPart,
  publishWorkspaceSync,
} from "@/lib/workspace-sync";
import { chatSessionsApi } from "@/services/chatSessions.api";
import { documentsApi } from "@/services/documents.api";

import { BackgroundJobsTray } from "./components/BackgroundJobsTray";
import { ChatComposer } from "./components/ChatComposer";
import { ChatHeader } from "./components/ChatHeader";
import { EmptyState } from "./components/EmptyState";
import { MessageList } from "./components/MessageList";
import { WordAgentContextBar } from "./components/WordAgentContextBar";
import { WorkspaceContextPill } from "./components/WorkspaceContextPill";
import { ChevronLeft, FileText, Loader2 } from "lucide-react";
import {
  EDITABLE_TEXT_EXTENSIONS_ACCEPT,
  isEditableTextDocument,
} from "@/components/conversations/DocumentsTab/editor/document-format-profiles";
import type { EditorCitationTarget } from "@/components/conversations/DocumentsTab/editor/text-anchor-resolver";

const SidePanelPdfViewer = dynamic(
  () => import("@/components/conversations/DocumentsTab/DocumentPdfViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 bg-neutral-50/80 dark:bg-[#0F1218] text-neutral-500 dark:text-neutral-400">
        <Loader2 className="h-6 w-6 animate-spin text-[#4F46E5] dark:text-[#818CF8]" />
        <span className="text-xs font-medium">Đang mở trình xem PDF…</span>
      </div>
    ),
  }
);

const SidePanelImageViewer = dynamic(
  () => import("@/components/conversations/DocumentsTab/DocumentImageViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 bg-neutral-50/80 dark:bg-[#0F1218] text-neutral-500 dark:text-neutral-400">
        <Loader2 className="h-6 w-6 animate-spin text-[#4F46E5] dark:text-[#818CF8]" />
        <span className="text-xs font-medium">Đang tải hình ảnh nguồn…</span>
      </div>
    ),
  }
);

const SidePanelTextEditor = dynamic(
  () => import("@/components/conversations/DocumentsTab/editor/DocumentTextEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 bg-neutral-50/80 dark:bg-[#0F1218] text-neutral-500 dark:text-neutral-400">
        <Loader2 className="h-6 w-6 animate-spin text-[#4F46E5] dark:text-[#818CF8]" />
        <span className="text-xs font-medium">Đang mở trình đọc & soạn thảo…</span>
      </div>
    ),
  }
);

const SidePanelWordEditor = dynamic(
  () => import("@/components/conversations/DocumentsTab/word/DocumentWordEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 bg-neutral-50/80 dark:bg-[#0F1218] text-neutral-500 dark:text-neutral-400">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
        <span className="text-xs font-medium">Đang mở tài liệu Word…</span>
      </div>
    ),
  }
);

const SidePanelLegacyDocPreview = dynamic(
  () => import("@/components/conversations/DocumentsTab/word/DocumentLegacyDocPreview"),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 bg-neutral-50/80 dark:bg-[#0F1218] text-neutral-500 dark:text-neutral-400">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
        <span className="text-xs font-medium">Đang tải bản xem trước tài liệu…</span>
      </div>
    ),
  }
);

import {
  isDocxDocument,
  isLegacyWordOrOdtDocument,
} from "@/components/conversations/DocumentsTab/word/word-document.helpers";
import {
  ATTACHMENT_PROCESSING_TIMEOUT_MS,
  DEFAULT_EFFORT,
  DEFAULT_MODEL_ID,
} from "./constants";
import { useAttachments } from "./hooks/useAttachments";
import type {
  AttachedFile,
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
  subjectId: propSubjectId,
  contextTitle,
  isCollapsed = false,
  onToggleCollapse,
  onSendMessage,
  className = "",
}: RightSidebarProps) {
  // Tự động trích xuất conversationId từ URL params (/home/[subjectId]/[conversationId]) nếu prop không truyền vào
  const params = useParams();
  const router = useRouter();
  const routeSubjectId =
    typeof params?.subjectId === "string"
      ? params.subjectId
      : Array.isArray(params?.subjectId)
        ? params.subjectId[0]
        : null;
  const routeConversationId =
    typeof params?.conversationId === "string"
      ? params.conversationId
      : Array.isArray(params?.conversationId)
        ? params.conversationId[0]
        : null;

  const conversationId = propConversationId || routeConversationId;
  const effectiveSubjectId = propSubjectId || routeSubjectId;
  const {
    status: restoreStatus,
    peekConversationIntent,
    clearChatSessionIntent,
  } = useWorkspaceRestore();
  const { setTheme } = useThemePreference();
  const {
    jobs,
    activeJobsCount,
    latestNotification,
    dismissNotification,
    refreshJobs,
    retryJob,
    cancelJob,
  } = useAgentJobs(conversationId);
  const refreshJobsRef = useRef(refreshJobs);
  refreshJobsRef.current = refreshJobs;

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

  /** Quản lý lượt gửi tin đang chờ tài liệu tải lên hoặc xử lý hoàn tất */
  const [pendingSubmission, setPendingSubmission] = useState<{
    text: string;
    attachedFiles: AttachedFile[];
    sessionId: string;
    isNewChat: boolean;
    timestamp: number;
  } | null>(null);

  // ── Resizable, Fullscreen & Side-panel Source Reader states ──
  const { sidePanelTarget, closeSidePanelCitation } = useCitationNavigation();
  const { pendingAskRequest, consumeAskRequest, setIsAiResponding } = useAskAi();
  const {
    activeWordDocument,
    activeConversationId,
    selection: wordSelection,
    changeMode: wordChangeMode,
    setChangeMode: setWordChangeMode,
    clearSelection: clearWordSelection,
    pendingComposerPrompt,
    consumePendingComposerPrompt,
    exportActiveSnapshotForAgent,
    streamTextToActiveEditor,
    pushPerformActionToActiveEditor,
    syncAgentSnapshotFromServer,
  } = useWordAgent();
  const { setIsRightSidebarCollapsed } = useFocusMode();
  const workspaceStore = useWorkspaceContextStore();
  const workspaceStoreRef = useRef(workspaceStore);
  workspaceStoreRef.current = workspaceStore;

  const isWordContextForConversation = Boolean(
    activeWordDocument &&
      conversationId &&
      activeConversationId === conversationId
  );

  // Đồng bộ trạng thái Word Agent (changeMode & selectedText) vào WorkspaceContextStore
  useEffect(() => {
    if (!workspaceStore || !isWordContextForConversation || !activeWordDocument) {
      return;
    }
    workspaceStore.patchDocumentsViewingDoc({
      documentId: activeWordDocument.id,
      fileName: activeWordDocument.file_name,
      viewerKind: "word",
      wordChangeMode,
      selectedText: wordSelection?.text ?? "",
    });
  }, [
    workspaceStore,
    isWordContextForConversation,
    activeWordDocument,
    wordChangeMode,
    wordSelection?.text,
  ]);

  const activeWordContextRef = useRef<{
    documentId: string;
    changeMode: "tracked" | "direct";
    selectedText?: string;
  } | null>(null);
  activeWordContextRef.current =
    isWordContextForConversation && activeWordDocument
      ? {
          documentId: activeWordDocument.id,
          changeMode: wordChangeMode,
          ...(wordSelection?.text ? { selectedText: wordSelection.text } : {}),
        }
      : null;

  const exportWordSnapshotRef = useRef(exportActiveSnapshotForAgent);
  exportWordSnapshotRef.current = exportActiveSnapshotForAgent;
  const streamTextToActiveEditorRef = useRef(streamTextToActiveEditor);
  streamTextToActiveEditorRef.current = streamTextToActiveEditor;
  const pushPerformActionToActiveEditorRef = useRef(pushPerformActionToActiveEditor);
  pushPerformActionToActiveEditorRef.current = pushPerformActionToActiveEditor;
  const syncWordSnapshotRef = useRef(syncAgentSnapshotFromServer);
  syncWordSnapshotRef.current = syncAgentSnapshotFromServer;
  const completedStreamToolCallIdsRef = useRef<Set<string>>(new Set());
  const lastStreamedInputSignatureRef = useRef<Map<string, string>>(new Map());
  const dispatchedPerformActionIdsRef = useRef<Set<string>>(new Set());
  const browserHandledPerformActionIdsRef = useRef<Set<string>>(new Set());
  const pendingWordSyncRef = useRef<{
    documentId: string;
    changeMode?: "tracked" | "direct";
    count: number;
    requiresSnapshotReload: boolean;
  } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(384);
  const sidebarWidthRef = useRef<number>(384);
  sidebarWidthRef.current = sidebarWidth;
  const prePdfWidthRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const [dismissedSidePanelCitationNonce, setDismissedSidePanelCitationNonce] =
    useState<number | null>(null);

  const isSidePanelOpen = Boolean(sidePanelTarget);

  const sidePanelCitationTarget = useMemo<EditorCitationTarget | null>(() => {
    if (!sidePanelTarget || sidePanelTarget.nonce === dismissedSidePanelCitationNonce) {
      return null;
    }
    return {
      documentId: sidePanelTarget.documentId,
      fileName: sidePanelTarget.fileName,
      citationId: sidePanelTarget.citationId,
      chunkId: sidePanelTarget.chunkId,
      chunkIndex: sidePanelTarget.chunkIndex,
      pageNo: sidePanelTarget.pageNo,
      rawContent: sidePanelTarget.rawContent,
      headings: sidePanelTarget.headings,
      textAnchor: sidePanelTarget.textAnchor,
      nonce: sidePanelTarget.nonce,
    };
  }, [sidePanelTarget, dismissedSidePanelCitationNonce]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Tự động nới rộng cột phải (~480–540px) khi mở xem nguồn PDF và trả về độ rộng cũ khi đóng
  useEffect(() => {
    if (sidePanelTarget) {
      if (prePdfWidthRef.current === null) {
        prePdfWidthRef.current = sidebarWidthRef.current;
      }
      const targetWidth =
        typeof window !== "undefined"
          ? Math.min(Math.max(480, Math.floor(window.innerWidth * 0.44)), 540)
          : 500;
      if (sidebarWidthRef.current < targetWidth) {
        setSidebarWidth(targetWidth);
      }
    } else if (prePdfWidthRef.current !== null) {
      setSidebarWidth(prePdfWidthRef.current);
      prePdfWidthRef.current = null;
    }
  }, [sidePanelTarget]);

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

  // Hỗ trợ phím ESC để thoát nhanh toàn màn hình hoặc đóng trình xem nguồn bên phải
  useEffect(() => {
    if (!isFullscreen && !isSidePanelOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (isFullscreen) {
        setIsFullscreen(false);
        return;
      }
      if (isSidePanelOpen) {
        closeSidePanelCitation();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, isSidePanelOpen, closeSidePanelCitation]);

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
  const [liveAgentStatus, setLiveAgentStatus] =
    useState<AgentStatusEvent | null>(null);

  // ── Model / reasoning ──
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    modelId: DEFAULT_MODEL_ID,
    effort: DEFAULT_EFFORT,
    thinking: false,
  });
  const modelConfigRef = useRef<ModelConfig>(modelConfig);
  modelConfigRef.current = modelConfig;

  const updateModelConfig = useCallback(
    (patch: Partial<ModelConfig>) => setModelConfig((prev) => ({ ...prev, ...patch })),
    []
  );

  // ── Data hooks ──
  const {
    chatSessions,
    isLoading,
    createSession,
    updateSession,
    deleteSession,
    refresh: refreshSessions,
  } = useChatSessions(conversationId);
  const { documents, uploadFile, downloadDocument, updateDocumentInCache } = useDocuments(conversationId);

  const sidePanelDocument = useMemo(() => {
    if (!sidePanelTarget?.documentId) return null;
    return documents.find((d) => d.id === sidePanelTarget.documentId) ?? null;
  }, [documents, sidePanelTarget?.documentId]);

  // ── Attachments ──
  const {
    files: attachedFiles,
    inputRef: fileInputRef,
    openLocalPicker,
    handleLocalInputChange,
    uploadLocalFiles,
    addWorkspaceDoc,
    addWorkspaceDocs,
    removeFile,
    clearFiles,
    restoreFiles,
  } = useAttachments({ uploadFile, documents });

  // ── Vercel AI SDK useChat ──
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      prepareSendMessagesRequest: ({ messages }) => {
        const id = activeChatIdRef.current;
        const attachedDocumentIds = pendingAttachedDocIdsRef.current;
        pendingAttachedDocIdsRef.current = [];
        const currentConfig = modelConfigRef.current;
        const currentWordContext = activeWordContextRef.current;
        const uiContext = workspaceStoreRef.current?.getSnapshot() ?? null;
        const targetApi = `/api/proxy/chat-agent/sessions/${id}/chat`;
        console.log(
          "[RightSidebar] prepareSendMessagesRequest -> Target API:",
          targetApi,
          "Messages:",
          messages,
          "AttachedDocumentIds:",
          attachedDocumentIds,
          "ModelConfig:",
          currentConfig,
          "WordContext:",
          currentWordContext,
          "UiContext:",
          uiContext
        );
        return {
          api: targetApi,
          body: {
            messages,
            ...(attachedDocumentIds.length > 0 ? { attachedDocumentIds } : {}),
            ...(currentWordContext ? { activeWordContext: currentWordContext } : {}),
            ...(uiContext ? { uiContext } : {}),
            modelId: currentConfig.modelId,
            effort: currentConfig.effort,
          },
        };
      },
    });
  }, []);

  const {
    messages,
    setMessages,
    sendMessage: aiSendMessage,
    addToolOutput,
    addToolApprovalResponse,
    status,
    error: chatError,
  } = useChat({
    transport,
    sendAutomaticallyWhen: ({ messages: currentMessages }) =>
      lastAssistantMessageIsCompleteWithToolCalls({ messages: currentMessages }) ||
      lastAssistantMessageIsCompleteWithApprovalResponses({
        messages: currentMessages,
      }),
    onData: (dataPart) => {
      handleChatStreamDataPart(dataPart);
      const workspaceAction = parseWorkspaceActionDataPart(dataPart);
      if (workspaceAction) {
        if (workspaceAction.type === "theme_changed") {
          setTheme(workspaceAction.theme, { persistLocal: true });
        } else if (workspaceAction.type === "job_enqueued") {
          void refreshJobsRef.current();
        } else if (workspaceAction.type === "navigate") {
          const target = workspaceAction.target;
          if (target.page === "profile") {
            router.push("/profile");
          } else if (target.page === "home") {
            router.push("/home");
          } else if (target.page === "subject" && target.subjectId) {
            router.push(`/home/${target.subjectId}`);
          } else if (
            target.conversationId &&
            target.conversationId !== conversationId
          ) {
            const sub = target.subjectId || routeSubjectId;
            if (sub) {
              router.push(`/home/${sub}/${target.conversationId}`);
            }
          } else if (typeof window !== "undefined") {
            if (target.resourceType === "summary" && target.resourceId) {
              window.dispatchEvent(
                new CustomEvent("studymate:open-summary", {
                  detail: { summaryId: target.resourceId },
                }),
              );
            } else if (target.resourceType === "deck" && target.resourceId) {
              window.dispatchEvent(
                new CustomEvent("studymate:open-flashcard-deck", {
                  detail: { deckId: target.resourceId },
                }),
              );
            } else if (target.resourceType === "quiz" && target.resourceId) {
              window.dispatchEvent(
                new CustomEvent("studymate:open-quiz", {
                  detail: { quizId: target.resourceId },
                }),
              );
            } else if (
              target.resourceType === "document" &&
              target.resourceId
            ) {
              window.dispatchEvent(
                new CustomEvent("studymate:open-document", {
                  detail: { documentId: target.resourceId },
                }),
              );
            } else if (target.tab) {
              window.dispatchEvent(
                new CustomEvent("studymate:switch-tab", {
                  detail: { tab: target.tab },
                }),
              );
            }
          }
        }
      }
      if (
        dataPart &&
        typeof dataPart === "object" &&
        "type" in dataPart &&
        dataPart.type === "data-agent-status" &&
        "data" in dataPart &&
        dataPart.data &&
        typeof dataPart.data === "object"
      ) {
        const statusPayload = dataPart.data as {
          phase?: unknown;
          label?: unknown;
          toolName?: unknown;
          stepIndex?: unknown;
        };
        if (
          (statusPayload.phase === "compacted" ||
            statusPayload.phase === "tool_running" ||
            statusPayload.phase === "synthesizing") &&
          typeof statusPayload.label === "string" &&
          statusPayload.label.trim()
        ) {
          setLiveAgentStatus({
            phase: statusPayload.phase,
            label: statusPayload.label,
            ...(typeof statusPayload.toolName === "string"
              ? { toolName: statusPayload.toolName }
              : {}),
            ...(typeof statusPayload.stepIndex === "number"
              ? { stepIndex: statusPayload.stepIndex }
              : {}),
          });
        }
      }
      if (
        dataPart &&
        typeof dataPart === "object" &&
        "type" in dataPart &&
        dataPart.type === "data-workspace-sync" &&
        "data" in dataPart &&
        dataPart.data &&
        typeof dataPart.data === "object"
      ) {
        const payload = dataPart.data as {
          resource?: string;
          entityId?: string;
          changeMode?: "tracked" | "direct";
          count?: number;
          requiresSnapshotReload?: boolean;
        };
        if (
          payload.resource === "word-document" &&
          typeof payload.entityId === "string"
        ) {
          const prev = pendingWordSyncRef.current;
          const isSameDoc = prev?.documentId === payload.entityId;
          const nextRequiresReload =
            payload.requiresSnapshotReload === true
              ? true
              : payload.requiresSnapshotReload === false
                ? (isSameDoc ? prev.requiresSnapshotReload : false)
                : true;
          pendingWordSyncRef.current = {
            documentId: payload.entityId,
            changeMode: payload.changeMode ?? (isSameDoc ? prev.changeMode : undefined),
            count: (isSameDoc ? prev.count : 0) + (payload.count ?? 1),
            requiresSnapshotReload: nextRequiresReload,
          };
        }
      }
    },
    onError: (err) => {
      console.error("[RightSidebar] useChat onError:", err);
      setIsLoadingSuggestions(false);
      setLiveAgentStatus(null);
    },
    onFinish: async ({ message }) => {
      console.log("[RightSidebar] useChat onFinish -> Tin nhắn AI nhận về thành công:", message);
      setLiveAgentStatus(null);
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
    status === "submitted" ||
    status === "streaming" ||
    isCreatingSession ||
    Boolean(pendingSubmission);

  useEffect(() => {
    if (!isSending) {
      setLiveAgentStatus(null);
    }
  }, [isSending]);

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
  const handleOpenSummary = useCallback(
    (summaryId: string) => {
      if (!summaryId) return;
      if (isFullscreen) {
        setIsFullscreen(false);
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("studymate:open-summary-id", summaryId);
        window.dispatchEvent(
          new CustomEvent("studymate:open-summary", { detail: { summaryId } })
        );
      }
    },
    [isFullscreen]
  );

  const handleOpenFlashcardDeck = useCallback(
    (deckId: string) => {
      if (!deckId) return;
      if (isFullscreen) {
        setIsFullscreen(false);
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("studymate:open-deck-id", deckId);
        window.dispatchEvent(
          new CustomEvent("studymate:open-flashcard-deck", {
            detail: { deckId },
          })
        );
      }
    },
    [isFullscreen]
  );

  const handleOpenQuiz = useCallback(
    (quizId: string) => {
      if (!quizId) return;
      if (isFullscreen) {
        setIsFullscreen(false);
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("studymate:open-quiz-id", quizId);
        window.dispatchEvent(
          new CustomEvent("studymate:open-quiz", {
            detail: { quizId },
          })
        );
      }
    },
    [isFullscreen]
  );

  const resetChatUiState = useCallback(() => {
    setActiveChatId(null);
    activeChatIdRef.current = null;
    pendingAttachedDocIdsRef.current = [];
    lastUserQuestionRef.current = "";
    setPendingSubmission(null);
    setSuggestions([]);
    setIsLoadingSuggestions(false);
    setLiveAgentStatus(null);
    completedStreamToolCallIdsRef.current.clear();
    setMessages([]);
    setInputValue("");
    clearFiles();
    if (typeof window !== "undefined" && conversationId) {
      window.sessionStorage.removeItem(
        `studymate:active-session:${conversationId}`
      );
    }
  }, [setMessages, clearFiles, conversationId]);

  const handleNewChat = useCallback(() => {
    resetChatUiState();
    if (isValidUuid(effectiveSubjectId) && isValidUuid(conversationId)) {
      workspaceStateCoordinator.reportChatSession(
        effectiveSubjectId,
        conversationId,
        null
      );
    }
  }, [resetChatUiState, effectiveSubjectId, conversationId]);

  // Chuyển sang Conversation khác → chỉ reset UI cục bộ, không ghi đè chatSessionId thành null lên server
  const [trackedConversationId, setTrackedConversationId] = useState(conversationId);
  if (trackedConversationId !== conversationId) {
    setTrackedConversationId(conversationId);
    resetChatUiState();
  }

  const handleSelectChat = useCallback(
    async (id: string) => {
      setActiveChatId(id);
      activeChatIdRef.current = id;
      setPendingSubmission(null);
      if (typeof window !== "undefined" && conversationId) {
        window.sessionStorage.setItem(
          `studymate:active-session:${conversationId}`,
          id
        );
      }
      if (isValidUuid(effectiveSubjectId) && isValidUuid(conversationId)) {
        workspaceStateCoordinator.reportChatSession(
          effectiveSubjectId,
          conversationId,
          id
        );
      }
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      setLiveAgentStatus(null);
      try {
        setIsLoadingMessages(true);
        const history = await chatSessionsApi.getMessages(id);
        const normalized = (history || []).map((m: any) => ({
          ...m,
          attachedFiles: m.attachedFiles || m.metadata?.attachedFiles,
        }));
        const historyToolIds = new Set<string>();
        for (const msg of normalized) {
          if (!Array.isArray(msg?.parts)) continue;
          for (const rawPart of msg.parts) {
            if (
              rawPart &&
              typeof rawPart.toolCallId === "string" &&
              (rawPart.type === "tool-superdoc_stream_text" ||
                (rawPart.type === "dynamic-tool" &&
                  rawPart.toolName === "superdoc_stream_text"))
            ) {
              historyToolIds.add(rawPart.toolCallId);
            }
          }
        }
        completedStreamToolCallIdsRef.current = historyToolIds;
        setMessages(normalized);
      } catch (err) {
        console.error("Lỗi khi tải lịch sử tin nhắn:", err);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [setMessages, conversationId, effectiveSubjectId]
  );

  // Tự động phục hồi phiên chat đang mở: ưu tiên sessionStorage của tab, fallback từ server xuyên thiết bị
  useEffect(() => {
    if (
      !conversationId ||
      activeChatId ||
      isLoading ||
      chatSessions.length === 0
    ) {
      return;
    }

    if (typeof window !== "undefined") {
      const savedSessionId = window.sessionStorage.getItem(
        `studymate:active-session:${conversationId}`
      );
      if (savedSessionId && chatSessions.some((s) => s.id === savedSessionId)) {
        void handleSelectChat(savedSessionId);
        return;
      }
    }

    if (restoreStatus !== "bootstrapping") {
      const serverSessionId =
        peekConversationIntent(conversationId)?.chatSessionId ?? null;
      if (serverSessionId && chatSessions.some((s) => s.id === serverSessionId)) {
        void handleSelectChat(serverSessionId);
      }
      clearChatSessionIntent(conversationId);
    }
  }, [
    conversationId,
    activeChatId,
    isLoading,
    chatSessions,
    handleSelectChat,
    restoreStatus,
    peekConversationIntent,
    clearChatSessionIntent,
  ]);

  /** Ném lỗi nếu API thất bại → HistorySessionRow tự hiển thị thông báo */
  const handleRenameChat = useCallback(
    async (id: string, newTitle: string) => {
      await updateSession(id, newTitle);
    },
    [updateSession]
  );

  /** Ném lỗi nếu API thất bại → HistorySessionRow tự hiển thị thông báo */
  const handleDeleteChat = useCallback(
    async (id: string) => {
      await deleteSession(id);

      // Đang mở chính đoạn chat vừa xóa → quay về đoạn chat mới
      if (id === activeChatId) handleNewChat();
    },
    [deleteSession, activeChatId, handleNewChat]
  );

  /** Gửi tin nhắn thực tế kèm danh sách documentId đã sẵn sàng */
  const executeDirectSend = useCallback(
    async (
      text: string,
      sessionId: string,
      filesToSend: AttachedFile[],
      isNewChat: boolean
    ) => {
      // Trích xuất danh sách documentId từ các tài liệu đã hoàn tất xử lý (ready)
      const readyDocIds = filesToSend
        .filter((f) => f.documentId && f.status === "ready")
        .map((f) => f.documentId as string);

      pendingAttachedDocIdsRef.current = readyDocIds;
      const attachedNames = filesToSend
        .filter((f) => f.status !== "error")
        .map((f) => f.name);

      setInputValue("");
      clearFiles();

      console.log("[RightSidebar] Chuẩn bị gửi tin nhắn AI:", {
        text,
        sessionId,
        conversationId,
        readyDocIds,
      });

      onSendMessage?.(text, sessionId, {
        model: modelConfig.modelId,
        effort: modelConfig.effort,
        thinking: modelConfig.thinking,
        attachedFiles: filesToSend,
      });

      const wordContext = activeWordContextRef.current;
      if (wordContext?.documentId) {
        try {
          const dirtyBlob = await exportWordSnapshotRef.current(
            wordContext.documentId
          );
          if (dirtyBlob) {
            await documentsApi.stageAgentWorkingSnapshot(
              wordContext.documentId,
              dirtyBlob
            );
          }
        } catch (stageErr) {
          console.warn(
            "[RightSidebar] Không thể đồng bộ bản nháp Word trước khi gửi AI:",
            stageErr
          );
        }
      }

      console.log("[RightSidebar] Kích hoạt aiSendMessage({ text })...");
      const sendPromise = aiSendMessage({
        text,
        metadata: { attachedFiles: attachedNames },
      } as any);

      if (attachedNames.length > 0) {
        setMessages((prev) => {
          const lastUserIdx = prev.map((m) => m.role).lastIndexOf("user");
          if (lastUserIdx === -1) return prev;
          const updated = [...prev];
          updated[lastUserIdx] = {
            ...updated[lastUserIdx],
            attachedFiles: attachedNames,
            metadata: {
              ...(updated[lastUserIdx] as any)?.metadata,
              attachedFiles: attachedNames,
            },
          } as any;
          return updated;
        });
      }

      await sendPromise;
      console.log("[RightSidebar] aiSendMessage đã gọi xong.");

      // Nếu là phiên mới, sau 1.2s kích hoạt tải lại tiêu đề mới do Ollama cập nhật ngầm
      if (isNewChat) {
        setTimeout(() => {
          refreshSessions();
        }, 1200);
      }
    },
    [
      conversationId,
      clearFiles,
      onSendMessage,
      modelConfig,
      aiSendMessage,
      setMessages,
      refreshSessions,
    ]
  );

  /** Hủy lượt gửi đang hoãn và hoàn trả câu hỏi vào ô soạn thảo */
  const handleCancelPendingSubmission = useCallback(() => {
    if (!pendingSubmission) return;
    setInputValue(pendingSubmission.text);
    restoreFiles(pendingSubmission.attachedFiles);
    setPendingSubmission(null);
  }, [pendingSubmission, restoreFiles]);

  /** 1. Timeout watcher: Tự động hủy trạng thái chờ và hoàn trả ô soạn thảo nếu quá thời gian cho phép */
  useEffect(() => {
    if (!pendingSubmission) return;

    const timer = setTimeout(() => {
      console.warn(
        `[RightSidebar] Quá thời gian chờ (${ATTACHMENT_PROCESSING_TIMEOUT_MS / 1000}s) xử lý tài liệu. Tự động hủy gửi hoãn và hoàn trả nội dung.`
      );
      setInputValue(pendingSubmission.text);
      restoreFiles(pendingSubmission.attachedFiles);
      setPendingSubmission(null);
    }, ATTACHMENT_PROCESSING_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [pendingSubmission, restoreFiles]);

  /** 2. Readiness & failure watcher: Theo dõi cập nhật danh sách documents (SWR Polling) để kích hoạt gửi thật */
  useEffect(() => {
    if (!pendingSubmission) return;

    const targetFiles = pendingSubmission.attachedFiles;
    const docMap = new Map((documents || []).map((d) => [d.id, d]));

    let anyFailed = false;
    let failedDocName = "";
    let failErrorMsg = "";
    let allReady = true;

    const updatedFiles: AttachedFile[] = targetFiles.map((file) => {
      // Trường hợp 1: Tệp đã có documentId
      if (file.documentId) {
        const doc = docMap.get(file.documentId);
        if (doc) {
          if (doc.ocr_status === "failed" || doc.embed_status === "failed") {
            anyFailed = true;
            failedDocName = file.name;
            failErrorMsg = doc.processing_error || "Xử lý trích xuất văn bản hoặc chỉ mục thất bại";
            return { ...file, status: "error", errorMessage: failErrorMsg };
          }
          if (doc.ocr_status === "done" && doc.embed_status === "done") {
            return { ...file, status: "ready" };
          }
          allReady = false;
          return { ...file, status: "processing" };
        }
        allReady = false;
        return file;
      }

      // Trường hợp 2: Tệp đang upload dở từ máy (chưa có documentId), tìm kiếm trong documents vừa được tạo cùng tên
      const matchedByName = documents?.find(
        (d) =>
          d.file_name === file.name &&
          Math.abs(new Date(d.created_at).getTime() - pendingSubmission.timestamp) < ATTACHMENT_PROCESSING_TIMEOUT_MS
      );

      if (matchedByName) {
        if (matchedByName.ocr_status === "failed" || matchedByName.embed_status === "failed") {
          anyFailed = true;
          failedDocName = file.name;
          failErrorMsg = matchedByName.processing_error || "Xử lý trích xuất văn bản hoặc chỉ mục thất bại";
          return { ...file, documentId: matchedByName.id, status: "error", errorMessage: failErrorMsg };
        }
        if (matchedByName.ocr_status === "done" && matchedByName.embed_status === "done") {
          return { ...file, documentId: matchedByName.id, status: "ready" };
        }
        allReady = false;
        return { ...file, documentId: matchedByName.id, status: "processing" };
      }

      allReady = false;
      return file;
    });

    if (anyFailed) {
      console.warn(`[RightSidebar] Tệp "${failedDocName}" bị lỗi khi xử lý: ${failErrorMsg}. Hủy lượt gửi tự động.`);
      setInputValue(pendingSubmission.text);
      restoreFiles(updatedFiles);
      setPendingSubmission(null);
      return;
    }

    if (allReady) {
      console.log("[RightSidebar] Tất cả tệp đính kèm đã sẵn sàng (ready). Bắt đầu gửi request AI thật sự...");
      const currentSubmission = pendingSubmission;
      setPendingSubmission(null);
      void executeDirectSend(
        currentSubmission.text,
        currentSubmission.sessionId,
        updatedFiles,
        currentSubmission.isNewChat
      );
    }
  }, [pendingSubmission, documents, restoreFiles, executeDirectSend]);

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
              if (typeof window !== "undefined" && conversationId) {
                window.sessionStorage.setItem(
                  `studymate:active-session:${conversationId}`,
                  created.id
                );
              }
              if (
                isValidUuid(effectiveSubjectId) &&
                isValidUuid(conversationId)
              ) {
                workspaceStateCoordinator.reportChatSession(
                  effectiveSubjectId,
                  conversationId,
                  created.id
                );
              }
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

        // Kiểm tra xem có tệp đính kèm nào đang tải lên hoặc đang xử lý không
        const pendingFiles = attachedFiles.filter(
          (f) => f.status === "uploading" || f.status === "processing"
        );

        if (pendingFiles.length > 0) {
          console.log("[RightSidebar] Có tệp đang tải/xử lý, đưa vào hàng đợi gửi hoãn:", pendingFiles);
          setPendingSubmission({
            text,
            attachedFiles: [...attachedFiles],
            sessionId,
            isNewChat,
            timestamp: Date.now(),
          });
          setInputValue("");
          clearFiles();
          return;
        }

        // Nếu tất cả tài liệu đã sẵn sàng (hoặc không đính kèm tệp) -> Gửi trực tiếp
        await executeDirectSend(text, sessionId, attachedFiles, isNewChat);
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
      executeDirectSend,
    ]
  );

  // Đồng bộ trạng thái AI đang phản hồi sang AskAiContext cho BubbleMenu
  useEffect(() => {
    setIsAiResponding(isSending);
    return () => {
      setIsAiResponding(false);
    };
  }, [isSending, setIsAiResponding]);

  // Tiếp nhận yêu cầu "Hỏi AI" từ đoạn văn bản được bôi đen trong Editor (BubbleMenu)
  useEffect(() => {
    if (!pendingAskRequest) return;

    // Bảo đảm khung Chat ở RightSidebar hiển thị ngay cho người dùng xem câu trả lời
    if (isCollapsed) {
      setIsRightSidebarCollapsed(false);
    }
    if (isSidePanelOpen) {
      if (isFullscreen) {
        setIsFullscreen(false);
      }
      closeSidePanelCitation();
    }

    if (isSending) {
      return;
    }

    const formattedMessage = formatSelectionAskPrompt({
      selectedText: pendingAskRequest.selectedText,
      prompt: pendingAskRequest.prompt,
      fileName: pendingAskRequest.source?.fileName,
      pageNo: pendingAskRequest.source?.pageNo,
    });

    consumeAskRequest();
    void sendMessage(formattedMessage);
  }, [
    pendingAskRequest,
    isSending,
    isCollapsed,
    isSidePanelOpen,
    isFullscreen,
    setIsRightSidebarCollapsed,
    closeSidePanelCitation,
    consumeAskRequest,
    sendMessage,
  ]);

  useEffect(() => {
    if (!pendingComposerPrompt) return;

    if (isCollapsed) {
      setIsRightSidebarCollapsed(false);
    }
    if (isSidePanelOpen) {
      if (isFullscreen) {
        setIsFullscreen(false);
      }
      closeSidePanelCitation();
    }

    if (!pendingComposerPrompt.autoSend) {
      if (pendingComposerPrompt.prompt) {
        setInputValue((prev) =>
          prev.trim().length > 0 ? prev : pendingComposerPrompt.prompt
        );
      }
      consumePendingComposerPrompt();
      return;
    }

    if (isSending) {
      return;
    }

    const promptToSend = pendingComposerPrompt.prompt;
    consumePendingComposerPrompt();
    if (promptToSend) {
      void sendMessage(promptToSend);
    }
  }, [
    pendingComposerPrompt,
    isSending,
    isCollapsed,
    isSidePanelOpen,
    isFullscreen,
    setIsRightSidebarCollapsed,
    closeSidePanelCitation,
    consumePendingComposerPrompt,
    sendMessage,
  ]);

  // Đẩy trực tiếp token của superdoc_stream_text & action tương thích sang BrowserDocumentApi,
  // đồng thời gom workspace sync về cuối lượt stream để tránh giật / reload giữa chừng.
  useEffect(() => {
    const wordCtx = activeWordContextRef.current;
    if (!wordCtx?.documentId) return;

    const lastMessage = messages[messages.length - 1];
    const assistantParts =
      lastMessage &&
      lastMessage.role === "assistant" &&
      Array.isArray(lastMessage.parts)
        ? lastMessage.parts
        : null;

    if (assistantParts) {
      for (const rawPart of assistantParts) {
        const part = rawPart as {
          type?: string;
          toolName?: string;
          toolCallId?: string;
          state?: string;
          input?: unknown;
        };
        const isStreamTextTool =
          part.type === "tool-superdoc_stream_text" ||
          (part.type === "dynamic-tool" &&
            part.toolName === "superdoc_stream_text");
        if (isStreamTextTool && part.toolCallId && part.input) {
          if (completedStreamToolCallIdsRef.current.has(part.toolCallId)) {
            continue;
          }
          const inputText =
            typeof (part.input as { text?: unknown }).text === "string"
              ? (part.input as { text: string }).text
              : "";
          const signature = `${part.state ?? ""}:${inputText.length}`;
          if (
            lastStreamedInputSignatureRef.current.get(part.toolCallId) ===
            signature
          ) {
            if (part.state === "output-available") {
              completedStreamToolCallIdsRef.current.add(part.toolCallId);
            }
            continue;
          }
          lastStreamedInputSignatureRef.current.set(part.toolCallId, signature);

          const isFinal =
            part.state === "input-available" ||
            part.state === "output-available";
          if (part.state === "input-streaming" || isFinal) {
            streamTextToActiveEditorRef.current(
              wordCtx.documentId,
              part.toolCallId,
              part.input,
              wordCtx.changeMode,
              isFinal,
            );
            if (part.state === "output-available") {
              completedStreamToolCallIdsRef.current.add(part.toolCallId);
              lastStreamedInputSignatureRef.current.delete(part.toolCallId);
            }
          }
          continue;
        }

        const isPerformActionTool =
          part.type === "tool-superdoc_perform_action" ||
          (part.type === "dynamic-tool" &&
            part.toolName === "superdoc_perform_action");
        if (
          isPerformActionTool &&
          part.toolCallId &&
          part.input &&
          (part.state === "input-available" ||
            part.state === "output-available") &&
          !dispatchedPerformActionIdsRef.current.has(part.toolCallId)
        ) {
          dispatchedPerformActionIdsRef.current.add(part.toolCallId);
          const handledInBrowser = pushPerformActionToActiveEditorRef.current(
            wordCtx.documentId,
            part.toolCallId,
            part.input,
            wordCtx.changeMode,
          );
          if (handledInBrowser) {
            browserHandledPerformActionIdsRef.current.add(part.toolCallId);
          }
        }
      }
    }

    if (
      status !== "streaming" &&
      status !== "submitted" &&
      pendingWordSyncRef.current
    ) {
      const pendingSync = pendingWordSyncRef.current;
      pendingWordSyncRef.current = null;

      let effectiveRequiresReload = pendingSync.requiresSnapshotReload;
      if (effectiveRequiresReload && assistantParts) {
        let sawBrowserHandledTool = false;
        let sawServerOnlyMutation = false;
        for (const rawPart of assistantParts) {
          const part = rawPart as {
            type?: string;
            toolName?: string;
            toolCallId?: string;
          };
          const toolName =
            part.type === "dynamic-tool"
              ? part.toolName
              : typeof part.type === "string" && part.type.startsWith("tool-")
                ? part.type.slice(5)
                : undefined;
          if (!toolName || !toolName.startsWith("superdoc_")) continue;
          if (toolName === "superdoc_stream_text") {
            sawBrowserHandledTool = true;
            continue;
          }
          if (toolName === "superdoc_perform_action") {
            if (
              part.toolCallId &&
              browserHandledPerformActionIdsRef.current.has(part.toolCallId)
            ) {
              sawBrowserHandledTool = true;
            } else {
              sawServerOnlyMutation = true;
            }
            continue;
          }
          if (
            !toolName.startsWith("superdoc_read") &&
            !toolName.startsWith("superdoc_search") &&
            !toolName.startsWith("superdoc_get") &&
            !toolName.startsWith("superdoc_list")
          ) {
            sawServerOnlyMutation = true;
          }
        }
        if (sawBrowserHandledTool && !sawServerOnlyMutation) {
          effectiveRequiresReload = false;
        }
      }

      void syncWordSnapshotRef.current(pendingSync.documentId, {
        changeMode: pendingSync.changeMode,
        count: pendingSync.count,
        requiresSnapshotReload: effectiveRequiresReload,
      });
    }
  }, [messages, status]);

  const handleApproveTool = useCallback(
    (approval: { id: string; approved: boolean; reason?: string }) => {
      void addToolApprovalResponse(approval);
    },
    [addToolApprovalResponse],
  );

  const handleUndoAction = useCallback(
    async (actionLogId: string) => {
      await chatSessionsApi.undoAgentAction(actionLogId);
      if (conversationId) {
        const occurredAt = new Date().toISOString();
        publishWorkspaceSync({
          resource: "summary",
          action: "updated",
          conversationId,
          entityId: actionLogId,
          occurredAt,
        });
        publishWorkspaceSync({
          resource: "flashcard",
          action: "updated",
          conversationId,
          entityId: actionLogId,
          targetKind: "deck",
          occurredAt,
        });
        publishWorkspaceSync({
          resource: "quiz",
          action: "updated",
          conversationId,
          entityId: actionLogId,
          occurredAt,
        });
        publishWorkspaceSync({
          resource: "document",
          action: "updated",
          conversationId,
          entityId: actionLogId,
          occurredAt,
        });
      }
    },
    [conversationId],
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
          ? "fixed inset-0 z-50 flex h-screen w-screen flex-col border-none bg-white dark:bg-[#12151C] text-[#0B1C30] dark:text-[#EFF0F6] select-none animate-in fade-in-50 duration-150 overflow-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          : `relative flex h-full flex-col border-l border-[#E5EEFF] dark:border-white/[0.08] bg-white dark:bg-[#12151C] text-[#0B1C30] dark:text-[#EFF0F6] select-none ${
              isDragging ? "transition-none" : "transition-[width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
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
          role="separator"
          aria-orientation="vertical"
          aria-label="Thay đổi độ rộng trợ lý AI"
          aria-valuemin={320}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onMouseDown={handleMouseDown}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 48 : 24;
            const maxWidth =
              typeof window !== "undefined"
                ? Math.floor(window.innerWidth * 0.6)
                : 720;
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              setSidebarWidth((prev) => Math.min(maxWidth, prev + step));
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              setSidebarWidth((prev) => Math.max(320, prev - step));
            }
          }}
          title="Kéo sang trái/phải để thay đổi kích thước (Tối đa 60%)"
          className="group absolute -left-1.5 top-0 bottom-0 z-40 w-3 cursor-col-resize select-none touch-none flex items-center justify-center hover:bg-transparent focus-visible:outline-2 focus-visible:outline-[#4F46E5]"
        >
          <div
            className={`h-full w-1 transition-colors duration-150 ${
              isDragging
                ? "bg-[#4F46E5] shadow-xs"
                : "bg-transparent group-hover:bg-[#4F46E5]/70 group-focus-visible:bg-[#4F46E5]"
            }`}
          />
        </div>
      )}
      {/* Input ẩn để chọn tệp từ thiết bị */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleLocalInputChange}
        aria-hidden="true"
        tabIndex={-1}
        className="hidden"
        multiple
        accept={`.pdf,.png,.jpg,.jpeg,.webp,.docx,.doc,.odt,${EDITABLE_TEXT_EXTENSIONS_ACCEPT}`}
      />

      {/* Trình xem nguồn PDF / Ảnh / Word / Text & Markdown tạm thời (mượn chỗ RightSidebar) */}
      {isSidePanelOpen && (
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
          {sidePanelDocument?.mime_type === "application/pdf" ? (
            <SidePanelPdfViewer
              key={sidePanelDocument.id}
              document={sidePanelDocument}
              compactReaderMode
              isExternalFullscreen={isFullscreen}
              onToggleExternalFullscreen={() => setIsFullscreen((prev) => !prev)}
              onDocumentUpdated={updateDocumentInCache}
              onClose={() => {
                if (isFullscreen) {
                  setIsFullscreen(false);
                }
                closeSidePanelCitation();
              }}
            />
          ) : sidePanelDocument?.mime_type.startsWith("image/") ? (
            <SidePanelImageViewer
              documents={[sidePanelDocument]}
              initialDocumentId={sidePanelDocument.id}
              compactReaderMode
              onClose={() => {
                if (isFullscreen) {
                  setIsFullscreen(false);
                }
                closeSidePanelCitation();
              }}
              className="h-full flex-1 rounded-none border-none"
            />
          ) : sidePanelDocument && isDocxDocument(sidePanelDocument) ? (
            <SidePanelWordEditor
              key={sidePanelDocument.id}
              document={sidePanelDocument}
              compactReaderMode
              isExternalFullscreen={isFullscreen}
              onToggleExternalFullscreen={() => setIsFullscreen((prev) => !prev)}
              onDownload={downloadDocument}
              onDocumentUpdated={updateDocumentInCache}
              citationTarget={sidePanelCitationTarget}
              onCitationDismiss={() =>
                setDismissedSidePanelCitationNonce(sidePanelTarget?.nonce ?? null)
              }
              onClose={() => {
                if (isFullscreen) {
                  setIsFullscreen(false);
                }
                closeSidePanelCitation();
              }}
            />
          ) : sidePanelDocument && isLegacyWordOrOdtDocument(sidePanelDocument) ? (
            <SidePanelLegacyDocPreview
              key={sidePanelDocument.id}
              document={sidePanelDocument}
              compactReaderMode
              isExternalFullscreen={isFullscreen}
              onToggleExternalFullscreen={() => setIsFullscreen((prev) => !prev)}
              onDownload={downloadDocument}
              onClose={() => {
                if (isFullscreen) {
                  setIsFullscreen(false);
                }
                closeSidePanelCitation();
              }}
            />
          ) : sidePanelDocument && isEditableTextDocument(sidePanelDocument) ? (
            <SidePanelTextEditor
              key={sidePanelDocument.id}
              document={sidePanelDocument}
              compactReaderMode
              isExternalFullscreen={isFullscreen}
              onToggleExternalFullscreen={() => setIsFullscreen((prev) => !prev)}
              onDownload={downloadDocument}
              onDocumentUpdated={updateDocumentInCache}
              citationTarget={sidePanelCitationTarget}
              onCitationDismiss={() =>
                setDismissedSidePanelCitationNonce(sidePanelTarget?.nonce ?? null)
              }
              onClose={() => {
                if (isFullscreen) {
                  setIsFullscreen(false);
                }
                closeSidePanelCitation();
              }}
            />
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#E5EEFF] dark:border-white/[0.08] px-3">
                <button
                  type="button"
                  onClick={closeSidePanelCitation}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white/80 dark:bg-white/[0.06] px-3 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Đóng nguồn</span>
                </button>
                <span className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400 max-w-[220px]">
                  {sidePanelTarget?.fileName || "Tài liệu nguồn"}
                </span>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2FF] dark:bg-white/[0.06] text-[#4F46E5] dark:text-[#818CF8]">
                  <FileText className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold text-[#0B1C30] dark:text-white">
                  {sidePanelDocument
                    ? "Định dạng tài liệu này chưa hỗ trợ xem trực tiếp"
                    : "Không tìm thấy tài liệu nguồn trong phiên học hiện tại"}
                </p>
                {sidePanelTarget?.rawContent && (
                  <div className="max-h-64 w-full overflow-y-auto rounded-2xl border border-[#E5EEFF] dark:border-white/[0.08] bg-[#F8F9FF] dark:bg-white/[0.04] p-3.5 text-left text-xs leading-relaxed text-[#464555] dark:text-neutral-300 select-text">
                    &ldquo;{sidePanelTarget.rawContent}&rdquo;
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Giao diện Chatbox AI được giữ mounted để bảo toàn hoàn toàn state khi đóng nguồn */}
      <div
        className={
          isSidePanelOpen
            ? "hidden"
            : "flex flex-1 flex-col min-h-0 overflow-hidden"
        }
      >
        <ChatHeader
          title={headerTitle}
          sessions={sessions}
          isLoading={isLoading}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onRenameChat={handleRenameChat}
          onDeleteChat={handleDeleteChat}
          onNewChat={handleNewChat}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
          headerRightSlot={
            <BackgroundJobsTray
              jobs={jobs}
              activeCount={activeJobsCount}
              onRetryJob={retryJob}
              onCancelJob={cancelJob}
            />
          }
          onClose={() => {
            if (isFullscreen) {
              setIsFullscreen(false);
            }
            onToggleCollapse?.();
          }}
        />

        {latestNotification && (
          <div
            className={`mx-4 mt-2 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
              latestNotification.status === "completed"
                ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
                : "border-rose-200 dark:border-rose-900/50 bg-rose-50/80 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200"
            }`}
          >
            <span className="min-w-0 flex-1 truncate font-medium">
              {latestNotification.message}
            </span>
            <button
              type="button"
              onClick={dismissNotification}
              className="shrink-0 text-[11px] font-semibold underline-offset-2 hover:underline cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}

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
              liveAgentStatus={liveAgentStatus}
              suggestions={suggestions}
              isLoadingSuggestions={isLoadingSuggestions}
              onSelectSuggestion={(selectedSuggestion) =>
                void sendMessage(selectedSuggestion)
              }
              onAddToolOutput={addToolOutput as any}
              onApproveTool={handleApproveTool}
              onUndoAction={handleUndoAction}
              onOpenSummary={handleOpenSummary}
              onOpenFlashcardDeck={handleOpenFlashcardDeck}
              onOpenQuiz={handleOpenQuiz}
            />
          )}

          {/* Banner hiển thị khi có tệp đang tải lên hoặc xử lý ngầm và người dùng đã bấm gửi */}
          {pendingSubmission && (
            <div className="mx-4 mb-1.5 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/90 dark:bg-amber-950/30 px-3.5 py-2.5 shadow-xs animate-in fade-in slide-in-from-bottom-2 duration-200 select-none">
              <div className="flex items-center gap-2.5 min-w-0">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-600 dark:text-amber-400" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 truncate">
                    Đang phân tích {pendingSubmission.attachedFiles.map((f) => f.name).join(", ")}…
                  </p>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                    Câu hỏi sẽ tự động được gửi khi tài liệu sẵn sàng tra cứu.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelPendingSubmission}
                className="shrink-0 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-lg focus-visible:outline-2 focus-visible:outline-[#4F46E5] transition-colors cursor-pointer"
              >
                Hủy
              </button>
            </div>
          )}

          {isWordContextForConversation && activeWordDocument && (
            <WordAgentContextBar
              document={activeWordDocument}
              changeMode={wordChangeMode}
              onChangeMode={setWordChangeMode}
              selectedText={wordSelection?.text}
              onClearSelection={clearWordSelection}
            />
          )}

          <WorkspaceContextPill
            hideWhenWordActive={Boolean(
              isWordContextForConversation && activeWordDocument
            )}
          />

          <ChatComposer
            value={inputValue}
            onChange={setInputValue}
            onSend={() => void sendMessage(inputValue)}
            disabled={isSending}
            placeholder={
              chatState === "empty"
                ? "Hỏi AI bất cứ điều gì về tài liệu…\nGõ @ để gắn tài liệu"
                : "Hỏi tiếp về đoạn chat này…\nGõ @ để gắn tài liệu"
            }
            attachedFiles={attachedFiles}
            onRemoveFile={removeFile}
            onSelectLocalFile={openLocalPicker}
            onPasteFiles={uploadLocalFiles}
            availableDocs={documents}
            onSelectWorkspaceDoc={addWorkspaceDoc}
            modelConfig={modelConfig}
            onModelConfigChange={updateModelConfig}
            contextLabel={shortContext}
            contextTitle={contextTitle}
            voiceResetKey={`${conversationId ?? ""}:${activeChatId ?? ""}`}
          />
        </div>
      </div>
    </aside>
  );

  if (isFullscreen && mounted && typeof document !== "undefined") {
    return (
      <>
        {/* Placeholder trong layout flow để không gián đoạn giao diện nền */}
        <div
          style={{ width: `${sidebarWidth}px` }}
          className="shrink-0 h-full border-l border-[#E5EEFF] dark:border-white/[0.08] bg-white dark:bg-[#12151C]"
        />
        {createPortal(sidebarContent, document.body)}
      </>
    );
  }

  return sidebarContent;
}

export { RightSidebar };
