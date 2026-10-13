"use client";

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { documentsApi } from '@/services/documents.api';
import { DocumentItem, UploadProgressItem } from '@/types';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export function useDocuments(conversationId?: string | null) {
  const [uploadQueue, setUploadQueue] = useState<Record<string, UploadProgressItem>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Kiểm tra xem có document nào đang trong tiến trình xử lý ngầm (ocr/embed) hay không
  const shouldPoll = useCallback((docs?: DocumentItem[]) => {
    if (!docs || docs.length === 0) return false;
    return docs.some(
      (d) =>
        d.ocr_status === 'pending' ||
        d.ocr_status === 'processing' ||
        (d.ocr_status === 'done' &&
          (d.embed_status === 'pending' || d.embed_status === 'processing'))
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

  const uploadFile = async (file: File) => {
    if (!conversationId) return;

    // Validate phía Client
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`Tệp "${file.name}" vượt quá dung lượng tối đa 50MB.`);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(
        `Định dạng tệp "${file.name}" không được hỗ trợ. Vui lòng tải lên PDF, PNG, JPG, hoặc WEBP.`
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
        mimeType: file.type,
      });

      // Bước 2: Tải trực tiếp lên Cloudflare R2
      await documentsApi.uploadToR2(initRes.uploadUrl, file, (percent) => {
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
      });

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
        mimeType: file.type,
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
    } catch (err: any) {
      const errText =
        err?.response?.data?.message || err?.message || 'Lỗi không xác định khi tải tệp lên';
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
      } catch (err: any) {
        setErrorMessage(err.message);
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
    } catch (err: any) {
      // Revert lại nếu có lỗi
      mutate(previous, { revalidate: true });
      const errText = err?.response?.data?.message || 'Lỗi khi xóa tài liệu';
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
    } catch (err: any) {
      const errText = err?.response?.data?.message || 'Lỗi khi lấy liên kết tải tệp';
      setErrorMessage(errText);
    }
  };

  return {
    documents: data || [],
    isLoading,
    error,
    uploadQueue: Object.values(uploadQueue),
    isUploading: Object.keys(uploadQueue).length > 0,
    errorMessage,
    clearError,
    uploadFiles,
    deleteDocument,
    downloadDocument,
    refresh: mutate,
  };
}
