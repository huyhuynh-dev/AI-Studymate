"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';
import type { DocumentItem, DocumentStatus } from '@/types';
import { documentsApi, extractDocumentApiError } from '@/services/documents.api';
import { useFocusMode } from '@/components/layout';
import { resolveDocumentEditorProfile } from './document-format-profiles';
import {
  MarkdownWysiwygCanvas,
} from './MarkdownWysiwygCanvas';
import {
  StructuredSourceCanvas,
  validateStructuredContent,
} from './StructuredSourceCanvas';
import { CitationEvidenceBanner } from './CitationEvidenceBanner';
import type {
  CitationResolutionTier,
  EditorCitationTarget,
  ProseMirrorCitationResolution,
  StructuredCitationResolution,
} from './text-anchor-resolver';

export interface DocumentTextEditorProps {
  document: DocumentItem;
  onClose: () => void;
  onDownload?: (documentId: string, fileName: string) => void;
  onDocumentUpdated?: (doc: DocumentItem) => void;
  compactReaderMode?: boolean;
  isExternalFullscreen?: boolean;
  onToggleExternalFullscreen?: () => void;
  citationTarget?: EditorCitationTarget | null;
  onCitationDismiss?: () => void;
  highlightSnippet?: string | null;
  onSnippetLocated?: () => void;
  className?: string;
}

const AUTO_SAVE_DEBOUNCE_MS = 2000;
const AI_SYNC_POLL_INTERVAL_MS = 2500;

