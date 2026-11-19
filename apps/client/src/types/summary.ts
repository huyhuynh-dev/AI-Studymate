export type SummaryScope = 'conversation' | 'document' | 'section';
export type SummaryMode = 'key_takeaways' | 'study_guide' | 'qa_style';
export type SummaryLength = 'short' | 'standard' | 'detailed';

export interface SummaryBlock {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  content?: Array<{
    type: string;
    text: string;
    styles?: Record<string, unknown>;
  }>;
  children?: SummaryBlock[];
}

export interface SummaryDocumentRef {
  id: string;
  fileName: string;
  mimeType: string;
}

export interface SummaryItem {
  id: string;
  conversationId: string;
  documentId: string | null;
  title: string;
  contentJson: unknown[];
  pdfStorageKey: string | null;
  createdAt: string;
  updatedAt: string;
  document?: SummaryDocumentRef | null;
}

export type NoteItem = SummaryItem;

export interface CreateSummaryRequest {
  scope: SummaryScope;
  documentId?: string;
  mode: SummaryMode;
  length: SummaryLength;
  sectionRange?: {
    fromPage?: number;
    toPage?: number;
    customText?: string;
  };
  customInstruction?: string;
}

export interface CreateManualNoteRequest {
  title?: string;
  contentJson?: unknown[];
}

export interface UpdateSummaryRequest {
  title?: string;
  contentJson?: unknown[];
}

export interface RefineSummaryRequest {
  instruction: string;
}
