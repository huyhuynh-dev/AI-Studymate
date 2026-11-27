import type { TextCitationAnchor } from '../../common/types/source-ref.types.js';
import type {
  DocumentFullContent,
  DocumentSectionOrPagesOutput,
  RetrievedChunk,
} from '../../documents/services/retrieval.service.js';

// ── Cấu trúc Dữ liệu Trích dẫn Toàn hệ thống (Citation Contract) ──
export type CitationSourceType = 'document' | 'web';

export interface DocumentCitationItem {
  sourceType: 'document';
  citationId: string; // "c1", "c2", ...
  chunkId: string;
  chunkIndex?: number;
  documentId: string;
  fileName: string;
  pageNumbers: number[];
  headings: string[];
  rawContent?: string | null;
  content?: string;
  previewSnippet?: string;
  bboxes?: unknown;
  textAnchor?: TextCitationAnchor;
  assets?: unknown[];
  rrfScore?: number;
  rerankScore?: number | null;
  rrfRank?: number | null;
  vectorRank?: number | null;
  keywordRank?: number | null;
}

export interface WebCitationItem {
  sourceType: 'web';
  citationId: string; // "w1", "w2", ...
  title: string;
  url: string;
  domain: string;
  favicon?: string;
  publishedDate?: string;
  previewSnippet?: string; // Tối đa 300-400 ký tự (Đảm bảo gọn nhẹ trong DB và SSE stream)
}

export type CitationItem = DocumentCitationItem | WebCitationItem;

// ── Tool 1: searchDocumentChunks ──
export interface SearchDocumentChunksToolInput {
  semanticQuery: string;
  keywords: string[];
  documentIds?: string[];
  pageNumbers?: number[];
  pageRange?: { start: number; end: number };
  includeNeighbors?: boolean;
  topK?: number;
}

export interface SearchDocumentChunksSourceSummary {
  documentId: string;
  fileName: string;
  pageNumbers: number[];
  chunkCount: number;
}

export interface SearchDocumentChunksToolOutput {
  semanticQuery: string;
  keywords: string[];
  subQueriesUsed?: string[];
  totalChunks: number;
  sources: SearchDocumentChunksSourceSummary[];
  chunks: Array<{
    citationId: string;
    rank: number;
    id: string;
    documentId: string;
    fileName: string;
    chunkIndex: number;
    pageNumbers: number[];
    headings: string[];
    content: string;
    previewSnippet?: string;
    rawContent?: string | null;
    bboxes?: unknown;
    textAnchor?: TextCitationAnchor;
    assets?: unknown[];
    neighbors?: {
      prev?: { chunkIndex: number; content: string; pageNumbers: number[] } | null;
      next?: { chunkIndex: number; content: string; pageNumbers: number[] } | null;
    };
    rrfScore: number;
    rerankScore?: number | null;
    rrfRank?: number | null;
    vectorRank?: number | null;
    keywordRank?: number | null;
  }>;
}

export type SearchDocumentChunksCallback = (
  input: SearchDocumentChunksToolInput,
) => Promise<RetrievedChunk[]>;

// ── Tool 2: getDocumentSectionOrPages (Nâng cấp thay thế getDocumentsFullContent) ──
export interface GetDocumentSectionOrPagesToolInput {
  documentId: string;
  pageNumbers?: number[];
  headingKeyword?: string;
}

export interface GetDocumentSectionOrPagesToolOutput {
  documentId: string;
  fileName: string;
  pageCount: number;
  isFullDocument: boolean;
  totalChunks: number;
  message?: string;
  chunks: Array<{
    citationId: string;
    chunkId: string;
    chunkIndex: number;
    pageNumbers: number[];
    headings: string[];
    content: string;
    previewSnippet?: string;
    rawContent?: string | null;
    bboxes?: unknown;
    textAnchor?: TextCitationAnchor;
    assets?: unknown[];
  }>;
}

export type GetDocumentSectionOrPagesCallback = (
  input: GetDocumentSectionOrPagesToolInput,
) => Promise<DocumentSectionOrPagesOutput>;

// ── Tool cũ: getDocumentsFullContent (Giữ lại để tương thích ngược nếu cần) ──
export interface GetDocumentsFullContentToolInput {
  documentIds?: string[];
  fetchAllDocuments?: boolean;
}