export default function DocumentTextEditor({
  document,
  onClose,
  onDownload,
  onDocumentUpdated,
  compactReaderMode = false,
  isExternalFullscreen = false,
  onToggleExternalFullscreen,
  citationTarget,
  onCitationDismiss,
  highlightSnippet,
  onSnippetLocated,
  className = '',
}: DocumentTextEditorProps) {
  const { isFocusMode, toggleFocusMode } = useFocusMode();
  const effectiveFullscreen = compactReaderMode ? isExternalFullscreen : isFocusMode;
  const handleToggleFullscreen = compactReaderMode
    ? onToggleExternalFullscreen
    : toggleFocusMode;

  const profile = useMemo(() => resolveDocumentEditorProfile(document), [document]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [version, setVersion] = useState(document.content_version ?? 1);
  const [indexedVersion, setIndexedVersion] = useState(document.indexed_version ?? 0);
  const [embedStatus, setEmbedStatus] = useState<DocumentStatus>(document.embed_status);
  const [syncError, setSyncError] = useState<string | null>(document.sync_error ?? null);
  const [readOnly, setReadOnly] = useState(false);
  const [readOnlyReason, setReadOnlyReason] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [dismissedCitationKey, setDismissedCitationKey] = useState<string | null>(null);
  const [scrollToCitationNonce, setScrollToCitationNonce] = useState(0);
  const [resolvedInfo, setResolvedInfo] = useState<{
    key: string;
    tier: CitationResolutionTier;
    startLine?: number | null;
    endLine?: number | null;
  } | null>(null);

  const fallbackCitationTarget = useMemo<EditorCitationTarget | null>(() => {
    if (citationTarget) return citationTarget;
    if (highlightSnippet && highlightSnippet.trim()) {
      return {
        documentId: document.id,
        fileName: document.file_name,
        rawContent: highlightSnippet,
        nonce: 1,
      };
    }
    return null;
  }, [citationTarget, highlightSnippet, document.id, document.file_name]);

  const activeCitationKey = fallbackCitationTarget
    ? `${fallbackCitationTarget.documentId}:${fallbackCitationTarget.nonce}:${fallbackCitationTarget.rawContent?.slice(0, 24) ?? ''}`
    : null;

  const activeCitation =
    fallbackCitationTarget && activeCitationKey !== dismissedCitationKey
      ? fallbackCitationTarget
      : null;

  const activeResolvedMeta =
    resolvedInfo && activeCitationKey && resolvedInfo.key === activeCitationKey
      ? resolvedInfo
      : null;

  const handleDismissCitation = useCallback(() => {
    if (activeCitationKey) {
      setDismissedCitationKey(activeCitationKey);
    }
    onCitationDismiss?.();
    onSnippetLocated?.();
  }, [activeCitationKey, onCitationDismiss, onSnippetLocated]);

  const handleCitationResolutionUpdate = useCallback(
    (resolution: ProseMirrorCitationResolution | StructuredCitationResolution | null) => {
      if (!activeCitationKey || !resolution) return;
      const startLine = 'startLine' in resolution ? resolution.startLine : null;
      const endLine = 'endLine' in resolution ? resolution.endLine : null;
      setResolvedInfo({
        key: activeCitationKey,
        tier: resolution.tier,
        startLine,
        endLine,
      });
    },
    [activeCitationKey],
  );

  const mountedRef = useRef(true);
  const versionRef = useRef(document.content_version ?? 1);
  const savedContentRef = useRef('');
  const latestContentRef = useRef('');
  const inFlightSaveRef = useRef(false);
  const inFlightPromiseRef = useRef<Promise<void> | null>(null);
  const queuedSaveRef = useRef(false);
  const conflictRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDocumentUpdatedRef = useRef(onDocumentUpdated);

  useEffect(() => {
    onDocumentUpdatedRef.current = onDocumentUpdated;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const loadContent = useCallback(async (withLoadingSpinner = true) => {
    if (withLoadingSpinner) {
      setIsLoading(true);
    }
    setLoadError(null);
    setConflictMessage(null);
    conflictRef.current = false;
    queuedSaveRef.current = false;
    setSaveError(null);

    try {
      const data = await documentsApi.getContent(document.id);
      if (!mountedRef.current) return;

      versionRef.current = data.version;
      savedContentRef.current = data.content;
      latestContentRef.current = data.content;

      setContent(data.content);
      setSavedContent(data.content);
      setVersion(data.version);
      setIndexedVersion(data.indexedVersion);
      setEmbedStatus(data.embedStatus);
      setSyncError(data.syncError);
      setReadOnly(data.readOnly);
      setReadOnlyReason(data.readOnlyReason);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const extracted = extractDocumentApiError(
        err,
        'Không thể tải nội dung tài liệu từ máy chủ.',
      );
      setLoadError(extracted.message);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [document.id]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        void loadContent(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadContent]);

  useEffect(() => {
    if (profile.mode === 'structured_source' && highlightSnippet && !isLoading && onSnippetLocated) {
      onSnippetLocated();
    }
  }, [profile.mode, highlightSnippet, isLoading, onSnippetLocated]);

  const jsonValidationError = useMemo(
    () =>
      profile.mode === 'structured_source'
        ? validateStructuredContent(profile.language, content)
        : null,
    [profile.mode, profile.language, content],
  );

  const isDirty = !readOnly && content !== savedContent;

  const performSave = useCallback(
    async (options?: { manual?: boolean }) => {
      if (readOnly || conflictRef.current || isLoading) {
        return;
      }

      const contentToSave = latestContentRef.current;
      if (contentToSave === savedContentRef.current) {
        return;
      }

      if (profile.mode === 'structured_source') {
        const syntaxErr = validateStructuredContent(profile.language, contentToSave);
        if (syntaxErr) {
          if (options?.manual) {
            setSaveError(`JSON chưa hợp lệ: ${syntaxErr}`);
          }
          return;
        }
      }

      if (inFlightSaveRef.current) {
        queuedSaveRef.current = true;
        return;
      }

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      inFlightSaveRef.current = true;
      setIsSaving(true);
      setSaveError(null);

      const saveTask = (async () => {
        try {
          const res = await documentsApi.updateContent(document.id, {
            content: contentToSave,
            expectedVersion: versionRef.current,
          });

          if (!mountedRef.current) return;

          versionRef.current = res.version;
          savedContentRef.current = contentToSave;

          setVersion(res.version);
          setIndexedVersion(res.indexedVersion);
          setEmbedStatus(res.embedStatus);
          setSyncError(res.document.sync_error ?? null);
          setSavedContent(contentToSave);

          onDocumentUpdatedRef.current?.(res.document);
        } catch (err: unknown) {
          if (!mountedRef.current) return;
          const extracted = extractDocumentApiError(
            err,
            'Không thể lưu nội dung tài liệu.',
          );
          if (extracted.status === 409) {
            conflictRef.current = true;
            setConflictMessage(extracted.message);
          } else {
            setSaveError(extracted.message);
          }
        } finally {
          inFlightSaveRef.current = false;
          inFlightPromiseRef.current = null;
          if (mountedRef.current) {
            setIsSaving(false);
          }
          if (
            queuedSaveRef.current &&
            mountedRef.current &&
            !conflictRef.current &&
            latestContentRef.current !== savedContentRef.current
          ) {
            queuedSaveRef.current = false;
            void performSave({ manual: false });
          }
        }
      })();

      inFlightPromiseRef.current = saveTask;
      await saveTask;
    },
    [document.id, isLoading, profile.mode, profile.language, readOnly],
  );

  const handleContentChange = useCallback(
    (nextValue: string) => {
      latestContentRef.current = nextValue;
      setContent(nextValue);
      setSaveError(null);

      if (readOnly || conflictRef.current) {
        return;
      }

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = setTimeout(() => {
        void performSave({ manual: false });
      }, AUTO_SAVE_DEBOUNCE_MS);
    },
    [performSave, readOnly],
  );

  // Phím tắt Ctrl+S / Cmd+S lưu ngay lập tức
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void performSave({ manual: true });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performSave]);

  // Phím Esc tắt vùng highlight trích dẫn trước khi kích hoạt hành vi Esc đóng panel bên ngoài
  useEffect(() => {
    if (!activeCitation) return;

    const handleEscapeHighlight = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      handleDismissCitation();
    };

    window.addEventListener('keydown', handleEscapeHighlight, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleEscapeHighlight, { capture: true });
    };
  }, [activeCitation, handleDismissCitation]);

  const isAiSyncing =
    embedStatus === 'pending' ||
    embedStatus === 'processing' ||
    (embedStatus !== 'failed' && version > indexedVersion);

  // Tầng 2: Polling nhẹ trạng thái đồng bộ Vector Index sau khi lưu
  useEffect(() => {
    if (isLoading || !isAiSyncing) {
      return;
    }

    const timer = setInterval(() => {
      void documentsApi
        .getById(document.id)
        .then((latest) => {
          if (!mountedRef.current) return;
          setEmbedStatus(latest.embed_status);
          setIndexedVersion(latest.indexed_version ?? 0);
          setSyncError(latest.sync_error ?? null);
          onDocumentUpdatedRef.current?.(latest);
        })
        .catch(() => {
          // Bỏ qua lỗi mạng tạm thời trong chu kỳ poll
        });
    }, AI_SYNC_POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [document.id, isLoading, isAiSyncing]);

  const handleCloseWithFlush = async () => {
    if (inFlightPromiseRef.current) {
      await inFlightPromiseRef.current.catch(() => {});
    }
    if (
      !readOnly &&
      !conflictRef.current &&
      latestContentRef.current !== savedContentRef.current &&
      !jsonValidationError
    ) {
      await performSave({ manual: true });
    }
    onClose();
  };

  return (
    <div
      className={`flex h-full w-full flex-col overflow-hidden bg-white dark:bg-[#0D1017] ${
        compactReaderMode
          ? 'rounded-none border-0'
          : 'rounded-[22px] border border-black/[0.06] dark:border-white/[0.08] shadow-xs'
      } ${className}`}
    >
      {/* Unified Apple HIG Header Bar */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/90 dark:bg-[#12151C]/90 px-3 sm:px-4 py-2.5 backdrop-blur-xl">
        {/* Cụm trái: Nút quay lại + Tên tệp + Badge định dạng */}
        <div className="flex items-center gap-2.5 min-w-0 max-w-full sm:max-w-[48%]">
          <button
            type="button"
            onClick={() => void handleCloseWithFlush()}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] px-3 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/[0.12] transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{compactReaderMode ? 'Đóng' : 'Tài liệu'}</span>
          </button>

          <span
            className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${profile.badgeToneClass}`}
          >
            {profile.shortBadge}
          </span>

          <h2
            title={document.file_name}
            className="truncate text-xs sm:text-sm font-semibold font-heading text-neutral-900 dark:text-white"
          >
            {document.file_name}
          </h2>
        </div>

        {/* Cụm phải: Trạng thái 2 tầng (Save + AI Vector Sync) + Nút Lưu + Tải về + Focus Mode */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Tầng 1: Trạng thái Lưu tệp */}
          {!isLoading && !loadError && (
            <div className="flex items-center gap-1.5">
              {conflictMessage ? (
                <span className="inline-flex h-7 items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-3 w-3" />
                  <span>Xung đột</span>
                </span>
              ) : isSaving ? (
                <span className="inline-flex h-7 items-center gap-1 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Đang lưu...</span>
                </span>
              ) : saveError ? (
                <span
                  title={saveError}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 cursor-help"
                >
                  <AlertCircle className="h-3 w-3" />
                  <span>Lỗi lưu</span>
                </span>
              ) : isDirty ? (
                <span className="inline-flex h-7 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span>{jsonValidationError ? 'Chưa lưu (lỗi JSON)' : 'Chưa lưu'}</span>
                </span>
              ) : !readOnly ? (
                <span className="inline-flex h-7 items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <Check className="h-3 w-3" />
                  <span>Đã lưu</span>
                </span>
              ) : (
                <span className="inline-flex h-7 items-center gap-1 rounded-full border border-neutral-500/25 bg-neutral-500/10 px-2.5 text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                  <span>Chỉ đọc</span>
                </span>
              )}

              {/* Tầng 2: Trạng thái Đồng bộ chỉ mục AI */}
              {embedStatus === 'failed' ? (
                <span
                  title={syncError || 'Lỗi trong quá trình đồng bộ Vector Index'}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 text-[11px] font-semibold text-orange-700 dark:text-orange-400 cursor-help"
                >
                  <AlertCircle className="h-3 w-3" />
                  {!compactReaderMode && <span>Lỗi đồng bộ AI</span>}
                </span>
              ) : isAiSyncing ? (
                <span
                  title="Đang cập nhật Docling Chunks & Vector Embedding theo thay đổi mới nhất"
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-purple-500/25 bg-purple-500/10 px-2.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300"
                >
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{compactReaderMode ? 'Sync AI...' : 'Đang đồng bộ AI...'}</span>
                </span>
              ) : (
                <span
                  title="Dữ liệu tìm kiếm AI & Trích dẫn đã khớp với phiên bản mới nhất"
                  className="hidden sm:inline-flex h-7 items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>AI đã đồng bộ</span>
                </span>
              )}
            </div>
          )}

          {/* Nút Lưu ngay (Ctrl+S) */}
          {!readOnly && !isLoading && !loadError && (
            <button
              type="button"
              onClick={() => void performSave({ manual: true })}
              disabled={!isDirty || isSaving || Boolean(conflictMessage)}
              title="Lưu thay đổi ngay (Ctrl+S)"
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all active:scale-95 ${
                isDirty && !conflictMessage
                  ? 'bg-[#4F46E5] hover:bg-[#4338CA] text-white shadow-2xs cursor-pointer'
                  : 'border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/80 dark:bg-white/[0.04] text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
              }`}
            >
              <Save className="h-3.5 w-3.5" />
              <span>Lưu</span>
            </button>
          )}

          {/* Nút Tải về */}
          {onDownload && (
            <button
              type="button"
              onClick={() => onDownload(document.id, document.file_name)}
              title="Tải xuống tệp gốc"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.12] transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Nút Toàn màn hình / Focus Mode */}
          {handleToggleFullscreen && (
            <button
              type="button"
              onClick={handleToggleFullscreen}
              title={effectiveFullscreen ? 'Thu gọn khung nhìn' : 'Mở rộng toàn màn hình'}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.12] transition-colors cursor-pointer"
            >
              {effectiveFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </header>

      {/* Banner Cảnh báo Read-Only (> 2MB), Xung đột 409 hoặc Lỗi Lưu */}
      {readOnly && readOnlyReason && !isLoading && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 bg-amber-500/[0.08] px-4 py-2 text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{readOnlyReason}</span>
          </div>
          {onDownload && (
            <button
              type="button"
              onClick={() => onDownload(document.id, document.file_name)}
              className="inline-flex h-7 items-center gap-1 rounded-lg bg-amber-600 px-2.5 text-xs font-semibold text-white hover:bg-amber-700 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Tải tệp đầy đủ</span>
            </button>
          )}
        </div>
      )}

      {conflictMessage && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-500/25 bg-rose-500/[0.09] px-4 py-2.5 text-xs text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{conflictMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadContent()}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Tải lại phiên bản mới nhất</span>
          </button>
        </div>
      )}

      {saveError && !conflictMessage && (
        <div className="flex items-center justify-between gap-2 border-b border-rose-500/20 bg-rose-500/[0.08] px-4 py-2 text-xs text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        </div>
      )}

      {!isLoading && !loadError && activeCitation && (
        <CitationEvidenceBanner
          target={activeCitation}
          resolvedTier={activeResolvedMeta?.tier ?? 1}
          resolvedStartLine={activeResolvedMeta?.startLine}
          resolvedEndLine={activeResolvedMeta?.endLine}
          onScrollToLocation={() => setScrollToCitationNonce((n) => n + 1)}
          onDismiss={handleDismissCitation}
        />
      )}

      {/* Vùng Nội dung Chính */}
      {isLoading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-[#4F46E5] dark:text-[#818CF8]" />
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Đang tải nội dung tài liệu...
          </p>
        </div>
      ) : loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-6 w-6" />
          </div>
          <p className="max-w-md text-sm font-semibold text-neutral-900 dark:text-white">
            Không thể mở tài liệu
          </p>
          <p className="max-w-md text-xs text-neutral-500 dark:text-neutral-400">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => void loadContent()}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#4F46E5] px-4 text-xs font-semibold text-white hover:bg-[#4338CA] cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Thử tải lại</span>
          </button>
        </div>
      ) : profile.mode === 'structured_source' ? (
        <StructuredSourceCanvas
          value={content}
          onChange={handleContentChange}
          language={profile.language}
          readOnly={readOnly}
          compactReaderMode={compactReaderMode}
          citationTarget={activeCitation}
          scrollToCitationNonce={scrollToCitationNonce}
          onCitationResolved={handleCitationResolutionUpdate}
          onCitationDismiss={handleDismissCitation}
        />
      ) : profile.mode === 'markdown_wysiwyg' ||
        profile.mode === 'html_wysiwyg' ||
        profile.mode === 'plain_text' ? (
        <MarkdownWysiwygCanvas
          value={content}
          onChange={handleContentChange}
          mode={profile.mode}
          readOnly={readOnly}
          compactReaderMode={compactReaderMode}
          documentId={document.id}
          documentFileName={document.file_name}
          citationTarget={activeCitation}
          scrollToCitationNonce={scrollToCitationNonce}
          onCitationResolved={handleCitationResolutionUpdate}
          onCitationDismiss={handleDismissCitation}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <CheckCircle2 className="h-6 w-6 text-neutral-400" />
          <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Định dạng chưa hỗ trợ mở trực tiếp
          </p>
        </div>
      )}
    </div>
  );
}
