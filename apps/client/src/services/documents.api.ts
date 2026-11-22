import axios from 'axios';
import { axiosClient } from '@/lib/axios.client';
import type {
  CompleteUploadRequest,
  DocumentContentData,
  DocumentItem,
  DocumentPreviewData,
  DocumentStatus,
  ImportGoogleDocRequest,
  InitUploadRequest,
  InitUploadResponse,
  OverwriteVersionRequest,
  UpdateDocumentContentRequest,
  UpdateDocumentContentResponse,
} from '@/types';

interface RawDocumentContentPayload {
  id: string;
  fileName?: string;
  file_name?: string;
  mimeType?: string;
  mime_type?: string;
  fileSize?: number;
  file_size?: number;
  content?: string;
  version?: number;
  content_version?: number;
  indexedVersion?: number;
  indexed_version?: number;
  ocrStatus?: DocumentStatus;
  ocr_status?: DocumentStatus;
  embedStatus?: DocumentStatus;
  embed_status?: DocumentStatus;
  syncError?: string | null;
  sync_error?: string | null;
  readOnly?: boolean;
  readOnlyReason?: string | null;
  isTruncated?: boolean;
  updatedAt?: string | Date;
  updated_at?: string | Date;
}

interface RawDocumentPreviewPayload {
  id: string;
  fileName?: string;
  file_name?: string;
  mimeType?: string;
  mime_type?: string;
  fileSize?: number;
  file_size?: number;
  rawText?: string | null;
  raw_text?: string | null;
  ocrStatus?: DocumentStatus;
  ocr_status?: DocumentStatus;
  embedStatus?: DocumentStatus;
  embed_status?: DocumentStatus;
  pageCount?: number | null;
  page_count?: number | null;
  processingError?: string | null;
  processing_error?: string | null;
  updatedAt?: string | Date;
  updated_at?: string | Date;
  readOnlyReason?: string | null;
}

interface RawUpdateDocumentContentPayload {
  document: DocumentItem;
  version?: number;
  indexedVersion?: number;
  unchanged?: boolean;
  embedStatus?: DocumentStatus;
}

function normalizeIsoDate(value?: string | Date | null): string {
  if (!value) return new Date().toISOString();
  return typeof value === 'string' ? value : value.toISOString();
}

function mapDocumentItem(raw: DocumentItem): DocumentItem {
  return {
    ...raw,
    file_size: Number(raw.file_size ?? 0),
    content_version: Number(raw.content_version ?? 1),
    indexed_version: Number(raw.indexed_version ?? 0),
    sync_error: raw.sync_error ?? null,
    processing_error: raw.processing_error ?? null,
    uploaded_at: normalizeIsoDate(raw.uploaded_at),
    created_at: normalizeIsoDate(raw.created_at),
    updated_at: normalizeIsoDate(raw.updated_at),
  };
}

function mapDocumentContent(raw: RawDocumentContentPayload): DocumentContentData {
  return {
    id: raw.id,
    fileName: raw.fileName ?? raw.file_name ?? 'document.txt',
    mimeType: raw.mimeType ?? raw.mime_type ?? 'text/plain',
    fileSize: Number(raw.fileSize ?? raw.file_size ?? 0),
    content: raw.content ?? '',
    version: Number(raw.version ?? raw.content_version ?? 1),
    indexedVersion: Number(raw.indexedVersion ?? raw.indexed_version ?? 0),
    ocrStatus: raw.ocrStatus ?? raw.ocr_status ?? 'pending',
    embedStatus: raw.embedStatus ?? raw.embed_status ?? 'pending',
    syncError: raw.syncError ?? raw.sync_error ?? null,
    readOnly: Boolean(raw.readOnly),
    readOnlyReason: raw.readOnlyReason ?? null,
    isTruncated: Boolean(raw.isTruncated),
    updatedAt: normalizeIsoDate(raw.updatedAt ?? raw.updated_at),
  };
}

function mapUpdateDocumentContent(
  raw: RawUpdateDocumentContentPayload,
): UpdateDocumentContentResponse {
  const mappedDoc = mapDocumentItem(raw.document);
  return {
    document: mappedDoc,
    version: Number(raw.version ?? mappedDoc.content_version ?? 1),
    indexedVersion: Number(raw.indexedVersion ?? mappedDoc.indexed_version ?? 0),
    unchanged: Boolean(raw.unchanged),
    embedStatus: raw.embedStatus ?? mappedDoc.embed_status,
  };
}

function mapDocumentPreview(raw: RawDocumentPreviewPayload): DocumentPreviewData {
  return {
    id: raw.id,
    fileName: raw.fileName ?? raw.file_name ?? 'document',
    mimeType: raw.mimeType ?? raw.mime_type ?? 'application/msword',
    fileSize: Number(raw.fileSize ?? raw.file_size ?? 0),
    rawText: raw.rawText ?? raw.raw_text ?? null,
    ocrStatus: raw.ocrStatus ?? raw.ocr_status ?? 'pending',
    embedStatus: raw.embedStatus ?? raw.embed_status ?? 'pending',
    pageCount: raw.pageCount ?? raw.page_count ?? null,
    processingError: raw.processingError ?? raw.processing_error ?? null,
    updatedAt: normalizeIsoDate(raw.updatedAt ?? raw.updated_at),
    readOnlyReason: raw.readOnlyReason ?? null,
  };
}

