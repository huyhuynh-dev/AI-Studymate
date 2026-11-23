"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  NotebookPen,
  Plus,
  FileUp,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { StudyMateAiIcon } from "@/components/ui/StudyMateAiIcon";
import type { DocumentItem, CreateSummaryRequest } from "@/types";
import { useSummaries } from "@/hooks/useSummaries";
import { useFocusMode } from "@/components/layout";
import SummaryConfigModal from "./SummaryConfigModal";
import SummarySkeleton from "./SummarySkeleton";
import SummaryToolbar from "./SummaryToolbar";
import SummaryListView from "./SummaryListView";
import SummaryTtsPlayer from "./SummaryTtsPlayer";
import { getNoteDisplayTitle } from "./noteHelpers";

// Import SummaryEditor dynamic với SSR = false để tương thích an toàn với Next.js
const SummaryEditor = dynamic(() => import("./SummaryEditor"), {
  ssr: false,
  loading: () => <SummarySkeleton variant="loading" />,
});

export interface SummaryTabProps {
  conversationId?: string;
  documents?: DocumentItem[];
  /** ID của ghi chú / bản tóm tắt cần mở trực tiếp (ví dụ khi nhấn Badge trong khung chat AI) */
  initialSummaryId?: string;
  /** Callback khi bấm nút "Tải lên tài liệu" */
  onUploadDocument?: () => void;
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
  // Chế độ xem: 'list' (tổng quan danh sách) hoặc 'detail' (trang soạn thảo Notion-style)
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isTtsOpen, setIsTtsOpen] = useState(false);
  const [autoFocusNoteId, setAutoFocusNoteId] = useState<string | null>(null);
  const [titleSyncKey, setTitleSyncKey] = useState(0);

  // Zoom state
  const [zoomPercent, setZoomPercent] = useState<number>(100);

  // Focus Mode (Chế độ tập trung / Mở rộng không gian hiển thị)
  const { isFocusMode, toggleFocusMode, setFocusMode, setIsViewingDocument } =
    useFocusMode();

  const {
    summaries,
    activeSummary,
    setSelectedSummaryId,
    isLoading: isSummariesLoading,
    isGenerating,
    isCreatingNote,
    isExportingPdf,
    autoSaveStatus,
    errorMessage,
    clearError,
    createManualNote,
    createSummary,
    autoSaveNote,
    flushPendingSave,
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
  }, [initialSummaryId, isSummariesLoading, summaries, setSelectedSummaryId]);

  // Đồng bộ trạng thái xem chi tiết ghi chú với FocusModeContext để tối ưu layout Box-in-box
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

  // Tạo nhanh trang ghi chú trống (Notion-style)
  const handleCreateManualNote = async () => {
    try {
      const created = await createManualNote();
      if (created) {
        setAutoFocusNoteId(created.id);
        setSelectedSummaryId(created.id);
        setViewMode("detail");
      }
    } catch {
      // Error đã được lưu trong errorMessage của hook
    }
  };

  // Xử lý tạo bản tóm tắt AI từ modal cấu hình
  const handleStartSummarize = async (request: CreateSummaryRequest) => {
    setIsConfigModalOpen(false);
    try {
      const created = await createSummary(request);
      if (created) {
        setAutoFocusNoteId(null);
        setSelectedSummaryId(created.id);
        setViewMode("detail");
      }
    } catch {
      // Error đã được lưu trong errorMessage của hook
    }
  };

  // Click vào 1 trang ghi chú từ danh sách hoặc dropdown switcher
  const handleSelectSummary = (summaryId: string) => {
    void flushPendingSave();
    setAutoFocusNoteId(null);
    setSelectedSummaryId(summaryId);
    setViewMode("detail");
  };

  // Quay lại danh sách tổng quan
  const handleBackToList = () => {
    void flushPendingSave();
    setAutoFocusNoteId(null);
    setFocusMode(false);
    setViewMode("list");
  };

  // Đổi tên từ Toolbar modal và đồng bộ lại ô tiêu đề inline trong Editor
  const handleRenameFromToolbar = async (summaryId: string, newTitle: string) => {
    await renameSummary(summaryId, newTitle);
    setTitleSyncKey((prev) => prev + 1);
  };

  // Xóa ghi chú
  const handleDeleteSummary = async (summaryId: string) => {
    await deleteSummary(summaryId);
    if (summaries.length <= 1) {
      setAutoFocusNoteId(null);
      setFocusMode(false);
      setViewMode("list");
    }
  };

  // 1. Loading ban đầu
  if (isSummariesLoading && summaries.length === 0) {
    return (
      <div className={`flex w-full flex-1 items-center justify-center ${className}`}>
        <SummarySkeleton variant="loading" />
      </div>
    );
  }

  // 2. Trạng thái AI đang đọc và tạo tóm tắt mới
  if (isGenerating) {
    return (
      <div className={`flex w-full flex-1 items-center justify-center ${className}`}>
        <SummarySkeleton variant="generating" />
      </div>
    );
  }

  // 3. Trạng thái ĐÃ CÓ các trang ghi chú
  if (summaries.length > 0) {
    // 3A. Chế độ xem Chi tiết (Detail / Notion Editor View)
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
            onSelectSummary={handleSelectSummary}
            onBackToList={handleBackToList}
            onCreateManual={() => void handleCreateManualNote()}
            onOpenAiModal={() => setIsConfigModalOpen(true)}
            isCreatingNote={isCreatingNote}
            hasDocuments={hasDocuments}
            hasReadyDocuments={hasReadyDocuments}
            onToggleTts={() => setIsTtsOpen(!isTtsOpen)}
            isTtsOpen={isTtsOpen}
            onExportPdf={() => void exportPdf()}
            isExportingPdf={isExportingPdf}
            onRenameSummary={(id, title) => void handleRenameFromToolbar(id, title)}
            onDeleteSummary={(id) => void handleDeleteSummary(id)}
            autoSaveStatus={autoSaveStatus}
            zoomPercent={zoomPercent}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
            isFocusMode={isFocusMode}
            onToggleFocusMode={toggleFocusMode}
          />

          {/* Vùng soạn thảo Ghi chú BlockNote - Chiếm tối đa không gian */}
          <div className="relative flex flex-1 flex-col overflow-hidden">
            <SummaryEditor
              summaryId={activeSummary.id}
              title={activeSummary.title}
              titleSyncKey={titleSyncKey}
              autoFocusTitle={autoFocusNoteId === activeSummary.id}
              initialContent={activeSummary.contentJson}
              onChange={(blocks) =>
                autoSaveNote(activeSummary.id, { contentJson: blocks })
              }
              onTitleChange={(nextTitle) =>
                autoSaveNote(activeSummary.id, { title: nextTitle })
              }
              onTitleBlur={() => void flushPendingSave()}
              onMediaCommitted={() => void flushPendingSave()}
              zoomPercent={zoomPercent}
            />
          </div>

          {/* Web Speech API TTS Floating Mini-Player Pill */}
          <SummaryTtsPlayer
            blocks={activeSummary.contentJson}
            title={getNoteDisplayTitle(activeSummary.title)}
            isOpen={isTtsOpen}
            onClose={() => setIsTtsOpen(false)}
          />

          {/* Modal cấu hình khi muốn tạo thêm bản tóm tắt AI */}
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
      <div
        className={`flex w-full flex-1 flex-col bg-white dark:bg-[#12151C] overflow-hidden ${className}`}
      >
        {errorMessage && (
          <div className="m-4 flex items-center justify-between gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              <span>{errorMessage}</span>
            </div>
            <button type="button" onClick={clearError} className="cursor-pointer">
              <X className="h-4 w-4 text-rose-500" />
            </button>
          </div>
        )}

        <SummaryListView
          summaries={summaries}
          onSelectSummary={handleSelectSummary}
          onCreateManual={() => void handleCreateManualNote()}
          onCreateAi={() => setIsConfigModalOpen(true)}
          onRenameSummary={(id, title) => void renameSummary(id, title)}
          onDeleteSummary={(id) => void handleDeleteSummary(id)}
          onExportPdf={(id) => void exportPdf(id)}
          isCreatingNote={isCreatingNote}
          isExportingPdf={isExportingPdf}
          hasDocuments={hasDocuments}
          hasReadyDocuments={hasReadyDocuments}
        />

        {/* Modal cấu hình khi muốn tạo thêm bản tóm tắt AI */}
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

  // 4. Trạng thái CHƯA CÓ GHI CHÚ NÀO (cho phép tạo ghi chú tự do ngay lập tức hoặc tóm tắt AI)
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
        <NotebookPen className="h-7 w-7 stroke-[1.75]" />
      </div>

      <h2 className="mt-5 text-[19px] sm:text-[21px] font-semibold tracking-[-0.02em] text-neutral-900 dark:text-neutral-100">
        Chưa có ghi chú nào
      </h2>

      <p className="mt-2 max-w-[380px] text-center text-[14px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        {hasDocuments ? (
          <>
            Đã nhận diện{" "}
            <span className="font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">
              {readyDocs.length} tài liệu
            </span>{" "}
            trong phiên học. Tạo trang ghi chú tự do như Notion hoặc để AI tóm tắt tài liệu.
          </>
        ) : (
          "Tạo trang ghi chú mới để tự do ghi chép kiến thức, công thức, sơ đồ — hoặc tải tài liệu lên để AI hỗ trợ tóm tắt."
        )}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={() => void handleCreateManualNote()}
          disabled={isCreatingNote}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] px-5 text-[13px] font-semibold text-white shadow-xs shadow-indigo-500/20 transition-all duration-200 active:scale-[0.97] cursor-pointer disabled:pointer-events-none disabled:opacity-50"
        >
          {isCreatingNote ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 stroke-[2.2]" />
          )}
          <span>Tạo ghi chú mới</span>
        </button>

        {hasDocuments ? (
          <button
            type="button"
            onClick={() => setIsConfigModalOpen(true)}
            disabled={!hasReadyDocuments}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1A1E29] hover:bg-neutral-50 dark:hover:bg-white/[0.06] px-5 text-[13px] font-semibold text-neutral-700 dark:text-neutral-200 shadow-2xs transition-all duration-200 active:scale-[0.97] cursor-pointer disabled:pointer-events-none disabled:opacity-40"
          >
            <StudyMateAiIcon
              variant="simple"
              className="h-4 w-4 text-[#4F46E5] dark:text-[#818CF8]"
            />
            <span>Tóm tắt bằng AI</span>
          </button>
        ) : (
          onUploadDocument && (
            <button
              type="button"
              onClick={onUploadDocument}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1A1E29] hover:bg-neutral-50 dark:hover:bg-white/[0.06] px-5 text-[13px] font-semibold text-neutral-700 dark:text-neutral-200 shadow-2xs transition-all duration-200 active:scale-[0.97] cursor-pointer"
            >
              <FileUp className="h-4 w-4 stroke-[1.9]" />
              <span>Tải lên tài liệu</span>
            </button>
          )
        )}
      </div>

      {hasDocuments && !hasReadyDocuments && (
        <p className="mt-3.5 text-[12px] text-neutral-400 dark:text-neutral-500">
          Đang hoàn tất trích xuất văn bản cho tài liệu mới tải lên…
        </p>
      )}

      {/* Summary Config Modal */}
      {hasDocuments && (
        <SummaryConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          onSubmit={handleStartSummarize}
          documents={documents}
          isSubmitting={isGenerating}
        />
      )}
    </div>
  );
}
