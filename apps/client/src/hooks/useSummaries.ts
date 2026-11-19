"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { summariesApi } from '@/services/summaries.api';
import { extractApiErrorMessage } from '@/services/subjects.api';
import type {
  CreateManualNoteRequest,
  CreateSummaryRequest,
  SummaryItem,
  UpdateSummaryRequest,
} from '@/types';

export type AutoSaveStatus = 'saved' | 'saving' | 'unsaved';

export interface NoteAutoSavePatch {
  title?: string;
  contentJson?: unknown[];
}

interface PendingNoteSave extends NoteAutoSavePatch {
  summaryId: string;
}

export function useSummaries(conversationId?: string | null) {
  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('saved');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Lưu thay đổi đang chờ debounce để gộp request và flush ngay khi chuyển ghi chú / rời trang
  const pendingSaveRef = useRef<PendingNoteSave | null>(null);

  const { data: summaries = [], isLoading, mutate } = useSWR<SummaryItem[]>(
    conversationId ? `/conversations/${conversationId}/summaries` : null,
    () => summariesApi.getByConversationId(conversationId!),
    {
      revalidateOnFocus: false,
    },
  );

  // Suy xuất trực tiếp khi render thay vì đồng bộ bằng useEffect
  const activeSummary = useMemo(() => {
    if (summaries.length === 0) return null;
    if (selectedSummaryId) {
      const matched = summaries.find((item) => item.id === selectedSummaryId);
      if (matched) return matched;
    }
    return summaries[0];
  }, [summaries, selectedSummaryId]);

  const effectiveSelectedId = activeSummary?.id ?? null;

  const clearError = useCallback(() => setErrorMessage(null), []);

  const applyOptimisticPatch = useCallback(
    async (summaryId: string, patch: NoteAutoSavePatch) => {
      const nowIso = new Date().toISOString();
      await mutate(
        (prev) =>
          prev?.map((item) =>
            item.id === summaryId
              ? {
                  ...item,
                  ...(patch.title !== undefined ? { title: patch.title } : {}),
                  ...(patch.contentJson !== undefined
                    ? { contentJson: patch.contentJson }
                    : {}),
                  updatedAt: nowIso,
                }
              : item,
          ),
        false,
      );
    },
    [mutate],
  );

  const persistPatch = useCallback(
    async (pending: PendingNoteSave): Promise<SummaryItem | undefined> => {
      const payload: UpdateSummaryRequest = {};
      if (pending.title !== undefined) {
        payload.title = pending.title;
      }
      if (pending.contentJson !== undefined) {
        payload.contentJson = pending.contentJson;
      }
      if (payload.title === undefined && payload.contentJson === undefined) {
        return undefined;
      }

      const updated = await summariesApi.update(pending.summaryId, payload);
      await mutate(
        (prev) =>
          prev?.map((item) => {
            if (item.id !== pending.summaryId) return item;
            const newerPending = pendingSaveRef.current;
            if (newerPending?.summaryId === pending.summaryId) {
              return {
                ...updated,
                ...(newerPending.title !== undefined
                  ? { title: newerPending.title }
                  : {}),
                ...(newerPending.contentJson !== undefined
                  ? { contentJson: newerPending.contentJson }
                  : {}),
              };
            }
            return updated;
          }),
        false,
      );
      return updated;
    },
    [mutate],
  );

  /**
   * Đẩy ngay thay đổi còn chờ debounce lên máy chủ (dùng trước khi chuyển trang / xuất PDF / quay lại danh sách)
   */
  const flushPendingSave = useCallback(async (): Promise<void> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const pending = pendingSaveRef.current;
    if (!pending) return;

    pendingSaveRef.current = null;
    await applyOptimisticPatch(pending.summaryId, pending);
    setAutoSaveStatus('saving');

    try {
      await persistPatch(pending);
      if (!pendingSaveRef.current) {
        setAutoSaveStatus('saved');
      }
    } catch (err: unknown) {
      setAutoSaveStatus('unsaved');
      console.error('Lỗi tự động lưu ghi chú:', err);
    }
  }, [applyOptimisticPatch, persistPatch]);

  /**
   * Tạo trang ghi chú thủ công mới (trống hoặc có nội dung ban đầu)
   */
  const createManualNote = async (
    request?: CreateManualNoteRequest,
  ): Promise<SummaryItem | undefined> => {
    if (!conversationId) return undefined;
    setIsCreatingNote(true);
    setErrorMessage(null);

    try {
      await flushPendingSave();
      const created = await summariesApi.createManual(conversationId, request);
      await mutate((prev) => [created, ...(prev ?? [])], false);
      setSelectedSummaryId(created.id);
      setAutoSaveStatus('saved');
      return created;
    } catch (err: unknown) {
      setErrorMessage(extractApiErrorMessage(err, 'Không thể tạo ghi chú mới'));
      throw err;
    } finally {
      setIsCreatingNote(false);
    }
  };

  /**
   * Tạo bản tóm tắt mới qua AI
   */
  const createSummary = async (
    request: CreateSummaryRequest,
  ): Promise<SummaryItem | undefined> => {
    if (!conversationId) return undefined;
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      await flushPendingSave();
      const created = await summariesApi.create(conversationId, request);
      await mutate((prev) => [created, ...(prev ?? [])], false);
      setSelectedSummaryId(created.id);
      setAutoSaveStatus('saved');
      return created;
    } catch (err: unknown) {
      setErrorMessage(extractApiErrorMessage(err, 'Không thể tạo bản tóm tắt AI'));
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Tự động lưu tiêu đề & nội dung ghi chú sau 1.5 giây dừng gõ (Debounced Auto-save)
   */
  const autoSaveNote = useCallback(
    (summaryId: string, patch: NoteAutoSavePatch) => {
      setAutoSaveStatus('unsaved');

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      const existing = pendingSaveRef.current;
      if (existing && existing.summaryId !== summaryId) {
        pendingSaveRef.current = null;
        void applyOptimisticPatch(existing.summaryId, existing);
        void persistPatch(existing).catch((err: unknown) => {
          console.error('Lỗi tự động lưu ghi chú trước đó:', err);
        });
        pendingSaveRef.current = { summaryId, ...patch };
      } else {
        pendingSaveRef.current = {
          summaryId,
          ...(existing?.title !== undefined ? { title: existing.title } : {}),
          ...(existing?.contentJson !== undefined
            ? { contentJson: existing.contentJson }
            : {}),
          ...patch,
        };
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        const pending = pendingSaveRef.current;
        if (!pending) return;

        pendingSaveRef.current = null;
        setAutoSaveStatus('saving');

        void persistPatch(pending)
          .then(() => {
            if (!pendingSaveRef.current) {
              setAutoSaveStatus('saved');
            }
          })
          .catch((err: unknown) => {
            setAutoSaveStatus('unsaved');
            console.error('Lỗi tự động lưu ghi chú:', err);
          });
      }, 1500);
    },
    [applyOptimisticPatch, persistPatch],
  );

  /**
   * Tinh chỉnh ghi chú theo chỉ dẫn người học (Yêu cầu AI chỉnh lại)
   */
  const refineSummary = async (
    instruction: string,
  ): Promise<SummaryItem | undefined> => {
    if (!activeSummary) return undefined;
    setIsRefining(true);
    setErrorMessage(null);

    try {
      const updated = await summariesApi.refine(activeSummary.id, { instruction });
      await mutate(
        (prev) =>
          prev?.map((item) => (item.id === activeSummary.id ? updated : item)),
        false,
      );
      setAutoSaveStatus('saved');
      return updated;
    } catch (err: unknown) {
      setErrorMessage(extractApiErrorMessage(err, 'Không thể tinh chỉnh ghi chú'));
      throw err;
    } finally {
      setIsRefining(false);
    }
  };

  /**
   * Xuất ghi chú ra PDF và kích hoạt tải về trên trình duyệt
   */
  const exportPdf = async (
    targetSummaryId?: string,
  ): Promise<string | undefined> => {
    const target = targetSummaryId
      ? summaries.find((item) => item.id === targetSummaryId)
      : activeSummary;
    if (!target) return undefined;

    setIsExportingPdf(true);
    setErrorMessage(null);

    try {
      if (pendingSaveRef.current?.summaryId === target.id) {
        await flushPendingSave();
      }

      const { downloadUrl } = await summariesApi.exportPdf(target.id);
      if (downloadUrl) {
        const baseName = target.title.trim() || 'Ghi-chu-hoc-tap';
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.download = `${baseName}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      }
      return downloadUrl;
    } catch (err: unknown) {
      setErrorMessage(extractApiErrorMessage(err, 'Không thể xuất file PDF'));
      throw err;
    } finally {
      setIsExportingPdf(false);
    }
  };

  /**
   * Đổi tên ghi chú
   */
  const renameSummary = async (summaryId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    if (pendingSaveRef.current?.summaryId === summaryId) {
      if (pendingSaveRef.current.contentJson !== undefined) {
        pendingSaveRef.current = {
          summaryId,
          contentJson: pendingSaveRef.current.contentJson,
        };
      } else {
        pendingSaveRef.current = null;
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
      }
    }

    try {
      const updated = await summariesApi.update(summaryId, { title: trimmed });
      await mutate(
        (prev) => prev?.map((item) => (item.id === summaryId ? updated : item)),
        false,
      );
    } catch (err: unknown) {
      setErrorMessage(extractApiErrorMessage(err, 'Không thể đổi tên ghi chú'));
    }
  };

  /**
   * Xóa ghi chú
   */
  const deleteSummary = async (summaryId: string) => {
    if (pendingSaveRef.current?.summaryId === summaryId) {
      pendingSaveRef.current = null;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    }

    try {
      await summariesApi.delete(summaryId);
      const remaining = summaries.filter((item) => item.id !== summaryId);
      await mutate(
        (prev) => (prev ?? []).filter((item) => item.id !== summaryId),
        false,
      );
      if (effectiveSelectedId === summaryId) {
        setSelectedSummaryId(remaining[0]?.id ?? null);
      }
    } catch (err: unknown) {
      setErrorMessage(extractApiErrorMessage(err, 'Không thể xóa ghi chú'));
    }
  };

  // Dọn dẹp timer và lưu thay đổi còn dang dở khi unmount
  useEffect(() => {
    return () => {
      const pending = pendingSaveRef.current;
      if (pending) {
        pendingSaveRef.current = null;
        const payload: UpdateSummaryRequest = {};
        if (pending.title !== undefined) {
          payload.title = pending.title;
        }
        if (pending.contentJson !== undefined) {
          payload.contentJson = pending.contentJson;
        }
        if (payload.title !== undefined || payload.contentJson !== undefined) {
          void summariesApi.update(pending.summaryId, payload).catch((err: unknown) => {
            console.error('Lỗi tự động lưu ghi chú khi rời trang:', err);
          });
        }
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  return {
    summaries,
    activeSummary,
    selectedSummaryId: effectiveSelectedId,
    setSelectedSummaryId,
    isLoading,
    isGenerating,
    isCreatingNote,
    isRefining,
    isExportingPdf,
    autoSaveStatus,
    errorMessage,
    clearError,
    createManualNote,
    createSummary,
    autoSaveNote,
    flushPendingSave,
    refineSummary,
    exportPdf,
    renameSummary,
    deleteSummary,
  };
}