export interface DocumentFullContentSummaryItem {
  documentId: string;
  fileName: string;
  characterCount: number;
}

export interface GetDocumentsFullContentToolOutput {
  requestedDocumentIds: string[];
  fetchAllDocuments: boolean;
  totalDocuments: number;
  documents: DocumentFullContentSummaryItem[];
  fullContents: DocumentFullContent[];
}

export type GetDocumentsFullContentCallback = (
  input: GetDocumentsFullContentToolInput,
) => Promise<DocumentFullContent[]>;

// ── Tool cũ: getConversationDocumentsMetadata (Deprecated - danh mục đã nhúng vào System Prompt) ──
export interface DocumentMetadataItem {
  documentId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  ocrStatus: string;
  characterCount: number;
  estimatedPages: number;
  isAttached: boolean;
  uploadedAt: string;
}

export interface GetConversationDocumentsMetadataToolOutput {
  totalDocuments: number;
  readyDocumentsCount: number;
  attachedDocumentIds: string[];
  documents: DocumentMetadataItem[];
}

export type GetConversationDocumentsMetadataCallback =
  () => Promise<GetConversationDocumentsMetadataToolOutput>;

// ── Tool 3: askUserQuestion (Client-Side Tool) ──
export interface AskUserQuestionItem {
  id: string;
  question: string;
  options?: string[];
  allowMultiple?: boolean;
  allowCustomInput?: boolean;
}

export interface AskUserQuestionToolInput {
  contextMessage?: string;
  questions: AskUserQuestionItem[];
}

// ── Tool 4: createDocumentSummary (Server-Side Tool) ──
export type CreateToolExecutionStatus =
  | 'created'
  | 'needs_clarification'
  | 'empty_workspace';

export interface ClarificationCandidateDocument {
  documentId: string;
  fileName: string;
}

export interface CreateDocumentSummaryToolInput {
  scope?: 'conversation' | 'document' | 'section';
  documentIds?: string[];
  mode?: 'key_takeaways' | 'study_guide' | 'qa_style';
  length?: 'short' | 'standard' | 'detailed';
  customInstruction?: string;
  fromPage?: number;
  toPage?: number;
}

export interface CreateDocumentSummaryToolOutput {
  summaryId: string;
  title: string;
  scope: 'conversation' | 'document' | 'section';
  mode: 'key_takeaways' | 'study_guide' | 'qa_style';
  length: 'short' | 'standard' | 'detailed';
  documentNames: string[];
  createdAt: string;
  status?: CreateToolExecutionStatus;
  missingField?: 'documentIds';
  candidates?: ClarificationCandidateDocument[];
  appliedDefaults?: string[];
  message?: string;
}

export type CreateDocumentSummaryCallback = (
  input: CreateDocumentSummaryToolInput,
) => Promise<CreateDocumentSummaryToolOutput>;

// ── Tool 5: searchInternet (Tavily Search API) ──
export interface SearchInternetToolInput {
  query: string;
  searchDepth?: 'basic' | 'advanced';
  topic?: 'general' | 'news' | 'finance';
  language?: string;
  timeRange?: 'day' | 'week' | 'month' | 'year';
  includeDomains?: string[];
  excludeDomains?: string[];
  exactMatch?: boolean;
}

export interface SearchInternetResultItem {
  citationId: string;
  title: string;
  url: string;
  domain: string;
  favicon?: string;
  publishedDate?: string;
  contentSnippet: string;
  previewSnippet?: string;
}

export interface SearchInternetToolOutput {
  query: string;
  totalResults: number;
  results: SearchInternetResultItem[];
  message?: string;
}

export type SearchInternetCallback = (
  input: SearchInternetToolInput,
) => Promise<{
  query: string;
  totalResults: number;
  results: Array<{
    title: string;
    url: string;
    domain: string;
    favicon?: string;
    publishedDate?: string;
    contentSnippet: string;
    previewSnippet: string;
  }>;
  message?: string;
}>;

// ── Tool 6: extractWebPage (Tavily Extract API) ──
export interface ExtractWebPageToolInput {
  urls: string[];
  query: string;
}

export interface ExtractWebPageResultItem {
  citationId: string;
  title: string;
  url: string;
  domain: string;
  favicon?: string;
  extractedContent: string;
  previewSnippet?: string;
}

