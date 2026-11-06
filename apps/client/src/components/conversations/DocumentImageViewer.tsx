"use client";

import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import Lightbox, { PLUGIN_CAPTIONS, ZoomRef } from "yet-another-react-lightbox";
import Inline from "yet-another-react-lightbox/plugins/inline";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Captions from "yet-another-react-lightbox/plugins/captions";

import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";

import {
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
  const fetchingIdsRef = useRef<Set<string>>(new Set());

  const currentDoc = imageDocs[currentIndex] || imageDocs[0];

  // Fetch URL cho ảnh hiện tại qua thao tác trực tiếp (ví dụ: nhấn Thử lại)
  const fetchImageUrl = useCallback(async (docId: string) => {
    if (urlMap[docId] || fetchingIdsRef.current.has(docId)) return;

    fetchingIdsRef.current.add(docId);
    setLoadingMap((prev) => ({ ...prev, [docId]: true }));
    setErrorMap((prev) => {
      const next = { ...prev };
      delete next[docId];
      return next;
    });

    try {
      const res = await documentsApi.getViewUrl(docId);
      setUrlMap((prev) => ({ ...prev, [docId]: res.downloadUrl }));
    } catch (err: unknown) {
      console.error(`Không thể lấy URL hình ảnh cho document ${docId}:`, err);
      const errObj = err as { response?: { data?: { message?: string } }; message?: string };
      setErrorMap((prev) => ({
        ...prev,
        [docId]: errObj?.response?.data?.message || errObj?.message || "Lỗi tải ảnh",
      }));
    } finally {
      fetchingIdsRef.current.delete(docId);
      setLoadingMap((prev) => ({ ...prev, [docId]: false }));
    }
  }, [urlMap]);

  useEffect(() => {
    if (!currentDoc) return;
    const docId = currentDoc.id;
    if (urlMap[docId] || fetchingIdsRef.current.has(docId)) return;

    fetchingIdsRef.current.add(docId);
    let ignore = false;
    documentsApi
      .getViewUrl(docId)
      .then((res) => {
        if (!ignore) {
          setUrlMap((prev) => ({ ...prev, [docId]: res.downloadUrl }));
          setLoadingMap((prev) => ({ ...prev, [docId]: false }));
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          console.error(`Không thể lấy URL hình ảnh cho document ${docId}:`, err);
          const errObj = err as { response?: { data?: { message?: string } }; message?: string };
          setErrorMap((prev) => ({
            ...prev,
            [docId]: errObj?.response?.data?.message || errObj?.message || "Lỗi tải ảnh",
          }));
          setLoadingMap((prev) => ({ ...prev, [docId]: false }));
        }
      })
      .finally(() => {
        fetchingIdsRef.current.delete(docId);
      });

    return () => {
      ignore = true;
    };
  }, [currentDoc, urlMap]);

  // Prefetch các ảnh còn lại trong danh sách
  useEffect(() => {
    imageDocs.forEach((doc) => {
      if (doc.id !== currentDoc?.id && !urlMap[doc.id] && !fetchingIdsRef.current.has(doc.id)) {
        fetchingIdsRef.current.add(doc.id);
        documentsApi
          .getViewUrl(doc.id)
          .then((res) => {
            setUrlMap((prev) => ({ ...prev, [doc.id]: res.downloadUrl }));
          })
          .catch(() => {})
          .finally(() => {
            fetchingIdsRef.current.delete(doc.id);
          });
      }
    });
  }, [imageDocs, currentDoc, urlMap]);

  const handlePrev = useCallback(() => {
    if (imageDocs.length <= 1) return;
    const nextIdx = (currentIndex - 1 + imageDocs.length) % imageDocs.length;
    setCurrentIndex(nextIdx);
    setZoomLevel(1);
  }, [imageDocs.length, currentIndex]);

  const handleNext = useCallback(() => {
    if (imageDocs.length <= 1) return;
    const nextIdx = (currentIndex + 1) % imageDocs.length;
    setCurrentIndex(nextIdx);
    setZoomLevel(1);
  }, [imageDocs.length, currentIndex]);

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
  }, [onClose, imageDocs.length, zoomLevel, currentIndex, handlePrev, handleNext]);

  // Slides cấu hình cho yet-another-react-lightbox
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

  const isLoadingCurrent = currentDoc ? loadingMap[currentDoc.id] : false;
  const currentError = currentDoc ? errorMap[currentDoc.id] : null;
  const hasCurrentUrl = currentDoc ? !!urlMap[currentDoc.id] : false;

  return (
    <div className={`flex w-full flex-col p-2 sm:p-3 select-none ${className}`}>
      {/* 1. Nút Quay lại phong cách Apple Navigation Pill */}
      <div className="flex w-full items-center justify-between mb-2 sm:mb-2.5">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#12151C]/80 px-3 py-1.5 text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 shadow-2xs backdrop-blur-md transition-all duration-200 hover:bg-neutral-100/80 dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-white active:scale-95 cursor-pointer whitespace-nowrap"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Quay lại</span>
        </button>

        {currentDoc && (
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate max-w-[280px]">
            {currentDoc.file_name}
          </span>
        )}
      </div>

      {/* 2. Vùng xem ảnh trung tâm (Apple Image Canvas) */}
      <div className="relative flex h-[600px] sm:h-[660px] md:h-[700px] w-full flex-col items-center justify-center overflow-hidden rounded-[20px] sm:rounded-[24px] bg-neutral-950 shadow-inner border border-black/[0.08] dark:border-white/[0.08]">
        {/* Loading overlay khi đang nạp URL */}
        {isLoadingCurrent && !hasCurrentUrl && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-neutral-950 text-neutral-300">
            <Loader2 className="h-8 w-8 animate-spin text-[#818CF8]" />
            <p className="text-xs sm:text-sm font-medium text-neutral-400">Đang tải ảnh từ bộ nhớ đám mây...</p>
          </div>
        )}

        {/* Thông báo lỗi nếu không tải được URL */}
        {currentError && !hasCurrentUrl && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-neutral-950 p-6 text-center text-neutral-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-rose-950/60 text-rose-400 border border-rose-800/40">
              <AlertCircle className="h-6 w-6" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-rose-300">{currentError}</p>
            <button
              type="button"
              onClick={() => fetchImageUrl(currentDoc.id)}
              className="rounded-xl bg-neutral-800 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-700 transition-colors cursor-pointer"
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
                  backgroundColor: "rgba(0, 0, 0, 0.6)",
                  backdropFilter: "blur(8px)",
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
                      <div className="flex h-full w-full items-center justify-center text-neutral-400">
                        <Loader2 className="h-8 w-8 animate-spin text-[#818CF8]" />
                      </div>
                    );
                  }
                  return undefined;
                },
              }}
              toolbar={{
                buttons: [PLUGIN_CAPTIONS],
              }}
            />
          </div>
        )}

        {/* 3. Thanh công cụ nổi Floating Pill Toolbar phong cách Apple Dynamic Island */}
        <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 sm:gap-1.5 rounded-full border border-white/15 bg-neutral-900/90 px-3 py-1.5 text-white shadow-2xl backdrop-blur-xl transition-all hover:bg-neutral-900/98">
          {/* Nút lùi ảnh nếu có nhiều ảnh */}
          {imageDocs.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                title="Ảnh trước (Phím mũi tên trái)"
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="h-4 w-px bg-white/20 mx-0.5" />
            </>
          )}

          {/* Nút Thu nhỏ [-] */}
          <button
            type="button"
            onClick={handleZoomOut}
            title="Thu nhỏ (-)"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          {/* Nút Reset / Hiển thị Zoom % [100%] */}
          <button
            type="button"
            onClick={handleResetZoom}
            title="Nhấp để đặt lại kích thước gốc 100%"
            className="flex h-8 min-w-[54px] items-center justify-center rounded-full px-2 text-xs font-semibold text-neutral-200 tabular-nums transition-colors hover:bg-white/10 hover:text-indigo-400 active:scale-95 cursor-pointer"
          >
            {Math.round(zoomLevel * 100)}%
          </button>

          {/* Nút Phóng to [+] */}
          <button
            type="button"
            onClick={handleZoomIn}
            title="Phóng to (+)"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          {/* Nút Vừa khung hình */}
          <button
            type="button"
            onClick={handleFit}
            title="Vừa khung hình"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>

          {/* Nút tiến ảnh nếu có nhiều ảnh */}
          {imageDocs.length > 1 && (
            <>
              <div className="h-4 w-px bg-white/20 mx-0.5" />
              <button
                type="button"
                onClick={handleNext}
                title="Ảnh tiếp theo (Phím mũi tên phải)"
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer"
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
