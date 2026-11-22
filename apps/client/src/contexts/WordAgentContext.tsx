"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFocusMode } from "@/components/layout/FocusModeContext";
import {
  documentsApi,
  extractDocumentApiError,
} from "@/services/documents.api";
import type { DocumentItem } from "@/types/document";

export type WordAgentChangeMode = "tracked" | "direct";

export type WordAgentSelectionAction =
  | "rewrite"
  | "expand"
  | "summarize"
  | "fix-grammar"
  | "translate-en"
  | "custom";

export interface WordSelectionSnapshot {
  text: string;
  updatedAt: number;
}

export interface PendingWordComposerPrompt {
  id: string;
  prompt: string;
  autoSend: boolean;
  selectedText?: string;
}

export interface WordAgentSyncNotice {
  documentId: string;
  changeMode: WordAgentChangeMode;
  occurredAt: number;
  count?: number;
}

export interface RegisteredWordEditorHandle {
  document: DocumentItem;
  conversationId: string;
  isDirty: () => boolean;
  exportWorkingBlob: () => Promise<Blob | null>;
  applyAgentSnapshotBlob: (
    blob: Blob,
    options?: { changeMode?: WordAgentChangeMode },
  ) => Promise<void>;
  acceptAllChanges: () => Promise<number>;
  rejectAllChanges: () => Promise<number>;
  openReviewPanel: () => void;
}

export interface TriggerWordAiPromptOptions {
  action: WordAgentSelectionAction;
  customInstruction?: string;
  selectedTextOverride?: string;
  autoSend?: boolean;
}

interface WordAgentContextValue {
  activeWordDocument: DocumentItem | null;
  activeConversationId: string | null;
  selection: WordSelectionSnapshot | null;
  changeMode: WordAgentChangeMode;
  setChangeMode: (mode: WordAgentChangeMode) => void;
  pendingComposerPrompt: PendingWordComposerPrompt | null;
  lastAgentUpdate: WordAgentSyncNotice | null;
  isApplyingSnapshot: boolean;
  snapshotSyncError: string | null;
  registerEditor: (handle: RegisteredWordEditorHandle) => () => void;
  updateSelection: (text: string | null) => void;
  clearSelection: () => void;
  triggerQuickPrompt: (options: TriggerWordAiPromptOptions) => void;
  consumePendingComposerPrompt: () => void;
  exportActiveSnapshotForAgent: (documentId: string) => Promise<Blob | null>;
  syncAgentSnapshotFromServer: (
    documentId: string,
    options?: { changeMode?: WordAgentChangeMode; count?: number },
  ) => Promise<boolean>;
  clearAgentSyncState: () => void;
  focusDocumentReviewBanner: (documentId: string) => void;
}

const WordAgentContext = createContext<WordAgentContextValue | null>(null);

const SELECTION_PROMPT_BUILDERS: Record<
  Exclude<WordAgentSelectionAction, "custom">,
  (quotedText: string) => string
> = {
  rewrite: (quotedText) =>
    quotedText
      ? `Hãy viết lại đoạn văn bản đang chọn sao cho mạch lạc, tự nhiên và chuẩn văn phong học thuật hơn:\n"${quotedText}"`
      : "Hãy rà soát và viết lại phần nội dung hiện tại sao cho mạch lạc, rõ ràng hơn.",
  expand: (quotedText) =>
    quotedText
      ? `Hãy mở rộng và bổ sung luận điểm, ví dụ chi tiết cho đoạn văn bản đang chọn:\n"${quotedText}"`
      : "Hãy mở rộng nội dung tài liệu hiện tại với các luận điểm và ví dụ cụ thể hơn.",
  summarize: (quotedText) =>
    quotedText
      ? `Hãy cô đọng và tóm tắt lại đoạn văn bản đang chọn cho súc tích hơn:\n"${quotedText}"`
      : "Hãy tóm tắt ngắn gọn các ý chính của tài liệu Word đang mở.",
  "fix-grammar": (quotedText) =>
    quotedText
      ? `Hãy kiểm tra và sửa toàn bộ lỗi chính tả, ngữ pháp, dấu câu cho đoạn đang chọn (giữ nguyên ý nghĩa):\n"${quotedText}"`
      : "Hãy rà soát và sửa toàn bộ lỗi chính tả, ngữ pháp và định dạng trong tài liệu đang mở.",
  "translate-en": (quotedText) =>
    quotedText
      ? `Hãy dịch đoạn văn bản đang chọn sang tiếng Anh học thuật tự nhiên và đề xuất thay thế trực tiếp trong tài liệu:\n"${quotedText}"`
      : "Hãy dịch nội dung tài liệu hiện tại sang tiếng Anh chuẩn xác.",
};

