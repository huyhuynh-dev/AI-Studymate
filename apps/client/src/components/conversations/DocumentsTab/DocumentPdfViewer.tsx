"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPluginRegistration } from "@embedpdf/core";
import { EmbedPDF, useDocumentState } from "@embedpdf/core/react";
import { usePdfiumEngine } from "@embedpdf/engines/react";
import {
  DocumentContent,
  DocumentManagerPluginPackage,
} from "@embedpdf/plugin-document-manager/react";
import {
  Viewport,
  ViewportPluginPackage,
  useViewportCapability,
} from "@embedpdf/plugin-viewport/react";
import {
  Scroller,
  ScrollPluginPackage,
  useScroll,
} from "@embedpdf/plugin-scroll/react";
import {
  RenderLayer,
  RenderPluginPackage,
} from "@embedpdf/plugin-render/react";
import {
  InteractionManagerPluginPackage,
  PagePointerProvider,
} from "@embedpdf/plugin-interaction-manager/react";
import {
  SelectionPluginPackage,
  SelectionLayer,
  useSelectionCapability,
} from "@embedpdf/plugin-selection/react";
import {
  HistoryPluginPackage,
  useHistoryCapability,
} from "@embedpdf/plugin-history/react";
import {
  AnnotationPluginPackage,
  AnnotationLayer,
  useAnnotation,
  AnnotationSelectionMenuProps,
} from "@embedpdf/plugin-annotation/react";
import {
  ZoomPluginPackage,
  ZoomMode,
  useZoom,
  ZoomGestureWrapper,
} from "@embedpdf/plugin-zoom/react";
import {
  ExportPluginPackage,
  useExport,
} from "@embedpdf/plugin-export/react";

