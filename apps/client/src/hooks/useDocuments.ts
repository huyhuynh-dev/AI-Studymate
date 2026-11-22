"use client";

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { documentsApi, extractDocumentApiError } from '@/services/documents.api';
import { DocumentItem, UploadProgressItem } from '@/types';

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'application/csv',
  'text/markdown',
  'text/x-markdown',
  'text/html',
  'text/plain',
  'application/json',
  'text/json',
  'application/xml',
  'text/xml',
  'application/yaml',
  'application/x-yaml',
  'text/yaml',
  'text/x-yaml',
  'application/toml',
  'text/toml',
  'text/x-toml',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

const EXTENSION_TO_MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
  md: 'text/markdown',
  markdown: 'text/markdown',
  html: 'text/html',
  htm: 'text/html',
  txt: 'text/plain',
  log: 'text/plain',
  json: 'application/json',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  toml: 'application/toml',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export function resolveFileMimeType(file: File): string {
  const rawType = file.type?.trim().toLowerCase() || '';
  const ext = file.name.split('.').pop()?.trim().toLowerCase() || '';
  if (
    rawType &&
    rawType !== 'application/octet-stream' &&
    !(rawType === 'text/plain' && ext !== 'txt' && ext !== 'log') &&
    (ALLOWED_MIME_TYPES as readonly string[]).includes(rawType)
  ) {
    return rawType;
  }

  return EXTENSION_TO_MIME_MAP[ext] || rawType;
}

