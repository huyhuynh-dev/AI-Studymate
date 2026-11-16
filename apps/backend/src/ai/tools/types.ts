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
  documentId: string;
  fileName: string;
  pageNumbers: number[];
  headings: string[];
  rawContent?: string | null;
  content?: string;
  previewSnippet?: string;
  bboxes?: unknown;
  assets?: unknown[];
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
    previewSnippet?: string;
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

// ── Tên định danh các Tool của Chat Agent ──
export type ChatAgentToolName =
  | 'searchDocumentChunks'
  | 'getDocumentSectionOrPages'
  | 'getDocumentsFullContent'
  | 'getConversationDocumentsMetadata'
  | 'askUserQuestion'
  | 'createDocumentSummary'
  | 'searchInternet'
  | 'extractWebPage';

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
  onSearchInternet?: SearchInternetCallback;
  onExtractWebPage?: ExtractWebPageCallback;
}