import {
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  MoveHorizontal,
  FileText,
  Highlighter,
  Underline,
  Strikethrough,
  StickyNote,
  PenTool,
  MousePointer,
  Copy,
  Check,
  Trash2,
  Undo2,
  Redo2,
  Save,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { DocumentItem } from "@/types";
import { documentsApi } from "@/services/documents.api";
import { useFocusMode } from "@/components/layout";
import { useCitationNavigation } from "@/contexts/CitationNavigationContext";
import { toEmbedPdfRect, calcBoxPixels } from "@/lib/pdf-coordinates";

export interface DocumentPdfViewerProps {
  document: DocumentItem;
  onClose: () => void;
  className?: string;
}

interface PdfToolbarProps {
  documentId: string;
  backendDocumentId: string;
  fileName: string;
  onClose: () => void;
}

/**
 * Thanh công cụ hợp nhất (Unified Apple Header & Toolbar):
 * Chuẩn Apple HIG: Thẻ Pill mờ kính (Backdrop Blur), nút bo tròn Squircle,
 * các công cụ Highlight/Ghi chú với màu sắc sematic tinh tế, nút lưu R2 và điều khiển Focus Mode.
 */
function PdfToolbar({
  documentId,
  backendDocumentId,
  fileName,
  onClose,
}: PdfToolbarProps) {
  const { provides: zoom, state: zoomState } = useZoom(documentId);
  const { provides: viewport } = useViewportCapability();
  const { provides: annotationApi, state: annotationState } = useAnnotation(documentId);
  const { provides: exportApi } = useExport(documentId);
  const { provides: selectionCapability } = useSelectionCapability();
  const { provides: historyCapability } = useHistoryCapability();
  const { isFocusMode, toggleFocusMode, setFocusMode } = useFocusMode();

  const [hasSelection, setHasSelection] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [hasUnsavedHistoryChanges, setHasUnsavedHistoryChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Suy luận trạng thái thay đổi chưa lưu từ lịch sử hoặc pending changes của Annotation
  const hasUnsavedChanges = hasUnsavedHistoryChanges || Boolean(annotationState?.hasPendingChanges);

  const activeToolId = annotationState?.activeToolId ?? null;
  const hasSelectedAnnotation = (annotationState?.selectedUids?.length ?? 0) > 0;

  // Theo dõi trạng thái bôi đen văn bản của tài liệu hiện tại
  useEffect(() => {
    if (!selectionCapability) return;
    const scope = selectionCapability.forDocument(documentId);
    return scope.onSelectionChange((selection) => {
      setHasSelection(!!selection);
    });
  }, [selectionCapability, documentId]);

  // Theo dõi trạng thái Undo / Redo và phát hiện thay đổi chưa lưu của lịch sử Annotation
  useEffect(() => {
    if (!historyCapability) return;
    const scope = historyCapability.forDocument(documentId);
    return scope.onHistoryChange(() => {
      setCanUndo(scope.canUndo());
      setCanRedo(scope.canRedo());
      setHasUnsavedHistoryChanges(true);
      setSaveSuccess(false);
    });
  }, [historyCapability, documentId]);

  const initialZoomAppliedRef = useRef(false);

  // Chỉ khởi tạo zoom sau khi viewport EmbedPDF đã mount và có metrics hợp lệ.
  useEffect(() => {
    if (!zoom || !viewport || initialZoomAppliedRef.current) return;

    const viewportScope = viewport.forDocument(documentId);
    const initializeZoom = () => {
      if (initialZoomAppliedRef.current) return;

      const metrics = viewportScope.getMetrics();
      if (
        viewport.isViewportMounted(documentId) &&
        metrics.clientWidth > 0 &&
        metrics.clientHeight > 0
      ) {
        zoom.requestZoom(1);
        initialZoomAppliedRef.current = true;
      }
    };

    initializeZoom();
    return viewport.onViewportResize((event) => {
      if (event.documentId === documentId) {
        initializeZoom();
      }
    });
  }, [documentId, viewport, zoom]);

  const handleCopySelection = useCallback(() => {
    if (!selectionCapability || !hasSelection) return;
    selectionCapability.forDocument(documentId).copyToClipboard();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [selectionCapability, documentId, hasSelection]);

  const handleDeleteSelectedAnnotation = useCallback(() => {
    if (!annotationApi) return;
    const selected = annotationApi.getSelectedAnnotation();
    if (selected) {
      annotationApi.deleteAnnotation(selected.object.pageIndex, selected.object.id);
    }
  }, [annotationApi]);

  const handleSaveToR2 = useCallback(async () => {
    if (!exportApi || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Đảm bảo mọi thay đổi annotation đang chọn/gõ đều được commit vào PDFium trước khi xuất file
      if (annotationApi) {
        annotationApi.deselectAnnotation();
        await annotationApi.commit().toPromise();
      }

      // 1. Xuất dữ liệu PDF nhị phân (đã nhúng toàn bộ Highlight & Ghi chú) dưới dạng ArrayBuffer
      const arrayBuffer = await exportApi.saveAsCopy().toPromise();

      // 2. Chuyển đổi ArrayBuffer sang đối tượng File chuẩn PDF
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      const updatedFile = new File([blob], fileName, {
        type: "application/pdf",
      });

      // 3. Lấy Presigned PUT URL để ghi đè lên đúng storage_key hiện tại trên Cloudflare R2
      const { uploadUrl } = await documentsApi.getOverwriteUrl(backendDocumentId);

      // 4. Ghi đè tệp PDF trực tiếp lên Cloudflare R2
      await documentsApi.uploadToR2(uploadUrl, updatedFile);

      // 5. Đồng bộ lại dung lượng tệp mới trong cơ sở dữ liệu
      await documentsApi.completeOverwrite(backendDocumentId);

      setHasUnsavedHistoryChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: unknown) {
      console.error("Lỗi khi lưu tài liệu PDF lên R2:", err);
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setSaveError(
        errorObj?.response?.data?.message || errorObj?.message || "Không thể lưu thay đổi"
      );
      setTimeout(() => setSaveError(null), 4000);
    } finally {
      setIsSaving(false);
    }
  }, [exportApi, isSaving, annotationApi, fileName, backendDocumentId]);

  const handleToggleTool = (toolId: string | null) => {
    if (!annotationApi) return;
    if (toolId === null) {
      annotationApi.setActiveTool(null);
      return;
    }
    annotationApi.setActiveTool(activeToolId === toolId ? null : toolId);
  };

  // Phím tắt:
  // - Ctrl+S / Cmd+S: Lưu các chỉnh sửa PDF đè lên Cloudflare R2
  // - Ctrl+C / Cmd+C: Sao chép văn bản đang bôi đen
  // - Delete / Backspace: Xoá Highlight/Ghi chú đang chọn
  // - Escape: Tắt công cụ vẽ hiện tại -> Nếu không bật công cụ vẽ và đang ở Focus Mode thì thoát Focus Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveToR2();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "c" &&
        hasSelection &&
        !isEditingInput
      ) {
        e.preventDefault();
        handleCopySelection();
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        hasSelectedAnnotation &&
        !isEditingInput
      ) {
        e.preventDefault();
        handleDeleteSelectedAnnotation();
      } else if (e.key === "Escape" && !isEditingInput) {
        if (activeToolId !== null) {
          e.stopPropagation();
          annotationApi?.setActiveTool(null);
        } else if (isFocusMode) {
          e.stopPropagation();
          setFocusMode(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    hasSelection,
    hasSelectedAnnotation,
    activeToolId,
    isFocusMode,
    handleSaveToR2,
    handleCopySelection,
    handleDeleteSelectedAnnotation,
    annotationApi,
    setFocusMode,
  ]);

  const annotationTools = [
    {
      id: "highlight",
      label: "Highlight văn bản",
      icon: Highlighter,
      activeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    },
    {
      id: "underline",
      label: "Gạch chân văn bản",
      icon: Underline,
      activeColor: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
    },
    {
      id: "strikeout",
      label: "Gạch ngang văn bản",
      icon: Strikethrough,
      activeColor: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    },
    {
      id: "freeText",
      label: "Thêm hộp ghi chú chữ (Nhấp vào trang để viết)",
      icon: StickyNote,
      activeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    },
    {
      id: "ink",
      label: "Bút vẽ ghi chú tự do",
      icon: PenTool,
      activeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
    },
  ];

  const zoomPercentage = zoomState?.currentZoomLevel
    ? Math.round(zoomState.currentZoomLevel * 100)
    : 100;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/90 dark:bg-[#12151C]/90 backdrop-blur-md px-3 py-2 sm:px-4 sm:py-2.5 shadow-2xs shrink-0 z-10 transition-colors">
      {/* Cụm Trái: Nút Quay lại Apple Pill + Tên tài liệu */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onClose}
          title="Quay lại danh sách tài liệu"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white/80 dark:bg-white/[0.06] px-3 text-xs font-semibold text-neutral-700 dark:text-neutral-200 shadow-2xs transition-all hover:bg-neutral-50 dark:hover:bg-white/[0.1] hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Quay lại</span>
        </button>

        <div className="hidden xl:flex items-center gap-1.5 min-w-0 max-w-[200px] rounded-full bg-neutral-100/80 dark:bg-white/[0.06] px-2.5 py-1 border border-black/[0.04] dark:border-white/[0.06]">
          <span className="rounded-[4px] bg-rose-500/10 border border-rose-500/20 px-1 py-0.2 text-[9px] font-black text-rose-600 dark:text-rose-400 shrink-0">
            PDF
          </span>
          <span
            title={fileName}
            className="truncate text-xs font-medium text-neutral-700 dark:text-neutral-300"
          >
            {fileName}
          </span>
        </div>
      </div>

      {/* Cụm Giữa: Chế độ Con trỏ, Sao chép & Công cụ Highlight / Ghi chú */}
      <div className="flex items-center gap-1">
        {/* Nút Con trỏ */}
        <button
          type="button"
          onClick={() => handleToggleTool(null)}
          title="Chế độ Con trỏ & Bôi đen văn bản"
          className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-medium transition-all active:scale-95 cursor-pointer ${
            activeToolId === null
              ? "border-indigo-500/30 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shadow-2xs"
              : "border-transparent text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-white"
          }`}
        >
          <MousePointer className="h-4 w-4" />
        </button>

        {/* Nút Sao chép */}
        <button
          type="button"
          onClick={handleCopySelection}
          disabled={!hasSelection && !copied}
          title={
            hasSelection
              ? "Sao chép văn bản đang bôi đen (Ctrl+C)"
              : "Bôi đen văn bản trên PDF để sao chép"
          }
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-all active:scale-95 ${
            copied
              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 cursor-default"
              : hasSelection
                ? "border-indigo-600 bg-[#4F46E5] text-white shadow-2xs hover:bg-[#4338CA] cursor-pointer"
                : "border-black/[0.04] dark:border-white/[0.06] bg-neutral-100/50 dark:bg-white/[0.03] text-neutral-400 dark:text-neutral-600 cursor-not-allowed"
          }`}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Đã chép</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Sao chép</span>
            </>
          )}
        </button>

        <div className="mx-1 h-5 w-px bg-black/[0.08] dark:bg-white/[0.1]" />

        {/* Công cụ Highlight & Ghi chú */}
        <div className="flex items-center gap-0.5">
          {annotationTools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeToolId === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => handleToggleTool(tool.id)}
                title={tool.label}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all active:scale-95 cursor-pointer ${
                  isActive
                    ? `${tool.activeColor} shadow-2xs`
                    : "border-transparent text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>

        <div className="mx-1 h-5 w-px bg-black/[0.08] dark:bg-white/[0.1]" />

        {/* Hoàn tác / Làm lại & Xoá Annotation */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => historyCapability?.forDocument(documentId).undo()}
            disabled={!canUndo}
            title="Hoàn tác (Undo)"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <Undo2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => historyCapability?.forDocument(documentId).redo()}
            disabled={!canRedo}
            title="Làm lại (Redo)"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <Redo2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleDeleteSelectedAnnotation}
            disabled={!hasSelectedAnnotation}
            title={
              hasSelectedAnnotation
                ? "Xoá Highlight / Ghi chú đang chọn (Delete)"
                : "Chọn một Highlight hoặc Ghi chú để xoá"
            }
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all active:scale-95 ${
              hasSelectedAnnotation
                ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                : "border-transparent text-neutral-300 dark:text-neutral-700 cursor-not-allowed"
            }`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-1 h-5 w-px bg-black/[0.08] dark:bg-white/[0.1]" />

        {/* Nút Lưu chỉnh sửa đè lên Cloudflare R2 */}
        <button
          type="button"
          onClick={handleSaveToR2}
          disabled={!exportApi || isSaving}
          title={
            saveError
              ? `Lỗi lưu: ${saveError} (Nhấn để thử lại)`
              : hasUnsavedChanges
                ? "Lưu các Highlight & Ghi chú lên đám mây (Ctrl+S)"
                : "Lưu tài liệu PDF lên đám mây (Ctrl+S)"
          }
          className={`relative inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-all active:scale-95 ${
            isSaving
              ? "border-indigo-500/30 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 cursor-wait"
              : saveError
                ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                : saveSuccess
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 cursor-default"
                  : hasUnsavedChanges
                    ? "border-indigo-600 bg-[#4F46E5] text-white shadow-2xs hover:bg-[#4338CA] cursor-pointer"
                    : "border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-200 hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="hidden sm:inline">Đang lưu...</span>
            </>
          ) : saveError ? (
            <>
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lỗi lưu</span>
            </>
          ) : saveSuccess ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Đã lưu</span>
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lưu</span>
              {hasUnsavedChanges && (
                <span
                  aria-label="Có thay đổi chưa lưu"
                  className="h-1.5 w-1.5 rounded-full bg-amber-400 ring-2 ring-white/50"
                />
              )}
            </>
          )}
        </button>
      </div>

      {/* Cụm Phải: Segmented Zoom Pill & Nút Focus Mode */}
      <div className="flex items-center gap-1.5">
        {zoom && (
          <div className="flex items-center gap-0.5 rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-neutral-100/80 dark:bg-white/[0.05] p-0.5">
            <button
              type="button"
              onClick={() => zoom.zoomOut()}
              title="Thu nhỏ"
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-white dark:hover:bg-white/[0.1] hover:text-neutral-900 dark:hover:text-white hover:shadow-2xs cursor-pointer"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => zoom.requestZoom(1)}
              title="Đặt lại 100%"
              className="min-w-[44px] rounded-md px-1 py-1 text-center font-mono tabular-nums text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-white dark:hover:bg-white/[0.1] cursor-pointer"
            >
              {zoomPercentage}%
            </button>

            <button
              type="button"
              onClick={() => zoom.zoomIn()}
              title="Phóng to"
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-white dark:hover:bg-white/[0.1] hover:text-neutral-900 dark:hover:text-white hover:shadow-2xs cursor-pointer"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>

            <div className="mx-0.5 h-4 w-px bg-black/[0.08] dark:bg-white/[0.1]" />

            <button
              type="button"
              onClick={() => zoom.requestZoom(ZoomMode.FitWidth)}
              title="Vừa chiều ngang khung hình"
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-white dark:hover:bg-white/[0.1] hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-2xs cursor-pointer"
            >
              <MoveHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Nút Chế độ tập trung (Focus Mode) */}
        <button
          type="button"
          onClick={toggleFocusMode}
          title={
            isFocusMode
              ? "Thoát Chế độ tập trung (Esc)"
              : "Chế độ tập trung — Ẩn thanh điều hướng & mở rộng tối đa vùng đọc PDF"
          }
          className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all active:scale-95 cursor-pointer ${
            isFocusMode
              ? "border-indigo-600 bg-[#4F46E5] text-white shadow-xs hover:bg-[#4338CA]"
              : "border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-200 shadow-2xs hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400"
          }`}
        >
          {isFocusMode ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Menu ngữ cảnh nhỏ xuất hiện ngay trên Highlight / Ghi chú khi người dùng click chọn annotation
 * Thiết kế chuẩn Apple Floating Pill
 */
function AnnotationQuickMenu({
  selected,
  context,
  menuWrapperProps,
  rect,
  documentId,
}: AnnotationSelectionMenuProps & { documentId: string }) {
  const { provides: annotationApi } = useAnnotation(documentId);

  if (!selected || context.structurallyLocked) return null;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    annotationApi?.deleteAnnotation(context.pageIndex, context.annotation.object.id);
  };

  return (
    <div {...menuWrapperProps}>
      <div
        style={{
          position: "absolute",
          top: rect.size.height + 6,
          left: Math.max(0, rect.size.width / 2 - 36),
          pointerEvents: "auto",
          cursor: "default",
          zIndex: 50,
        }}
      >
        <button
          type="button"
          onClick={handleDelete}
          className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-white/95 dark:bg-[#1E2330]/95 backdrop-blur-md px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 shadow-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Xoá</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Quản lý sự kiện Nhảy trang (Jump-to-Page) và Lắng nghe Click-outside để tắt Highlight
 * của hệ thống RAG Phase 2.
 */
function PdfCitationManager({
  documentId,
  backendDocumentId,
}: {
  documentId: string;
  backendDocumentId: string;
}) {
  const { provides: scroll } = useScroll(documentId);
  const docState = useDocumentState(documentId);
  const {
    activeTarget,
    activeHighlight,
    consumeActiveTarget,
    setHighlight,
    clearHighlight,
  } = useCitationNavigation();

  // 1. Nhảy trang và thiết lập vùng tô sáng (Highlight Overlay) khi có activeTarget
  useEffect(() => {
    if (!activeTarget || !scroll) return;

    // Bỏ qua nếu lệnh trỏ tới tài liệu khác
    if (activeTarget.documentId && activeTarget.documentId !== backendDocumentId) {
      return;
    }

    const pageNo = activeTarget.pageNo || 1;
    const pageIndex = Math.max(0, pageNo - 1);
    const pageSize = docState?.document?.pages[pageIndex]?.size;
    const pageHeight = pageSize?.height || 792;

    const bboxes = Array.isArray(activeTarget.bboxes) ? activeTarget.bboxes : [];
    const firstBbox = bboxes.length > 0 ? bboxes[0] : null;

    if (firstBbox) {
      const rect = toEmbedPdfRect(firstBbox, pageHeight);
      if (rect) {
        scroll.scrollToPage({
          pageNumber: pageNo,
          pageCoordinates: { x: rect.x, y: rect.y },
          behavior: "smooth",
          alignY: 35, // Canh đoạn trích ở khoảng 1/3 từ trên xuống
        });
      } else {
        scroll.scrollToPage({
          pageNumber: pageNo,
          behavior: "smooth",
          alignY: 0,
        });
      }
    } else {
      scroll.scrollToPage({
        pageNumber: pageNo,
        behavior: "smooth",
        alignY: 0,
      });
    }

    // Thiết lập vùng tô sáng
    if (bboxes.length > 0) {
      setHighlight({
        documentId: backendDocumentId,
        pageIndex,
        bboxes,
        createdAt: Date.now(),
      });
    }

    // Consume activeTarget sau khi cuộn xong (tránh lặp lại khi chuyển Tab)
    consumeActiveTarget();
  }, [
    activeTarget,
    backendDocumentId,
    scroll,
    docState,
    setHighlight,
    consumeActiveTarget,
  ]);

  // 2. Lắng nghe sự kiện click ra ngoài để ẩn khung highlight
  useEffect(() => {
    if (!activeHighlight) return;

    const handlePointerDown = () => {
      // Bảo vệ: Bỏ qua nếu cú click xảy ra trong vòng 250ms đầu tiên (tránh bắt nhầm cú click mở trích dẫn)
      const elapsed = Date.now() - activeHighlight.createdAt;
      if (elapsed < 250) {
        return;
      }
      clearHighlight();
    };

    window.addEventListener("pointerdown", handlePointerDown, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, { capture: true });
    };
  }, [activeHighlight, clearHighlight]);

  return null;
}

/**
 * Lớp phủ tô sáng (Highlight Overlay) đè lên trang PDF đang hiển thị trích dẫn RAG
 */
function CitationHighlightLayer({
  documentId,
  backendDocumentId,
  pageIndex,
  renderedWidth,
  renderedHeight,
}: {
  documentId: string;
  backendDocumentId: string;
  pageIndex: number;
  renderedWidth: number;
  renderedHeight: number;
}) {
  const { activeHighlight } = useCitationNavigation();
  const docState = useDocumentState(documentId);

  if (
    !activeHighlight ||
    activeHighlight.documentId !== backendDocumentId ||
    activeHighlight.pageIndex !== pageIndex ||
    !Array.isArray(activeHighlight.bboxes) ||
    activeHighlight.bboxes.length === 0
  ) {
    return null;
  }

  const pageSize = docState?.document?.pages[pageIndex]?.size;
  const pagePointWidth = pageSize?.width || 612;
  const pagePointHeight = pageSize?.height || 792;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {activeHighlight.bboxes.map((rawBox, idx) => {
        const box = calcBoxPixels(
          rawBox,
          pagePointWidth,
          pagePointHeight,
          renderedWidth,
          renderedHeight
        );
        if (!box) return null;

        return (
          <div
            key={idx}
            className="absolute rounded-md bg-amber-400/25 dark:bg-amber-400/30 ring-2 ring-amber-500/80 dark:ring-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all duration-300 animate-in fade-in zoom-in-95"
            style={{
              left: `${box.left}px`,
              top: `${box.top}px`,
              width: `${box.width}px`,
              height: `${box.height}px`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function DocumentPdfViewer({
  document,
  onClose,
  className = "",
}: DocumentPdfViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState<boolean>(true);
  const [urlError, setUrlError] = useState<string | null>(null);

  const { isFocusMode, toggleFocusMode } = useFocusMode();
  const { engine, isLoading: isEngineLoading, error: engineError } = usePdfiumEngine();

  const fetchPdfViewUrl = useCallback(async () => {
    setIsLoadingUrl(true);
    setUrlError(null);
    try {
      const res = await documentsApi.getViewUrl(document.id);
      setPdfUrl(res.downloadUrl);
    } catch (err: unknown) {
      console.error(`Không thể lấy URL PDF cho document ${document.id}:`, err);
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setUrlError(
        errorObj?.response?.data?.message || errorObj?.message || "Không thể tải đường dẫn tài liệu PDF"
      );
    } finally {
      setIsLoadingUrl(false);
    }
  }, [document.id]);

  useEffect(() => {
    let ignore = false;
    documentsApi
      .getViewUrl(document.id)
      .then((res) => {
        if (!ignore) {
          setPdfUrl(res.downloadUrl);
          setIsLoadingUrl(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          console.error(`Không thể lấy URL PDF cho document ${document.id}:`, err);
          const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
          setUrlError(
            errorObj?.response?.data?.message || errorObj?.message || "Không thể tải đường dẫn tài liệu PDF"
          );
          setIsLoadingUrl(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [document.id]);

  // Đăng ký các plugins của EmbedPDF Headless khi đã có URL tài liệu
  const plugins = useMemo(() => {
    if (!pdfUrl) return [];
    return [
      createPluginRegistration(DocumentManagerPluginPackage, {
        initialDocuments: [
          {
            url: pdfUrl,
            name: document.file_name,
          },
        ],
      }),
      createPluginRegistration(ViewportPluginPackage, {
        viewportGap: 16,
      }),
      createPluginRegistration(ScrollPluginPackage),
      createPluginRegistration(RenderPluginPackage),
      createPluginRegistration(InteractionManagerPluginPackage),
      createPluginRegistration(SelectionPluginPackage),
      createPluginRegistration(HistoryPluginPackage),
      createPluginRegistration(AnnotationPluginPackage, {
        annotationAuthor: "StudyMate User",
        autoCommit: true,
        deactivateToolAfterCreate: false,
        selectAfterCreate: true,
      }),
      createPluginRegistration(ZoomPluginPackage, {
        defaultZoomLevel: 1,
      }),
      createPluginRegistration(ExportPluginPackage, {
        defaultFileName: document.file_name,
      }),
    ];
  }, [pdfUrl, document.file_name]);

  const isPreparing = isLoadingUrl || isEngineLoading;
  const fatalError = urlError || (engineError ? engineError.message : null);

  return (
    <div
      className={`flex w-full flex-col overflow-hidden rounded-[24px] border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100 dark:bg-[#0B0D12] transition-all duration-300 ease-in-out ${
        isFocusMode
          ? "h-screen flex-1 rounded-none border-none"
          : "h-[calc(100vh-185px)] min-h-[580px] flex-1"
      } ${className}`}
    >
      {/* Thanh Header phụ trợ khi đang tải hoặc gặp lỗi (trước khi PdfToolbar được mount) */}
      {(isPreparing || fatalError) && (
        <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] bg-white/90 dark:bg-[#12151C]/90 px-3 py-2 sm:px-4 sm:py-2.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white/80 dark:bg-white/[0.06] px-3 text-xs font-semibold text-neutral-700 dark:text-neutral-200 shadow-2xs transition-all hover:bg-neutral-50 dark:hover:bg-white/[0.1] hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Quay lại</span>
            </button>
            <span className="truncate text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              {document.file_name}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleFocusMode}
            title={isFocusMode ? "Thoát Chế độ tập trung (Esc)" : "Chế độ tập trung"}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/[0.1] cursor-pointer"
          >
            {isFocusMode ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>
      )}

      {/* Trạng thái đang khởi tạo WebAssembly Engine hoặc đang lấy Presigned URL */}
      {isPreparing && !fatalError && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-neutral-50/80 dark:bg-[#0F1218] text-neutral-600 dark:text-neutral-400">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="text-sm font-medium">
            {isEngineLoading
              ? "Đang khởi tạo bộ xử lý PDF..."
              : "Đang tải tài liệu PDF từ đám mây..."}
          </p>
        </div>
      )}

      {/* Trạng thái lỗi */}
      {fatalError && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-neutral-50/80 dark:bg-[#0F1218] p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <AlertCircle className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">Không thể mở tài liệu PDF</p>
          <p className="max-w-md text-xs text-neutral-500 dark:text-neutral-400">{fatalError}</p>
          <button
            type="button"
            onClick={fetchPdfViewUrl}
            className="mt-1 rounded-full bg-[#4F46E5] px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#4338CA] transition-all cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Trình xem EmbedPDF Headless (Không bọc viền lồng nhau - Tràn sát khung container) */}
      {!isPreparing && !fatalError && engine && pdfUrl && plugins.length > 0 && (
        <EmbedPDF engine={engine} plugins={plugins}>
          {({ activeDocumentId }) =>
            activeDocumentId && (
              <DocumentContent documentId={activeDocumentId}>
                {({ isLoading, isError, isLoaded }) => (
                  <div className="flex h-full w-full flex-col overflow-hidden">
                    {isLoading && (
                      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-neutral-50/80 dark:bg-[#0F1218] text-neutral-600 dark:text-neutral-400">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
                        <p className="text-sm font-medium">Đang kết xuất các trang PDF...</p>
                      </div>
                    )}

                    {isError && (
                      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-neutral-50/80 dark:bg-[#0F1218] p-6 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          <FileText className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                          Lỗi đọc dữ liệu tệp PDF
                        </p>
                        <p className="max-w-md text-xs text-neutral-500 dark:text-neutral-400">
                          Tệp PDF có thể bị hỏng hoặc phiên truy cập đã hết hạn.
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/[0.1] transition-colors cursor-pointer"
                          >
                            Quay lại
                          </button>
                          <button
                            type="button"
                            onClick={fetchPdfViewUrl}
                            className="rounded-full bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4338CA] transition-colors cursor-pointer"
                          >
                            Tải lại tài liệu
                          </button>
                        </div>
                      </div>
                    )}

                    {isLoaded && (
                      <>
                        {/* Quản lý sự kiện Nhảy trang RAG & Highlight */}
                        <PdfCitationManager
                          documentId={activeDocumentId}
                          backendDocumentId={document.id}
                        />

                        {/* Thanh công cụ hợp nhất duy nhất ở trên cùng */}
                        <PdfToolbar
                          documentId={activeDocumentId}
                          backendDocumentId={document.id}
                          fileName={document.file_name}
                          onClose={onClose}
                        />

                        {/* Vùng cuộn các trang PDF chiếm trọn 100% diện tích còn lại */}
                        <div className="relative flex-1 min-h-0 overflow-hidden bg-neutral-200/60 dark:bg-[#0E1117]">
                          <Viewport
                            documentId={activeDocumentId}
                            style={{
                              width: "100%",
                              height: "100%",
                              backgroundColor: "transparent",
                            }}
                          >
                            <ZoomGestureWrapper documentId={activeDocumentId}>
                              <Scroller
                                documentId={activeDocumentId}
                                renderPage={({ width, height, pageIndex }) => (
                                  <PagePointerProvider
                                    documentId={activeDocumentId}
                                    pageIndex={pageIndex}
                                  >
                                    <div
                                      style={{
                                        width,
                                        height,
                                        position: "relative",
                                        userSelect: "none",
                                        WebkitUserSelect: "none",
                                        backgroundColor: "#ffffff",
                                        borderRadius: "8px",
                                        overflow: "hidden",
                                        boxShadow:
                                          "0 10px 30px -5px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                                      }}
                                    >
                                      {/* Lớp 1: Hiển thị đồ hoạ trang PDF */}
                                      <RenderLayer
                                        documentId={activeDocumentId}
                                        pageIndex={pageIndex}
                                        style={{ pointerEvents: "none" }}
                                      />

                                      {/* Lớp 2: Bôi đen & Sao chép văn bản */}
                                      <SelectionLayer
                                        documentId={activeDocumentId}
                                        pageIndex={pageIndex}
                                      />

                                      {/* Lớp 3: Highlight & Ghi chú */}
                                      <AnnotationLayer
                                        documentId={activeDocumentId}
                                        pageIndex={pageIndex}
                                        selectionMenu={(menuProps) => (
                                          <AnnotationQuickMenu
                                            {...menuProps}
                                            documentId={activeDocumentId}
                                          />
                                        )}
                                      />

                                      {/* Lớp 4: Lớp phủ Highlight trích dẫn RAG Phase 2 */}
                                      <CitationHighlightLayer
                                        documentId={activeDocumentId}
                                        backendDocumentId={document.id}
                                        pageIndex={pageIndex}
                                        renderedWidth={width}
                                        renderedHeight={height}
                                      />
                                    </div>
                                  </PagePointerProvider>
                                )}
                              />
                            </ZoomGestureWrapper>
                          </Viewport>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </DocumentContent>
            )
          }
        </EmbedPDF>
      )}
    </div>
  );
}
