"use client";

import { useCallback } from 'react';
import type { AxiosError } from 'axios';
import useSWR from 'swr';
import { analyticsApi } from '@/services/analytics.api';
import type {
  ConversationAnalyticsResponse,
  DocumentMasteryResponse,
  SubjectAnalyticsResponse,
} from '@/types';

function extractAnalyticsError(err: unknown, fallback: string): string {
  if (!err) return '';
  const axiosErr = err as AxiosError<{ message?: string | string[] }>;
  const serverMessage = axiosErr.response?.data?.message;
  if (Array.isArray(serverMessage) && serverMessage.length > 0) {
    return serverMessage[0];
  }
  if (typeof serverMessage === 'string' && serverMessage.trim()) {
    return serverMessage;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export function useConversationAnalytics(
  conversationId?: string | null,
  enabled = true,
  windowDays = 30
) {
  const swrKey =
    enabled && conversationId
      ? [`/analytics/conversations/${conversationId}`, windowDays]
      : null;

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<ConversationAnalyticsResponse>(
      swrKey,
      () =>
        analyticsApi.getConversationAnalytics(conversationId!, {
          windowDays,
        }),
      {
        revalidateOnFocus: false,
        keepPreviousData: true,
      }
    );

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    analytics: data ?? null,
    isLoading: Boolean(swrKey && isLoading && !data),
    isValidating,
    errorMessage: error
      ? extractAnalyticsError(error, 'Không thể tải dữ liệu phân tích phiên học')
      : null,
    refresh,
  };
}

export function useSubjectAnalytics(
  subjectId?: string | null,
  enabled = true,
  windowDays = 30
) {
  const swrKey =
    enabled && subjectId
      ? [`/analytics/subjects/${subjectId}`, windowDays]
      : null;

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<SubjectAnalyticsResponse>(
      swrKey,
      () =>
        analyticsApi.getSubjectAnalytics(subjectId!, {
          windowDays,
        }),
      {
        revalidateOnFocus: false,
        keepPreviousData: true,
      }
    );

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    analytics: data ?? null,
    isLoading: Boolean(swrKey && isLoading && !data),
    isValidating,
    errorMessage: error
      ? extractAnalyticsError(error, 'Không thể tải phân tích tổng hợp môn học')
      : null,
    refresh,
  };
}

export function useDocumentMastery(
  documentId?: string | null,
  enabled = true
) {
  const swrKey =
    enabled && documentId ? `/analytics/documents/${documentId}/mastery` : null;

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<DocumentMasteryResponse>(
      swrKey,
      () => analyticsApi.getDocumentMastery(documentId!),
      {
        revalidateOnFocus: false,
        keepPreviousData: true,
      }
    );

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    mastery: data ?? null,
    isLoading: Boolean(swrKey && isLoading && !data),
    isValidating,
    errorMessage: error
      ? extractAnalyticsError(error, 'Không thể tải bản đồ nhiệt mục lục tài liệu')
      : null,
    refresh,
  };
}
