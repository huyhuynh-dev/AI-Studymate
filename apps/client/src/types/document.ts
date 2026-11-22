export type DocumentStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface DocumentItem {
  id: string;
  conversation_id: string;
  user_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  file_hash?: string | null;
  storage_key: string;
  docling_json_key?: string | null;
  raw_text?: string | null;
  page_count?: number | null;
  doc_metadata?: Record<string, unknown> | null;
  processing_error?: string | null;
  uploaded_at: string;
  ocr_status: DocumentStatus;
  embed_status: DocumentStatus;
  content_version?: number;
  indexed_version?: number;
  sync_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentContentData {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  content: string;
  version: number;
  indexedVersion: number;
  ocrStatus: DocumentStatus;
  embedStatus: DocumentStatus;
  syncError: string | null;
  readOnly: boolean;
  readOnlyReason: string | null;
  isTruncated: boolean;
  updatedAt: string;
}

export interface UpdateDocumentContentRequest {
  content: string;
  expectedVersion: number;
}

export interface UpdateDocumentContentResponse {
  document: DocumentItem;
  version: number;
  indexedVersion: number;
  unchanged: boolean;
  embedStatus: DocumentStatus;
}

export interface InitUploadRequest {
  conversationId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface InitUploadResponse {
  documentId: string;
  storageKey: string;
  uploadUrl: string;
}

export interface CompleteUploadRequest {
  conversationId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
}

export interface UploadProgressItem {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'uploading' | 'verifying' | 'completed' | 'error';
  errorMessage?: string;
}
