import type {
  DocumentFullContent,
  DocumentSectionOrPagesOutput,
  RetrievedChunk,
} from '../../documents/services/retrieval.service.js';

// ── Cấu trúc Dữ liệu Trích dẫn Toàn hệ thống (Citation Contract) ──
export interface CitationItem {
  citationId: string; // "c1", "c2", ...
  chunkId: string;
  documentId: string;
  fileName: string;
  pageNumbers: number[];
  headings: string[];
  rawContent?: string | null;
  content?: string;
  bboxes?: unknown;
  assets?: unknown[];
}

// ── Tool 1: searchDocumentChunks ──
export interface SearchDocumentChunksToolInput {
  semanticQuery: string;
  keywords: string[];
  pageNumbers?: number[];
  pageRange?: { start: number; end: number };
  includeNeighbors?: boolean;
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
    rawContent?: string | null;
    bboxes?: unknown;
    assets?: unknown[];
    neighbors?: {
      prev?: { chunkIndex: number; content: string; pageNumbers: number[] } | null;
      next?: { chunkIndex: number; content: string; pageNumbers: number[] } | null;
    };
    rrfScore: number;
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
    rawContent?: string | null;
    bboxes?: unknown;
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
export interface CreateDocumentSummaryToolInput {
  scope: 'conversation' | 'document' | 'section';
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
}

export type CreateDocumentSummaryCallback = (
  input: CreateDocumentSummaryToolInput,
) => Promise<CreateDocumentSummaryToolOutput>;

// ── Tên định danh các Tool của Chat Agent ──
export type ChatAgentToolName =
  | 'searchDocumentChunks'
  | 'getDocumentSectionOrPages'
  | 'getDocumentsFullContent'
  | 'getConversationDocumentsMetadata'
  | 'askUserQuestion'
  | 'createDocumentSummary';

export interface ToolCallTracker {
  recordChunkId(chunkId: string): void;
  allocateCitation(chunk: Omit<CitationItem, 'citationId'>): string;
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
}
