export type WorkspacePageType =
  | 'home'
  | 'subject'
  | 'conversation'
  | 'profile';

export type ConversationTabId =
  | 'documents'
  | 'summary'
  | 'flashcard'
  | 'quiz'
  | 'analytics';

export type DocumentViewerKind =
  | 'pdf'
  | 'word'
  | 'text'
  | 'image'
  | 'legacy_doc';

export interface ResolvedWorkspaceLocation {
  pathname?: string;
  pageType: WorkspacePageType;
  subjectId?: string;
  subjectName?: string;
  conversationId?: string;
  conversationTitle?: string;
  activeTab?: ConversationTabId;
  isFocusMode?: boolean;
}

export interface ResolvedWorkspaceInventory {
  documentsCount: number;
  readyDocumentsCount: number;
  notesCount: number;
  decksCount: number;
  quizzesCount: number;
}

export interface ResolvedDocumentsViewContext {
  viewMode: 'list' | 'viewer';
  filterType?: 'all' | 'pdf' | 'image';
  visibleCount?: number;
  viewingDocument?: {
    documentId: string;
    fileName: string;
    viewerKind: DocumentViewerKind;
    currentPage?: number;
    totalPages?: number;
    pageCount?: number;
    wordChangeMode?: 'tracked' | 'direct';
    status?: string;
    nearbyTocHeadings?: string[];
    selectedText?: string;
  };
}

export interface ResolvedSummaryViewContext {
  viewMode: 'list' | 'detail';
  totalCount: number;
  notesList?: Array<{ id: string; title: string }>;
  activeNote?: {
    summaryId: string;
    title: string;
    headings: string[];
    selectedText?: string;
  };
}

export interface ResolvedFlashcardViewContext {
  viewMode: 'decks' | 'detail' | 'study';
  totalDecksCount: number;
  decksList?: Array<{
    id: string;
    name: string;
    totalCards: number;
    dueToday: number;
  }>;
  activeDeck?: {
    deckId: string;
    name: string;
    totalCards: number;
    newCount: number;
    learningCount: number;
    reviewCount: number;
    dueToday: number;
  };
  studyState?: {
    mode: 'due' | 'extra';
    progress: number;
    remaining: number;
    currentCardId?: string;
    isCardRevealed: boolean;
  };
}

export interface ResolvedQuizViewContext {
  viewMode: 'list' | 'detail' | 'builder' | 'taking' | 'grading' | 'result';
  totalQuizzesCount: number;
  quizzesList?: Array<{
    id: string;
    title: string;
    questionCount: number;
  }>;
  activeQuiz?: {
    quizId: string;
    title: string;
    questionCount: number;
    attemptsCount: number;
  };
  activeAttempt?: {
    attemptId: string;
    status?: string;
    mode?: 'exam' | 'practice';
    currentQuestionIndex?: number;
    totalQuestions?: number;
    answeredCount?: number;
    score?: number;
    maxScore?: number;
    correctCount?: number;
    partialCount?: number;
    incorrectCount?: number;
    essayCount?: number;
    resultFilter?: string;
  };
}

export interface ResolvedAnalyticsViewContext {
  windowDays: number;
  advancedOpen?: boolean;
}

export interface ResolvedSidePanelContext {
  documentId: string;
  fileName?: string;
  pageNo?: number;
  citationId?: string;
}

export interface ResolvedWorkspaceGuards {
  examIntegrityGuard: boolean;
  hideFlashcardAnswerGuard: boolean;
}

export interface ResolvedWorkspaceContext {
  location: ResolvedWorkspaceLocation;
  inventory: ResolvedWorkspaceInventory;
  attachedDocuments?: Array<{ documentId: string; fileName: string }>;
  documentsView?: ResolvedDocumentsViewContext;
  summaryView?: ResolvedSummaryViewContext;
  flashcardView?: ResolvedFlashcardViewContext;
  quizView?: ResolvedQuizViewContext;
  analyticsView?: ResolvedAnalyticsViewContext;
  sidePanel?: ResolvedSidePanelContext;
  guards: ResolvedWorkspaceGuards;
}
