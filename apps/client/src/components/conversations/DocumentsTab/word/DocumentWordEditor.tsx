"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SuperDocEditor,
  type DocumentMode,
  type SuperDocContentErrorEvent,
  type SuperDocEditorProps,
  type SuperDocExceptionEvent,
  type SuperDocInstance,
  type SuperDocReadyEvent,
} from "@superdoc/react";
import "@superdoc/react/style.css";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  CloudCheck,
  Download,
  ExternalLink,
  Eye,
  FileEdit,
  GitPullRequest,
  ListTree,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { CitationEvidenceBanner } from "../editor/CitationEvidenceBanner";
import type {
  CitationResolutionTier,
  EditorCitationTarget,
} from "../editor/text-anchor-resolver";
import TocMasterySidebar from "../TocMasterySidebar";
import { useWordDocumentPersistence } from "./useWordDocumentPersistence";
import {
  buildCitationSearchQueries,
  buildSuperDocUser,
  getGoogleDocsSourceUrl,
  isGoogleDocsImported,
  stripExtensionForExport,
} from "./word-document.helpers";
import type { DocumentItem, TocMasterySection } from "@/types";

export interface DocumentWordEditorProps {
  document: DocumentItem;
  onClose: () => void;
  onDownload?: (documentId: string, fileName: string) => void;
  onDocumentUpdated?: (doc: DocumentItem) => void;
  onCreateTargetedQuiz?: (opts: {
    chunkIds: string[];
    sectionTitle: string;
  }) => void;
  citationTarget?: EditorCitationTarget | null;
  onCitationDismiss?: () => void;
  compactReaderMode?: boolean;
  isExternalFullscreen?: boolean;
  onToggleExternalFullscreen?: () => void;
  className?: string;
}

type TrackedChangesView = "markup" | "final" | "original";

// Cố định object cấu hình ở cấp module để tránh SuperDoc remount ngoài ý muốn khi re-render
const COMPACT_VIEWING: NonNullable<SuperDocEditorProps["viewing"]> = {
  comments: true,
  trackedChanges: "final",
};

const FULL_VIEWING: NonNullable<SuperDocEditorProps["viewing"]> = {
  comments: true,
  trackedChanges: "markup",
};

const COMPACT_INTERACTION: NonNullable<SuperDocEditorProps["interaction"]> = {
  comments: { level: "read" },
  trackedChanges: { allowDecisions: false },
};

const FULL_INTERACTION: NonNullable<SuperDocEditorProps["interaction"]> = {
  comments: { level: "resolve" },
  trackedChanges: { allowDecisions: true },
};

const COMPACT_UI: NonNullable<SuperDocEditorProps["ui"]> = {
  toolbar: false,
  loading: false,
};

const FULL_UI: NonNullable<SuperDocEditorProps["ui"]> = {
  loading: false,
};

function findAndScrollDomText(
  hostElement: HTMLElement | null,
  queries: string[],
): boolean {
  if (!hostElement || queries.length === 0) return false;

  const normalize = (value: string) =>
    value.toLowerCase().replace(/\s+/g, " ").trim();

  const blockElements = Array.from(
    hostElement.querySelectorAll<HTMLElement>(
      "p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, [data-pm-node]",
    ),
  );

  for (const rawQuery of queries) {
    const query = normalize(rawQuery);
    if (query.length < 4) continue;

    // 1. Thử tìm khớp trực tiếp trong các khối văn bản trước để cuộn chính xác
    for (const block of blockElements) {
      const text = normalize(block.textContent ?? "");
      if (text && text.includes(query)) {
        block.scrollIntoView({ behavior: "smooth", block: "center" });
        block.classList.add("studymate-word-citation-pulse");
        window.setTimeout(() => {
          block.classList.remove("studymate-word-citation-pulse");
        }, 2400);
        return true;
      }
    }

    // 2. Fallback TreeWalker nếu DOM dùng span/custom container khác chuẩn
    const walker = window.document.createTreeWalker(
      hostElement,
      NodeFilter.SHOW_TEXT,
    );
    let node = walker.nextNode();
    while (node) {
      const text = normalize(node.textContent ?? "");
      if (text && text.includes(query) && node.parentElement) {
        const el = node.parentElement;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("studymate-word-citation-pulse");
        window.setTimeout(() => {
          el.classList.remove("studymate-word-citation-pulse");
        }, 2400);
        return true;
      }
      node = walker.nextNode();
    }
  }

  return false;
}

