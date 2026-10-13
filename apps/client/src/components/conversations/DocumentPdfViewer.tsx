"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPluginRegistration } from "@embedpdf/core";
import { EmbedPDF } from "@embedpdf/core/react";
import { usePdfiumEngine } from "@embedpdf/engines/react";
import {
  DocumentContent,
  DocumentManagerPluginPackage,
} from "@embedpdf/plugin-document-manager/react";
import {
  Viewport,
  ViewportPluginPackage,
} from "@embedpdf/plugin-viewport/react";
import {
  Scroller,
  ScrollPluginPackage,
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
  ArrowLeft,
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
  Loader2,
  AlertCircle,
} from "lucide-react";

import { DocumentItem } from "@/types";
import { documentsApi } from "@/services/documents.api";
import { useFocusMode } from "@/components/layout";

export interface DocumentPdfViewerProps {
  document: DocumentItem;
  onClose: () => void;
  className?: string;
}

interface PdfToolbarProps {
  documentId: string;
  fileName: string;
  onClose: () => void;
}

/**
 * Thanh công cụ hợp nhất (Unified Header & Toolbar):
 * Gộp nút Quay lại + Tên file + Công cụ Tương tác/Ghi chú + Zoom + Nút Chế độ tập trung [↗]/[↙]
 * giúp loại bỏ hoàn toàn tình trạng "Box-in-box Syndrome" (nhiều thanh tiêu đề xếp chồng).
 */
