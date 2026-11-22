"use client";

import React, { useEffect, useRef, useState } from "react";
import { Globe, Loader2, X, AlertCircle, Link2, CheckCircle2 } from "lucide-react";
import { extractDocumentApiError } from "@/services/documents.api";
import { validateGoogleDocsUrlClient } from "./word-document.helpers";
import type { DocumentItem } from "@/types";

export interface ImportGoogleDocModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (url: string, fileName?: string) => Promise<DocumentItem>;
  onImported?: (doc: DocumentItem) => void;
}

export default function ImportGoogleDocModal({
  isOpen,
  onClose,
  onImport,
  onImported,
}: ImportGoogleDocModalProps) {
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const trimmedUrl = url.trim();
  const clientValidation = trimmedUrl
    ? validateGoogleDocsUrlClient(trimmedUrl)
    : null;
  const isUrlReady = Boolean(trimmedUrl && clientValidation?.valid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateGoogleDocsUrlClient(url);
    if (!check.valid) {
      setErrorMessage(check.reason ?? "Liên kết Google Docs không hợp lệ.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const created = await onImport(trimmedUrl, fileName.trim() || undefined);
      setUrl("");
      setFileName("");
      onClose();
      onImported?.(created);
    } catch (err: unknown) {
      const { message } = extractDocumentApiError(
        err,
        "Không thể nhập tài liệu Google Docs. Vui lòng kiểm tra liên kết và quyền chia sẻ công khai.",
      );
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-google-doc-title"
    >
      <div
        className="w-full max-w-lg rounded-[24px] border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#161922] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h3
                id="import-google-doc-title"
                className="text-base font-semibold tracking-tight text-neutral-900 dark:text-white"
              >
                Nhập từ Google Docs
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Xuất bản sao OOXML (.docx) chuẩn để chỉnh sửa & học cùng AI
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.08] hover:text-neutral-700 dark:hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="google-doc-url-input"
              className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-200"
            >
              Liên kết Google Docs công khai <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                ref={inputRef}
                id="google-doc-url-input"
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isSubmitting}
                placeholder="https://docs.google.com/document/d/.../edit"
                className="h-11 w-full rounded-xl border border-black/[0.1] dark:border-white/[0.12] bg-neutral-50/70 dark:bg-[#0F1218] pl-10 pr-9 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:border-blue-500 focus:bg-white dark:focus:bg-[#131722] focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
              />
              {isUrlReady && (
                <CheckCircle2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
              )}
            </div>

            {trimmedUrl && clientValidation && !clientValidation.valid && (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                {clientValidation.reason}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="google-doc-name-input"
              className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-200"
            >
              Tên tệp tùy chọn <span className="font-normal text-neutral-400">(để trống sẽ lấy tên gốc)</span>
            </label>
            <input
              id="google-doc-name-input"
              type="text"
              maxLength={180}
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              disabled={isSubmitting}
              placeholder="Ví dụ: Đề cương ôn tập cuối kỳ.docx"
              className="h-10 w-full rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-neutral-50/70 dark:bg-[#0F1218] px-3.5 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:border-blue-500 focus:bg-white dark:focus:bg-[#131722] focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
            />
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] px-3.5 py-2.5 text-xs leading-relaxed text-blue-800 dark:text-blue-200">
            <span className="font-semibold">Điều kiện:</span> Trên Google Docs, chọn{" "}
            <span className="font-semibold">Chia sẻ → Quyền truy cập chung → Bất kỳ ai có đường liên kết (Người xem)</span>.
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/[0.08] dark:border-white/[0.1] px-4 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/[0.06] disabled:opacity-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !trimmedUrl}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 px-5 text-xs font-semibold text-white shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang tải về...</span>
                </>
              ) : (
                <>
                  <Globe className="h-3.5 w-3.5" />
                  <span>Nhập tài liệu</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