export default function DocumentWordEditor({
  document,
  onClose,
  onDownload,
  onDocumentUpdated,
  onCreateTargetedQuiz,
  citationTarget = null,
  onCitationDismiss,
  compactReaderMode = false,
  isExternalFullscreen,
  onToggleExternalFullscreen,
  className = "",
}: DocumentWordEditorProps) {
  const { user } = useCurrentUser();
  const persistence = useWordDocumentPersistence({
    document,
    compactReaderMode,
    onDocumentUpdated,
  });

  const {
    documentBlob,
    isLoadingBlob,
    loadError,
    isDirty,
    isSaving,
    saveError,
    conflictMessage,
    ocrStatus,
    embedStatus,
    syncError,
    isAiSyncing,
    lastSavedAt,
    attachSuperDocInstance,
    saveDocument,
    reloadDocument,
    clearSaveFeedback,
  } = persistence;

  const [documentMode, setDocumentMode] = useState<DocumentMode>(() =>
    compactReaderMode ? "viewing" : "editing",
  );
  const [trackedChangesView, setTrackedChangesView] =
    useState<TrackedChangesView>(() => (compactReaderMode ? "final" : "markup"));
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [fatalEditorError, setFatalEditorError] = useState<string | null>(null);
  const [transientNotice, setTransientNotice] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showTocSidebar, setShowTocSidebar] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [resolvedCitationTier, setResolvedCitationTier] =
    useState<CitationResolutionTier>(2);

  const superdocInstanceRef = useRef<SuperDocInstance | null>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const isReadyRef = useRef(false);

  const isFullscreen =
    isExternalFullscreen !== undefined ? isExternalFullscreen : internalFullscreen;

  const handleToggleFullscreen = useCallback(() => {
    if (onToggleExternalFullscreen) {
      onToggleExternalFullscreen();
      return;
    }
    setInternalFullscreen((prev) => !prev);
  }, [onToggleExternalFullscreen]);

  const superdocUser = useMemo(
    () => buildSuperDocUser(user),
    [user?.id, user?.name, user?.email],
  );

  const isGoogleDoc = isGoogleDocsImported(document);
  const googleDocUrl = getGoogleDocsSourceUrl(document);

  // Reset trạng thái editor mỗi khi đổi tài liệu hoặc tải lại Blob
  useEffect(() => {
    isReadyRef.current = false;
    setIsEditorReady(false);
    setFatalEditorError(null);
    setTransientNotice(null);
  }, [document.id, documentBlob]);

  // Đồng bộ chế độ xem tracked changes qua API imperative của SuperDoc v2
  useEffect(() => {
    if (!isEditorReady || !superdocInstanceRef.current) return;
    superdocInstanceRef.current.setViewingOptions?.({
      comments: true,
      trackedChanges: trackedChangesView,
    });
  }, [isEditorReady, trackedChangesView]);

  // Đóng dropdown xuất file khi click ra ngoài
  useEffect(() => {
    if (!showExportMenu) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };
    window.document.addEventListener("mousedown", handlePointerDown);
    return () =>
      window.document.removeEventListener("mousedown", handlePointerDown);
  }, [showExportMenu]);

  // Phím tắt Ctrl+S / Cmd+S để lưu & Esc để đóng popup/banner
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        if (!compactReaderMode) {
          e.preventDefault();
          void saveDocument();
        }
        return;
      }

      if (e.key === "Escape") {
        if (showUnsavedDialog) {
          setShowUnsavedDialog(false);
          return;
        }
        if (showExportMenu) {
          setShowExportMenu(false);
          return;
        }
        if (citationTarget) {
          onCitationDismiss?.();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    compactReaderMode,
    saveDocument,
    showUnsavedDialog,
    showExportMenu,
    citationTarget,
    onCitationDismiss,
  ]);

  const scrollToQueries = useCallback((queries: string[]): boolean => {
    const instance = superdocInstanceRef.current;
    if (!instance || queries.length === 0) return false;

    for (const q of queries) {
      if (q.length >= 4 && instance.ui?.search?.find) {
        try {
          instance.ui.search.find(q);
          break;
        } catch {
          // Bỏ qua nếu SuperDoc search controller chưa sẵn sàng
        }
      }
    }

    return findAndScrollDomText(editorHostRef.current, queries);
  }, []);

  // Tự động nhảy tới vị trí trích dẫn khi mở từ AI Chatbox / Flashcard / Quiz
  useEffect(() => {
    if (!isEditorReady || !citationTarget) return;

    const queries = buildCitationSearchQueries({
      quoteExact: citationTarget.textAnchor?.quoteExact,
      rawContent: citationTarget.rawContent,
      headings: citationTarget.headings,
    });

    const timer = window.setTimeout(() => {
      const matched = scrollToQueries(queries);
      setResolvedCitationTier(matched ? 2 : 3);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [
    isEditorReady,
    citationTarget?.nonce,
    citationTarget?.rawContent,
    citationTarget?.textAnchor?.quoteExact,
    citationTarget?.headings,
    scrollToQueries,
  ]);

  const handleReady = useCallback(
    ({ superdoc }: SuperDocReadyEvent) => {
      superdocInstanceRef.current = superdoc;
      isReadyRef.current = true;
      setIsEditorReady(true);
      setFatalEditorError(null);
      attachSuperDocInstance(superdoc);
      superdoc.setViewingOptions?.({
        comments: true,
        trackedChanges: compactReaderMode ? "final" : trackedChangesView,
      });
    },
    [attachSuperDocInstance, compactReaderMode, trackedChangesView],
  );

  const handleContentError = useCallback((event: SuperDocContentErrorEvent) => {
    const eventObj = event as unknown as Record<string, unknown>;
    if (eventObj?.diagnosticCode === "UNSUPPORTED_FEATURE") {
      console.warn("[DocumentWordEditor] Tính năng OOXML chưa hỗ trợ đầy đủ:", event);
      return;
    }

    if (!isReadyRef.current) {
      const msg =
        typeof eventObj?.message === "string"
          ? eventObj.message
          : "Tệp DOCX có cấu trúc không tương thích hoặc bị hỏng.";
      setFatalEditorError(msg);
    } else {
      console.warn("[DocumentWordEditor] Cảnh báo nội dung DOCX:", event);
    }
  }, []);

  const handleException = useCallback((event: SuperDocExceptionEvent) => {
    const eventObj = event as unknown as Record<string, unknown>;
    if (eventObj?.code === "edit-rejected") {
      setTransientNotice("Vùng này đang được khóa hoặc ở chế độ chỉ đọc.");
      window.setTimeout(() => {
        setTransientNotice((curr) =>
          curr === "Vùng này đang được khóa hoặc ở chế độ chỉ đọc." ? null : curr,
        );
      }, 3000);
      return;
    }

    if (!isReadyRef.current) {
      const msg =
        typeof eventObj?.message === "string"
          ? eventObj.message
          : "Không thể khởi tạo trình soạn thảo SuperDoc cho tệp này.";
      setFatalEditorError(msg);
    }
  }, []);

  const handleAttemptClose = useCallback(() => {
    if (isDirty && !compactReaderMode) {
      setShowUnsavedDialog(true);
      return;
    }
    onClose();
  }, [isDirty, compactReaderMode, onClose]);

  const handleSaveAndClose = useCallback(async () => {
    const ok = await saveDocument();
    if (ok) {
      setShowUnsavedDialog(false);
      onClose();
    }
  }, [saveDocument, onClose]);

  const handleExportDocx = useCallback(
    async (cleanFinal: boolean) => {
      const instance = superdocInstanceRef.current;
      if (!instance || isExporting) return;

      setShowExportMenu(false);
      setIsExporting(true);
      try {
        const baseName = stripExtensionForExport(document.file_name);
        await instance.export({
          exportType: ["docx"],
          triggerDownload: true,
          exportedName: cleanFinal ? `${baseName}-final` : baseName,
          policies: cleanFinal
            ? {
                trackedChanges: "final",
                comments: "remove",
                contentControls: "flatten",
              }
            : {
                trackedChanges: "review-preserving",
                comments: "preserve",
                contentControls: "preserve",
              },
        });
      } catch (err) {
        console.error("[DocumentWordEditor] Export DOCX failed:", err);
        setTransientNotice("Không thể xuất tệp DOCX lúc này. Vui lòng thử lại.");
      } finally {
        setIsExporting(false);
      }
    },
    [document.file_name, isExporting],
  );

  const handleSelectTocSection = useCallback(
    (section: TocMasterySection) => {
      const matched = scrollToQueries([section.text]);
      if (!matched) {
        setTransientNotice(`Không tìm thấy tiêu đề "${section.text}" trong khung hiện tại.`);
        window.setTimeout(() => setTransientNotice(null), 2600);
      }
    },
    [scrollToQueries],
  );

  const renderLoadingOverlay = useCallback(
    () => (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 bg-white dark:bg-[#141720] text-neutral-500 dark:text-neutral-400">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600 dark:text-blue-400" />
        <p className="text-xs font-medium">Đang dựng tài liệu Word trong SuperDoc…</p>
      </div>
    ),
    [],
  );

  const containerClass =
    compactReaderMode || isFullscreen
      ? `flex h-full min-h-0 flex-1 flex-col bg-neutral-100/75 dark:bg-[#0F1218] ${isFullscreen && isExternalFullscreen === undefined ? "fixed inset-0 z-50" : ""} ${className}`
      : `flex h-[calc(100vh-140px)] min-h-[580px] w-full flex-col overflow-hidden rounded-[24px] border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/75 dark:bg-[#0F1218] shadow-sm ${className}`;

  return (
    <div className={containerClass}>
      {/* Unified Apple HIG Header */}
      <div className="flex h-13 shrink-0 items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/90 dark:bg-[#141720]/90 px-3 sm:px-4 backdrop-blur-md">
        {/* Trái: Quay lại + Badge + Tên tệp */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={handleAttemptClose}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-black/[0.07] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] px-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {!compactReaderMode && <span className="hidden sm:inline">Quay lại</span>}
          </button>

          <span className="inline-flex shrink-0 items-center rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-600 dark:text-blue-400">
            {isGoogleDoc ? "GDOCS" : "DOCX"}
          </span>

          <h3 className="truncate text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white">
            {document.file_name}
          </h3>

          {googleDocUrl && !compactReaderMode && (
            <a
              href={googleDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Mở liên kết Google Docs gốc"
              className="hidden lg:inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.08] hover:text-blue-600 dark:hover:text-blue-400"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {/* Giữa: Apple Segmented Mode Switcher (chế độ đầy đủ) */}
        {!compactReaderMode && (
          <div className="hidden md:flex items-center gap-2">
            <div
              role="group"
              aria-label="Chế độ soạn thảo Word"
              className="inline-flex h-8 items-center rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/90 dark:bg-white/[0.05] p-0.5"
            >
              {(
                [
                  { id: "editing", label: "Chỉnh sửa", Icon: FileEdit },
                  { id: "suggesting", label: "Đề xuất", Icon: GitPullRequest },
                  { id: "viewing", label: "Xem", Icon: Eye },
                ] as const
              ).map(({ id, label, Icon }) => {
                const active = documentMode === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDocumentMode(id)}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition-all cursor-pointer ${
                      active
                        ? "bg-white dark:bg-[#1E222D] text-blue-600 dark:text-blue-400 shadow-2xs"
                        : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {documentMode === "viewing" && (
              <div
                role="group"
                aria-label="Hiển thị Track Changes"
                className="inline-flex h-8 items-center rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/80 dark:bg-white/[0.04] p-0.5"
              >
                {(
                  [
                    { id: "markup", label: "Đánh dấu" },
                    { id: "final", label: "Bản cuối" },
                    { id: "original", label: "Bản gốc" },
                  ] as const
                ).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTrackedChangesView(id)}
                    className={`h-7 rounded-full px-2 text-[11px] font-medium transition-all cursor-pointer ${
                      trackedChangesView === id
                        ? "bg-white dark:bg-[#1E222D] text-neutral-900 dark:text-white shadow-2xs"
                        : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Phải: Trạng thái 2 tầng + Nút Lưu + Export + Mục lục + Toàn màn hình */}
        <div className="flex shrink-0 items-center gap-1.5">
          {!compactReaderMode && (
            <div className="hidden xl:flex items-center gap-1.5 mr-1">
              {/* Tầng 1: Trạng thái lưu R2 */}
              {isSaving ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Đang lưu…
                </span>
              ) : isDirty ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Chưa lưu
                </span>
              ) : lastSavedAt ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  <Check className="h-3 w-3" />
                  Đã lưu
                </span>
              ) : null}

              {/* Tầng 2: Trạng thái đồng bộ Docling + Chunk/Embedding */}
              {syncError || embedStatus === "failed" || ocrStatus === "failed" ? (
                <span
                  title={syncError ?? document.processing_error ?? "Lỗi đồng bộ chỉ mục AI"}
                  className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400"
                >
                  <AlertCircle className="h-3 w-3" />
                  Lỗi Sync AI
                </span>
              ) : isAiSyncing ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-300">
                  <Sparkles className="h-3 w-3 animate-pulse" />
                  Đang đồng bộ AI…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                  <CloudCheck className="h-3 w-3 text-emerald-500" />
                  AI đã đồng bộ
                </span>
              )}
            </div>
          )}

          {!compactReaderMode && (
            <button
              type="button"
              disabled={!isDirty || isSaving || !isEditorReady}
              onClick={() => void saveDocument()}
              title="Lưu tài liệu lên đám mây (Ctrl+S)"
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all cursor-pointer ${
                isDirty && !isSaving && isEditorReady
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-[0.98]"
                  : "border border-black/[0.07] dark:border-white/[0.1] bg-neutral-100/70 dark:bg-white/[0.04] text-neutral-400 dark:text-neutral-500 cursor-not-allowed"
              }`}
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Lưu</span>
            </button>
          )}

          {/* Dropdown Xuất DOCX */}
          {!compactReaderMode && (
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                disabled={!isEditorReady || isExporting}
                onClick={() => setShowExportMenu((prev) => !prev)}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-black/[0.07] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] px-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/[0.1] disabled:opacity-50 cursor-pointer"
                title="Xuất tệp DOCX về máy"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span className="hidden lg:inline">Xuất DOCX</span>
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 top-10 z-40 w-64 overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#1A1D28] p-1.5 shadow-xl">
                  <button
                    type="button"
                    onClick={() => void handleExportDocx(false)}
                    className="flex w-full flex-col items-start rounded-xl px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-white/[0.07] cursor-pointer"
                  >
                    <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                      Bản đầy đủ (Review)
                    </span>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Giữ nguyên Nhận xét & Theo dõi thay đổi
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExportDocx(true)}
                    className="flex w-full flex-col items-start rounded-xl px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-white/[0.07] cursor-pointer"
                  >
                    <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                      Bản sạch hoàn chỉnh (Final)
                    </span>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Áp dụng mọi chỉnh sửa & xóa nhận xét
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mục lục & Mức độ thành thạo */}
          {!compactReaderMode && (
            <button
              type="button"
              onClick={() => setShowTocSidebar((prev) => !prev)}
              title="Mục lục & Tiến độ nắm vững"
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                showTocSidebar
                  ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                  : "border-black/[0.07] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/[0.1]"
              }`}
            >
              <ListTree className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Mục lục</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.07] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Banners phản hồi: Xung đột 409 / Lỗi lưu / Cảnh báo nhẹ / Citation */}
      {conflictMessage && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/25 bg-amber-500/[0.1] px-4 py-2 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{conflictMessage}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reloadDocument}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-amber-600 px-3 text-[11px] font-semibold text-white hover:bg-amber-700 cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              Tải lại bản mới nhất
            </button>
            <button
              type="button"
              onClick={clearSaveFeedback}
              className="text-amber-700 dark:text-amber-300 hover:opacity-80 cursor-pointer"
              aria-label="Đóng thông báo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {saveError && (
        <div className="flex items-center justify-between gap-2 border-b border-rose-500/20 bg-rose-500/[0.08] px-4 py-2 text-xs text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{saveError}</span>
          </div>
          <button
            type="button"
            onClick={clearSaveFeedback}
            className="text-rose-500 hover:opacity-80 cursor-pointer"
            aria-label="Đóng thông báo lỗi"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {transientNotice && (
        <div className="flex items-center justify-between gap-2 border-b border-blue-500/20 bg-blue-500/[0.08] px-4 py-1.5 text-xs text-blue-800 dark:text-blue-200">
          <span>{transientNotice}</span>
          <button
            type="button"
            onClick={() => setTransientNotice(null)}
            className="opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {citationTarget && (
        <div className="border-b border-black/[0.05] dark:border-white/[0.08] bg-white/80 dark:bg-[#141720]/80 px-3 py-2">
          <CitationEvidenceBanner
            target={citationTarget}
            resolvedTier={resolvedCitationTier}
            onScrollToLocation={() => {
              const queries = buildCitationSearchQueries({
                quoteExact: citationTarget.textAnchor?.quoteExact,
                rawContent: citationTarget.rawContent,
                headings: citationTarget.headings,
              });
              scrollToQueries(queries);
            }}
            onDismiss={() => onCitationDismiss?.()}
          />
        </div>
      )}

      {/* Main Content Area: SuperDoc + TocMasterySidebar */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          ref={editorHostRef}
          className="studymate-superdoc-host relative min-w-0 flex-1 overflow-hidden bg-neutral-100 dark:bg-[#10131A]"
        >
          {isLoadingBlob ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-neutral-500 dark:text-neutral-400">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600 dark:text-blue-400" />
              <p className="text-xs font-medium">Đang tải tài liệu Word từ máy chủ…</p>
            </div>
          ) : loadError || fatalEditorError ? (
            <div className="flex h-full items-center justify-center p-6">
              <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-rose-500/20 bg-white dark:bg-[#161922] p-6 text-center shadow-xs">
                <AlertTriangle className="h-8 w-8 text-rose-500" />
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Không thể mở tệp DOCX trong SuperDoc
                </h4>
                <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                  {loadError || fatalEditorError}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={reloadDocument}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Thử tải lại
                  </button>
                  {onDownload && (
                    <button
                      type="button"
                      onClick={() => onDownload(document.id, document.file_name)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/[0.1] dark:border-white/[0.12] px-4 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/[0.06] cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Tải tệp gốc
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : documentBlob ? (
            <SuperDocEditor
              key={document.id}
              document={documentBlob}
              documentMode={compactReaderMode ? "viewing" : documentMode}
              user={superdocUser}
              viewing={compactReaderMode ? COMPACT_VIEWING : FULL_VIEWING}
              interaction={
                compactReaderMode ? COMPACT_INTERACTION : FULL_INTERACTION
              }
              ui={compactReaderMode ? COMPACT_UI : FULL_UI}
              hideToolbar={compactReaderMode}
              contained
              renderLoading={renderLoadingOverlay}
              onReady={handleReady}
              onContentError={handleContentError}
              onException={handleException}
            />
          ) : null}
        </div>

        {showTocSidebar && !compactReaderMode && (
          <div className="h-full w-80 shrink-0 border-l border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#141720]">
            <TocMasterySidebar
              documentId={document.id}
              onJumpToPage={() => undefined}
              onSelectSection={handleSelectTocSection}
              onCreateTargetedQuiz={onCreateTargetedQuiz}
              onClose={() => setShowTocSidebar(false)}
            />
          </div>
        )}
      </div>

      {/* Hộp thoại xác nhận khi đóng lúc chưa lưu */}
      {showUnsavedDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
          onClick={() => {
            if (!isSaving) setShowUnsavedDialog(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="word-unsaved-dialog-title"
        >
          <div
            className="w-full max-w-sm rounded-[22px] border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#161922] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4
              id="word-unsaved-dialog-title"
              className="text-base font-semibold text-neutral-900 dark:text-white"
            >
              Bạn có thay đổi chưa lưu
            </h4>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              Bạn đã chỉnh sửa tài liệu Word này. Lưu thay đổi để cập nhật tệp gốc và đồng bộ lại chỉ mục AI?
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSaveAndClose()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer disabled:opacity-60"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>Lưu & Đóng</span>
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setShowUnsavedDialog(false);
                  onClose();
                }}
                className="inline-flex h-10 items-center justify-center rounded-full border border-rose-500/25 bg-rose-500/[0.06] hover:bg-rose-500/[0.12] text-xs font-semibold text-rose-600 dark:text-rose-400 cursor-pointer disabled:opacity-60"
              >
                Bỏ thay đổi
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setShowUnsavedDialog(false)}
                className="inline-flex h-9 items-center justify-center rounded-full text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.06] cursor-pointer"
              >
                Tiếp tục soạn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
