"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SuperDoc as SuperDocInstance } from "superdoc";
import { documentsApi, extractDocumentApiError } from "@/services/documents.api";
import { DOCX_MIME_TYPE, stripExtensionForExport } from "./word-document.helpers";
import type { DocumentItem, DocumentStatus } from "@/types";

export interface UseWordDocumentPersistenceOptions {
  document: DocumentItem;
  compactReaderMode?: boolean;
  onDocumentUpdated?: (doc: DocumentItem) => void;
}

export interface WordDocumentPersistenceState {
  documentBlob: Blob | null;
  isLoadingBlob: boolean;
  loadError: string | null;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  conflictMessage: string | null;
  contentVersion: number;
  indexedVersion: number;
  ocrStatus: DocumentStatus;
  embedStatus: DocumentStatus;
  syncError: string | null;
  isAiSyncing: boolean;
  lastSavedAt: number | null;
  attachSuperDocInstance: (instance: SuperDocInstance | null) => void;
  saveDocument: () => Promise<boolean>;
  reloadDocument: () => void;
  clearSaveFeedback: () => void;
}

export function useWordDocumentPersistence({
  document,
  compactReaderMode = false,
  onDocumentUpdated,
}: UseWordDocumentPersistenceOptions): WordDocumentPersistenceState {
  const [documentBlob, setDocumentBlob] = useState<Blob | null>(null);
  const [isLoadingBlob, setIsLoadingBlob] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const [contentVersion, setContentVersion] = useState<number>(
    document.content_version ?? 1,
  );
  const [indexedVersion, setIndexedVersion] = useState<number>(
    document.indexed_version ?? 0,
  );
  const [ocrStatus, setOcrStatus] = useState<DocumentStatus>(document.ocr_status);
  const [embedStatus, setEmbedStatus] = useState<DocumentStatus>(
    document.embed_status,
  );
  const [syncError, setSyncError] = useState<string | null>(
    document.sync_error ?? null,
  );

  const superdocRef = useRef<SuperDocInstance | null>(null);
  const dirtyUnsubRef = useRef<(() => void) | null>(null);
  const savingRef = useRef(false);
  const contentVersionRef = useRef(contentVersion);
  contentVersionRef.current = contentVersion;

  const onDocumentUpdatedRef = useRef(onDocumentUpdated);
  onDocumentUpdatedRef.current = onDocumentUpdated;

  // Đồng bộ metadata phiên bản khi mở tài liệu khác hoặc bản ghi SWR thay đổi
  useEffect(() => {
    setContentVersion(document.content_version ?? 1);
    setIndexedVersion(document.indexed_version ?? 0);
    setOcrStatus(document.ocr_status);
    setEmbedStatus(document.embed_status);
    setSyncError(document.sync_error ?? null);
  }, [
    document.id,
    document.content_version,
    document.indexed_version,
    document.ocr_status,
    document.embed_status,
    document.sync_error,
  ]);

  // Tải binary .docx từ R2 Signed URL
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const loadDocxBlob = async () => {
      setIsLoadingBlob(true);
      setLoadError(null);
      setConflictMessage(null);
      setSaveError(null);
      setIsDirty(false);
      setDocumentBlob(null);

      try {
        const { downloadUrl } = await documentsApi.getViewUrl(document.id);
        if (cancelled) return;

        const blob = await documentsApi.fetchDocumentBlob(
          downloadUrl,
          DOCX_MIME_TYPE,
          controller.signal,
        );
        if (cancelled) return;

        setDocumentBlob(blob);
      } catch (err: unknown) {
        if (cancelled || controller.signal.aborted) return;
        const { message } = extractDocumentApiError(
          err,
          "Không thể tải nội dung tệp Word từ hệ thống lưu trữ.",
        );
        setLoadError(message);
      } finally {
        if (!cancelled) {
          setIsLoadingBlob(false);
        }
      }
    };

    void loadDocxBlob();

    return () => {
      cancelled = true;
      controller.abort();
      dirtyUnsubRef.current?.();
      dirtyUnsubRef.current = null;
      superdocRef.current = null;
    };
  }, [document.id, reloadNonce]);

  const attachSuperDocInstance = useCallback(
    (instance: SuperDocInstance | null) => {
      dirtyUnsubRef.current?.();
      dirtyUnsubRef.current = null;
      superdocRef.current = instance;

      if (!instance?.ui?.document) {
        setIsDirty(false);
        return;
      }

      const initialSnapshot = instance.ui.document.getSnapshot();
      setIsDirty(Boolean(initialSnapshot?.dirty));

      dirtyUnsubRef.current = instance.ui.document.observe((snapshot) => {
        setIsDirty(Boolean(snapshot.dirty));
      });
    },
    [],
  );

  const reloadDocument = useCallback(() => {
    dirtyUnsubRef.current?.();
    dirtyUnsubRef.current = null;
    superdocRef.current = null;
    setReloadNonce((n) => n + 1);
  }, []);

  const clearSaveFeedback = useCallback(() => {
    setSaveError(null);
    setConflictMessage(null);
  }, []);

  const saveDocument = useCallback(async (): Promise<boolean> => {
    const superdoc = superdocRef.current;
    if (!superdoc || savingRef.current || compactReaderMode) {
      return false;
    }

    savingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    setConflictMessage(null);

    try {
      const expectedVersion = contentVersionRef.current;
      const editorVersion = superdoc.ui?.document?.getVersion?.();

      const exportedResult = await superdoc.export({
        exportType: ["docx"],
        triggerDownload: false,
        exportedName: stripExtensionForExport(document.file_name),
        policies: {
          trackedChanges: "review-preserving",
          comments: "preserve",
          contentControls: "preserve",
        },
      });

      if (!(exportedResult instanceof Blob) || exportedResult.size === 0) {
        throw new Error(
          "Không thể xuất tệp DOCX từ trình soạn thảo. Vui lòng thử lại.",
        );
      }

      const { uploadUrl } = await documentsApi.getOverwriteUrl(document.id, {
        expectedVersion,
      });

      await documentsApi.uploadToR2(
        uploadUrl,
        exportedResult,
        undefined,
        DOCX_MIME_TYPE,
      );

      const updatedDoc = await documentsApi.completeOverwrite(document.id, {
        expectedVersion,
      });

      if (editorVersion) {
        superdoc.ui?.document?.markClean?.(editorVersion);
      }

      const currentSnap = superdoc.ui?.document?.getSnapshot?.();
      setIsDirty(Boolean(currentSnap?.dirty));

      const nextVer = updatedDoc.content_version ?? expectedVersion + 1;
      setContentVersion(nextVer);
      contentVersionRef.current = nextVer;
      setIndexedVersion(updatedDoc.indexed_version ?? indexedVersion);
      setOcrStatus(updatedDoc.ocr_status);
      setEmbedStatus(updatedDoc.embed_status);
      setSyncError(updatedDoc.sync_error ?? null);
      setLastSavedAt(Date.now());
      onDocumentUpdatedRef.current?.(updatedDoc);

      return true;
    } catch (err: unknown) {
      const parsed = extractDocumentApiError(
        err,
        "Không thể lưu thay đổi lên hệ thống. Vui lòng thử lại.",
      );
      if (parsed.status === 409) {
        const versionHint = parsed.currentVersion
          ? ` (phiên bản máy chủ v${parsed.currentVersion})`
          : "";
        setConflictMessage(
          `Phát hiện xung đột phiên bản${versionHint}: tài liệu đã được cập nhật ở tab hoặc nơi khác. Hãy tải lại bản mới nhất trước khi lưu đè.`,
        );
      } else {
        setSaveError(parsed.message);
      }
      return false;
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [compactReaderMode, document.file_name, document.id, indexedVersion]);

  const isAiSyncing =
    !syncError &&
    embedStatus !== "failed" &&
    ocrStatus !== "failed" &&
    (ocrStatus === "pending" ||
      ocrStatus === "processing" ||
      embedStatus === "pending" ||
      embedStatus === "processing" ||
      indexedVersion < contentVersion);

  // Tầng 2: Poll tiến trình đồng bộ chỉ mục AI (Docling + Phương án 2 Embedding)
  useEffect(() => {
    if (!isAiSyncing) return;

    let cancelled = false;
    const pollStatus = async () => {
      try {
        const freshDoc = await documentsApi.getById(document.id);
        if (cancelled) return;

        const nextVer = freshDoc.content_version ?? 1;
        const nextIdx = freshDoc.indexed_version ?? 0;

        setContentVersion(nextVer);
        setIndexedVersion(nextIdx);
        setOcrStatus(freshDoc.ocr_status);
        setEmbedStatus(freshDoc.embed_status);
        setSyncError(freshDoc.sync_error ?? null);

        if (
          freshDoc.embed_status === "done" ||
          freshDoc.embed_status === "failed" ||
          freshDoc.ocr_status === "failed" ||
          Boolean(freshDoc.sync_error) ||
          nextIdx >= nextVer
        ) {
          onDocumentUpdatedRef.current?.(freshDoc);
        }
      } catch {
        // Bỏ qua lỗi mạng tạm thời trong chu kỳ polling kế tiếp
      }
    };

    const intervalId = window.setInterval(() => {
      void pollStatus();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [document.id, isAiSyncing]);

  // Cảnh báo trình duyệt khi đóng tab lúc vẫn còn thay đổi chưa lưu
  useEffect(() => {
    if (!isDirty || compactReaderMode) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, compactReaderMode]);

  return {
    documentBlob,
    isLoadingBlob,
    loadError,
    isDirty,
    isSaving,
    saveError,
    conflictMessage,
    contentVersion,
    indexedVersion,
    ocrStatus,
    embedStatus,
    syncError,
    isAiSyncing,
    lastSavedAt,
    attachSuperDocInstance,
    saveDocument,
    reloadDocument,
    clearSaveFeedback,
  };
}