export interface ExtractWebPageFailedItem {
  url: string;
  error: string;
}

export interface ExtractWebPageToolOutput {
  query: string;
  totalSuccess: number;
  totalFailed: number;
  results: ExtractWebPageResultItem[];
  failedResults: ExtractWebPageFailedItem[];
  message?: string;
}

export type ExtractWebPageCallback = (
  input: ExtractWebPageToolInput,
) => Promise<{
  query: string;
  totalSuccess: number;
  totalFailed: number;
  results: Array<{
    title: string;
    url: string;
    domain: string;
    favicon?: string;
    extractedContent: string;
    previewSnippet: string;
  }>;
  failedResults: ExtractWebPageFailedItem[];
  message?: string;
}>;

// ── Tool 7: createFlashcards (Server-Side Tool) ──
export interface CreateFlashcardsToolInput {
  documentIds?: string[];
  count?: number;
  types?: Array<'basic' | 'cloze' | 'type_in'>;
  deckName?: string;
  instructions?: string;
  deckId?: string;
}

export interface CreateFlashcardsToolOutput {
  deckId: string;
  deckName: string;
  deckDescription?: string | null;
  targetKind: 'new' | 'deck';
  savedCount: number;
  requestedCount: number;
  droppedCount: number;
  types: Array<'basic' | 'cloze' | 'type_in'>;
  documentNames: string[];
  createdAt: string;
  status?: CreateToolExecutionStatus;
  missingField?: 'documentIds';
  candidates?: ClarificationCandidateDocument[];
  appliedDefaults?: string[];
  message?: string;
}

export type CreateFlashcardsCallback = (
  input: CreateFlashcardsToolInput,
) => Promise<CreateFlashcardsToolOutput>;

// ── Tool 8: createQuiz (Server-Side Tool) ──
export type QuizToolQuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'true_false'
  | 'short_answer'
  | 'essay';

export type QuizToolDifficulty = 'basic' | 'applied' | 'advanced';
export type QuizToolBloomPreset = 'familiarize' | 'balanced' | 'exam_prep';

export interface CreateQuizToolInput {
  documentIds?: string[];
  questionCount?: number;
  types?: QuizToolQuestionType[];
  difficulty?: QuizToolDifficulty;
  bloomPreset?: QuizToolBloomPreset;
  deckId?: string;
}

export interface CreateQuizToolOutput {
  quizId: string;
  title: string;
  description?: string | null;
  source: 'ai' | 'flashcard' | 'manual';
  questionCount: number;
  requestedCount: number;
  types: QuizToolQuestionType[];
  difficulty: QuizToolDifficulty;
  documentNames: string[];
  createdAt: string;
  status?: CreateToolExecutionStatus;
  missingField?: 'documentIds';
  candidates?: ClarificationCandidateDocument[];
  appliedDefaults?: string[];
  message?: string;
}

export type CreateQuizCallback = (
  input: CreateQuizToolInput,
) => Promise<CreateQuizToolOutput>;

// ── Tool L2-1: getNoteContent ──
export interface GetNoteContentToolInput {
  summaryId?: string;
  titleQuery?: string;
  sectionKeyword?: string;
  charOffset?: number;
}

export interface GetNoteContentToolOutput {
  found: boolean;
  summaryId?: string;
  title?: string;
  conversationId?: string;
  sourceDocumentName?: string | null;
  updatedAt?: string;
  sectionOutline: string[];
  matchedSection?: string | null;
  contentMarkdown: string;
  totalChars: number;
  charOffset: number;
  truncated: boolean;
  nextCharOffset?: number;
  candidates?: Array<{ summaryId: string; title: string }>;
  message?: string;
}

export type GetNoteContentCallback = (
  input: GetNoteContentToolInput,
) => Promise<GetNoteContentToolOutput>;

// ── Tool L2-2: getQuizContent ──
export type QuizEvaluationFilter =
  | 'all'
  | 'incorrect'
  | 'partial'
  | 'correct'
  | 'flagged'
  | 'unanswered'
  | 'essay';

export interface GetQuizContentToolInput {
  quizId?: string;
  attemptId?: string;
  mode?: 'questions_only' | 'attempt_review';
  evaluationFilter?: QuizEvaluationFilter;
  questionNumbers?: number[];
  offset?: number;
  limit?: number;
}

