"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { CitationItem, DocumentCitationItem, WebCitationItem } from "@/lib/citation-parser";
import type { TextCitationAnchor } from "@/types/source-ref";

export interface ActiveCitationTarget {
  documentId: string;
  fileName?: string;
  pageNo: number; // 1-based
  bboxes?: unknown[];
  rawContent?: string;
  citationId?: string;
  chunkId?: string;
  chunkIndex?: number;
  headings?: string[];
  textAnchor?: TextCitationAnchor;
  mode?: "main" | "side-panel";
  nonce: number;
}

export interface ActiveHighlightState {
  documentId: string;
  pageIndex: number; // 0-based
  bboxes: unknown[];
  createdAt: number;
}

export interface CitationNavigationContextValue {
  /** Thông tin điều hướng đang chờ PDF Viewer xử lý (nhảy trang, cuộn mượt) */
  activeTarget: ActiveCitationTarget | null;
  /** Tài liệu nguồn đang mở tạm thời ở cột RightSidebar (không chuyển tab chính) */
  sidePanelTarget: ActiveCitationTarget | null;
  /** Trạng thái tô sáng khung bboxes đang hiển thị trên trang PDF */
  activeHighlight: ActiveHighlightState | null;
  /** Kích hoạt điều hướng tới một trích dẫn bất kỳ (tài liệu hoặc web) */
  navigateToCitation: (
    citation:
      | CitationItem
      | {
          documentId: string;
          pageNo: number;
          fileName?: string;
          bboxes?: unknown[];
          rawContent?: string;
          citationId?: string;
          chunkId?: string;
          chunkIndex?: number;
          headings?: string[];
          textAnchor?: TextCitationAnchor;
        }
  ) => void;
  /** Điều hướng cụ thể tới tài liệu (mở ở Tab Tài liệu chính) */
  navigateToDocumentCitation: (target: Omit<ActiveCitationTarget, "nonce" | "mode">) => void;
  /** Mở tài liệu nguồn ngay tại cột RightSidebar bên phải */
  openSidePanelCitation: (target: Omit<ActiveCitationTarget, "nonce" | "mode">) => void;
  /** Đóng trình xem nguồn ở cột RightSidebar và trả về Trợ lý AI */
  closeSidePanelCitation: () => void;
  /** Mở liên kết web trong tab mới */
  navigateToWebCitation: (url: string) => void;
  /** Sau khi PDF viewer đã cuộn xong, gọi hàm này để xóa activeTarget, chỉ giữ lại activeHighlight */
  consumeActiveTarget: () => void;
  /** Cập nhật trạng thái tô sáng */
  setHighlight: (highlight: ActiveHighlightState | null) => void;
  /** Xóa bỏ khung tô sáng (khi người dùng click ra vùng khác) */
  clearHighlight: () => void;
}

const CitationNavigationContext = createContext<CitationNavigationContextValue>({
  activeTarget: null,
  sidePanelTarget: null,
  activeHighlight: null,
  navigateToCitation: () => {},
  navigateToDocumentCitation: () => {},
  openSidePanelCitation: () => {},
  closeSidePanelCitation: () => {},
  navigateToWebCitation: () => {},
  consumeActiveTarget: () => {},
  setHighlight: () => {},
  clearHighlight: () => {},
});

export function CitationNavigationProvider({ children }: { children: React.ReactNode }) {
  const [activeTarget, setActiveTarget] = useState<ActiveCitationTarget | null>(null);
  const [sidePanelTarget, setSidePanelTarget] = useState<ActiveCitationTarget | null>(null);
  const [activeHighlight, setActiveHighlight] = useState<ActiveHighlightState | null>(null);

  const navigateToDocumentCitation = useCallback(
    (target: Omit<ActiveCitationTarget, "nonce" | "mode">) => {
      setSidePanelTarget(null);
      setActiveTarget({
        ...target,
        mode: "main",
        nonce: Date.now(),
      });
    },
    []
  );

  const openSidePanelCitation = useCallback(
    (target: Omit<ActiveCitationTarget, "nonce" | "mode">) => {
      const nextTarget: ActiveCitationTarget = {
        ...target,
        mode: "side-panel",
        nonce: Date.now(),
      };
      setSidePanelTarget(nextTarget);
      setActiveTarget(nextTarget);
    },
    []
  );

  const closeSidePanelCitation = useCallback(() => {
    setSidePanelTarget(null);
    setActiveTarget((prev) => (prev?.mode === "side-panel" ? null : prev));
    setActiveHighlight(null);
  }, []);

  const navigateToWebCitation = useCallback((url: string) => {
    if (!url) return;
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, []);

  const navigateToCitation = useCallback(
    (
      citation:
        | CitationItem
        | {
            documentId: string;
            pageNo: number;
            fileName?: string;
            bboxes?: unknown[];
            rawContent?: string;
            citationId?: string;
            chunkId?: string;
            chunkIndex?: number;
            headings?: string[];
            textAnchor?: TextCitationAnchor;
            url?: string;
            sourceType?: string;
          }
    ) => {
      if (!citation) return;

      if ("sourceType" in citation && citation.sourceType === "web") {
        const webItem = citation as WebCitationItem;
        navigateToWebCitation(webItem.url);
        return;
      }

      const docItem = citation as DocumentCitationItem & {
        pageNo?: number;
      };

      const pageNo =
        docItem.pageNo ??
        (Array.isArray(docItem.pageNumbers) && docItem.pageNumbers.length > 0
          ? docItem.pageNumbers[0]
          : 1);

      const bboxes = Array.isArray(docItem.bboxes)
        ? docItem.bboxes
        : undefined;

      navigateToDocumentCitation({
        documentId: docItem.documentId,
        fileName: docItem.fileName,
        pageNo,
        bboxes,
        rawContent: docItem.rawContent || docItem.content || docItem.previewSnippet,
        citationId: docItem.citationId,
        chunkId: docItem.chunkId,
        chunkIndex: docItem.chunkIndex,
        headings: docItem.headings,
        textAnchor: docItem.textAnchor,
      });
    },
    [navigateToDocumentCitation, navigateToWebCitation]
  );

  const consumeActiveTarget = useCallback(() => {
    setActiveTarget(null);
  }, []);

  const setHighlight = useCallback((highlight: ActiveHighlightState | null) => {
    setActiveHighlight(highlight);
  }, []);

  const clearHighlight = useCallback(() => {
    setActiveHighlight(null);
  }, []);

  const value = useMemo<CitationNavigationContextValue>(
    () => ({
      activeTarget,
      sidePanelTarget,
      activeHighlight,
      navigateToCitation,
      navigateToDocumentCitation,
      openSidePanelCitation,
      closeSidePanelCitation,
      navigateToWebCitation,
      consumeActiveTarget,
      setHighlight,
      clearHighlight,
    }),
    [
      activeTarget,
      sidePanelTarget,
      activeHighlight,
      navigateToCitation,
      navigateToDocumentCitation,
      openSidePanelCitation,
      closeSidePanelCitation,
      navigateToWebCitation,
      consumeActiveTarget,
      setHighlight,
      clearHighlight,
    ]
  );

  return (
    <CitationNavigationContext.Provider value={value}>
      {children}
    </CitationNavigationContext.Provider>
  );
}

export function useCitationNavigation(): CitationNavigationContextValue {
  return useContext(CitationNavigationContext);
}