function PdfToolbar({ documentId, fileName, onClose }: PdfToolbarProps) {
  const { provides: zoom, state: zoomState } = useZoom(documentId);
  const { provides: annotationApi, state: annotationState } = useAnnotation(documentId);
  const { provides: selectionCapability } = useSelectionCapability();
  const { provides: historyCapability } = useHistoryCapability();
  const { isFocusMode, toggleFocusMode, setFocusMode } = useFocusMode();

  const [hasSelection, setHasSelection] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

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

  // Theo dõi trạng thái Undo / Redo của lịch sử Annotation
  useEffect(() => {
    if (!historyCapability) return;
    const scope = historyCapability.forDocument(documentId);
    const updateHistoryState = () => {
      setCanUndo(scope.canUndo());
      setCanRedo(scope.canRedo());
    };
    updateHistoryState();
    return scope.onHistoryChange(() => {
      updateHistoryState();
    });
  }, [historyCapability, documentId]);

  // Tự động căn lại chiều rộng PDF (FitWidth) sau khi chuyển đổi Focus Mode (đợi hiệu ứng đóng/mở cột trái hoàn tất)
  useEffect(() => {
    if (!zoom) return;
    const timer = setTimeout(() => {
      zoom.requestZoom(ZoomMode.FitWidth);
    }, 320);
    return () => clearTimeout(timer);
  }, [isFocusMode, zoom]);

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

  const handleToggleTool = (toolId: string | null) => {
    if (!annotationApi) return;
    if (toolId === null) {
      annotationApi.setActiveTool(null);
      return;
    }
    annotationApi.setActiveTool(activeToolId === toolId ? null : toolId);
  };

  // Phím tắt:
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

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && hasSelection && !isEditingInput) {
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
      activeColor: "bg-amber-50 text-amber-600 border-amber-200",
    },
    {
      id: "underline",
      label: "Gạch chân văn bản",
      icon: Underline,
      activeColor: "bg-indigo-50 text-indigo-600 border-indigo-200",
    },
    {
      id: "strikeout",
      label: "Gạch ngang văn bản",
      icon: Strikethrough,
      activeColor: "bg-rose-50 text-rose-600 border-rose-200",
    },
    {
      id: "freeText",
      label: "Thêm hộp ghi chú chữ (Nhấp vào trang để viết)",
      icon: StickyNote,
      activeColor: "bg-emerald-50 text-emerald-600 border-emerald-200",
    },
    {
      id: "ink",
      label: "Bút vẽ ghi chú tự do",
      icon: PenTool,
      activeColor: "bg-purple-50 text-purple-600 border-purple-200",
    },
  ];

  const zoomPercentage = zoomState?.currentZoomLevel
    ? Math.round(zoomState.currentZoomLevel * 100)
    : 100;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2 shadow-2xs shrink-0 z-10">
      {/* Cụm Trái: Nút Quay lại + Tên tài liệu thu gọn */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onClose}
          title="Quay lại danh sách tài liệu"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 shadow-2xs transition-all hover:bg-gray-50 hover:text-indigo-600 active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Quay lại</span>
        </button>

        <div className="hidden xl:flex items-center gap-1.5 min-w-0 max-w-[180px] rounded-lg bg-gray-50 px-2 py-1 border border-gray-100">
          <span className="rounded-[3px] bg-red-50 border border-red-200 px-1 py-0.2 text-[9px] font-black text-red-600 shrink-0">
            PDF
          </span>
          <span
            title={fileName}
            className="truncate text-xs font-medium text-gray-700"
          >
            {fileName}
          </span>
        </div>
      </div>

      {/* Cụm Giữa: Chế độ Con trỏ, Sao chép & Công cụ Highlight / Ghi chú */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleToggleTool(null)}
          title="Chế độ Con trỏ & Bôi đen văn bản"
          className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-medium transition-all cursor-pointer ${
            activeToolId === null
              ? "border-indigo-200 bg-indigo-50 text-indigo-600 shadow-2xs"
              : "border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <MousePointer className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={handleCopySelection}
          disabled={!hasSelection && !copied}
          title={
            hasSelection
              ? "Sao chép văn bản đang bôi đen (Ctrl+C)"
              : "Bôi đen văn bản trên PDF để sao chép"
          }
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-all ${
            copied
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default"
              : hasSelection
                ? "border-indigo-200 bg-indigo-600 text-white shadow-2xs hover:bg-indigo-700 cursor-pointer"
                : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
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

        <div className="mx-0.5 h-5 w-px bg-gray-200" />

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
                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                  isActive
                    ? `${tool.activeColor} shadow-2xs`
                    : "border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>

        <div className="mx-0.5 h-5 w-px bg-gray-200" />

        {/* Hoàn tác / Làm lại & Xoá Annotation */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => historyCapability?.forDocument(documentId).undo()}
            disabled={!canUndo}
            title="Hoàn tác (Undo)"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
          >
            <Undo2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => historyCapability?.forDocument(documentId).redo()}
            disabled={!canRedo}
            title="Làm lại (Redo)"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
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
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
              hasSelectedAnnotation
                ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                : "border-transparent text-gray-300 cursor-not-allowed"
            }`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Cụm Phải: Điều khiển Phóng to / Thu nhỏ & Nút Chế độ Tập trung (Focus Mode [↗] / [↙]) */}
      <div className="flex items-center gap-1.5">
        {zoom && (
          <div className="flex items-center gap-0.5 rounded-xl border border-gray-200/80 bg-gray-50/80 p-0.5">
            <button
              type="button"
              onClick={() => zoom.zoomOut()}
              title="Thu nhỏ"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-white hover:text-gray-900 hover:shadow-2xs cursor-pointer"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => zoom.requestZoom(1)}
              title="Đặt lại 100%"
              className="min-w-[44px] rounded-md px-1 py-1 text-center font-mono text-xs font-semibold text-gray-700 transition-colors hover:bg-white cursor-pointer"
            >
              {zoomPercentage}%
            </button>

            <button
              type="button"
              onClick={() => zoom.zoomIn()}
              title="Phóng to"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-white hover:text-gray-900 hover:shadow-2xs cursor-pointer"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>

            <div className="mx-0.5 h-4 w-px bg-gray-200" />

            <button
              type="button"
              onClick={() => zoom.requestZoom(ZoomMode.FitWidth)}
              title="Vừa chiều ngang khung hình"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-white hover:text-indigo-600 hover:shadow-2xs cursor-pointer"
            >
              <MoveHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Nút Chế độ tập trung (Focus Mode / Partial Fullscreen): [ ↗ ] Mở rộng / [ ↙ ] Thu nhỏ */}
        <button
          type="button"
          onClick={toggleFocusMode}
          title={
            isFocusMode
              ? "Thoát Chế độ tập trung (Esc)"
              : "Chế độ tập trung — Ẩn thanh điều hướng & mở rộng tối đa vùng đọc PDF"
          }
          className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all active:scale-95 cursor-pointer ${
            isFocusMode
              ? "border-indigo-600 bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
              : "border-gray-200 bg-white text-gray-700 shadow-2xs hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
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
          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 shadow-md transition-colors hover:bg-red-50 cursor-pointer whitespace-nowrap"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Xoá</span>
        </button>
      </div>
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
    } catch (err: any) {
      console.error(`Không thể lấy URL PDF cho document ${document.id}:`, err);
      setUrlError(
        err?.response?.data?.message || err?.message || "Không thể tải đường dẫn tài liệu PDF"
      );
    } finally {
      setIsLoadingUrl(false);
    }
  }, [document.id]);

  useEffect(() => {
    fetchPdfViewUrl();
  }, [fetchPdfViewUrl]);

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
        defaultZoomLevel: ZoomMode.FitWidth,
      }),
    ];
  }, [pdfUrl, document.file_name]);

  const isPreparing = isLoadingUrl || isEngineLoading;
  const fatalError = urlError || (engineError ? engineError.message : null);

  return (
    <div
      className={`flex w-full flex-col overflow-hidden transition-all duration-300 ease-in-out ${
        isFocusMode
          ? "h-screen flex-1"
          : "h-[calc(100vh-185px)] min-h-[580px] flex-1"
      } ${className}`}
    >
      {/* Thanh Header phụ trợ khi đang tải hoặc gặp lỗi (trước khi PdfToolbar được mount) */}
      {(isPreparing || fatalError) && (
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 shadow-2xs transition-all hover:bg-gray-50 hover:text-indigo-600 cursor-pointer shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Quay lại</span>
            </button>
            <span className="truncate text-xs font-semibold text-gray-700">
              {document.file_name}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleFocusMode}
            title={isFocusMode ? "Thoát Chế độ tập trung (Esc)" : "Chế độ tập trung"}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer"
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
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-slate-50 text-gray-600">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium">
            {isEngineLoading
              ? "Đang khởi tạo bộ xử lý PDF..."
              : "Đang tải tài liệu PDF từ đám mây..."}
          </p>
        </div>
      )}

      {/* Trạng thái lỗi */}
      {fatalError && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500 border border-red-100">
            <AlertCircle className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Không thể mở tài liệu PDF</p>
          <p className="max-w-md text-xs text-gray-500">{fatalError}</p>
          <button
            type="button"
            onClick={fetchPdfViewUrl}
            className="mt-1 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors cursor-pointer"
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
                      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-slate-50 text-gray-600">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                        <p className="text-sm font-medium">Đang kết xuất các trang PDF...</p>
                      </div>
                    )}

                    {isError && (
                      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500 border border-red-100">
                          <FileText className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-semibold text-gray-900">
                          Lỗi đọc dữ liệu tệp PDF
                        </p>
                        <p className="max-w-md text-xs text-gray-500">
                          Tệp PDF có thể bị hỏng hoặc phiên truy cập đã hết hạn.
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            Quay lại
                          </button>
                          <button
                            type="button"
                            onClick={fetchPdfViewUrl}
                            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                          >
                            Tải lại tài liệu
                          </button>
                        </div>
                      </div>
                    )}

                    {isLoaded && (
                      <>
                        {/* Thanh công cụ hợp nhất duy nhất ở trên cùng */}
                        <PdfToolbar
                          documentId={activeDocumentId}
                          fileName={document.file_name}
                          onClose={onClose}
                        />

                        {/* Vùng cuộn các trang PDF chiếm trọn 100% diện tích còn lại */}
                        <div className="relative flex-1 min-h-0 overflow-hidden">
                          <Viewport
                            documentId={activeDocumentId}
                            style={{
                              width: "100%",
                              height: "100%",
                              backgroundColor: "#eef2f6",
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
                                        boxShadow:
                                          "0 4px 12px -2px rgba(15, 23, 42, 0.12), 0 2px 4px -2px rgba(15, 23, 42, 0.08)",
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
