"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type {
  AnalyticsTabContextSlice,
  ConversationTabId,
  DocumentsTabContextSlice,
  FlashcardTabContextSlice,
  QuizTabContextSlice,
  SidePanelContextSlice,
  SummaryTabContextSlice,
  ViewingDocumentContext,
  WorkspaceContextBadge,
  WorkspaceLocationState,
  WorkspaceUiContextSnapshot,
} from "./workspace-context.types";

const MAX_SELECTED_TEXT_LENGTH = 1200;

function clipSelectedText(text?: string | null): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  return trimmed.length > MAX_SELECTED_TEXT_LENGTH
    ? trimmed.slice(0, MAX_SELECTED_TEXT_LENGTH)
    : trimmed;
}

type TabSlicesMap = {
  documents?: DocumentsTabContextSlice;
  summary?: SummaryTabContextSlice;
  flashcard?: FlashcardTabContextSlice;
  quiz?: QuizTabContextSlice;
  analytics?: AnalyticsTabContextSlice;
};

export class WorkspaceContextStore {
  private location: WorkspaceLocationState = {
    pageType: "home",
    subjectId: null,
    conversationId: null,
    activeTab: null,
    isFocusMode: false,
  };
  private slices: TabSlicesMap = {};
  private sidePanel: SidePanelContextSlice | null = null;
  private enabled = true;
  private listeners = new Set<() => void>();
  private cachedBadge: WorkspaceContextBadge | null = null;
  private cachedBadgeKey = "";

