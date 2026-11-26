export type WorkspacePageType =
  | "home"
  | "subject"
  | "conversation"
  | "profile";

export type ConversationTabId =
  | "documents"
  | "summary"
  | "flashcard"
  | "quiz"
  | "analytics";

export type DocumentViewerKind =
  | "pdf"
  | "word"
  | "text"
  | "image"
  | "legacy_doc";

export interface ViewingDocumentContext {
  documentId: string;
  fileName: string;
  viewerKind: DocumentViewerKind;
  currentPage?: number;
  totalPages?: number;
  wordChangeMode?: "tracked" | "direct";
  selectedText?: string;
}

export interface DocumentsTabContextSlice {
  viewMode: "list" | "viewer";
  filterType: "all" | "pdf" | "image";
  totalCount: number;
  visibleCount: number;
  viewingDocument?: ViewingDocumentContext | null;
}

export interface SummaryTabContextSlice {
  viewMode: "list" | "detail";
  totalCount: number;
  activeSummary?: {
    summaryId: string;
    title: string;
    selectedText?: string;
  } | null;
}

export interface FlashcardTabContextSlice {
  viewMode: "decks" | "detail" | "study";
  totalDecksCount: number;
  activeDeck?: {
    deckId: string;
    deckName: string;
    totalCards?: number;
    dueToday?: number;
  } | null;
  studyState?: {
    mode: "due" | "extra";
    progress: number;
    remaining: number;
    currentCardId?: string;
    isCardRevealed: boolean;
  } | null;
}

export interface QuizTabContextSlice {
  viewMode: "list" | "detail" | "builder" | "taking" | "grading" | "result";
  totalQuizzesCount: number;
  activeQuiz?: {
    quizId: string;
    title: string;
  } | null;
  activeAttempt?: {
    attemptId: string;
    mode?: "exam" | "practice";
    currentQuestionIndex?: number;
    totalQuestions?: number;
    answeredCount?: number;
    resultFilter?: "all" | "incorrect" | "partial" | "correct" | "essay";
  } | null;
}

export interface AnalyticsTabContextSlice {
  windowDays: number;
  advancedOpen?: boolean;
}

export interface SidePanelContextSlice {
  documentId: string;
  fileName?: string;
  pageNo?: number;
  citationId?: string;
}

export interface WorkspaceLocationState {
  pathname?: string;
  pageType: WorkspacePageType;
  subjectId?: string | null;
  conversationId?: string | null;
  activeTab?: ConversationTabId | null;
  isFocusMode?: boolean;
}

export interface WorkspaceUiContextSnapshot {
  schemaVersion: 1;
  capturedAt: string;
  location: WorkspaceLocationState;
  documents?: DocumentsTabContextSlice;
  summary?: SummaryTabContextSlice;
  flashcard?: FlashcardTabContextSlice;
  quiz?: QuizTabContextSlice;
  analytics?: AnalyticsTabContextSlice;
  sidePanel?: SidePanelContextSlice | null;
}

export interface WorkspaceContextBadge {
  enabled: boolean;
  tab: ConversationTabId | "global";
  label: string;
  pageLabel?: string;
  title: string;
  isExamGuard: boolean;
  isWordActive: boolean;
}
