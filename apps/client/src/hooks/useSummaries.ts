"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { summariesApi } from '@/services/summaries.api';
import {
  SummaryItem,
  CreateSummaryRequest,
  UpdateSummaryRequest,
} from '@/types';

export type AutoSaveStatus = 'saved' | 'saving' | 'unsaved';

export function useSummaries(conversationId?: string | null) {
  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('saved');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: summaries = [], error, isLoading, mutate } = useSWR<SummaryItem[]>(
    conversationId ? `/conversations/${conversationId}/summaries` : null,
    () => summariesApi.getByConversationId(conversationId!),
    {
      revalidateOnFocus: false,
    }
  );

  // Tự động chọn summary đầu tiên nếu chưa có summary nào được chọn
  useEffect(() => {
    if (summaries.length > 0) {
      if (!selectedSummaryId || !summaries.some((s) => s.id === selectedSummaryId)) {
        setSelectedSummaryId(summaries[0].id);
      }
    } else {
      setSelectedSummaryId(null);
    }
  }, [summaries, selectedSummaryId]);

  const activeSummary = summaries.find((s) => s.id === selectedSummaryId) || summaries[0] || null;

  const clearError = () => setErrorMessage(null);

  /**
   * Tạo bản tóm tắt mới qua AI
   */
  const createSummary = async (request: CreateSummaryRequest): Promise<SummaryItem | undefined> => {
    if (!conversationId) return;
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const created = await summariesApi.create(conversationId, request);
      await mutate([created, ...summaries], false);
      setSelectedSummaryId(created.id);
      setAutoSaveStatus('saved');
      return created;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Không thể tạo bản tóm tắt AI';
      setErrorMessage(msg);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Tự động lưu sau 1.5 giây dừng gõ (Debounced Auto-save)
   */
  const autoSaveContent = useCallback(
    (summaryId: string, contentJson: any[], title?: string) => {
      setAutoSaveStatus('unsaved');

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        setAutoSaveStatus('saving');
        try {
          const updatePayload: UpdateSummaryRequest = {
            content_json: contentJson,
          };
          if (title !== undefined) {
            updatePayload.title = title;
          }

          const updated = await summariesApi.update(summaryId, updatePayload);

          // Cập nhật ngầm vào SWR cache
          await mutate(
            (prev) => prev?.map((item) => (item.id === summaryId ? updated : item)),
            false
          );

          setAutoSaveStatus('saved');
        } catch (err: any) {
          setAutoSaveStatus('unsaved');
          console.error('Lỗi tự động lưu tóm tắt:', err);
        }
      }, 1500);
    },
    [mutate]
  );

  /**
   * Tinh chỉnh tóm tắt theo chỉ dẫn người học (Yêu cầu AI chỉnh lại)
   */
  const refineSummary = async (instruction: string): Promise<SummaryItem | undefined> => {
    if (!activeSummary) return;
    setIsRefining(true);
    setErrorMessage(null);

    try {
      const updated = await summariesApi.refine(activeSummary.id, { instruction });
      await mutate(
        (prev) => prev?.map((item) => (item.id === activeSummary.id ? updated : item)),
        false
      );
      setAutoSaveStatus('saved');
      return updated;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Không thể tinh chỉnh bản tóm tắt';
      setErrorMessage(msg);
      throw err;
    } finally {
      setIsRefining(false);
    }
  };

  /**
   * Xuất tóm tắt ra PDF và kích hoạt tải về trên trình duyệt
   */
  const exportPdf = async (): Promise<string | undefined> => {
    if (!activeSummary) return;
    setIsExportingPdf(true);
    setErrorMessage(null);

    try {
      const { downloadUrl } = await summariesApi.exportPdf(activeSummary.id);
      if (downloadUrl) {
        // Tải file tự động
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.download = `${activeSummary.title || 'Tom-tat-tai-lieu'}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      }
      return downloadUrl;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Không thể xuất file PDF';
      setErrorMessage(msg);
      throw err;
    } finally {
      setIsExportingPdf(false);
    }
  };

  /**
   * Đổi tên bản tóm tắt
   */
  const renameSummary = async (summaryId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      const updated = await summariesApi.update(summaryId, { title: newTitle.trim() });
      await mutate(
        (prev) => prev?.map((item) => (item.id === summaryId ? updated : item)),
        false
      );
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Không thể đổi tên tóm tắt';
      setErrorMessage(msg);
    }
  };

  /**
   * Xóa bản tóm tắt
   */
  const deleteSummary = async (summaryId: string) => {
    try {
      await summariesApi.delete(summaryId);
      const remaining = summaries.filter((s) => s.id !== summaryId);
      await mutate(remaining, false);
      if (selectedSummaryId === summaryId) {
        setSelectedSummaryId(remaining[0]?.id || null);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Không thể xóa bản tóm tắt';
      setErrorMessage(msg);
    }
  };

  // Dọn dẹp timer khi unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    summaries,
    activeSummary,
    selectedSummaryId,
    setSelectedSummaryId,
    isLoading,
    isGenerating,
    isRefining,
    isExportingPdf,
    autoSaveStatus,
    errorMessage,
    clearError,
    createSummary,
    autoSaveContent,
    refineSummary,
    exportPdf,
    renameSummary,
    deleteSummary,
  };
}
