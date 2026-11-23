"use client";

import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import {
  ArrowLeft,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertTriangle,
  Info,
} from "lucide-react";
import { documentsApi, extractDocumentApiError } from "@/services/documents.api";
import { useFocusMode } from "@/components/layout";
import type { DocumentItem, DocumentPreviewData } from "@/types";

export interface DocumentLegacyDocPreviewProps {
  document: DocumentItem;
  onClose: () => void;
  onDownload?: (documentId: string, fileName: string) => void;
  compactReaderMode?: boolean;
  isExternalFullscreen?: boolean;
  onToggleExternalFullscreen?: () => void;
  className?: string;
}

export default function DocumentLegacyDocPreview({
  document,
  onClose,
  onDownload,
  compactReaderMode = false,
  isExternalFullscreen,
  onToggleExternalFullscreen,
  className = "",
}: DocumentLegacyDocPreviewProps) {
  const [preview, setPreview] = useState<DocumentPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const { isFocusMode, toggleFocusMode, setFocusMode } = useFocusMode();

  const isFullscreen =
    compactReaderMode
      ? Boolean(isExternalFullscreen)
      : isFocusMode;

  const handleToggleFullscreen = () => {
    if (compactReaderMode) {
      onToggleExternalFullscreen?.();
      return;
    }
    toggleFocusMode();
  };

  useEffect(() => {
    if (compactReaderMode) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isFocusMode) {
        setFocusMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [compactReaderMode, isFocusMode, setFocusMode]);

  useEffect(() => {
    let cancelled = false;
    const loadPreview = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await documentsApi.getPreview(document.id);
        if (!cancelled) {
          setPreview(data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const { message } = extractDocumentApiError(
            err,
            "Không thể tải bản xem trước tài liệu.",
          );
          setErrorMessage(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [document.id, reloadNonce]);

  const isExtracting =
    preview?.ocrStatus === "pending" || preview?.ocrStatus === "processing";

  useEffect(() => {
    if (!isExtracting) return;
    const timer = window.setInterval(() => {
      setReloadNonce((n) => n + 1);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [isExtracting]);

  const extBadge = document.file_name.toLowerCase().endsWith(".odt")
    ? "ODT"
    : "DOC";

  const containerClass =
    compactReaderMode || isFullscreen
      ? `flex h-full min-h-0 flex-1 flex-col bg-neutral-100/70 dark:bg-[#0F1218] ${className}`
      : `flex h-[calc(100vh-140px)] min-h-[540px] w-full flex-col overflow-hidden rounded-[24px] border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/70 dark:bg-[#0F1218] shadow-sm ${className}`;

  return (
    <div className={containerClass}>
      {/* Unified Apple HIG Header */}
      <div className="flex h-13 shrink-0 items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/85 dark:bg-[#141720]/90 px-3 sm:px-4 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-black/[0.07] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] px-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {!compactReaderMode && <span className="hidden sm:inline">Quay lại</span>}
          </button>

          <span className="inline-flex shrink-0 items-center rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-600 dark:text-blue-400">
            {extBadge}
          </span>

          <h3 className="truncate text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white">
            {document.file_name}
          </h3>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {onDownload && (
            <button
              type="button"
              onClick={() => onDownload(document.id, document.file_name)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/[0.07] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] px-3 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/[0.1] cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              {!compactReaderMode && <span className="hidden md:inline">Tải tệp gốc</span>}
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.07] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Read-only notice */}
      <div className="flex items-start gap-2 border-b border-blue-500/15 bg-blue-500/[0.06] px-4 py-2 text-xs text-blue-800 dark:text-blue-200">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
        <span>
          {preview?.readOnlyReason ||
            `Định dạng ${extBadge} đang hiển thị ở chế độ xem trước chỉ đọc từ văn bản do AI trích xuất. Hãy lưu lại dưới dạng .docx để chỉnh sửa trực tiếp bằng SuperDoc.`}
        </span>
      </div>

      {/* Content viewport */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading && !preview ? (
          <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 text-neutral-500 dark:text-neutral-400">
            <Loader2 className="h-7 w-7 animate-spin text-blue-600 dark:text-blue-400" />
            <p className="text-xs font-medium">Đang tải bản xem trước tài liệu…</p>
          </div>
        ) : errorMessage ? (
          <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-rose-500/20 bg-white dark:bg-[#161922] p-6 text-center shadow-xs">
            <AlertTriangle className="h-8 w-8 text-rose-500" />
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">
              Không tải được xem trước
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Thử lại</span>
            </button>
          </div>
        ) : isExtracting ? (
          <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 text-neutral-500 dark:text-neutral-400">
            <Loader2 className="h-7 w-7 animate-spin text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              Docling đang trích xuất nội dung từ tệp {extBadge}…
            </p>
            <p className="text-xs text-neutral-400">
              Trang xem trước sẽ tự động cập nhật sau khi hoàn tất.
            </p>
          </div>
        ) : preview?.rawText ? (
          <div className="mx-auto max-w-3xl rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#161922] p-6 sm:p-8 shadow-xs">
            <article className="prose prose-sm sm:prose-base dark:prose-invert max-w-none leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeKatex]}
              >
                {preview.rawText}
              </ReactMarkdown>
            </article>
          </div>
        ) : (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center text-neutral-500 dark:text-neutral-400">
            <p className="text-sm font-medium">Chưa có nội dung văn bản trích xuất.</p>
            <p className="text-xs">
              {preview?.processingError ||
                "Bạn vẫn có thể tải xuống tệp gốc bằng nút Tải tệp gốc ở góc trên."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
