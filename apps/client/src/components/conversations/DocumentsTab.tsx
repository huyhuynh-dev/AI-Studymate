"use client";

import React, { useRef, useState, DragEvent, ChangeEvent } from "react";
import {
  Plus,
  FileText,
  Image as ImageIcon,
  ScanText,
  Sparkles,
  Brain,
  Download,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  UploadCloud,
} from "lucide-react";
import { DocumentItem, UploadProgressItem } from "@/types";

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
  isUploading = false,
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
          title={doc.processing_error || "Lỗi trong quá trình xử lý"}
          className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200 ring-inset cursor-help"
        >
          <AlertCircle className="h-3.5 w-3.5 text-red-600" />
          Lỗi xử lý
        </span>
      );
    }

    if (doc.ocr_status === "processing" || doc.embed_status === "processing") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 ring-inset">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
          Đang xử lý...
        </span>
      );
    }

    if (doc.ocr_status === "done") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 ring-inset">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Sẵn sàng
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 ring-inset">
        <Loader2 className="h-3.5 w-3.5 text-amber-600" />
        Đang chờ
      </span>
    );
  };

  // 1. Trường hợp chưa có tài liệu nào và không có file đang upload: Hiển thị Hero Dropzone nguyên bản
  const hasContent = documents.length > 0 || uploadQueue.length > 0;

  if (!hasContent && !isLoading) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex w-full flex-col items-center justify-center rounded-3xl border transition-all duration-200 select-none ${isDragging
          ? "border-indigo-400 bg-indigo-50/70 ring-4 ring-indigo-100"
          : "border-blue-100/80 bg-[#F4F7FF]"
          } px-6 py-12 sm:px-12 sm:py-16 text-center ${className}`}
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
          <div className="mb-6 flex w-full max-w-md items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={onClearError}
              type="button"
              className="text-red-500 hover:text-red-700 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Illustration Badge */}
        <div className="relative mb-6 sm:mb-8 flex items-center justify-center">
          <div className="relative flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center rounded-3xl bg-[#ECE7FE] shadow-xs">
            <div className="relative flex items-center justify-center">
              <svg
                className="absolute -top-1.5 -left-1.5 h-14 w-12 text-indigo-400 opacity-60"
                viewBox="0 0 48 56"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 6C4 3.79086 5.79086 2 8 2H30L44 16V50C44 52.2091 42.2091 54 40 54H8C5.79086 54 4 52.2091 4 50V6Z"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <div className="relative z-10 flex h-14 w-12 flex-col items-center justify-center rounded-lg border-[2.5px] border-[#3730A3] bg-white/20 backdrop-blur-xs">
                <div className="absolute top-0 right-0 h-3 w-3 border-b-2 border-l-2 border-[#3730A3] bg-[#ECE7FE] rounded-bl-sm" />
                <div className="mt-1 flex items-center justify-center rounded border border-[#3730A3] px-1 py-0.5">
                  <span className="text-[10px] font-extrabold tracking-tight text-[#3730A3]">
                    PDF
                  </span>
                </div>
              </div>
            </div>

            <div className="absolute -top-2.5 -right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-tr from-[#6366F1] to-[#7C3AED] shadow-md shadow-indigo-500/25">
              <Sparkles className="h-4.5 w-4.5 text-white fill-white" />
            </div>

            <div className="absolute -bottom-2 -left-2 flex h-8 w-8 items-center justify-center rounded-xl bg-[#34D399] shadow-md shadow-emerald-500/20">
              <Brain className="h-4.5 w-4.5 text-[#064E3B]" />
            </div>
          </div>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
          Bắt đầu Không gian học tập của bạn
        </h2>

        <p className="mt-2.5 max-w-xl text-center text-sm sm:text-[15px] leading-relaxed text-gray-600">
          Chưa có tài liệu nào trong phiên học này. Tải lên file PDF hoặc ảnh chụp bài giảng
          (JPEG, PNG, WEBP) để AI StudyMate giúp bạn tóm tắt, tạo flashcard và giải đáp thắc
          mắc chuyên sâu.
        </p>

        <button
          type="button"
          onClick={handleTriggerUpload}
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-6 py-3 text-sm sm:text-base font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:bg-[#4338CA] hover:shadow-lg hover:shadow-indigo-500/30 active:scale-[0.98] cursor-pointer"
        >
          <Plus className="h-5 w-5 stroke-[2.5]" />
          <span>Tải lên tài liệu</span>
        </button>

        <p className="mt-3.5 text-xs sm:text-sm text-gray-500">
          Hoặc kéo và thả tệp tài liệu trực tiếp vào đây (Tối đa {maxSizeMB}MB)
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-gray-200/90 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 shadow-xs">
            <span className="flex items-center justify-center rounded-[3px] border border-red-500 bg-red-50 px-1 py-0.2 text-[9px] font-black text-red-600 leading-none">
              PDF
            </span>
            <span>PDF</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-gray-200/90 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 shadow-xs">
            <ImageIcon className="h-3.5 w-3.5 text-emerald-600" />
            <span>PNG / JPG / WEBP</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-indigo-100 bg-white px-3.5 py-1.5 text-xs font-semibold text-indigo-600 shadow-xs">
            <ScanText className="h-3.5 w-3.5 text-indigo-600" />
            <span>Trích xuất & OCR tự động</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Trường hợp đã có tài liệu hoặc đang tải lên: Giao diện danh sách chuyên nghiệp
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
        <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-700 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={onClearError}
            type="button"
            className="rounded-lg p-1 text-red-500 hover:bg-red-100 hover:text-red-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Thanh Header của Tab */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-gray-900">Tài liệu đã tải lên</h2>
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-50 px-2 text-xs font-bold text-indigo-600">
              {documents.length}
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">
            Quản lý tài liệu học tập của phiên này. AI sẽ dựa vào các tài liệu này để tóm tắt và hỏi đáp.
          </p>
        </div>

        <button
          type="button"
          onClick={handleTriggerUpload}
          className="inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-[#4338CA] active:scale-[0.98] cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Tải thêm tài liệu</span>
        </button>
      </div>

      {/* Vùng kéo thả phụ trợ nếu đang drag */}
      {isDragging && (
        <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-indigo-400 bg-indigo-50/70 p-8 text-center text-sm font-semibold text-indigo-700">
          <UploadCloud className="mr-2 h-6 w-6 animate-bounce" />
          Thả tệp vào đây để tải lên ngay
        </div>
      )}

      {/* Danh sách tệp đang tải lên (Upload Queue) */}
      {uploadQueue.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">
            Tiến trình tải lên ({uploadQueue.length})
          </h3>
          <div className="flex flex-col gap-2.5">
            {uploadQueue.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-1.5 rounded-xl border border-blue-100 bg-white p-3 shadow-xs"
              >
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2 truncate font-medium text-gray-800">
                    <FileText className="h-4 w-4 shrink-0 text-indigo-600" />
                    <span className="truncate">{item.fileName}</span>
                    <span className="text-xs text-gray-400">({formatBytes(item.fileSize)})</span>
                  </div>

                  <div className="shrink-0 text-xs font-semibold">
                    {item.status === "uploading" && (
                      <span className="text-indigo-600">{item.progress}%</span>
                    )}
                    {item.status === "verifying" && (
                      <span className="text-blue-600">Đang xác thực...</span>
                    )}
                    {item.status === "completed" && (
                      <span className="text-emerald-600">Hoàn tất!</span>
                    )}
                    {item.status === "error" && (
                      <span className="text-red-600">Thất bại</span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full transition-all duration-300 ${item.status === "error"
                      ? "bg-red-500"
                      : item.status === "completed"
                        ? "bg-emerald-500"
                        : "bg-indigo-600"
                      }`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>

                {item.errorMessage && (
                  <p className="text-xs text-red-600">{item.errorMessage}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danh sách các tài liệu đã tải lên */}
      <div className="flex flex-col gap-3">
        {documents.map((doc) => {
          const isPdf = doc.mime_type === "application/pdf";
          return (
            <div
              key={doc.id}
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-xs transition-all hover:border-gray-200 hover:shadow-sm"
            >
              {/* Thông tin tệp */}
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${isPdf
                    ? "border-red-100 bg-red-50 text-red-600"
                    : "border-emerald-100 bg-emerald-50 text-emerald-600"
                    }`}
                >
                  {isPdf ? (
                    <span className="text-xs font-black">PDF</span>
                  ) : (
                    <ImageIcon className="h-5 w-5" />
                  )}
                </div>

                <div className="min-w-0">
                  <h4 className="truncate text-sm sm:text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {doc.file_name}
                  </h4>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{formatBytes(doc.file_size)}</span>
                    <span>•</span>
                    <span>{formatDate(doc.uploaded_at || doc.created_at)}</span>
                    {doc.raw_text && (
                      <>
                        <span>•</span>
                        <span className="text-indigo-600">
                          {doc.raw_text.length.toLocaleString()} ký tự
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Trạng thái & Nút thao tác */}
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-50">
                {renderStatusBadge(doc)}

                <div className="flex items-center gap-1.5">
                  {/* Nút Tải về */}
                  <button
                    type="button"
                    onClick={() => onDownload?.(doc.id, doc.file_name)}
                    title="Tải về tệp gốc"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-600 shadow-xs transition-all hover:bg-gray-50 hover:text-gray-900 active:scale-95 cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                  </button>

                  {/* Nút Xóa */}
                  <button
                    type="button"
                    onClick={() => confirmDelete(doc.id)}
                    title="Xóa tài liệu"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-400 shadow-xs transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600 active:scale-95 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal xác nhận xóa */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600 mb-4">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Xác nhận xóa tài liệu</h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa tài liệu này không? File gốc trên Cloudflare R2 và toàn bộ dữ liệu văn bản đã trích xuất sẽ bị xóa vĩnh viễn.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-red-700 cursor-pointer"
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
