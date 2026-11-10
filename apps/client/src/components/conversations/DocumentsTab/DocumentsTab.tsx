"use client";

import React, { useRef, useState, useMemo, useEffect, DragEvent, ChangeEvent } from "react";
import {
  Plus,
  FileText,
  Image as ImageIcon,
  Download,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  UploadCloud,
  Eye,
  Layers,
} from "lucide-react";
import { DocumentItem, UploadProgressItem } from "@/types";
import { useFocusMode } from "@/components/layout";
import DocumentImageViewer from "./DocumentImageViewer";
import DocumentPdfViewer from "./DocumentPdfViewer";

export interface DocumentsTabProps {
  documents?: DocumentItem[];
  isLoading?: boolean;
  isUploading?: boolean;
  uploadQueue?: UploadProgressItem[];
  errorMessage?: string | null;
  onClearError?: () => void;
  onUpload?: (files: File[]) => void;
  onDelete?: (documentId: string) => void;
  onDownload?: (documentId: string, fileName: string) => void;
  className?: string;
  maxSizeMB?: number;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!+bytes) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export default function DocumentsTab({
  documents = [],
  isLoading = false,
  uploadQueue = [],
  errorMessage = null,
  onClearError,
  onUpload,
  onDelete,
  onDownload,
  className = "",
  maxSizeMB = 50,
}: DocumentsTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "pdf" | "image">("all");
  const { setIsViewingDocument, setFocusMode } = useFocusMode();

  const viewingDoc = useMemo(
    () => documents.find((d) => d.id === viewingDocId),
    [documents, viewingDocId]
  );

  // Đồng bộ trạng thái xem tài liệu với FocusModeContext để loại bỏ padding thừa (Box-in-box)
  useEffect(() => {
    const isViewing = Boolean(viewingDocId && viewingDoc);
    setIsViewingDocument(isViewing);
    return () => {
      setIsViewingDocument(false);
    };
  }, [viewingDocId, viewingDoc, setIsViewingDocument]);

  const pdfCount = useMemo(
    () => documents.filter((doc) => doc.mime_type === "application/pdf").length,
    [documents]
  );

  const imageCount = useMemo(
    () => documents.filter((doc) => doc.mime_type.startsWith("image/")).length,
    [documents]
  );

  const filteredDocuments = useMemo(() => {
    if (filterType === "pdf") {
      return documents.filter((doc) => doc.mime_type === "application/pdf");
    }
    if (filterType === "image") {
      return documents.filter((doc) => doc.mime_type.startsWith("image/"));
    }
    return documents;
  }, [documents, filterType]);

  const handleCardClick = (doc: DocumentItem) => {
    setViewingDocId(doc.id);
  };

  const handleCloseViewer = () => {
    setFocusMode(false);
    setViewingDocId(null);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      onUpload?.(filesArray);
      e.target.value = "";
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      onUpload?.(filesArray);
    }
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const confirmDelete = (documentId: string) => {
    setDeletingId(documentId);
  };

  const executeDelete = () => {
    if (deletingId) {
      onDelete?.(deletingId);
      setDeletingId(null);
    }
  };

  const renderStatusBadge = (doc: DocumentItem) => {
    if (doc.ocr_status === "failed") {
      return (
        <span
          title={doc.processing_error || "Lỗi trong quá trình trích xuất văn bản"}
          className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-400 ring-1 ring-rose-500/20 ring-inset cursor-help"
        >
          <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
          Lỗi trích xuất
        </span>
      );
    }

    if (doc.ocr_status === "done" && doc.embed_status === "failed") {
      return (
        <span
          title={doc.processing_error || "Lỗi trong quá trình tạo chỉ mục ngữ nghĩa (Embedding)"}
          className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:text-orange-400 ring-1 ring-orange-500/20 ring-inset cursor-help"
        >
          <AlertCircle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
          Lỗi chỉ mục
        </span>
      );
    }

    if (doc.ocr_status === "processing") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-500/20 ring-inset">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
          Đang trích xuất...
        </span>
      );
    }

    if (
      doc.ocr_status === "done" &&
      (doc.embed_status === "pending" || doc.embed_status === "processing")
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-400 ring-1 ring-purple-500/20 ring-inset">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600 dark:text-purple-400" />
          Đang lập chỉ mục...
        </span>
      );
    }

    if (doc.ocr_status === "done" && doc.embed_status === "done") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20 ring-inset">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          Sẵn sàng
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20 ring-inset">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600 dark:text-amber-400" />
        Đang chờ
      </span>
    );
  };

  // 0. Trường hợp người dùng đang xem chi tiết tài liệu (Detail View: Ảnh hoặc PDF)
  if (viewingDocId && viewingDoc) {
    if (viewingDoc.mime_type.startsWith("image/")) {
      return (
        <DocumentImageViewer
          documents={documents}
          initialDocumentId={viewingDocId}
          onClose={handleCloseViewer}
          onDownload={onDownload}
          className={className}
        />
      );
    }

    if (viewingDoc.mime_type === "application/pdf") {
      return (
        <DocumentPdfViewer
          document={viewingDoc}
          onClose={handleCloseViewer}
          className={className}
        />
      );
    }
  }

  // 1. Trường hợp chưa có tài liệu nào và không có file đang upload: Empty State tối giản chuẩn Apple HIG
  const hasContent = documents.length > 0 || uploadQueue.length > 0;

  if (!hasContent && !isLoading) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex w-full flex-1 flex-col items-center justify-center rounded-3xl transition-all duration-200 select-none ${
          isDragging
            ? "border-2 border-dashed border-indigo-500/60 bg-indigo-500/[0.04] dark:bg-indigo-500/[0.08]"
            : "border border-transparent"
        } px-6 py-16 text-center ${className}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {errorMessage && (
          <div className="mb-6 flex w-full max-w-md items-center justify-between rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-xs text-rose-700 dark:text-rose-400">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={onClearError}
              type="button"
              className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Biểu tượng Apple Tonal Squircle */}
        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/70 dark:bg-white/[0.04] text-neutral-700 dark:text-neutral-200 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)]">
          <FileText className="h-7 w-7 stroke-[1.75]" />
        </div>

        <h2 className="mt-5 text-[19px] sm:text-[21px] font-semibold tracking-[-0.02em] text-neutral-900 dark:text-neutral-100">
          Chưa có tài liệu
        </h2>

        <p className="mt-2 max-w-[360px] text-center text-[14px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Tải lên tệp PDF hoặc hình ảnh bài giảng để bắt đầu đọc, ghi chú và hỏi đáp cùng AI.
        </p>

        <button
          type="button"
          onClick={handleTriggerUpload}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] px-5 text-[13px] font-semibold text-white shadow-xs shadow-indigo-500/20 transition-all duration-200 active:scale-[0.97] cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.25]" />
          <span>Tải lên tài liệu</span>
        </button>

        <p className="mt-3.5 text-[12px] text-neutral-400 dark:text-neutral-500">
          Kéo thả tệp vào đây · PDF, PNG, JPG (tối đa {maxSizeMB}MB)
        </p>
      </div>
    );
  }

  // 2. Trường hợp đã có tài liệu hoặc đang tải lên: Danh sách tài liệu chuẩn Apple HIG
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex w-full flex-col gap-6 ${className}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Thông báo lỗi nếu có */}
      {errorMessage && (
        <div className="flex items-center justify-between rounded-[18px] border border-rose-500/20 bg-rose-500/[0.08] p-4 text-sm text-rose-700 dark:text-rose-400 shadow-2xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={onClearError}
            type="button"
            className="rounded-full p-1 text-rose-500 hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Thanh Header của Tab */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] dark:border-white/[0.08] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Tài liệu đã tải lên</h2>
            <span className="tabular-nums inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 px-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
              {filteredDocuments.length}
              {filterType !== "all" && `/${documents.length}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Bộ lọc loại tài liệu dạng Apple Segmented Pill */}
          <div className="flex items-center rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/80 dark:bg-white/[0.05] p-1 shadow-2xs">
            {/* Nút: Tất cả tài liệu */}
            <button
              type="button"
              onClick={() => setFilterType("all")}
              title={`Tất cả tài liệu (${documents.length})`}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all cursor-pointer ${
                filterType === "all"
                  ? "bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tất cả</span>
            </button>

            {/* Nút: Chỉ PDF */}
            <button
              type="button"
              onClick={() => setFilterType("pdf")}
              title={`Tài liệu PDF (${pdfCount})`}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all cursor-pointer ${
                filterType === "pdf"
                  ? "bg-white dark:bg-neutral-800 text-rose-600 dark:text-rose-400 shadow-2xs"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">PDF ({pdfCount})</span>
            </button>

            {/* Nút: Chỉ Hình ảnh */}
            <button
              type="button"
              onClick={() => setFilterType("image")}
              title={`Hình ảnh (${imageCount})`}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all cursor-pointer ${
                filterType === "image"
                  ? "bg-white dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 shadow-2xs"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ảnh ({imageCount})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleTriggerUpload}
            className="inline-flex items-center gap-2 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Tải thêm tài liệu</span>
            <span className="sm:hidden">Tải thêm</span>
          </button>
        </div>
      </div>

      {/* Vùng kéo thả phụ trợ nếu đang drag */}
      {isDragging && (
        <div className="flex items-center justify-center rounded-[20px] border-2 border-dashed border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/20 p-8 text-center text-sm font-semibold text-indigo-700 dark:text-indigo-300">
          <UploadCloud className="mr-2 h-6 w-6 animate-bounce" />
          Thả tệp vào đây để tải lên ngay
        </div>
      )}

      {/* Danh sách tệp đang tải lên (Upload Queue) */}
      {uploadQueue.length > 0 && (
        <div className="flex flex-col gap-3 rounded-[20px] border border-indigo-500/20 bg-indigo-500/[0.03] dark:bg-indigo-500/[0.06] p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
            Tiến trình tải lên ({uploadQueue.length})
          </h3>
          <div className="flex flex-col gap-2.5">
            {uploadQueue.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-[14px] border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#161922] p-3.5 shadow-2xs"
              >
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2 truncate font-medium text-neutral-800 dark:text-neutral-200">
                    <FileText className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                    <span className="truncate">{item.fileName}</span>
                    <span className="tabular-nums text-xs text-neutral-400 dark:text-neutral-500">
                      ({formatBytes(item.fileSize)})
                    </span>
                  </div>

                  <div className="shrink-0 text-xs font-semibold tabular-nums">
                    {item.status === "uploading" && (
                      <span className="text-indigo-600 dark:text-indigo-400">{item.progress}%</span>
                    )}
                    {item.status === "verifying" && (
                      <span className="text-blue-600 dark:text-blue-400">Đang xác thực...</span>
                    )}
                    {item.status === "completed" && (
                      <span className="text-emerald-600 dark:text-emerald-400">Hoàn tất!</span>
                    )}
                    {item.status === "error" && (
                      <span className="text-rose-600 dark:text-rose-400">Thất bại</span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/[0.06]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      item.status === "error"
                        ? "bg-rose-500"
                        : item.status === "completed"
                          ? "bg-emerald-500"
                          : "bg-indigo-600 dark:bg-indigo-500"
                    }`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>

                {item.errorMessage && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">{item.errorMessage}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danh sách các tài liệu đã tải lên */}
      <div className="flex flex-col gap-3">
        {filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[22px] border border-dashed border-black/[0.08] dark:border-white/[0.1] bg-neutral-50/50 dark:bg-white/[0.02] p-8 text-center animate-in fade-in duration-150">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-neutral-800 shadow-2xs border border-black/[0.06] dark:border-white/[0.08] text-neutral-400 mb-3">
              {filterType === "pdf" ? (
                <FileText className="h-6 w-6 text-rose-500" />
              ) : (
                <ImageIcon className="h-6 w-6 text-emerald-500" />
              )}
            </div>
            <p className="text-sm font-semibold font-heading text-neutral-900 dark:text-white">
              Không có tài liệu {filterType === "pdf" ? "PDF" : "hình ảnh"} nào
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Chưa có tài liệu định dạng này trong danh sách tải lên của phiên học.
            </p>
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Xem tất cả tài liệu ({documents.length})</span>
            </button>
          </div>
        ) : (
          filteredDocuments.map((doc) => {
            const isPdf = doc.mime_type === "application/pdf";
            return (
              <div
                key={doc.id}
                onClick={() => handleCardClick(doc)}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[20px] border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#161922] p-4 shadow-2xs hover:shadow-md hover:border-indigo-500/30 dark:hover:border-indigo-500/40 hover:bg-neutral-50/50 dark:hover:bg-[#1B1F2A] transition-all cursor-pointer select-none"
              >
                {/* Thông tin tệp */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border transition-colors ${
                      isPdf
                        ? "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500/15"
                        : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/15"
                    }`}
                  >
                    {isPdf ? (
                      <span className="text-xs font-black">PDF</span>
                    ) : (
                      <ImageIcon className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <h4 className="truncate text-sm sm:text-base font-semibold text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {doc.file_name}
                    </h4>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 tabular-nums text-xs text-neutral-500 dark:text-neutral-400">
                      <span>{formatBytes(doc.file_size)}</span>
                      <span>•</span>
                      <span>{formatDate(doc.uploaded_at || doc.created_at)}</span>
                      {doc.raw_text && (
                        <>
                          <span>•</span>
                          <span className="text-indigo-600 dark:text-indigo-400">
                            {doc.raw_text.length.toLocaleString()} ký tự
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Trạng thái & Nút thao tác */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-black/[0.04] dark:border-white/[0.06]">
                  {renderStatusBadge(doc)}

                  <div className="flex items-center gap-1.5">
                    {/* Nút Xem chi tiết (Eye Icon) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardClick(doc);
                      }}
                      title={isPdf ? "Xem tài liệu PDF" : "Xem hình ảnh"}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/80 dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 shadow-2xs transition-all hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 cursor-pointer"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    {/* Nút Tải về */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownload?.(doc.id, doc.file_name);
                      }}
                      title="Tải về tệp gốc"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/80 dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 shadow-2xs transition-all hover:bg-neutral-200/80 dark:hover:bg-white/[0.12] hover:text-neutral-900 dark:hover:text-white active:scale-95 cursor-pointer"
                    >
                      <Download className="h-4 w-4" />
                    </button>

                    {/* Nút Xóa */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmDelete(doc.id);
                      }}
                      title="Xóa tài liệu"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/80 dark:bg-white/[0.06] text-neutral-400 shadow-2xs transition-all hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 active:scale-95 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal xác nhận xóa chuẩn Apple Destructive Alert */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-[24px] border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1C202C] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 mb-4">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Xác nhận xóa tài liệu</h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Bạn có chắc chắn muốn xóa tài liệu này không? File gốc trên Cloudflare R2 và toàn bộ dữ liệu văn bản đã trích xuất sẽ bị xóa vĩnh viễn.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] px-4 py-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.1] transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="rounded-full bg-rose-600 hover:bg-rose-700 px-5 py-2 text-sm font-semibold text-white shadow-xs transition-colors cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