function buildPromptText(options: TriggerWordAiPromptOptions, currentSelection: string | null): string {
  const rawSelection = (options.selectedTextOverride ?? currentSelection ?? "").trim();
  const clipped = rawSelection.length > 1500
    ? `${rawSelection.slice(0, 1500)}...`
    : rawSelection;

  if (options.action === "custom") {
    const custom = options.customInstruction?.trim();
    if (custom) {
      return clipped
        ? `${custom}\n\nĐoạn đang chọn:\n"${clipped}"`
        : custom;
    }
    return clipped ? `Đoạn văn bản đang chọn:\n"${clipped}"` : "";
  }

  return SELECTION_PROMPT_BUILDERS[options.action](clipped);
}

export function WordAgentProvider({ children }: { children: React.ReactNode }) {
  const { setIsRightSidebarCollapsed } = useFocusMode();
  const editorHandleRef = useRef<RegisteredWordEditorHandle | null>(null);
  const deferredSyncRef = useRef<{
    documentId: string;
    changeMode?: WordAgentChangeMode;
    count?: number;
  } | null>(null);

  const [activeWordDocument, setActiveWordDocument] =
    useState<DocumentItem | null>(null);
  const [activeConversationId, setActiveConversationId] =
    useState<string | null>(null);
  const [selection, setSelection] = useState<WordSelectionSnapshot | null>(null);
  const [changeMode, setChangeModeState] =
    useState<WordAgentChangeMode>("tracked");
  const [pendingComposerPrompt, setPendingComposerPrompt] =
    useState<PendingWordComposerPrompt | null>(null);
  const [lastAgentUpdate, setLastAgentUpdate] =
    useState<WordAgentSyncNotice | null>(null);
  const [isApplyingSnapshot, setIsApplyingSnapshot] = useState(false);
  const [snapshotSyncError, setSnapshotSyncError] = useState<string | null>(
    null,
  );

  const syncAgentSnapshotFromServer = useCallback(
    async (
      documentId: string,
      options?: { changeMode?: WordAgentChangeMode; count?: number },
    ): Promise<boolean> => {
      const handle = editorHandleRef.current;
      if (!handle || handle.document.id !== documentId) {
        deferredSyncRef.current = {
          documentId,
          changeMode: options?.changeMode,
          count: options?.count,
        };
        return false;
      }

      deferredSyncRef.current = null;
      setIsApplyingSnapshot(true);
      setSnapshotSyncError(null);
      try {
        const snapshot =
          await documentsApi.getAgentWorkingSnapshotBlob(documentId);
        await handle.applyAgentSnapshotBlob(snapshot.blob, {
          changeMode: options?.changeMode,
        });
        setLastAgentUpdate({
          documentId,
          changeMode: options?.changeMode ?? "tracked",
          occurredAt: Date.now(),
          count: options?.count,
        });
        return true;
      } catch (err) {
        setSnapshotSyncError(
          extractDocumentApiError(
            err,
            "Không thể đồng bộ bản chỉnh sửa mới nhất từ AI Agent.",
          ).message,
        );
        return false;
      } finally {
        setIsApplyingSnapshot(false);
      }
    },
    [],
  );

  const registerEditor = useCallback(
    (handle: RegisteredWordEditorHandle) => {
      editorHandleRef.current = handle;
      setActiveWordDocument(handle.document);
      setActiveConversationId(handle.conversationId);
      setSnapshotSyncError(null);

      const pending = deferredSyncRef.current;
      if (pending && pending.documentId === handle.document.id) {
        deferredSyncRef.current = null;
        void syncAgentSnapshotFromServer(pending.documentId, {
          changeMode: pending.changeMode,
          count: pending.count,
        });
      }

      return () => {
        if (editorHandleRef.current?.document.id === handle.document.id) {
          editorHandleRef.current = null;
          setActiveWordDocument(null);
          setActiveConversationId(null);
          setSelection(null);
        }
      };
    },
    [syncAgentSnapshotFromServer],
  );

  const updateSelection = useCallback((text: string | null) => {
    const normalized = text?.trim() ?? "";
    setSelection((prev) => {
      if (!normalized) {
        return prev ? null : prev;
      }
      if (prev && prev.text === normalized) {
        return prev;
      }
      return {
        text: normalized,
        updatedAt: Date.now(),
      };
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  const setChangeMode = useCallback((mode: WordAgentChangeMode) => {
    setChangeModeState(mode);
  }, []);

  const triggerQuickPrompt = useCallback(
    (options: TriggerWordAiPromptOptions) => {
      const currentSelection =
        options.selectedTextOverride?.trim() ?? selection?.text ?? null;
      const prompt = buildPromptText(options, currentSelection);
      setIsRightSidebarCollapsed(false);
      setPendingComposerPrompt({
        id: `word-prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        prompt,
        autoSend: options.autoSend ?? options.action !== "custom",
        ...(currentSelection ? { selectedText: currentSelection } : {}),
      });
    },
    [selection?.text, setIsRightSidebarCollapsed],
  );

  const consumePendingComposerPrompt = useCallback(() => {
    setPendingComposerPrompt(null);
  }, []);

  const exportActiveSnapshotForAgent = useCallback(
    async (documentId: string): Promise<Blob | null> => {
      const handle = editorHandleRef.current;
      if (!handle || handle.document.id !== documentId) {
        return null;
      }
      if (!handle.isDirty()) {
        return null;
      }
      return handle.exportWorkingBlob();
    },
    [],
  );

  const clearAgentSyncState = useCallback(() => {
    setLastAgentUpdate(null);
    setSnapshotSyncError(null);
  }, []);

  const focusDocumentReviewBanner = useCallback((documentId: string) => {
    const handle = editorHandleRef.current;
    if (!handle || handle.document.id !== documentId) {
      return;
    }
    handle.openReviewPanel();
  }, []);

  const contextValue = useMemo<WordAgentContextValue>(
    () => ({
      activeWordDocument,
      activeConversationId,
      selection,
      changeMode,
      setChangeMode,
      pendingComposerPrompt,
      lastAgentUpdate,
      isApplyingSnapshot,
      snapshotSyncError,
      registerEditor,
      updateSelection,
      clearSelection,
      triggerQuickPrompt,
      consumePendingComposerPrompt,
      exportActiveSnapshotForAgent,
      syncAgentSnapshotFromServer,
      clearAgentSyncState,
      focusDocumentReviewBanner,
    }),
    [
      activeWordDocument,
      activeConversationId,
      selection,
      changeMode,
      setChangeMode,
      pendingComposerPrompt,
      lastAgentUpdate,
      isApplyingSnapshot,
      snapshotSyncError,
      registerEditor,
      updateSelection,
      clearSelection,
      triggerQuickPrompt,
      consumePendingComposerPrompt,
      exportActiveSnapshotForAgent,
      syncAgentSnapshotFromServer,
      clearAgentSyncState,
      focusDocumentReviewBanner,
    ],
  );

  return (
    <WordAgentContext.Provider value={contextValue}>
      {children}
    </WordAgentContext.Provider>
  );
}

export function useWordAgent(): WordAgentContextValue {
  const ctx = useContext(WordAgentContext);
  if (!ctx) {
    throw new Error(
      "useWordAgent phải được sử dụng bên trong WordAgentProvider",
    );
  }
  return ctx;
}
