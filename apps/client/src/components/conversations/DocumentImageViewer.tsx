"use client";

import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import Lightbox, { PLUGIN_CAPTIONS, ZoomRef } from "yet-another-react-lightbox";
import Inline from "yet-another-react-lightbox/plugins/inline";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Captions from "yet-another-react-lightbox/plugins/captions";

import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";

import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { DocumentItem } from "@/types";
import { documentsApi } from "@/services/documents.api";

export interface DocumentImageViewerProps {
  documents: DocumentItem[];
  initialDocumentId: string;
  onClose: () => void;
  onDownload?: (documentId: string, fileName: string) => void;
  className?: string;
}

const PLACEHOLDER_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export default function DocumentImageViewer({
  documents = [],
  initialDocumentId,
  onClose,
  className = "",
}: DocumentImageViewerProps) {
  // Lọc chỉ lấy các tài liệu ảnh
  const imageDocs = useMemo(() => {
    return documents.filter((doc) => doc.mime_type.startsWith("image/"));
  }, [documents]);

  const initialIndex = useMemo(() => {
    const idx = imageDocs.findIndex((doc) => doc.id === initialDocumentId);
    return idx >= 0 ? idx : 0;
  }, [imageDocs, initialDocumentId]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [urlMap, setUrlMap] = useState<Record<string, string>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});

  const zoomRef = useRef<ZoomRef>(null);

  const currentDoc = imageDocs[currentIndex] || imageDocs[0];

  // Fetch URL cho ảnh hiện tại và tải trước (prefetch) các ảnh còn lại
  const fetchImageUrl = useCallback(async (docId: string) => {
    if (urlMap[docId] || loadingMap[docId]) return;

    setLoadingMap((prev) => ({ ...prev, [docId]: true }));
    setErrorMap((prev) => {
      const next = { ...prev };
      delete next[docId];
      return next;
    });

    try {
      const res = await documentsApi.getViewUrl(docId);
      setUrlMap((prev) => ({ ...prev, [docId]: res.downloadUrl }));
    } catch (err: any) {
      console.error(`Không thể lấy URL hình ảnh cho document ${docId}:`, err);
      setErrorMap((prev) => ({
        ...prev,
        [docId]: err?.response?.data?.message || err?.message || "Lỗi tải ảnh",
      }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [docId]: false }));
    }
  }, [urlMap, loadingMap]);

  useEffect(() => {
    if (currentDoc) {
      fetchImageUrl(currentDoc.id);
    }
  }, [currentDoc, fetchImageUrl]);

  // Prefetch các ảnh còn lại trong danh sách
  useEffect(() => {
    imageDocs.forEach((doc) => {
      if (doc.id !== currentDoc?.id && !urlMap[doc.id] && !loadingMap[doc.id]) {
        fetchImageUrl(doc.id);
      }
    });
  }, [imageDocs, currentDoc, urlMap, loadingMap, fetchImageUrl]);

  // Bắt sự kiện bàn phím: Escape để thoát, Mũi tên trái/phải để chuyển ảnh khi không zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && imageDocs.length > 1 && zoomLevel <= 1.05) {
        handlePrev();
      } else if (e.key === "ArrowRight" && imageDocs.length > 1 && zoomLevel <= 1.05) {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, imageDocs.length, zoomLevel, currentIndex]);

  // Slides cấu hình cho yet-another-react-lightbox (chỉ chứa src và title tên ảnh, không chứa metadata cồng kềnh)
  const slides = useMemo(() => {
    return imageDocs.map((doc) => ({
      src: urlMap[doc.id] || PLACEHOLDER_IMAGE,
      title: doc.file_name,
    }));
  }, [imageDocs, urlMap]);

  const handleZoomIn = () => {
    zoomRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    zoomRef.current?.zoomOut();
  };

  const handleResetZoom = () => {
    zoomRef.current?.changeZoom(1);
    setZoomLevel(1);
  };

  const handleFit = () => {
    zoomRef.current?.changeZoom(1);
    setZoomLevel(1);
  };

  const handlePrev = () => {
    if (imageDocs.length <= 1) return;
    const nextIdx = (currentIndex - 1 + imageDocs.length) % imageDocs.length;
    setCurrentIndex(nextIdx);
    setZoomLevel(1);
  };

  const handleNext = () => {
    if (imageDocs.length <= 1) return;
    const nextIdx = (currentIndex + 1) % imageDocs.length;
    setCurrentIndex(nextIdx);
    setZoomLevel(1);
  };

  const isLoadingCurrent = currentDoc ? loadingMap[currentDoc.id] : false;
  const currentError = currentDoc ? errorMap[currentDoc.id] : null;
  const hasCurrentUrl = currentDoc ? !!urlMap[currentDoc.id] : false;

  return (
    <div className={`flex w-full flex-col p-3 sm:p-4 ${className}`}>
      {/* 1. Nút Quay lại (ngắn gọn, dời lên trên sát khu vực Tab) */}
      <div className="flex w-full items-center justify-start mb-2 sm:mb-2.5">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-gray-700 shadow-xs transition-all hover:bg-gray-50 hover:text-indigo-600 active:scale-95 cursor-pointer whitespace-nowrap"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Quay lại</span>
        </button>
      </div>

      {/* 2. Vùng xem ảnh trung tâm (Canvas Viewer tối giản không vướng metadata) */}
      <div className="relative flex h-[600px] sm:h-[660px] md:h-[700px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-slate-950 shadow-inner select-none">
        {/* Loading overlay khi đang nạp URL */}
        {isLoadingCurrent && !hasCurrentUrl && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-300">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            <p className="text-sm font-medium">Đang tải ảnh từ bộ nhớ đám mây...</p>
          </div>
        )}

        {/* Thông báo lỗi nếu không tải được URL */}
        {currentError && !hasCurrentUrl && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center text-slate-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-950/60 text-red-400 border border-red-800/40">
              <AlertCircle className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-red-300">{currentError}</p>
            <button
              type="button"
              onClick={() => fetchImageUrl(currentDoc.id)}
              className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Trình xem yet-another-react-lightbox hiển thị trực tiếp nội tuyến (Inline) */}
        {hasCurrentUrl && (
          <div className="relative h-full w-full">
            <Lightbox
              plugins={[Inline, Zoom, Captions]}
              inline={{
                style: {
                  width: "100%",
                  height: "100%",
                  backgroundColor: "transparent",
                },
              }}
              slides={slides}
              index={currentIndex}
              on={{
                view: ({ index }) => {
                  setCurrentIndex(index);
                },
                zoom: ({ zoom }) => {
                  setZoomLevel(zoom);
                },
              }}
              zoom={{
                ref: zoomRef,
                scrollToZoom: true,
                maxZoomPixelRatio: 6,
                zoomInMultiplier: 1.5,
              }}
              captions={{
                showToggle: true,
              }}
              styles={{
                captionsTitle: {
                  fontSize: "12px",
                  fontWeight: 500,
                  lineHeight: "1.35",
                  maxWidth: "75%",
                },
                captionsTitleContainer: {
                  padding: "6px 14px",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  backdropFilter: "blur(4px)",
                },
              }}
              carousel={{
                finite: imageDocs.length <= 1,
                padding: 0,
                preload: 1,
              }}
              render={{
                slide: ({ slide }) => {
                  if (!("src" in slide) || !slide.src || slide.src === PLACEHOLDER_IMAGE) {
                    return (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                      </div>
                    );
                  }
                  return undefined;
                },
              }}
              toolbar={{
                buttons: [PLUGIN_CAPTIONS], // Chỉ hiển thị nút [CC] để ẩn/hiện tiêu đề ảnh
              }}
            />
          </div>
        )}

        {/* 3. Thanh công cụ nổi Floating Pill Toolbar (cạnh dưới màn hình) */}
        <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 sm:gap-1.5 rounded-full border border-slate-700/80 bg-slate-900/90 px-3 py-1.5 text-white shadow-2xl backdrop-blur-md transition-all hover:bg-slate-900/98">
          {/* Nút lùi ảnh nếu có nhiều ảnh */}
          {imageDocs.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                title="Ảnh trước (Phím mũi tên trái)"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="h-4 w-px bg-slate-700 mx-0.5" />
            </>
          )}

          {/* Nút Thu nhỏ [-] */}
          <button
            type="button"
            onClick={handleZoomOut}
            title="Thu nhỏ (-)"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 cursor-pointer"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          {/* Nút Reset / Hiển thị Zoom % [100%] */}
          <button
            type="button"
            onClick={handleResetZoom}
            title="Nhấp để đặt lại kích thước gốc 100%"
            className="flex h-8 min-w-[54px] items-center justify-center rounded-full px-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 hover:text-indigo-400 active:scale-95 cursor-pointer"
          >
            {Math.round(zoomLevel * 100)}%
          </button>

          {/* Nút Phóng to [+] */}
          <button
            type="button"
            onClick={handleZoomIn}
            title="Phóng to (+)"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 cursor-pointer"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          {/* Nút Vừa khung hình [⤢] */}
          <button
            type="button"
            onClick={handleFit}
            title="Vừa khung hình"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 cursor-pointer"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>

          {/* Nút tiến ảnh nếu có nhiều ảnh */}
          {imageDocs.length > 1 && (
            <>
              <div className="h-4 w-px bg-slate-700 mx-0.5" />
              <button
                type="button"
                onClick={handleNext}
                title="Ảnh tiếp theo (Phím mũi tên phải)"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
