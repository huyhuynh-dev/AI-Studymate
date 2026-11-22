"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SuperDoc, type Config, type DocumentMode } from "superdoc";
import type { TextTarget } from "superdoc/ui";
import {
  SuperDocUIProvider,
  useSetSuperDoc,
  useSuperDocUI,
} from "superdoc/ui/react";
import "superdoc/style.css";
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
import { useWordAgent } from "@/contexts/WordAgentContext";
import { WordDocumentToolbar } from "./toolbar/WordDocumentToolbar";
import { WordAiReviewBanner } from "./review/WordAiReviewBanner";
import { WordSelectionAiPill } from "./review/WordSelectionAiPill";
import { WordTrackedChangePopover } from "./review/WordTrackedChangePopover";
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

const COMPACT_VIEWING: NonNullable<Config["viewing"]> = {
  comments: true,
  trackedChanges: "final",
};

const COMPACT_INTERACTION: NonNullable<Config["interaction"]> = {
  comments: { level: "read" },
  trackedChanges: { allowDecisions: false },
};

const FULL_INTERACTION: NonNullable<Config["interaction"]> = {
  comments: { level: "resolve" },
  trackedChanges: { allowDecisions: true },
};

const FIT_WIDTH_ZOOM: NonNullable<Config["zoom"]> = {
  mode: "fit-width",
  fitWidth: { min: 20, max: 100, padding: 24 },
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

/** Đồng bộ độ rộng & căn lề của thanh thước dính phía trên theo trang đầu tiên. */
function WordRulerPositioner({
  rulerRef,
  stageRef,
}: {
  rulerRef: React.RefObject<HTMLDivElement | null>;
  stageRef: React.RefObject<HTMLDivElement | null>;
}) {
  const ui = useSuperDocUI();

  const alignRuler = useCallback(() => {
    const stage = stageRef.current;
    const rulerElement = rulerRef.current;
    const firstPage = stage?.querySelector<HTMLElement>('[data-page-index="0"]');
    if (!stage || !rulerElement || !firstPage) return;

    const stageBounds = stage.getBoundingClientRect();
    const pageBounds = firstPage.getBoundingClientRect();
    rulerElement.style.width = `${pageBounds.width}px`;
    rulerElement.style.marginLeft = `${pageBounds.left - stageBounds.left + stage.scrollLeft}px`;
  }, [rulerRef, stageRef]);

  useEffect(() => {
    alignRuler();
    const stop = ui?.viewport.observe(alignRuler);
    const stage = stageRef.current;
    const resizeObserver =
      stage && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(alignRuler)
        : null;
    if (stage && resizeObserver) {
      resizeObserver.observe(stage);
    }

    window.addEventListener("resize", alignRuler);
    stage?.addEventListener("scroll", alignRuler);

    return () => {
      stop?.();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", alignRuler);
      stage?.removeEventListener("scroll", alignRuler);
    };
  }, [alignRuler, stageRef, ui]);

  return null;
}

export default function DocumentWordEditor(props: DocumentWordEditorProps) {
  return (
    <SuperDocUIProvider key={props.document.id}>
      <DocumentWordWorkspace {...props} />
    </SuperDocUIProvider>
  );
}

function DocumentWordWorkspace({
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
  const setSuperDoc = useSetSuperDoc();
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
    markDirty,
  } = persistence;

  const { registerEditor, triggerQuickPrompt } = useWordAgent();

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

  const superdocInstanceRef = useRef<SuperDoc | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const editorOverlayRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const isReadyRef = useRef(false);
  const [reviewExpandSignal, setReviewExpandSignal] = useState(0);

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const initialModeRef = useRef(documentMode);
  const initialTrackedViewRef = useRef(trackedChangesView);
  const attachRef = useRef(attachSuperDocInstance);

  useEffect(() => {
    initialModeRef.current = documentMode;
  }, [documentMode]);

  useEffect(() => {
    initialTrackedViewRef.current = trackedChangesView;
  }, [trackedChangesView]);

  useEffect(() => {
    attachRef.current = attachSuperDocInstance;
  }, [attachSuperDocInstance]);

  useEffect(() => {
    if (!isEditorReady || compactReaderMode) {
      return undefined;
    }

    return registerEditor({
      document,
      conversationId: document.conversation_id,
      isDirty: () => isDirtyRef.current,
      exportWorkingBlob: async () => {
        const instance = superdocInstanceRef.current;
        if (!instance || !isReadyRef.current) return null;
        const result = await instance.export({
          exportType: ["docx"],
          triggerDownload: false,
          exportedName: stripExtensionForExport(document.file_name),
          policies: {
            trackedChanges: "review-preserving",
            comments: "preserve",
            contentControls: "preserve",
          },
        });
        return result instanceof Blob && result.size > 0 ? result : null;
      },
      applyAgentSnapshotBlob: async (blob, options) => {
        const instance = superdocInstanceRef.current;
        if (!instance || !isReadyRef.current) return;
        const replacement = await instance.replaceDocument(blob);
        if (!replacement.ok) {
          throw new Error(
            "Không thể nạp bản chỉnh sửa DOCX mới vào trình soạn thảo SuperDoc.",
          );
        }
        if (options?.changeMode !== "direct") {
          setTrackedChangesView("markup");
          instance.setViewingOptions({
            comments: true,
            trackedChanges: "markup",
          });
        }
        markDirty();
      },
      acceptAllChanges: async () => {
        const instance = superdocInstanceRef.current;
        const tcHandle = instance?.ui?.trackChanges;
        if (!tcHandle) return 0;
        const totalBefore = tcHandle.list().length;
        const result = await tcHandle.acceptAllAsync();
        if (result !== false) {
          markDirty();
          return totalBefore;
        }
        return 0;
      },
      rejectAllChanges: async () => {
        const instance = superdocInstanceRef.current;
        const tcHandle = instance?.ui?.trackChanges;
        if (!tcHandle) return 0;
        const totalBefore = tcHandle.list().length;
        const result = await tcHandle.rejectAllAsync();
        if (result !== false) {
          markDirty();
          return totalBefore;
        }
        return 0;
      },
      openReviewPanel: () => {
        const instance = superdocInstanceRef.current;
        if (instance && isReadyRef.current) {
          setTrackedChangesView("markup");
          instance.setViewingOptions({
            comments: true,
            trackedChanges: "markup",
          });
        }
        setReviewExpandSignal((n) => n + 1);
      },
    });
  }, [compactReaderMode, document, isEditorReady, markDirty, registerEditor]);

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

  // Khởi tạo trực tiếp SuperDoc v2 với `ui.toolbar: false`, Zoom Fit-Width và Sticky Ruler
  useEffect(() => {
    const mountEl = mountRef.current;
    const rulerEl = rulerRef.current;

    if (!documentBlob || !mountEl || loadError) {
      return;
    }

    let disposed = false;
    isReadyRef.current = false;
    setIsEditorReady(false);
    setFatalEditorError(null);
    setTransientNotice(null);

    const instance = new SuperDoc({
      selector: mountEl,
      document: documentBlob,
      documentMode: compactReaderMode ? "viewing" : initialModeRef.current,
      viewing: compactReaderMode
        ? COMPACT_VIEWING
        : { comments: true, trackedChanges: initialTrackedViewRef.current },
      user: superdocUser,
      interaction: compactReaderMode ? COMPACT_INTERACTION : FULL_INTERACTION,
      zoom: FIT_WIDTH_ZOOM,
      ui: {
        toolbar: false,
        comments: true,
        contextMenu: !compactReaderMode,
        loading: false,
        search: true,
        linkPopover: false,
        ruler:
          !compactReaderMode && rulerEl ? { container: rulerEl } : false,
        contentControls: true,
      },
      onReady: ({ superdoc: readySuperDoc }) => {
        if (disposed) return;
        superdocInstanceRef.current = readySuperDoc;
        isReadyRef.current = true;
        setIsEditorReady(true);
        setFatalEditorError(null);
        setSuperDoc(readySuperDoc);
        attachRef.current(readySuperDoc);
      },
      onContentError: (event) => {
        if (disposed) return;
        const errRecord =
          event.error && typeof event.error === "object"
            ? (event.error as { diagnosticCode?: unknown; message?: unknown })
            : null;
        const diagnosticCode =
          ("diagnosticCode" in event
            ? (event as { diagnosticCode?: unknown }).diagnosticCode
            : undefined) ?? errRecord?.diagnosticCode;

        if (diagnosticCode === "UNSUPPORTED_FEATURE") {
          console.warn(
            "[DocumentWordEditor] Tính năng OOXML chưa hỗ trợ đầy đủ:",
            event,
          );
          return;
        }
        if (!isReadyRef.current) {
          const message =
            typeof event.error === "string"
              ? event.error
              : event.error instanceof Error
                ? event.error.message
                : typeof errRecord?.message === "string"
                  ? errRecord.message
                  : "Tệp DOCX có cấu trúc không tương thích hoặc bị hỏng.";
          setFatalEditorError(message);
        } else {
          console.warn("[DocumentWordEditor] Cảnh báo nội dung DOCX:", event);
        }
      },
      onException: (exception) => {
        if (disposed) return;
        if ("code" in exception && exception.code === "edit-rejected") {
          setTransientNotice("Vùng này đang được khóa hoặc ở chế độ chỉ đọc.");
          window.setTimeout(() => {
            setTransientNotice((curr) =>
              curr === "Vùng này đang được khóa hoặc ở chế độ chỉ đọc."
                ? null
                : curr,
            );
          }, 3000);
          return;
        }
        if (!isReadyRef.current) {
          const err = exception.error;
          const message =
            err instanceof Error
              ? err.message
              : typeof err === "string"
                ? err
                : "Không thể khởi tạo trình soạn thảo SuperDoc cho tệp này.";
          setFatalEditorError(message);
        }
      },
    });

    return () => {
      disposed = true;
      isReadyRef.current = false;
      superdocInstanceRef.current = null;
      attachRef.current(null);
      instance.destroy();
      mountEl.replaceChildren();
      rulerEl?.replaceChildren();
    };
  }, [
    compactReaderMode,
    document.id,
    documentBlob,
    loadError,
    setSuperDoc,
    superdocUser,
  ]);

  const handleChangeDocumentMode = useCallback(
    (nextMode: DocumentMode) => {
      setDocumentMode(nextMode);
      const instance = superdocInstanceRef.current;
      if (!instance || !isReadyRef.current) return;
      instance.setDocumentMode(nextMode);
      if (nextMode === "viewing") {
        instance.setViewingOptions({
          comments: true,
          trackedChanges: trackedChangesView,
        });
      }
    },
    [trackedChangesView],
  );

  const handleChangeTrackedChangesView = useCallback(
    (nextView: TrackedChangesView) => {
      setTrackedChangesView(nextView);
      const instance = superdocInstanceRef.current;
      if (!instance || !isReadyRef.current) return;
      instance.setViewingOptions({
        comments: true,
        trackedChanges: nextView,
      });
    },
    [],
  );

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

  const scrollToQueries = useCallback(
    async (queries: string[], isCancelled?: () => boolean): Promise<boolean> => {
      const instance = superdocInstanceRef.current;
      if (!instance || queries.length === 0) return false;

      const doc = instance.activeEditor?.doc;
      const ui = instance.ui;

      // 1. Ưu tiên định vị bằng Document API + cuộn trang ảo qua `ui.viewport.scrollIntoView`
      if (doc?.query?.match && ui?.viewport?.scrollIntoView) {
        for (const q of queries) {
          if (q.length < 4 || isCancelled?.()) continue;
          try {
            const matches = await doc.query.match({
              select: { type: "text", pattern: q, caseSensitive: false },
            });
            if (isCancelled?.()) return false;
            const match = matches.items[0];
            if (match && match.matchKind === "text" && match.blocks.length > 0) {
              const [first, ...rest] = match.blocks;
              const target: TextTarget = {
                kind: "text",
                segments: [
                  { blockId: first.blockId, range: first.range },
                  ...rest.map((block) => ({
                    blockId: block.blockId,
                    range: block.range,
                  })),
                ],
                ...(match.target.story ? { story: match.target.story } : {}),
              };
              for (let step = 0; step < 8 && !isCancelled?.(); step++) {
                const res = await ui.viewport.scrollIntoView({
                  target,
                  block: "center",
                  behavior: "instant",
                });
                if (res.success) {
                  findAndScrollDomText(mountRef.current, [q, ...queries]);
                  return true;
                }
              }
            }
          } catch {
            // Tiếp tục fallback search API / DOM nếu query phức tạp
          }
        }
      }

      if (isCancelled?.()) return false;

      // 2. Fallback SuperDoc search + DOM TreeWalker
      for (const q of queries) {
        if (q.length >= 4 && ui?.search?.find) {
          try {
            ui.search.find(q);
            break;
          } catch {
            // Bỏ qua nếu search controller chưa sẵn sàng
          }
        }
      }

      return findAndScrollDomText(mountRef.current, queries);
    },
    [],
  );

  // Tự động nhảy tới vị trí trích dẫn khi mở từ AI Chatbox / Flashcard / Quiz
  useEffect(() => {
    if (!isEditorReady || !citationTarget) return;

    let cancelled = false;
    const queries = buildCitationSearchQueries({
      quoteExact: citationTarget.textAnchor?.quoteExact,
      rawContent: citationTarget.rawContent,
      headings: citationTarget.headings,
    });

    const timer = window.setTimeout(() => {
      void scrollToQueries(queries, () => cancelled).then((matched) => {
        if (!cancelled) {
          setResolvedCitationTier(matched ? 2 : 3);
        }
      });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    isEditorReady,
    citationTarget?.nonce,
    citationTarget?.rawContent,
    citationTarget?.textAnchor?.quoteExact,
    citationTarget?.headings,
    scrollToQueries,
  ]);

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
        setTransientNotice(
          "Không thể xuất tệp DOCX lúc này. Vui lòng thử lại.",
        );
      } finally {
        setIsExporting(false);
      }
    },
    [document.file_name, isExporting],
  );

  const handleSelectTocSection = useCallback(
    (section: TocMasterySection) => {
      void scrollToQueries([section.text]).then((matched) => {
        if (!matched) {
          setTransientNotice(
            `Không tìm thấy tiêu đề "${section.text}" trong khung hiện tại.`,
          );
          window.setTimeout(() => setTransientNotice(null), 2600);
        }
      });
    },
    [scrollToQueries],
  );

  const containerClass =
    compactReaderMode || isFullscreen
      ? `flex h-full min-h-0 flex-1 flex-col bg-neutral-100/75 dark:bg-[#0F1218] ${isFullscreen && isExternalFullscreen === undefined ? "fixed inset-0 z-50" : ""} ${className}`
      : `flex h-[calc(100vh-140px)] min-h-[580px] w-full flex-col overflow-hidden rounded-[24px] border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/75 dark:bg-[#0F1218] shadow-sm ${className}`;

  const showEditorSurface =
    !isLoadingBlob && !loadError && !fatalEditorError && Boolean(documentBlob);

  return (
    <div className={containerClass}>
      {/* Unified Apple HIG Header */}
      <div className="flex h-13 shrink-0 items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/90 dark:bg-[#141720]/90 px-3 sm:px-4 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={handleAttemptClose}
            aria-label="Quay lại danh sách tài liệu"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-black/[0.07] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] px-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {!compactReaderMode && (
              <span className="hidden sm:inline">Quay lại</span>
            )}
          </button>

          <span className="inline-flex shrink-0 items-center rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-600 dark:text-blue-400">
            {isGoogleDoc ? "GDOCS" : "DOCX"}
          </span>

          <h3 className="min-w-0 truncate text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white">
            {document.file_name}
          </h3>

          {googleDocUrl && !compactReaderMode && (
            <a
              href={googleDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Mở liên kết Google Docs gốc"
              aria-label="Mở liên kết Google Docs gốc"
              className="hidden lg:inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.08] hover:text-blue-600 dark:hover:text-blue-400"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>

        {/* Giữa: Apple Segmented Mode Switcher */}
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
                    aria-pressed={active}
                    onClick={() => handleChangeDocumentMode(id)}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition-all cursor-pointer ${
                      active
                        ? "bg-white dark:bg-[#1E222D] text-blue-600 dark:text-blue-400 shadow-2xs"
                        : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="h-3 w-3" aria-hidden="true" />
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
                ).map(({ id, label }) => {
                  const active = trackedChangesView === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleChangeTrackedChangesView(id)}
                      className={`h-7 rounded-full px-2 text-[11px] font-medium transition-all cursor-pointer ${
                        active
                          ? "bg-white dark:bg-[#1E222D] text-neutral-900 dark:text-white shadow-2xs"
                          : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Phải: Trạng thái 2 tầng + Lưu + Export + Mục lục + Toàn màn hình */}
        <div className="flex shrink-0 items-center gap-1.5">
          {!compactReaderMode && (
            <div className="hidden xl:flex items-center gap-1.5 mr-1">
              {isSaving ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  Đang lưu…
                </span>
              ) : isDirty ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Chưa lưu
                </span>
              ) : lastSavedAt ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  Đã lưu
                </span>
              ) : null}

              {syncError ||
              embedStatus === "failed" ||
              ocrStatus === "failed" ? (
                <span
                  title={
                    syncError ??
                    document.processing_error ??
                    "Lỗi đồng bộ chỉ mục AI"
                  }
                  className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400"
                >
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  Lỗi Sync AI
                </span>
              ) : isAiSyncing ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-300">
                  <Sparkles className="h-3 w-3 animate-pulse" aria-hidden="true" />
                  Đang đồng bộ AI…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                  <CloudCheck
                    className="h-3 w-3 text-emerald-500"
                    aria-hidden="true"
                  />
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
              aria-label="Lưu tài liệu"
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all cursor-pointer ${
                isDirty && !isSaving && isEditorReady
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-[0.98]"
                  : "border border-black/[0.07] dark:border-white/[0.1] bg-neutral-100/70 dark:bg-white/[0.04] text-neutral-400 dark:text-neutral-500 cursor-not-allowed"
              }`}
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">Lưu</span>
            </button>
          )}

          {!compactReaderMode && (
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                disabled={!isEditorReady || isExporting}
                onClick={() => setShowExportMenu((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={showExportMenu}
                aria-label="Xuất tệp DOCX về máy"
                title="Xuất tệp DOCX về máy"
                className="inline-flex h-8 items-center gap-1 rounded-full border border-black/[0.07] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] px-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/[0.1] disabled:opacity-50 cursor-pointer"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span className="hidden lg:inline">Xuất DOCX</span>
                <ChevronDown className="h-3 w-3 opacity-70" aria-hidden="true" />
              </button>

              {showExportMenu && (
                <div
                  role="menu"
                  aria-label="Tùy chọn xuất DOCX"
                  className="absolute right-0 top-10 z-40 w-64 overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#1A1D28] p-1.5 shadow-xl"
                >
                  <button
                    type="button"
                    role="menuitem"
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
                    role="menuitem"
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

          {!compactReaderMode && (
            <button
              type="button"
              onClick={() => setShowTocSidebar((prev) => !prev)}
              aria-pressed={showTocSidebar}
              aria-label="Mục lục và tiến độ nắm vững"
              title="Mục lục & Tiến độ nắm vững"
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                showTocSidebar
                  ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                  : "border-black/[0.07] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/[0.1]"
              }`}
            >
              <ListTree className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden lg:inline">Mục lục</span>
            </button>
          )}

          {!compactReaderMode && (
            <button
              type="button"
              onClick={() =>
                triggerQuickPrompt({ action: "custom", autoSend: false })
              }
              aria-label="Mở AI Agent chỉnh sửa tài liệu Word"
              title="Mở trợ lý AI Agent để thêm, sửa hoặc đề xuất thay đổi trực tiếp trên tài liệu"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 text-xs font-semibold text-indigo-700 dark:text-indigo-200 hover:bg-indigo-500/20 transition-colors cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden lg:inline">AI Agent</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleFullscreen}
            aria-label={
              isFullscreen
                ? "Thu nhỏ trình soạn thảo"
                : "Toàn màn hình trình soạn thảo"
            }
            title={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.07] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Thanh công cụ React thuần (thay thế hoàn toàn Vue toolbar mặc định của SuperDoc) */}
      {!compactReaderMode && <WordDocumentToolbar />}
      {!compactReaderMode && (
        <WordAiReviewBanner
          documentId={document.id}
          forceExpandSignal={reviewExpandSignal}
          onDecisionSettled={markDirty}
        />
      )}

      {/* Banners phản hồi */}
      {conflictMessage && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/25 bg-amber-500/[0.1] px-4 py-2 text-xs text-amber-800 dark:text-amber-200"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle
              className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <span>{conflictMessage}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reloadDocument}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-amber-600 px-3 text-[11px] font-semibold text-white hover:bg-amber-700 cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Tải lại bản mới nhất
            </button>
            <button
              type="button"
              onClick={clearSaveFeedback}
              className="text-amber-700 dark:text-amber-300 hover:opacity-80 cursor-pointer"
              aria-label="Đóng thông báo xung đột"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {saveError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 border-b border-rose-500/20 bg-rose-500/[0.08] px-4 py-2 text-xs text-rose-700 dark:text-rose-300"
        >
          <div className="flex items-center gap-2">
            <AlertCircle
              className="h-4 w-4 shrink-0 text-rose-500"
              aria-hidden="true"
            />
            <span>{saveError}</span>
          </div>
          <button
            type="button"
            onClick={clearSaveFeedback}
            className="text-rose-500 hover:opacity-80 cursor-pointer"
            aria-label="Đóng thông báo lỗi lưu"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {transientNotice && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-2 border-b border-blue-500/20 bg-blue-500/[0.08] px-4 py-1.5 text-xs text-blue-800 dark:text-blue-200"
        >
          <span>{transientNotice}</span>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => setTransientNotice(null)}
            className="opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
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
              void scrollToQueries(queries);
            }}
            onDismiss={() => onCitationDismiss?.()}
          />
        </div>
      )}

      {/* Main Content Area: Stage + Sticky Ruler + SuperDoc + TocMasterySidebar */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {isLoadingBlob ? (
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 text-neutral-500 dark:text-neutral-400">
            <Loader2
              className="h-7 w-7 animate-spin text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            />
            <p className="text-xs font-medium">
              Đang tải tài liệu Word từ máy chủ…
            </p>
          </div>
        ) : loadError || fatalEditorError ? (
          <div className="flex min-w-0 flex-1 items-center justify-center p-6">
            <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-rose-500/20 bg-white dark:bg-[#161922] p-6 text-center shadow-xs">
              <AlertTriangle
                className="h-8 w-8 text-rose-500"
                aria-hidden="true"
              />
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
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Thử tải lại
                </button>
                {onDownload && (
                  <button
                    type="button"
                    onClick={() => onDownload(document.id, document.file_name)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/[0.1] dark:border-white/[0.12] px-4 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/[0.06] cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Tải tệp gốc
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : showEditorSurface ? (
          <div
            ref={stageRef}
            className="studymate-word-stage relative min-w-0 flex-1 overflow-auto"
          >
            {!compactReaderMode && (
              <div className="studymate-word-ruler-strip">
                <div
                  ref={rulerRef}
                  className="studymate-word-ruler"
                  aria-label="Thước căn lề tài liệu"
                />
              </div>
            )}
            {!compactReaderMode && (
              <WordRulerPositioner rulerRef={rulerRef} stageRef={stageRef} />
            )}

            <div ref={editorOverlayRef} className="relative w-full min-h-full">
              <div
                ref={mountRef}
                className="studymate-superdoc-host"
                aria-label={`Trình soạn thảo ${document.file_name}`}
              />
              {!compactReaderMode && (
                <WordSelectionAiPill overlayContainerRef={editorOverlayRef} />
              )}
            </div>

            {!isEditorReady && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/95 dark:bg-[#141720]/95 text-neutral-500 dark:text-neutral-400">
                <Loader2
                  className="h-7 w-7 animate-spin text-blue-600 dark:text-blue-400"
                  aria-hidden="true"
                />
                <p className="text-xs font-medium">
                  Đang dựng tài liệu Word trong SuperDoc…
                </p>
              </div>
            )}
          </div>
        ) : null}

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

      {!compactReaderMode && (
        <WordTrackedChangePopover
          stageContainerRef={stageRef}
          onDecisionSettled={markDirty}
        />
      )}

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
              Bạn đã chỉnh sửa tài liệu Word này. Lưu thay đổi để cập nhật tệp
              gốc và đồng bộ lại chỉ mục AI?
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSaveAndClose()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer disabled:opacity-60"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-3.5 w-3.5" aria-hidden="true" />
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