export interface ExtractedDocumentApiError {
  message: string;
  status?: number;
  currentVersion?: number;
}

export function extractDocumentApiError(
  error: unknown,
  fallback = 'Có lỗi xảy ra khi thao tác với tài liệu. Vui lòng thử lại.',
): ExtractedDocumentApiError {
  if (!error || typeof error !== 'object') {
    return { message: fallback };
  }

  const errObj = error as {
    response?: {
      status?: number;
      data?: {
        message?: string | string[];
        error?: string;
        currentVersion?: number;
      };
    };
    message?: string;
  };

  const status = errObj.response?.status;
  const rawMessage = errObj.response?.data?.message;
  const message = Array.isArray(rawMessage)
    ? rawMessage.join(', ')
    : rawMessage || errObj.response?.data?.error || errObj.message || fallback;

  return {
    message,
    status,
    currentVersion:
      typeof errObj.response?.data?.currentVersion === 'number'
        ? errObj.response.data.currentVersion
        : undefined,
  };
}

export const documentsApi = {
  getByConversationId: async (conversationId: string): Promise<DocumentItem[]> => {
    const res = await axiosClient.get<DocumentItem[]>(`/conversations/${conversationId}/documents`);
    return Array.isArray(res.data) ? res.data.map(mapDocumentItem) : [];
  },

  getById: async (documentId: string): Promise<DocumentItem> => {
    const res = await axiosClient.get<DocumentItem>(`/documents/${documentId}`);
    return mapDocumentItem(res.data);
  },

  getContent: async (documentId: string): Promise<DocumentContentData> => {
    const res = await axiosClient.get<RawDocumentContentPayload>(`/documents/${documentId}/content`);
    return mapDocumentContent(res.data);
  },

  updateContent: async (
    documentId: string,
    payload: UpdateDocumentContentRequest,
  ): Promise<UpdateDocumentContentResponse> => {
    const res = await axiosClient.put<RawUpdateDocumentContentPayload>(
      `/documents/${documentId}/content`,
      payload,
    );
    return mapUpdateDocumentContent(res.data);
  },

  initUpload: async (data: InitUploadRequest): Promise<InitUploadResponse> => {
    const res = await axiosClient.post<InitUploadResponse>('/documents/init-upload', data);
    return res.data;
  },

  uploadToR2: async (
    uploadUrl: string,
    file: File | Blob,
    onProgress?: (percent: number) => void,
    contentType?: string,
  ): Promise<void> => {
    const inferredType = file instanceof File ? file.type : '';
    // Tải trực tiếp lên Cloudflare R2 qua Presigned PUT URL không qua Proxy
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': contentType || inferredType || 'application/octet-stream',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress?.(percent);
        }
      },
    });
  },

  completeUpload: async (
    documentId: string,
    data: CompleteUploadRequest,
  ): Promise<DocumentItem> => {
    const res = await axiosClient.post<DocumentItem>(`/documents/${documentId}/complete`, data);
    return mapDocumentItem(res.data);
  },

  importGoogleDoc: async (payload: ImportGoogleDocRequest): Promise<DocumentItem> => {
    const res = await axiosClient.post<DocumentItem>('/documents/import-google-doc', payload);
    return mapDocumentItem(res.data);
  },

  getPreview: async (documentId: string): Promise<DocumentPreviewData> => {
    const res = await axiosClient.get<RawDocumentPreviewPayload>(
      `/documents/${documentId}/preview`,
    );
    return mapDocumentPreview(res.data);
  },

  getDownloadUrl: async (documentId: string): Promise<{ downloadUrl: string }> => {
    const res = await axiosClient.get<{ downloadUrl: string }>(`/documents/${documentId}/download`);
    return res.data;
  },

  getViewUrl: async (documentId: string): Promise<{ downloadUrl: string }> => {
    const res = await axiosClient.get<{ downloadUrl: string }>(
      `/documents/${documentId}/download?inline=true`,
    );
    return res.data;
  },

  fetchDocumentBlob: async (
    signedUrl: string,
    mimeType: string,
    signal?: AbortSignal,
  ): Promise<Blob> => {
    const response = await fetch(signedUrl, { signal });
    if (!response.ok) {
      throw new Error(`Không thể tải nội dung tệp từ bộ nhớ (${response.status}).`);
    }
    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    if (contentType.startsWith('text/html')) {
      throw new Error('Phản hồi tải tệp trả về HTML không hợp lệ thay vì dữ liệu nhị phân.');
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Blob([arrayBuffer], { type: mimeType });
  },

  getOverwriteUrl: async (
    documentId: string,
    payload?: OverwriteVersionRequest,
  ): Promise<{ uploadUrl: string }> => {
    const res = await axiosClient.post<{ uploadUrl: string }>(
      `/documents/${documentId}/overwrite-url`,
      payload ?? {},
    );
    return res.data;
  },

  completeOverwrite: async (
    documentId: string,
    payload?: OverwriteVersionRequest,
  ): Promise<DocumentItem> => {
    const res = await axiosClient.post<DocumentItem>(
      `/documents/${documentId}/overwrite-complete`,
      payload ?? {},
    );
    return mapDocumentItem(res.data);
  },

  delete: async (documentId: string): Promise<{ success: boolean; message: string }> => {
    const res = await axiosClient.delete<{ success: boolean; message: string }>(
      `/documents/${documentId}`,
    );
    return res.data;
  },
};