export function useDocuments(conversationId?: string | null) {
  const [uploadQueue, setUploadQueue] = useState<Record<string, UploadProgressItem>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Kiểm tra xem có document nào đang trong tiến trình xử lý ngầm (ocr/embed/reindex) hay không
  const shouldPoll = useCallback((docs?: DocumentItem[]) => {
    if (!docs || docs.length === 0) return false;
    return docs.some(
      (d) =>
        d.ocr_status === 'pending' ||
        d.ocr_status === 'processing' ||
        (d.ocr_status === 'done' &&
          (d.embed_status === 'pending' ||
            d.embed_status === 'processing' ||
            (d.embed_status !== 'failed' &&
              (d.content_version ?? 1) > (d.indexed_version ?? 0))))
    );
  }, []);

  const { data, error, isLoading, mutate } = useSWR<DocumentItem[]>(
    conversationId ? `/conversations/${conversationId}/documents` : null,
    () => documentsApi.getByConversationId(conversationId!),
    {
      refreshInterval: (latestData) => (shouldPoll(latestData) ? 3000 : 0),
      revalidateOnFocus: true,
    }
  );

  const clearError = () => setErrorMessage(null);

  const uploadFile = async (
    file: File,
    onProgress?: (percent: number) => void
  ) => {
    if (!conversationId) return;

    // Validate phía Client
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`Tệp "${file.name}" vượt quá dung lượng tối đa 50MB.`);
    }

    const resolvedMimeType = resolveFileMimeType(file);
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(resolvedMimeType)) {
      throw new Error(
        `Định dạng tệp "${file.name}" không được hỗ trợ. Chỉ chấp nhận PDF, Word, Excel, PowerPoint, Markdown, HTML, TXT, LOG, JSON, XML, YAML, CSV, TOML và PNG, JPG, WEBP.`
      );
    }

    const tempId = `${Date.now()}-${file.name}`;
    setUploadQueue((prev) => ({
      ...prev,
      [tempId]: {
        id: tempId,
        fileName: file.name,
        fileSize: file.size,
        progress: 0,
        status: 'uploading',
      },
    }));

    try {
      // Bước 1: Khởi tạo tải lên (Init Upload)
      const initRes = await documentsApi.initUpload({
        conversationId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: resolvedMimeType,
      });

      // Bước 2: Tải trực tiếp lên Cloudflare R2
      await documentsApi.uploadToR2(
        initRes.uploadUrl,
        file,
        (percent) => {
          onProgress?.(percent);
          setUploadQueue((prev) => {
            if (!prev[tempId]) return prev;
            return {
              ...prev,
              [tempId]: {
                ...prev[tempId],
                progress: percent,
              },
            };
          });
        },
        resolvedMimeType
      );

      // Đánh dấu chuyển sang bước kiểm chứng
      setUploadQueue((prev) => {
        if (!prev[tempId]) return prev;
        return {
          ...prev,
          [tempId]: {
            ...prev[tempId],
            progress: 100,
            status: 'verifying',
          },
        };
      });

      // Bước 3: Xác nhận hoàn tất tải lên (Complete Upload)
      const newDoc = await documentsApi.completeUpload(initRes.documentId, {
        conversationId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: resolvedMimeType,
        storageKey: initRes.storageKey,
      });

      // Cập nhật danh sách tài liệu ngay lập tức
      mutate((current) => (current ? [newDoc, ...current] : [newDoc]), {
        revalidate: true,
      });

      // Đánh dấu thành công và xóa khỏi hàng đợi tải sau 1 giây
      setUploadQueue((prev) => {
        if (!prev[tempId]) return prev;
        return {
          ...prev,
          [tempId]: {
            ...prev[tempId],
            status: 'completed',
          },
        };
      });

      setTimeout(() => {
        setUploadQueue((prev) => {
          const next = { ...prev };
          delete next[tempId];
          return next;
        });
      }, 1000);

      return newDoc;
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      const errText =
        axiosErr?.response?.data?.message ||
        axiosErr?.message ||
        'Lỗi không xác định khi tải tệp lên';
      setUploadQueue((prev) => {
        if (!prev[tempId]) return prev;
        return {
          ...prev,
          [tempId]: {
            ...prev[tempId],
            status: 'error',
            errorMessage: errText,
          },
        };
      });
      throw new Error(errText);
    }
  };

  const uploadFiles = async (files: File[]) => {
    clearError();
    for (const file of files) {
      try {
        await uploadFile(file);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi tải tệp lên';
        setErrorMessage(message);
      }
    }
  };

  const deleteDocument = async (documentId: string) => {
    // Optimistic delete
    const previous = data;
    mutate(
      (current) => current?.filter((d) => d.id !== documentId) || [],
      { revalidate: false }
    );

    try {
      await documentsApi.delete(documentId);
      mutate();
    } catch (err: unknown) {
      // Revert lại nếu có lỗi
      mutate(previous, { revalidate: true });
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const errText = axiosErr?.response?.data?.message || 'Lỗi khi xóa tài liệu';
      setErrorMessage(errText);
      throw err;
    }
  };

  const downloadDocument = async (documentId: string, fileName: string) => {
    try {
      const { downloadUrl } = await documentsApi.getDownloadUrl(documentId);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', fileName);
      link.setAttribute('target', '_blank');
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const errText = axiosErr?.response?.data?.message || 'Lỗi khi lấy liên kết tải tệp';
      setErrorMessage(errText);
    }
  };

  const updateDocumentInCache = useCallback(
    (updatedDoc: DocumentItem) => {
      mutate(
        (current) => {
          if (!current) return [updatedDoc];
          return current.map((doc) =>
            doc.id === updatedDoc.id ? { ...doc, ...updatedDoc } : doc
          );
        },
        { revalidate: false }
      );
    },
    [mutate]
  );

  const importGoogleDoc = useCallback(
    async (url: string, fileName?: string): Promise<DocumentItem> => {
      if (!conversationId) {
        const msg = 'Chưa chọn cuộc trò chuyện để nhập tài liệu.';
        setErrorMessage(msg);
        throw new Error(msg);
      }
      setErrorMessage(null);
      try {
        const importedDoc = await documentsApi.importGoogleDoc({
          conversationId,
          url,
          fileName: fileName?.trim() || undefined,
        });
        mutate(
          (current) => [
            importedDoc,
            ...(current ?? []).filter((d) => d.id !== importedDoc.id),
          ],
          { revalidate: true },
        );
        return importedDoc;
      } catch (err: unknown) {
        const { message } = extractDocumentApiError(
          err,
          'Không thể nhập tài liệu từ Google Docs.',
        );
        setErrorMessage(message);
        throw err;
      }
    },
    [conversationId, mutate],
  );

  return {
    documents: data || [],
    isLoading,
    error,
    uploadQueue: Object.values(uploadQueue),
    isUploading: Object.keys(uploadQueue).length > 0,
    errorMessage,
    clearError,
    uploadFile,
    uploadFiles,
    importGoogleDoc,
    deleteDocument,
    downloadDocument,
    updateDocumentInCache,
    refresh: mutate,
  };
}
