import axios from 'axios';
import { axiosClient } from '@/lib/axios.client';
import type {
  CompleteNoteMediaUploadRequest,
  CompleteNoteMediaUploadResponse,
  CreateManualNoteRequest,
  CreateSummaryRequest,
  InitNoteMediaUploadRequest,
  InitNoteMediaUploadResponse,
  RefineSummaryRequest,
  ResolveNoteMediaUrlsResponse,
  SummaryDocumentRef,
  SummaryItem,
  UpdateSummaryRequest,
} from '@/types';

interface RawSummaryDocumentResponse {
  id: string;
  file_name: string;
  mime_type: string;
}

interface RawSummaryResponse {
  id: string;
  conversation_id: string;
  document_id?: string | null;
  title?: string | null;
  content_json?: unknown;
  pdf_storage_key?: string | null;
  created_at?: string | Date;
  updated_at?: string | Date;
  document?: RawSummaryDocumentResponse | null;
}

function toIso(value: string | Date | undefined): string {
  if (!value) return new Date().toISOString();
  return typeof value === 'string' ? value : value.toISOString();
}

function mapSummaryDocument(
  raw: RawSummaryDocumentResponse | null | undefined,
): SummaryDocumentRef | null {
  if (!raw) return null;
  return {
    id: raw.id,
    fileName: raw.file_name,
    mimeType: raw.mime_type,
  };
}

/**
 * Chuyển đổi bản ghi Summary/Note từ snake_case của Backend sang camelCase cho UI Client.
 */
function mapSummary(raw: RawSummaryResponse): SummaryItem {
  return {
    id: raw.id,
    conversationId: raw.conversation_id,
    documentId: raw.document_id ?? null,
    title: typeof raw.title === 'string' ? raw.title : '',
    contentJson: Array.isArray(raw.content_json) ? raw.content_json : [],
    pdfStorageKey: raw.pdf_storage_key ?? null,
    createdAt: toIso(raw.created_at),
    updatedAt: toIso(raw.updated_at),
    document: raw.document !== undefined ? mapSummaryDocument(raw.document) : undefined,
  };
}

export const summariesApi = {
  getByConversationId: async (conversationId: string): Promise<SummaryItem[]> => {
    const res = await axiosClient.get<RawSummaryResponse[]>(
      `/conversations/${conversationId}/summaries`,
    );
    return Array.isArray(res.data) ? res.data.map(mapSummary) : [];
  },

  getById: async (summaryId: string): Promise<SummaryItem> => {
    const res = await axiosClient.get<RawSummaryResponse>(`/summaries/${summaryId}`);
    return mapSummary(res.data);
  },

  create: async (
    conversationId: string,
    data: CreateSummaryRequest,
  ): Promise<SummaryItem> => {
    const res = await axiosClient.post<RawSummaryResponse>(
      `/conversations/${conversationId}/summaries`,
      data,
    );
    return mapSummary(res.data);
  },

  createManual: async (
    conversationId: string,
    data?: CreateManualNoteRequest,
  ): Promise<SummaryItem> => {
    const payload: { title?: string; content_json?: unknown[] } = {};
    if (data?.title !== undefined) {
      payload.title = data.title;
    }
    if (data?.contentJson !== undefined) {
      payload.content_json = data.contentJson;
    }

    const res = await axiosClient.post<RawSummaryResponse>(
      `/conversations/${conversationId}/summaries/manual`,
      payload,
    );
    return mapSummary(res.data);
  },

  update: async (
    summaryId: string,
    data: UpdateSummaryRequest,
  ): Promise<SummaryItem> => {
    const payload: { title?: string; content_json?: unknown[] } = {};
    if (data.title !== undefined) {
      payload.title = data.title;
    }
    if (data.contentJson !== undefined) {
      payload.content_json = data.contentJson;
    }

    const res = await axiosClient.patch<RawSummaryResponse>(
      `/summaries/${summaryId}`,
      payload,
    );
    return mapSummary(res.data);
  },

  refine: async (
    summaryId: string,
    data: RefineSummaryRequest,
  ): Promise<SummaryItem> => {
    const res = await axiosClient.post<RawSummaryResponse>(
      `/summaries/${summaryId}/refine`,
      data,
    );
    return mapSummary(res.data);
  },

  exportPdf: async (summaryId: string): Promise<{ downloadUrl: string }> => {
    const res = await axiosClient.post<{ downloadUrl: string }>(
      `/summaries/${summaryId}/export-pdf`,
    );
    return res.data;
  },

  delete: async (
    summaryId: string,
  ): Promise<{ success: boolean; message: string }> => {
    const res = await axiosClient.delete<{ success: boolean; message: string }>(
      `/summaries/${summaryId}`,
    );
    return res.data;
  },

  initMediaUpload: async (
    summaryId: string,
    data: InitNoteMediaUploadRequest,
  ): Promise<InitNoteMediaUploadResponse> => {
    const payload: {
      fileName: string;
      fileSize: number;
      mimeType: string;
      mediaKind?: InitNoteMediaUploadRequest['mediaKind'];
    } = {
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
    };
    if (data.mediaKind !== undefined) {
      payload.mediaKind = data.mediaKind;
    }

    const res = await axiosClient.post<InitNoteMediaUploadResponse>(
      `/summaries/${summaryId}/media/init-upload`,
      payload,
    );
    return res.data;
  },

  uploadMediaToR2: async (
    uploadUrl: string,
    file: File,
    contentType: string,
  ): Promise<void> => {
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': contentType || file.type || 'application/octet-stream',
      },
    });
  },

  completeMediaUpload: async (
    summaryId: string,
    data: CompleteNoteMediaUploadRequest,
  ): Promise<CompleteNoteMediaUploadResponse> => {
    const payload: {
      storageKey: string;
      fileName: string;
      mediaKind?: CompleteNoteMediaUploadRequest['mediaKind'];
    } = {
      storageKey: data.storageKey,
      fileName: data.fileName,
    };
    if (data.mediaKind !== undefined) {
      payload.mediaKind = data.mediaKind;
    }

    const res = await axiosClient.post<CompleteNoteMediaUploadResponse>(
      `/summaries/${summaryId}/media/complete-upload`,
      payload,
    );
    return res.data;
  },

  resolveMediaUrls: async (
    summaryId: string,
    mediaUris: string[],
    download?: boolean,
  ): Promise<ResolveNoteMediaUrlsResponse> => {
    const payload: { mediaUris: string[]; download?: boolean } = { mediaUris };
    if (download !== undefined) {
      payload.download = download;
    }

    const res = await axiosClient.post<ResolveNoteMediaUrlsResponse>(
      `/summaries/${summaryId}/media/resolve-urls`,
      payload,
    );
    return res.data;
  },
};
