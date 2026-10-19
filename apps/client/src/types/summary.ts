export type SummaryScope = 'conversation' | 'document' | 'section';
export type SummaryMode = 'key_takeaways' | 'study_guide' | 'qa_style';
export type SummaryLength = 'short' | 'standard' | 'detailed';

export interface SummaryBlock {
  id: string;
  type: string;
  props?: Record<string, any>;
  content?: Array<{
    type: string;
    text: string;
    styles?: Record<string, any>;
  }>;
  children?: SummaryBlock[];
}

export interface SummaryItem {
  id: string;
  conversation_id: string;
  document_id: string | null;
  title: string;
  content_json: any; // BlockNote blocks
  pdf_storage_key: string | null;
  created_at: string;
  updated_at: string;
  document?: {
    id: string;
    file_name: string;
    mime_type: string;
  } | null;
}

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

export interface UpdateSummaryRequest {
  title?: string;
  content_json?: any[];
}

export interface RefineSummaryRequest {
  instruction: string;
}
