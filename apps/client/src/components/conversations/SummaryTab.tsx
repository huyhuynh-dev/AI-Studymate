"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Sparkles,
  BookOpen,
  FileUp,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { DocumentItem, CreateSummaryRequest } from "@/types";
import { useSummaries } from "@/hooks/useSummaries";
import { useFocusMode } from "@/components/layout";
import SummaryConfigModal from "./SummaryConfigModal";
import SummarySkeleton from "./SummarySkeleton";
import SummaryToolbar from "./SummaryToolbar";
import SummaryListView from "./SummaryListView";
import SummaryTtsPlayer from "./SummaryTtsPlayer";

// Import SummaryEditor dynamic với SSR = false để tương thích an toàn với Next.js
const SummaryEditor = dynamic(() => import("./SummaryEditor"), {
  ssr: false,
  loading: () => <SummarySkeleton />,
});

export interface SummaryTabProps {
  conversationId?: string;
  documents?: DocumentItem[];
  /** Callback khi bấm nút "Tải tài liệu để AI tóm tắt" */
  onUploadDocument?: () => void;
  /** Callback khi bấm nút "Nhập ghi chú hoặc dán văn bản" */
  onInputText?: () => void;
  /** Class tùy chọn cho container ngoài cùng */
  className?: string;
}

const ZOOM_STEPS = [75, 90, 100, 115, 130, 150, 175];

