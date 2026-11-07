"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Sparkles,
  BookOpen,
  FileUp,
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
  /** ID của bản tóm tắt cần mở trực tiếp (ví dụ khi người dùng nhấn vào Badge trong khung chat AI) */
  initialSummaryId?: string;
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
  initialSummaryId,
  onUploadDocument,
  className = "",
}: SummaryTabProps) {
  // Chế độ xem: 'list' (tổng quan danh sách) hoặc 'detail' (xem chi tiết editor)
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isTtsOpen, setIsTtsOpen] = useState(false);

  // Zoom state
  const [zoomPercent, setZoomPercent] = useState<number>(100);

  // Focus Mode (Chế độ tập trung / Mở rộng không gian hiển thị)
  const { isFocusMode, toggleFocusMode, setFocusMode, setIsViewingDocument } = useFocusMode();

  const {
    summaries,
    activeSummary,
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

  // Tự động mở chi tiết bản tóm tắt khi được điều hướng từ Badge trong AI Chat
  useEffect(() => {
    if (isSummariesLoading || summaries.length === 0) return;

    const storedId =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem("studymate:open-summary-id")
        : null;
    const targetId = initialSummaryId || storedId;

    if (targetId && summaries.some((s) => s.id === targetId)) {
      setSelectedSummaryId(targetId);
      setViewMode("detail");
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("studymate:open-summary-id");
      }
    }
  }, [
    initialSummaryId,
    isSummariesLoading,
    summaries,
    setSelectedSummaryId,
  ]);

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
        setSelectedSummaryId(created.id);
        setViewMode("detail");
      }
    } catch {
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
          className={`flex w-full flex-1 flex-col bg-white dark:bg-[#12151C] overflow-hidden transition-all duration-300 ${className}`}
        >
          {/* Error notification banner if any */}
          {errorMessage && (
            <div className="flex items-center justify-between gap-2 bg-rose-50 dark:bg-rose-950/40 px-4 py-2 text-xs text-rose-700 dark:text-rose-300 border-b border-rose-200 dark:border-rose-900/50">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={clearError}
                className="text-rose-500 hover:text-rose-800 dark:hover:text-rose-200 cursor-pointer"
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

          {/* Vùng hiển thị Nội dung Tóm tắt - Chiếm tối đa không gian */}
          <div className="relative flex flex-1 flex-col overflow-hidden">
            <SummaryEditor
              summaryId={activeSummary.id}
              initialContent={activeSummary.content_json}
              onChange={(blocks) => autoSaveContent(activeSummary.id, blocks)}
              zoomPercent={zoomPercent}
            />
          </div>

          {/* Web Speech API TTS Floating Mini-Player Pill */}
          <SummaryTtsPlayer
            blocks={activeSummary.content_json}
            title={activeSummary.title}
            isOpen={isTtsOpen}
            onClose={() => setIsTtsOpen(false)}
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

    // 3B. Chế độ xem Danh sách Tổng quan (List View)
    return (
      <div className={`flex w-full flex-1 flex-col bg-white dark:bg-[#12151C] overflow-hidden ${className}`}>
        {errorMessage && (
          <div className="m-4 flex items-center justify-between gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
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
        className={`relative flex w-full flex-1 flex-col items-center justify-center px-6 py-16 text-center select-none ${className}`}
      >
        {/* Error banner */}
        {errorMessage && (
          <div className="mb-6 flex w-full max-w-md items-center justify-between gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-xs text-rose-700 dark:text-rose-400">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorMessage}</span>
            </div>
            <button type="button" onClick={clearError} className="cursor-pointer">
              <X className="h-4 w-4 text-rose-500" />
            </button>
          </div>
        )}

        {/* Biểu tượng Apple Tonal Squircle */}
        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/70 dark:bg-white/[0.04] text-neutral-700 dark:text-neutral-200 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)]">
          <BookOpen className="h-7 w-7 stroke-[1.75]" />
        </div>

        <h2 className="mt-5 text-[19px] sm:text-[21px] font-semibold tracking-[-0.02em] text-neutral-900 dark:text-neutral-100">
          Sẵn sàng tóm tắt
        </h2>

        <p className="mt-2 max-w-[360px] text-center text-[14px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Đã nhận diện{" "}
          <span className="font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">
            {readyDocs.length} tài liệu
          </span>{" "}
          trong phiên học. Tổng hợp các luận điểm và kiến thức trọng tâm với AI.
        </p>

        <button
          type="button"
          onClick={() => setIsConfigModalOpen(true)}
          disabled={!hasReadyDocuments}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] px-5 text-[13px] font-semibold text-white shadow-xs shadow-indigo-500/20 transition-all duration-200 active:scale-[0.97] cursor-pointer disabled:pointer-events-none disabled:opacity-40"
        >
          <Sparkles className="h-4 w-4" />
          <span>Tạo bản tóm tắt</span>
        </button>

        {!hasReadyDocuments && (
          <p className="mt-3.5 text-[12px] text-neutral-400 dark:text-neutral-500">
            Đang hoàn tất trích xuất văn bản cho tài liệu mới tải lên…
          </p>
        )}

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
      className={`relative flex w-full flex-1 flex-col items-center justify-center px-6 py-16 text-center select-none ${className}`}
    >
      {/* Biểu tượng Apple Tonal Squircle */}
      <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/70 dark:bg-white/[0.04] text-neutral-700 dark:text-neutral-200 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)]">
        <BookOpen className="h-7 w-7 stroke-[1.75]" />
      </div>

      <h2 className="mt-5 text-[19px] sm:text-[21px] font-semibold tracking-[-0.02em] text-neutral-900 dark:text-neutral-100">
        Chưa có bản tóm tắt
      </h2>

      <p className="mt-2 max-w-[360px] text-center text-[14px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        Tải lên tài liệu học tập để AI tự động tổng hợp các luận điểm, công thức và kiến thức cốt lõi.
      </p>

      <button
        type="button"
        onClick={onUploadDocument}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] px-5 text-[13px] font-semibold text-white shadow-xs shadow-indigo-500/20 transition-all duration-200 active:scale-[0.97] cursor-pointer"
      >
        <FileUp className="h-4 w-4 stroke-[2]" />
        <span>Tải lên tài liệu</span>
      </button>
    </div>
  );
}