export interface GetQuizContentOptionItem {
  label: string;
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface GetQuizContentQuestionItem {
  questionId: string;
  displayNumber: number;
  questionType: string;
  questionText: string;
  points: number;
  options?: GetQuizContentOptionItem[];
  sampleAnswer?: string | null;
  gradingCriteria?: string[];
  explanation?: string | null;
  bloomLevel?: string | null;
  studentSelectedLabels?: string[];
  studentTextAnswer?: string | null;
  isFlagged?: boolean;
  evaluationStatus?: string;
  pointsEarned?: number;
  matchedPoints?: string[];
  missingPoints?: string[];
  aiFeedback?: string | null;
}

export interface GetQuizContentToolOutput {
  found: boolean;
  quizId?: string;
  quizTitle?: string;
  attemptId?: string;
  attemptStatus?: string;
  attemptMode?: 'exam' | 'practice';
  examIntegrityEnforced: boolean;
  score?: number;
  maxScore?: number;
  totalQuestions: number;
  filteredCount: number;
  returnedCount: number;
  offset: number;
  hasMore: boolean;
  nextOffset?: number;
  questions: GetQuizContentQuestionItem[];
  message?: string;
}

export type GetQuizContentCallback = (
  input: GetQuizContentToolInput,
) => Promise<GetQuizContentToolOutput>;

// ── Tool L2-3: getDeckCards ──
export type FlashcardStateFilter =
  | 'all'
  | 'due'
  | 'new'
  | 'learning'
  | 'review'
  | 'relearning';

export interface GetDeckCardsToolInput {
  deckId?: string;
  cardId?: string;
  stateFilter?: FlashcardStateFilter;
  searchKeyword?: string;
  allowRevealCurrentCard?: boolean;
  offset?: number;
  limit?: number;
}

export interface GetDeckCardsItem {
  cardId: string;
  cardType: string;
  state: string;
  dueDate?: string;
  intervalDays: number;
  frontText: string;
  backText: string;
  answerHidden: boolean;
  answerRevealedOnRequest?: boolean;
}

export interface GetDeckCardsToolOutput {
  found: boolean;
  deckId?: string;
  deckName?: string;
  deckDescription?: string | null;
  totalCards: number;
  dueCount: number;
  filteredCount: number;
  returnedCount: number;
  offset: number;
  hasMore: boolean;
  nextOffset?: number;
  cards: GetDeckCardsItem[];
  message?: string;
}

export type GetDeckCardsCallback = (
  input: GetDeckCardsToolInput,
) => Promise<GetDeckCardsToolOutput>;

// ── Tool L2-4: searchWorkspaceResources ──
export type WorkspaceSearchResourceType =
  | 'document'
  | 'note'
  | 'deck'
  | 'quiz'
  | 'conversation';

export type WorkspaceSearchScope = 'conversation' | 'subject' | 'all';

export interface SearchWorkspaceResourcesToolInput {
  query?: string;
  resourceTypes?: WorkspaceSearchResourceType[];
  scope?: WorkspaceSearchScope;
  limitPerType?: number;
}

export interface WorkspaceResourceSearchItem {
  id: string;
  type: WorkspaceSearchResourceType;
  title: string;
  conversationId?: string;
  conversationTitle?: string;
  subjectName?: string;
  updatedAt?: string;
  meta?: string;
}

export interface SearchWorkspaceResourcesToolOutput {
  scope: WorkspaceSearchScope;
  query?: string;
  totalResults: number;
  items: WorkspaceResourceSearchItem[];
  message?: string;
}

export type SearchWorkspaceResourcesCallback = (
  input: SearchWorkspaceResourcesToolInput,
) => Promise<SearchWorkspaceResourcesToolOutput>;

// ── Tool 9..13: SuperDocs Word Editor Tools (full preset + streaming) ──
export type SuperDocInspectToolInput = Record<string, unknown>;
export type SuperDocInspectToolOutput = unknown;
export type SuperDocInspectCallback = (
  input: SuperDocInspectToolInput,
) => Promise<SuperDocInspectToolOutput>;

export type SuperDocPerformActionToolInput = {
  action: string;
  changeMode?: 'tracked' | 'direct';
} & Record<string, unknown>;
export type SuperDocPerformActionToolOutput = unknown;
export type SuperDocPerformActionCallback = (
  input: SuperDocPerformActionToolInput,
) => Promise<SuperDocPerformActionToolOutput>;

export interface SuperDocStreamTextToolInput {
  mode:
    | 'replace'
    | 'before'
    | 'after'
    | 'append'
    | 'paragraphBefore'
    | 'paragraphAfter';
  anchor: string | null;
  text: string;
}
export type SuperDocStreamTextToolOutput = unknown;
export type SuperDocStreamTextCallback = (
  input: SuperDocStreamTextToolInput,
) => Promise<SuperDocStreamTextToolOutput>;

export interface SuperDocStreamTextLiveHandlers {
  onInputStart?: (event: {
    toolCallId: string;
    abortSignal?: AbortSignal;
  }) => void | Promise<void>;
  onInputDelta?: (event: {
    toolCallId: string;
    inputTextDelta: string;
    abortSignal?: AbortSignal;
  }) => void | Promise<void>;
  commit?: (event: {
    toolCallId: string;
    input: SuperDocStreamTextToolInput;
    abortSignal?: AbortSignal;
  }) => Promise<SuperDocStreamTextToolOutput>;
}

export type SuperDocApiSearchToolInput = Record<string, unknown>;
export type SuperDocApiSearchToolOutput = unknown;
export type SuperDocApiSearchCallback = (
  input: SuperDocApiSearchToolInput,
) => Promise<SuperDocApiSearchToolOutput>;

export type SuperDocApiCallToolInput = Record<string, unknown>;
export type SuperDocApiCallToolOutput = unknown;
export type SuperDocApiCallCallback = (
  input: SuperDocApiCallToolInput,
) => Promise<SuperDocApiCallToolOutput>;

export interface SuperDocToolkitToolMeta {
  documentId: string;
  fileName: string;
  inspectDescription?: string;
  inspectInputSchema?: Record<string, unknown>;
  performActionDescription?: string;
  performActionInputSchema?: Record<string, unknown>;
  apiSearchDescription?: string;
  apiSearchInputSchema?: Record<string, unknown>;
  apiCallDescription?: string;
  apiCallInputSchema?: Record<string, unknown>;
}

// ── Phase 4 Mutation Tools (Domain-Consolidated) ──
export interface ManageNotesToolInput {
  action:
    | 'create_manual'
    | 'rename'
    | 'append_section'
    | 'update_section'
    | 'replace_content'
    | 'refine_note'
    | 'delete_note'
    | 'batch_reorganize';
  summaryId?: string;
  title?: string;
  sectionHeading?: string;
  markdownContent?: string;
  instruction?: string;
  batchItems?: Array<{
    summaryId: string;
    newTitle?: string;
    newMarkdownContent?: string;
  }>;
}

export interface ManageNotesToolOutput {
  ok: boolean;
  action: ManageNotesToolInput['action'];
  riskTier: 'tier_1' | 'tier_2';
  summaryId?: string;
  title?: string;
  affectedIds?: string[];
  actionLogId?: string;
  undoable?: boolean;
  message: string;
}

export type ManageNotesCallback = (
  input: ManageNotesToolInput,
  toolCallId?: string,
) => Promise<ManageNotesToolOutput>;

export interface ManageFlashcardsToolInput {
  action:
    | 'create_deck'
    | 'rename_deck'
    | 'delete_deck'
    | 'add_cards'
    | 'update_card'
    | 'delete_cards'
    | 'move_cards'
    | 'merge_duplicates';
  deckId?: string;
  targetDeckId?: string;
  deckName?: string;
  deckDescription?: string;
  cardId?: string;
  cardIds?: string[];
  cards?: Array<{
    cardType?: 'basic' | 'cloze' | 'type_in';
    frontText: string;
    backText?: string;
  }>;
  frontText?: string;
  backText?: string;
  cardType?: 'basic' | 'cloze' | 'type_in';
  mergeGroups?: Array<{
    keepCardId: string;
    deleteCardIds: string[];
    updatedFrontText?: string;
    updatedBackText?: string;
  }>;
}

export interface ManageFlashcardsToolOutput {
  ok: boolean;
  action: ManageFlashcardsToolInput['action'];
  riskTier: 'tier_1' | 'tier_2';
  deckId?: string;
  deckName?: string;
  affectedCount?: number;
  affectedIds?: string[];
  actionLogId?: string;
  undoable?: boolean;
  message: string;
}

export type ManageFlashcardsCallback = (
  input: ManageFlashcardsToolInput,
  toolCallId?: string,
) => Promise<ManageFlashcardsToolOutput>;

export interface ManageQuizToolInput {
  action:
    | 'update_metadata'
    | 'add_question'
    | 'update_question'
    | 'delete_questions'
    | 'batch_update_questions'
    | 'delete_quiz';
  quizId: string;
  title?: string;
  description?: string;
  timeLimitSec?: number | null;
  questionId?: string;
  questionIds?: string[];
  question?: {
    questionId?: string;
    questionType?: QuizToolQuestionType;
    questionText: string;
    points?: number;
    options?: Array<{ id?: string; text: string; isCorrect: boolean }>;
    sampleAnswer?: string;
    explanation?: string;
  };
  questions?: Array<{
    questionId: string;
    questionType?: QuizToolQuestionType;
    questionText: string;
    points?: number;
    options?: Array<{ id?: string; text: string; isCorrect: boolean }>;
    sampleAnswer?: string;
    explanation?: string;
  }>;
}

export interface ManageQuizToolOutput {
  ok: boolean;
  action: ManageQuizToolInput['action'];
  riskTier: 'tier_1' | 'tier_2';
  quizId?: string;
  title?: string;
  affectedCount?: number;
  affectedIds?: string[];
  blockedReason?: 'blocked_exam_integrity';
  actionLogId?: string;
  undoable?: boolean;
  message: string;
}

export type ManageQuizCallback = (
  input: ManageQuizToolInput,
  toolCallId?: string,
) => Promise<ManageQuizToolOutput>;

export interface ManageEditableDocumentToolInput {
  action:
    | 'read_content'
    | 'update_content'
    | 'save_as_new_document'
    | 'convert_note_to_markdown'
    | 'convert_markdown_to_note';
  documentId?: string;
  summaryId?: string;
  charOffset?: number;
  expectedVersion?: number;
  replaceSnippet?: {
    oldSnippet: string;
    newSnippet: string;
  };
  newContent?: string;
  newFileName?: string;
  noteTitle?: string;
}

export interface ManageEditableDocumentToolOutput {
  ok: boolean;
  action: ManageEditableDocumentToolInput['action'];
  riskTier: 'tier_0' | 'tier_1' | 'tier_2';
  documentId?: string;
  summaryId?: string;
  fileName?: string;
  version?: number;
  content?: string;
  totalChars?: number;
  returnedChars?: number;
  truncated?: boolean;
  nextCharOffset?: number;
  diffPreview?: string;
  actionLogId?: string;
  undoable?: boolean;
  message: string;
}

export type ManageEditableDocumentCallback = (
  input: ManageEditableDocumentToolInput,
  toolCallId?: string,
) => Promise<ManageEditableDocumentToolOutput>;

export interface ManageWorkspaceAndJobsToolInput {
  action:
    | 'navigate'
    | 'get_preferences'
    | 'update_preferences'
    | 'list_action_history'
    | 'undo_action'
    | 'enqueue_background_job'
    | 'list_jobs'
    | 'get_job_status'
    | 'retry_job'
    | 'cancel_job';
  navigationTarget?: {
    page?: 'home' | 'subject' | 'conversation' | 'profile';
    subjectId?: string;
    conversationId?: string;
    tab?: 'documents' | 'summary' | 'flashcard' | 'quiz' | 'analytics';
    resourceType?: 'document' | 'summary' | 'deck' | 'quiz';
    resourceId?: string;
  };
  theme?: 'system' | 'light' | 'dark';
  aiResponseLanguage?: 'auto' | 'vi' | 'en';
  dailyGoalMinutes?: number;
  actionLogId?: string;
  jobType?:
    | 'bulk_flashcards'
    | 'bulk_quiz'
    | 'deep_multi_doc_summary'
    | 'batch_study_workflow';
  jobTitle?: string;
  documentIds?: string[];
  count?: number;
  deckName?: string;
  instructions?: string;
  jobId?: string;
  limit?: number;
}

export interface ManageWorkspaceAndJobsToolOutput {
  ok: boolean;
  action: ManageWorkspaceAndJobsToolInput['action'];
  riskTier: 'tier_0' | 'tier_1';
  actionLogId?: string;
  undoable?: boolean;
  jobId?: string;
  jobStatus?: string;
  jobs?: Array<Record<string, unknown>>;
  actions?: Array<Record<string, unknown>>;
  preferences?: {
    theme: 'system' | 'light' | 'dark';
    aiResponseLanguage: 'auto' | 'vi' | 'en';
    dailyGoalMinutes?: number;
  };
  message: string;
}

export type ManageWorkspaceAndJobsCallback = (
  input: ManageWorkspaceAndJobsToolInput,
  toolCallId?: string,
) => Promise<ManageWorkspaceAndJobsToolOutput>;

// ── Tên định danh các Tool của Chat Agent ──
export type ChatAgentToolName =
  | 'searchDocumentChunks'
  | 'getDocumentSectionOrPages'
  | 'getDocumentsFullContent'
  | 'getConversationDocumentsMetadata'
  | 'askUserQuestion'
  | 'createDocumentSummary'
  | 'createFlashcards'
  | 'createQuiz'
  | 'getNoteContent'
  | 'getQuizContent'
  | 'getDeckCards'
  | 'searchWorkspaceResources'
  | 'searchInternet'
  | 'extractWebPage'
  | 'superdoc_inspect'
  | 'superdoc_perform_action'
  | 'superdoc_stream_text'
  | 'superdoc_api_search'
  | 'superdoc_api_call'
  | 'manageNotes'
  | 'manageFlashcards'
  | 'manageQuiz'
  | 'manageEditableDocument'
  | 'manageWorkspaceAndJobs';

export interface ToolCallTracker {
  recordChunkId(chunkId: string): void;
  allocateCitation(
    chunk: Omit<DocumentCitationItem, 'citationId' | 'sourceType'> & {
      sourceType?: 'document';
    },
  ): string;
  allocateWebCitation(
    webSource: Omit<WebCitationItem, 'citationId' | 'sourceType'>,
  ): string;
  getAllCitations(): CitationItem[];
  getCitation(citationId: string): CitationItem | undefined;
  recordOutput(
    toolCallId: string,
    toolName: ChatAgentToolName,
    rawOutput: unknown,
    lightweightOutput?: Record<string, unknown>,
  ): void;
  getLightweightOutput(toolCallId: string): Record<string, unknown> | undefined;
  getCollectedChunkIds(): Set<string>;
}

export interface ChatSessionToolCallbacks {
  onSearchDocumentChunks?: SearchDocumentChunksCallback;
  onGetDocumentSectionOrPages?: GetDocumentSectionOrPagesCallback;
  onGetDocumentsFullContent?: GetDocumentsFullContentCallback;
  onGetDocumentsMetadata?: GetConversationDocumentsMetadataCallback;
  onCreateDocumentSummary?: CreateDocumentSummaryCallback;
  onCreateFlashcards?: CreateFlashcardsCallback;
  onCreateQuiz?: CreateQuizCallback;
  onGetNoteContent?: GetNoteContentCallback;
  onGetQuizContent?: GetQuizContentCallback;
  onGetDeckCards?: GetDeckCardsCallback;
  onSearchWorkspaceResources?: SearchWorkspaceResourcesCallback;
  onSearchInternet?: SearchInternetCallback;
  onExtractWebPage?: ExtractWebPageCallback;
  onSuperDocInspect?: SuperDocInspectCallback;
  onSuperDocPerformAction?: SuperDocPerformActionCallback;
  onSuperDocStreamText?: SuperDocStreamTextCallback;
  superdocStreamTextLiveHandlers?: SuperDocStreamTextLiveHandlers;
  onSuperDocApiSearch?: SuperDocApiSearchCallback;
  onSuperDocApiCall?: SuperDocApiCallCallback;
  superdocToolkitMeta?: SuperDocToolkitToolMeta;
  onManageNotes?: ManageNotesCallback;
  onManageFlashcards?: ManageFlashcardsCallback;
  onManageQuiz?: ManageQuizCallback;
  onManageEditableDocument?: ManageEditableDocumentCallback;
  onManageWorkspaceAndJobs?: ManageWorkspaceAndJobsCallback;
}