export default function SummaryTab({
  conversationId,
  documents = [],
  onUploadDocument,
  onInputText,
  className = "",
}: SummaryTabProps) {
  // Chế độ xem: 'list' (tổng quan danh sách) hoặc 'detail' (xem chi tiết editor)
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isTtsOpen, setIsTtsOpen] = useState(false);

  // Zoom state
  const [zoomPercent, setZoomPercent] = useState<number>(100);

  // Focus Mode (Chế độ tập trung / Mở rộng không gian hiển thị giống DocumentsTab)
  const { isFocusMode, toggleFocusMode, setFocusMode, setIsViewingDocument } = useFocusMode();

  const {
    summaries,
    activeSummary,
    selectedSummaryId,
    setSelectedSummaryId,
    isLoading: isSummariesLoading,
    isGenerating,
    isExportingPdf,
    autoSaveStatus,
    errorMessage,
    clearError,
    createSummary,
    autoSaveContent,
    exportPdf,
    renameSummary,
    deleteSummary,
  } = useSummaries(conversationId);

  // Đồng bộ trạng thái xem chi tiết tóm tắt với FocusModeContext để tối ưu layout Box-in-box
  useEffect(() => {
    const isViewing = viewMode === "detail" && Boolean(activeSummary);
    setIsViewingDocument(isViewing);
    return () => {
      setIsViewingDocument(false);
    };
  }, [viewMode, activeSummary, setIsViewingDocument]);

  // Nhấn phím Escape để thoát Chế độ tập trung (Focus Mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFocusMode) {
        setFocusMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFocusMode, setFocusMode]);

  // Zoom handlers
  const handleZoomIn = () => {
    setZoomPercent((prev) => {
      const next = ZOOM_STEPS.find((step) => step > prev);
      return next ?? prev;
    });
  };

  const handleZoomOut = () => {
    setZoomPercent((prev) => {
      const reversed = [...ZOOM_STEPS].reverse();
      const prevStep = reversed.find((step) => step < prev);
      return prevStep ?? prev;
    });
  };

  const handleZoomReset = () => {
    setZoomPercent(100);
  };

  // Lọc tài liệu đã xử lý thành công
  const readyDocs = documents.filter((d) => d.ocr_status === "done");
  const hasDocuments = documents.length > 0;
  const hasReadyDocuments = readyDocs.length > 0;

  // Xử lý tạo tóm tắt từ modal cấu hình
  const handleStartSummarize = async (request: CreateSummaryRequest) => {
    setIsConfigModalOpen(false);
    try {
      const created = await createSummary(request);
      if (created) {
        // Tự động điều hướng đến thẳng tóm tắt vừa tạo
        setSelectedSummaryId(created.id);
        setViewMode("detail");
      }
    } catch (err) {
      // Error đã được lưu trong errorMessage của hook
    }
  };

  // Click vào 1 bản tóm tắt từ danh sách
  const handleSelectSummaryFromList = (summaryId: string) => {
    setSelectedSummaryId(summaryId);
    setViewMode("detail");
  };

  // Quay lại danh sách tổng quan
  const handleBackToList = () => {
    setFocusMode(false);
    setViewMode("list");
  };

  // Xóa tóm tắt
  const handleDeleteSummary = async (summaryId: string) => {
    await deleteSummary(summaryId);
    // Nếu xóa tóm tắt đang xem hoặc không còn tóm tắt nào thì quay lại danh sách
    if (summaries.length <= 1) {
      setFocusMode(false);
      setViewMode("list");
    }
  };

  // 1. Loading ban đầu
  if (isSummariesLoading && summaries.length === 0) {
    return (
      <div className={`flex w-full flex-1 items-center justify-center ${className}`}>
        <SummarySkeleton />
      </div>
    );
  }

  // 2. Trạng thái AI đang đọc và tạo tóm tắt mới
  if (isGenerating) {
    return (
      <div className={`flex w-full flex-1 items-center justify-center ${className}`}>
        <SummarySkeleton />
      </div>
    );
  }

  // 3. Trạng thái ĐÃ CÓ các bản tóm tắt
  if (summaries.length > 0) {
    // 3A. Chế độ xem Chi tiết (Detail / Editor View)
    if (viewMode === "detail" && activeSummary) {
      return (
        <div
          className={`flex w-full flex-1 flex-col bg-white overflow-hidden transition-all duration-300 ${
            isFocusMode
              ? "h-full rounded-none border-0 shadow-none"
              : `rounded-2xl sm:rounded-3xl border border-gray-200/80 shadow-2xs ${className}`
          }`}
        >
          {/* Error notification banner if any */}
          {errorMessage && (
            <div className="flex items-center justify-between gap-2 bg-rose-50 px-4 py-2 text-xs text-rose-700 border-b border-rose-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={clearError}
                className="text-rose-500 hover:text-rose-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Header Toolbar tinh gọn */}
          <SummaryToolbar
            summaries={summaries}
            activeSummary={activeSummary}
            onSelectSummary={(id) => {
              setSelectedSummaryId(id);
              setViewMode("detail");
            }}
            onBackToList={handleBackToList}
            onOpenCreateModal={() => setIsConfigModalOpen(true)}
            onToggleTts={() => setIsTtsOpen(!isTtsOpen)}
            isTtsOpen={isTtsOpen}
            onExportPdf={exportPdf}
            isExportingPdf={isExportingPdf}
            onRenameSummary={renameSummary}
            onDeleteSummary={handleDeleteSummary}
            autoSaveStatus={autoSaveStatus}
            zoomPercent={zoomPercent}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
            isFocusMode={isFocusMode}
            onToggleFocusMode={toggleFocusMode}
          />

          {/* Web Speech API TTS Player Bar nếu đang mở */}
          {isTtsOpen && (
            <div className="p-3 border-b border-indigo-100 bg-indigo-50/40">
              <SummaryTtsPlayer
                blocks={activeSummary.content_json}
                title={activeSummary.title}
                isOpen={isTtsOpen}
                onClose={() => setIsTtsOpen(false)}
              />
            </div>
          )}

          {/* Vùng hiển thị Nội dung Tóm tắt - Chiếm tối đa không gian */}
          <div className="relative flex flex-1 flex-col overflow-hidden">
            <SummaryEditor
              summaryId={activeSummary.id}
              initialContent={activeSummary.content_json}
              onChange={(blocks) => autoSaveContent(activeSummary.id, blocks)}
              zoomPercent={zoomPercent}
            />
          </div>

          {/* Modal cấu hình khi muốn tạo thêm bản tóm tắt */}
          <SummaryConfigModal
            isOpen={isConfigModalOpen}
            onClose={() => setIsConfigModalOpen(false)}
            onSubmit={handleStartSummarize}
            documents={documents}
            isSubmitting={isGenerating}
          />
        </div>
      );
    }

    // 3B. Chế độ xem Danh sách Tổng quan (List View)
    return (
      <div className={`flex w-full flex-1 flex-col ${className}`}>
        {errorMessage && (
          <div className="mb-4 flex items-center justify-between gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-xs text-rose-700 border border-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
            <button type="button" onClick={clearError}>
              <X className="h-4 w-4 text-rose-500" />
            </button>
          </div>
        )}

        <SummaryListView
          summaries={summaries}
          onSelectSummary={handleSelectSummaryFromList}
          onCreateNew={() => setIsConfigModalOpen(true)}
          onRenameSummary={renameSummary}
          onDeleteSummary={handleDeleteSummary}
          onExportPdf={exportPdf}
          isExportingPdf={isExportingPdf}
        />

        {/* Modal cấu hình khi muốn tạo thêm bản tóm tắt */}
        <SummaryConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          onSubmit={handleStartSummarize}
          documents={documents}
          isSubmitting={isGenerating}
        />
      </div>
    );
  }

  // 4. Trạng thái ĐÃ CÓ TÀI LIỆU nhưng CHƯA CÓ bản tóm tắt nào
  if (hasDocuments) {
    return (
      <div
        className={`relative flex w-full flex-col items-center justify-center rounded-3xl border border-indigo-100/90 bg-gradient-to-b from-[#F5F8FF] to-white px-6 py-12 sm:px-12 sm:py-16 text-center select-none shadow-xs ${className}`}
      >
        {/* Error banner */}
        {errorMessage && (
          <div className="mb-6 flex items-center justify-between gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-xs text-rose-700 border border-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
            <button type="button" onClick={clearError}>
              <X className="h-4 w-4 text-rose-500" />
            </button>
          </div>
        )}

        {/* Central Illustration */}
        <div className="relative mb-6 sm:mb-8 flex items-center justify-center">
          <div className="relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-3xl bg-white p-2 shadow-sm border border-indigo-50">
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] shadow-md shadow-indigo-500/25">
              <Sparkles className="h-8 w-8 text-white fill-white animate-pulse" />
            </div>
            <div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-white shadow-md shadow-indigo-500/10">
              <BookOpen className="h-4.5 w-4.5 text-[#4F46E5]" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
          Sẵn sàng tạo bản Tóm tắt AI
        </h2>

        {/* Description */}
        <p className="mt-2.5 max-w-xl text-center text-sm sm:text-[15px] leading-relaxed text-gray-600">
          Hệ thống đã nhận diện được{" "}
          <strong className="text-indigo-600 font-semibold">
            {readyDocs.length} tài liệu học tập
          </strong>{" "}
          trong cuộc trò chuyện này. Hãy thiết lập và để AI tổng hợp kiến thức trọng tâm cho bạn.
        </p>

        {/* Primary Action Button: "Tóm tắt tài liệu" */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setIsConfigModalOpen(true)}
            disabled={!hasReadyDocuments}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-6 py-3 text-sm sm:text-base font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:bg-[#4338CA] hover:shadow-lg hover:shadow-indigo-500/30 active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="h-5 w-5 fill-white" />
            <span>Tóm tắt tài liệu ngay</span>
          </button>
        </div>

        {/* Status Indicator */}
        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/80 px-4 py-2 text-xs sm:text-sm text-emerald-800 shadow-2xs">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            {hasReadyDocuments
              ? `Tài liệu đã sẵn sàng: ${readyDocs.map((d) => d.file_name).join(", ").slice(0, 50)}...`
              : "Đang chờ hoàn tất OCR cho các tài liệu mới tải lên..."}
          </span>
        </div>

        {/* Summary Config Modal */}
        <SummaryConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          onSubmit={handleStartSummarize}
          documents={documents}
          isSubmitting={isGenerating}
        />
      </div>
    );
  }

  // 5. Trạng thái MẶC ĐỊNH: CHƯA CÓ TÀI LIỆU NÀO ĐƯỢC TẢI LÊN
  return (
    <div
      className={`relative flex w-full flex-col items-center justify-center rounded-3xl border border-blue-100/80 bg-[#F4F7FF] px-6 py-12 sm:px-12 sm:py-16 text-center select-none ${className}`}
    >
      {/* Central Illustration */}
      <div className="relative mb-6 sm:mb-8 flex items-center justify-center">
        <div className="relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-3xl bg-white p-2 shadow-sm border border-indigo-50">
          <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-tr from-[#4F46E5] to-[#6366F1] shadow-md shadow-indigo-500/20">
            <Sparkles className="h-8 w-8 text-white fill-white" />
          </div>
          <div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-white shadow-md shadow-indigo-500/10">
            <BookOpen className="h-4.5 w-4.5 text-[#4F46E5]" />
          </div>
        </div>
      </div>

      {/* Title */}
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
        Chưa có bản Tóm tắt nào được tạo
      </h2>

      {/* Description */}
      <p className="mt-2.5 max-w-xl text-center text-sm sm:text-[15px] leading-relaxed text-gray-600">
        AI StudyMate cần tài liệu học tập để tự động trích xuất các luận điểm
        quan trọng, công thức và sơ đồ kiến thức cốt lõi cho bạn.
      </p>

      {/* Action Buttons */}
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onUploadDocument}
          className="inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-5 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:bg-[#4338CA] hover:shadow-lg hover:shadow-indigo-500/30 active:scale-[0.98] cursor-pointer"
        >
          <FileUp className="h-5 w-5" />
          <span>Tải tài liệu để AI tóm tắt</span>
        </button>
      </div>

      {/* Notice Banner */}
      <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-indigo-100/70 bg-[#EAF0FE]/90 px-4 py-2 text-xs sm:text-sm text-indigo-700 shadow-2xs">
        <Lightbulb className="h-4 w-4 shrink-0 text-[#4F46E5]" />
        <span>
          Cần có tài liệu ở Tab Tài liệu (PDF) để kích hoạt tính năng tóm tắt tự động.
        </span>
      </div>
    </div>
  );
}