  constructor() {
    this.recomputeBadge();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emitIfBadgeChanged(): void {
    const changed = this.recomputeBadge();
    if (!changed) return;
    for (const listener of this.listeners) {
      listener();
    }
  }

  private recomputeBadge(): boolean {
    const next = this.buildBadge();
    const nextKey = next
      ? `${next.enabled ? 1 : 0}|${next.tab}|${next.label}|${next.pageLabel ?? ""}|${next.title}|${next.isExamGuard ? 1 : 0}|${next.isWordActive ? 1 : 0}`
      : "null";

    if (nextKey === this.cachedBadgeKey) {
      return false;
    }

    this.cachedBadgeKey = nextKey;
    this.cachedBadge = next;
    return true;
  }

  private buildBadge(): WorkspaceContextBadge | null {
    if (this.location.pageType !== "conversation" || !this.location.conversationId) {
      return null;
    }

    const tab = this.location.activeTab ?? "documents";
    let label = "Không gian học tập";
    let pageLabel: string | undefined;
    let title = "Trợ lý AI nhận biết ngữ cảnh màn hình hiện tại";
    let isExamGuard = false;
    let isWordActive = false;

    if (tab === "documents") {
      const slice = this.slices.documents;
      if (slice?.viewMode === "viewer" && slice.viewingDocument) {
        const doc = slice.viewingDocument;
        isWordActive = doc.viewerKind === "word";
        const pageStr =
          typeof doc.currentPage === "number"
            ? ` · Tr. ${doc.currentPage}${doc.totalPages ? `/${doc.totalPages}` : ""}`
            : "";
        pageLabel =
          typeof doc.currentPage === "number"
            ? `Tr. ${doc.currentPage}${doc.totalPages ? `/${doc.totalPages}` : ""}`
            : undefined;
        label = `${doc.fileName}${pageStr}`;
        title = `Đang mở tài liệu ${doc.fileName}${pageStr}`;
      } else {
        const count = slice?.visibleCount ?? slice?.totalCount ?? 0;
        label = `Tab Tài liệu (${count})`;
        title = `Đang xem danh sách ${count} tài liệu`;
      }
    } else if (tab === "summary") {
      const slice = this.slices.summary;
      if (slice?.viewMode === "detail" && slice.activeSummary) {
        label = `Ghi chú: ${slice.activeSummary.title}`;
        title = `Đang mở ghi chú "${slice.activeSummary.title}"`;
      } else {
        const count = slice?.totalCount ?? 0;
        label = `Tab Ghi chú (${count})`;
        title = `Đang xem danh sách ${count} ghi chú`;
      }
    } else if (tab === "flashcard") {
      const slice = this.slices.flashcard;
      if (slice?.viewMode === "study" && slice.activeDeck) {
        const st = slice.studyState;
        const remainStr =
          st && typeof st.remaining === "number" ? ` · Còn ${st.remaining} thẻ` : "";
        label = `Đang học: ${slice.activeDeck.deckName}${remainStr}`;
        title = `Đang ôn tập bộ thẻ "${slice.activeDeck.deckName}"`;
      } else if (slice?.viewMode === "detail" && slice.activeDeck) {
        label = `Bộ thẻ: ${slice.activeDeck.deckName}`;
        title = `Đang xem bộ thẻ "${slice.activeDeck.deckName}"`;
      } else {
        const count = slice?.totalDecksCount ?? 0;
        label = `Tab Flashcard (${count} bộ)`;
        title = `Đang xem danh sách ${count} bộ thẻ`;
      }
    } else if (tab === "quiz") {
      const slice = this.slices.quiz;
      if (slice?.viewMode === "taking" && slice.activeQuiz) {
        const att = slice.activeAttempt;
        isExamGuard = att?.mode === "exam" || !att?.mode;
        const qStr =
          att?.currentQuestionIndex && att?.totalQuestions
            ? ` · Câu ${att.currentQuestionIndex}/${att.totalQuestions}`
            : "";
        label = `${isExamGuard ? "Đang thi" : "Luyện tập"}: ${slice.activeQuiz.title}${qStr}`;
        title = isExamGuard
          ? `Đang làm bài thi "${slice.activeQuiz.title}" (Chế độ gợi ý bảo toàn thi cử)`
          : `Đang luyện tập "${slice.activeQuiz.title}"`;
      } else if (slice?.viewMode === "result" && slice.activeQuiz) {
        label = `Kết quả: ${slice.activeQuiz.title}`;
        title = `Đang xem kết quả bài "${slice.activeQuiz.title}"`;
      } else if (slice?.activeQuiz) {
        label = `Đề: ${slice.activeQuiz.title}`;
        title = `Đang xem đề kiểm tra "${slice.activeQuiz.title}"`;
      } else {
        const count = slice?.totalQuizzesCount ?? 0;
        label = `Tab Trắc nghiệm (${count} đề)`;
        title = `Đang xem danh sách ${count} đề kiểm tra`;
      }
    } else if (tab === "analytics") {
      const days = this.slices.analytics?.windowDays ?? 30;
      label = `Phân tích (${days} ngày)`;
      title = `Đang xem thống kê học tập ${days} ngày gần nhất`;
    }

    if (this.sidePanel?.fileName) {
      const sidePage = this.sidePanel.pageNo ? ` (Tr. ${this.sidePanel.pageNo})` : "";
      title = `${title} · Đang đối chiếu nguồn: ${this.sidePanel.fileName}${sidePage}`;
    }

    return {
      enabled: this.enabled,
      tab,
      label,
      ...(pageLabel ? { pageLabel } : {}),
      title,
      isExamGuard,
      isWordActive,
    };
  }

  getBadge = (): WorkspaceContextBadge | null => {
    return this.cachedBadge;
  };

  setEnabled = (enabled: boolean): void => {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.emitIfBadgeChanged();
  };

  isEnabled = (): boolean => {
    return this.enabled;
  };

  setLocation = (patch: Partial<WorkspaceLocationState>): void => {
    this.location = {
      ...this.location,
      ...patch,
    };
    this.emitIfBadgeChanged();
  };

  setTabSlice = <K extends ConversationTabId>(
    tab: K,
    slice: TabSlicesMap[K],
  ): void => {
    if (tab === "documents" && slice) {
      const docSlice = slice as DocumentsTabContextSlice;
      const existingViewing = this.slices.documents?.viewingDocument;
      const incomingViewing = docSlice.viewingDocument;
      const mergedViewing = incomingViewing
        ? {
            ...incomingViewing,
            // Bảo toàn currentPage/totalPages/wordChangeMode nếu cùng documentId và payload mới không ghi đè
            ...(existingViewing &&
            existingViewing.documentId === incomingViewing.documentId
              ? {
                  currentPage:
                    incomingViewing.currentPage ?? existingViewing.currentPage,
                  totalPages:
                    existingViewing.totalPages ?? incomingViewing.totalPages,
                  wordChangeMode:
                    incomingViewing.wordChangeMode ??
                    existingViewing.wordChangeMode,
                  selectedText:
                    incomingViewing.selectedText ??
                    existingViewing.selectedText,
                }
              : {}),
            selectedText: clipSelectedText(
              incomingViewing.selectedText ??
                (existingViewing?.documentId === incomingViewing.documentId
                  ? existingViewing.selectedText
                  : undefined),
            ),
          }
        : null;

      this.slices.documents = {
        ...docSlice,
        viewingDocument: mergedViewing,
      };
    } else if (tab === "summary" && slice) {
      const sumSlice = slice as SummaryTabContextSlice;
      this.slices.summary = {
        ...sumSlice,
        activeSummary: sumSlice.activeSummary
          ? {
              ...sumSlice.activeSummary,
              selectedText: clipSelectedText(sumSlice.activeSummary.selectedText),
            }
          : null,
      };
    } else {
      this.slices[tab] = slice;
    }
    this.emitIfBadgeChanged();
  };

  patchDocumentsViewingDoc = (
    patch: Partial<ViewingDocumentContext> & { documentId: string },
  ): void => {
    const prevSlice = this.slices.documents;
    const prevDoc = prevSlice?.viewingDocument;
    const isSameDoc = prevDoc?.documentId === patch.documentId;

    const mergedDoc: ViewingDocumentContext = {
      documentId: patch.documentId,
      fileName: patch.fileName ?? (isSameDoc ? prevDoc?.fileName : "") ?? "",
      viewerKind:
        patch.viewerKind ?? (isSameDoc ? prevDoc?.viewerKind : "pdf") ?? "pdf",
      currentPage:
        patch.currentPage ?? (isSameDoc ? prevDoc?.currentPage : undefined),
      totalPages:
        patch.totalPages ?? (isSameDoc ? prevDoc?.totalPages : undefined),
      wordChangeMode:
        patch.wordChangeMode ??
        (isSameDoc ? prevDoc?.wordChangeMode : undefined),
      selectedText:
        patch.selectedText !== undefined
          ? clipSelectedText(patch.selectedText)
          : isSameDoc
            ? prevDoc?.selectedText
            : undefined,
    };

    this.slices.documents = {
      viewMode: "viewer",
      filterType: prevSlice?.filterType ?? "all",
      totalCount: prevSlice?.totalCount ?? 1,
      visibleCount: prevSlice?.visibleCount ?? 1,
      viewingDocument: mergedDoc,
    };
    this.emitIfBadgeChanged();
  };

  patchFlashcardStudyState = (
    studyState: NonNullable<FlashcardTabContextSlice["studyState"]> | null,
  ): void => {
    const prev = this.slices.flashcard;
    if (!prev) return;
    this.slices.flashcard = {
      ...prev,
      studyState,
    };
    this.emitIfBadgeChanged();
  };

  patchQuizAttemptState = (
    attemptPatch: NonNullable<QuizTabContextSlice["activeAttempt"]>,
  ): void => {
    const prev = this.slices.quiz;
    if (!prev) return;
    this.slices.quiz = {
      ...prev,
      activeAttempt: {
        ...prev.activeAttempt,
        ...attemptPatch,
      },
    };
    this.emitIfBadgeChanged();
  };

  patchAnalyticsState = (patch: Partial<AnalyticsTabContextSlice>): void => {
    const prev = this.slices.analytics;
    this.slices.analytics = {
      windowDays: patch.windowDays ?? prev?.windowDays ?? 30,
      advancedOpen: patch.advancedOpen ?? prev?.advancedOpen ?? false,
    };
    this.emitIfBadgeChanged();
  };

  clearTabSlice = (tab: ConversationTabId): void => {
    if (this.slices[tab] === undefined) return;
    delete this.slices[tab];
    this.emitIfBadgeChanged();
  };

  setSidePanel = (panel: SidePanelContextSlice | null): void => {
    this.sidePanel = panel;
    this.emitIfBadgeChanged();
  };

  patchSidePanelPage = (documentId: string, pageNo: number): void => {
    if (
      !this.sidePanel ||
      this.sidePanel.documentId !== documentId ||
      this.sidePanel.pageNo === pageNo
    ) {
      return;
    }
    this.sidePanel = {
      ...this.sidePanel,
      pageNo,
    };
    this.emitIfBadgeChanged();
  };

  getSnapshot = (): WorkspaceUiContextSnapshot | null => {
    if (!this.enabled) return null;

    const activeTab = this.location.activeTab;
    const snapshot: WorkspaceUiContextSnapshot = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      location: {
        ...this.location,
      },
      ...(this.sidePanel ? { sidePanel: { ...this.sidePanel } } : {}),
    };

    if (activeTab === "documents" && this.slices.documents) {
      snapshot.documents = this.slices.documents;
    } else if (activeTab === "summary" && this.slices.summary) {
      snapshot.summary = this.slices.summary;
    } else if (activeTab === "flashcard" && this.slices.flashcard) {
      snapshot.flashcard = this.slices.flashcard;
    } else if (activeTab === "quiz" && this.slices.quiz) {
      snapshot.quiz = this.slices.quiz;
    } else if (activeTab === "analytics" && this.slices.analytics) {
      snapshot.analytics = this.slices.analytics;
    }

    return snapshot;
  };
}

const WorkspaceContext = createContext<WorkspaceContextStore | null>(null);
const getServerBadgeSnapshot = (): WorkspaceContextBadge | null => null;

export function WorkspaceContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = useMemo(() => new WorkspaceContextStore(), []);
  return (
    <WorkspaceContext.Provider value={store}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContextStore(): WorkspaceContextStore | null {
  return useContext(WorkspaceContext);
}

export function useWorkspaceContextBadge(): WorkspaceContextBadge | null {
  const store = useContext(WorkspaceContext);
  const noopSubscribe = useMemo(() => () => () => {}, []);
  const nullSnapshot = useMemo(() => () => null, []);

  return useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? store.getBadge : nullSnapshot,
    getServerBadgeSnapshot,
  );
}
