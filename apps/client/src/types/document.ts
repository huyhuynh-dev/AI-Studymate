export type DocumentStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface DocumentItem {
  id: string;
  conversation_id: string;
  user_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_key: string;
  raw_text?: string | null;
  processing_error?: string | null;
  uploaded_at: string;
  ocr_status: DocumentStatus;
  embed_status: DocumentStatus;
  created_at: string;
  updated_at: string;
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
