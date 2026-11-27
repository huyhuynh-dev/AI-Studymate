"use client";

import React, { useState, useEffect, use, useMemo, useRef, useCallback } from "react";
import ConversationHeader from "@/components/conversations/ConversationHeader";
import ConversationHeaderTabs, {
  DEFAULT_TABS_CONFIG,
  TabConfig,
  TabKey,
} from "@/components/conversations/ConversationHeaderTabs";
import DocumentsTab from "@/components/conversations/DocumentsTab/DocumentsTab";
import SummaryTab from "@/components/conversations/SummaryTab/SummaryTab";
import FlashcardsTab from "@/components/conversations/FlashcardTab";
import QuizTab, { type TargetedQuizRequest } from "@/components/conversations/QuizTab";
import AnalyticsDashboardView from "@/components/analytics/AnalyticsDashboardView";
import { useFocusMode } from "@/components/layout";
import { useCitationNavigation } from "@/contexts/CitationNavigationContext";
import { useWorkspaceContextStore } from "@/contexts/WorkspaceContextProvider";
import { useSubjects } from "@/hooks/useSubjects";
import { useConversations } from "@/hooks/useConversations";
import { useDocuments } from "@/hooks/useDocuments";
import { useDecks } from "@/hooks/useDecks";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useConversationAnalytics } from "@/hooks/useLearningAnalytics";
import { quizApi } from "@/services/quiz.api";
import { extractApiErrorMessage } from "@/services/subjects.api";
import { extractUserApiError } from "@/services/users.api";
import {
  publishWorkspaceSync,
  subscribeWorkspaceSync,
  type WorkspaceSyncResource,
} from "@/lib/workspace-sync";
import type { SourceReference, StudyRecommendation } from "@/types";

const SYNC_RESOURCE_TO_TAB: Partial<Record<WorkspaceSyncResource, TabKey>> = {
  summary: "summary",
  flashcard: "flashcard",
  quiz: "quiz",
  "word-document": "documents",
  document: "documents",
};

interface ConversationPageProps {
  params: Promise<{
    subjectId: string;
    conversationId: string;
  }>;
}

export default function ConversationPage({ params }: ConversationPageProps) {
  const resolvedParams = use(params);
  const { subjectId, conversationId } = resolvedParams;

  const [activeTab, setActiveTab] = useState<TabKey>("documents");
  const [summaryOpenRequest, setSummaryOpenRequest] = useState<{
    summaryId: string;
    nonce: number;
  } | null>(null);
  const [flashcardOpenRequest, setFlashcardOpenRequest] = useState<{
    deckId: string;
    nonce: number;
  } | null>(null);
  const [quizOpenRequest, setQuizOpenRequest] = useState<{
    quizId: string;
    nonce: number;
  } | null>(null);
  const [quizTargetedRequest, setQuizTargetedRequest] =
    useState<TargetedQuizRequest | null>(null);
  const [analyticsWindowDays, setAnalyticsWindowDays] = useState<number>(30);
  const [unseenByConversation, setUnseenByConversation] = useState<
    Record<string, Partial<Record<TabKey, number>>>
  >({});
  const activeTabRef = useRef<TabKey>(activeTab);
  const workspaceStore = useWorkspaceContextStore();

  useEffect(() => {
    activeTabRef.current = activeTab;
    workspaceStore?.setLocation({
      pageType: "conversation",
      subjectId,
      conversationId,
      activeTab,
    });
  }, [activeTab, subjectId, conversationId, workspaceStore]);

  useEffect(() => {
    return () => {
      workspaceStore?.setLocation({ activeTab: null });
    };
  }, [workspaceStore]);

  useEffect(() => {
    if (!workspaceStore) return;
    if (activeTab === "analytics") {
      workspaceStore.patchAnalyticsState({ windowDays: analyticsWindowDays });
    } else {
      workspaceStore.clearTabSlice("analytics");
    }
  }, [activeTab, analyticsWindowDays, workspaceStore]);

  const clearTabUnseen = useCallback(
    (tab: TabKey) => {
      setUnseenByConversation((prev) => {
        const current = prev[conversationId];
        if (!current || !(tab in current)) return prev;
        const nextForConv = { ...current };
        delete nextForConv[tab];
        return { ...prev, [conversationId]: nextForConv };
      });
    },
    [conversationId]
  );

  // Ghi nhận thông báo thay đổi dữ liệu ở các tab không active để hiển thị badge nhắc nhẹ
  useEffect(() => {
    return subscribeWorkspaceSync(
      conversationId,
      ["summary", "flashcard", "quiz", "document"],
      (event) => {
        const targetTab = SYNC_RESOURCE_TO_TAB[event.resource];
        if (!targetTab || activeTabRef.current === targetTab) return;
        setUnseenByConversation((prev) => {
          const current = prev[conversationId] ?? {};
          return {
            ...prev,
            [conversationId]: {
              ...current,
              [targetTab]: (current[targetTab] ?? 0) + 1,
            },
          };
        });
      }
    );
  }, [conversationId]);

  const headerTabs = useMemo<TabConfig<TabKey>[]>(() => {
    const unseenCounts = unseenByConversation[conversationId] ?? {};
    return DEFAULT_TABS_CONFIG.map((tab) => {
      const count = activeTab === tab.id ? 0 : (unseenCounts[tab.id] ?? 0);
      if (count <= 0) return tab;
      return {
        ...tab,
        badge: (
          <span
            aria-label={`${count} mục mới vừa được tạo`}
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#4F46E5] px-1 text-[10px] font-bold leading-none text-white shadow-2xs dark:bg-[#818CF8] dark:text-[#0B0D13]"
          >
            +{count}
          </span>
        ),
      };
    });
  }, [activeTab, conversationId, unseenByConversation]);
  const {
    isFocusMode,
    isViewingDocument,
    setFocusMode,
  } = useFocusMode();
  const {
    activeTarget,
    navigateToDocumentCitation,
    openSidePanelCitation,
    closeSidePanelCitation,
  } = useCitationNavigation();

  const {
    analytics: conversationAnalytics,
    isLoading: isAnalyticsLoading,
    isValidating: isAnalyticsValidating,
    errorMessage: analyticsError,
    refresh: refreshConversationAnalytics,
  } = useConversationAnalytics(
    conversationId,
    activeTab === "analytics",
    analyticsWindowDays
  );

  // Đọc tham số điều hướng ban đầu từ Subject Analytics (?tab=analytics|flashcard|quiz|documents&docId=&page=)
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    const deckIdParam = params.get("deckId");
    const docIdParam = params.get("docId");
    const pageParam = Number(params.get("page") ?? "1");

    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (
        tabParam === "documents" ||
        tabParam === "summary" ||
        tabParam === "flashcard" ||
        tabParam === "quiz" ||
        tabParam === "analytics"
      ) {
        setActiveTab(tabParam);
      }
      if (tabParam === "flashcard" && deckIdParam) {
        setFlashcardOpenRequest({ deckId: deckIdParam, nonce: Date.now() });
      }
      if (docIdParam) {
        navigateToDocumentCitation({
          documentId: docIdParam,
          pageNo: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [navigateToDocumentCitation]);

  // Tự động chuyển sang Tab "Tài liệu" khi người dùng bấm vào một Badge trích dẫn từ Chatbox (bỏ qua nếu mở ở cột phải)
  useEffect(() => {
    if (!activeTarget?.documentId || activeTarget.mode === "side-panel") return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        setActiveTab("documents");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeTarget]);

  // Lắng nghe sự kiện mở trực tiếp bản tóm tắt từ Badge trong RightSidebar AI Chat
  useEffect(() => {
    const handleOpenSummaryEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ summaryId?: string }>;
      const targetId =
        customEvent.detail?.summaryId ||
        (typeof window !== "undefined"
          ? window.sessionStorage.getItem("studymate:open-summary-id") || ""
          : "");
      if (targetId) {
        clearTabUnseen("summary");
        setActiveTab("summary");
        setSummaryOpenRequest({ summaryId: targetId, nonce: Date.now() });
      }
    };

    window.addEventListener("studymate:open-summary", handleOpenSummaryEvent);
    return () => {
      window.removeEventListener(
        "studymate:open-summary",
        handleOpenSummaryEvent
      );
    };
  }, [clearTabUnseen]);

  // Lắng nghe sự kiện mở trực tiếp bộ thẻ Flashcard từ Badge trong RightSidebar AI Chat
  useEffect(() => {
    const handleOpenFlashcardDeckEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ deckId?: string }>;
      const targetId =
        customEvent.detail?.deckId ||
        (typeof window !== "undefined"
          ? window.sessionStorage.getItem("studymate:open-deck-id") || ""
          : "");
      if (targetId) {
        clearTabUnseen("flashcard");
        setFocusMode(false);
        setActiveTab("flashcard");
        setFlashcardOpenRequest({ deckId: targetId, nonce: Date.now() });
      }
    };

    window.addEventListener(
      "studymate:open-flashcard-deck",
      handleOpenFlashcardDeckEvent
    );
    return () => {
      window.removeEventListener(
        "studymate:open-flashcard-deck",
        handleOpenFlashcardDeckEvent
      );
    };
  }, [setFocusMode, clearTabUnseen]);

  // Lắng nghe sự kiện mở trực tiếp đề kiểm tra Quiz từ Badge trong RightSidebar AI Chat
  useEffect(() => {
    const handleOpenQuizEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ quizId?: string }>;
      const targetId =
        customEvent.detail?.quizId ||
        (typeof window !== "undefined"
          ? window.sessionStorage.getItem("studymate:open-quiz-id") || ""
          : "");
      if (targetId) {
        clearTabUnseen("quiz");
        setFocusMode(false);
        setActiveTab("quiz");
        setQuizOpenRequest({ quizId: targetId, nonce: Date.now() });
      }
    };

    window.addEventListener("studymate:open-quiz", handleOpenQuizEvent);
    return () => {
      window.removeEventListener("studymate:open-quiz", handleOpenQuizEvent);
    };
  }, [setFocusMode, clearTabUnseen]);

  // Lắng nghe sự kiện chuyển tab trực tiếp từ AI RightSidebar (`manageWorkspaceAndJobs`)
  useEffect(() => {
    const handleSwitchTabEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ tab?: TabKey }>;
      const targetTab = customEvent.detail?.tab;
      if (
        targetTab === "documents" ||
        targetTab === "summary" ||
        targetTab === "flashcard" ||
        targetTab === "quiz"
      ) {
        clearTabUnseen(targetTab);
        setFocusMode(false);
        setActiveTab(targetTab);
      }
    };

    const handleOpenDocumentEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        documentId?: string;
        pageNo?: number;
      }>;
      const docId = customEvent.detail?.documentId;
      if (!docId) return;
      clearTabUnseen("documents");
      setFocusMode(false);
      setActiveTab("documents");
      navigateToDocumentCitation({
        documentId: docId,
        fileName: "Tài liệu",
        pageNo: customEvent.detail?.pageNo ?? 1,
      });
    };

    window.addEventListener("studymate:switch-tab", handleSwitchTabEvent);
    window.addEventListener("studymate:open-document", handleOpenDocumentEvent);
    return () => {
      window.removeEventListener("studymate:switch-tab", handleSwitchTabEvent);
      window.removeEventListener("studymate:open-document", handleOpenDocumentEvent);
    };
  }, [setFocusMode, clearTabUnseen, navigateToDocumentCitation]);

  // Lấy dữ liệu người dùng, môn học và danh sách cuộc hội thoại thực tế
  const { user, updateProfile } = useCurrentUser();
  const { subjects, updateSubject } = useSubjects();
  const { conversations } = useConversations(subjectId);

  // Hook quản lý danh sách và tiến trình tải lên tài liệu
  const {
    documents,
    isLoading: isDocumentsLoading,
    isUploading,
    uploadQueue,
    errorMessage: documentsError,
    clearError: clearDocumentsError,
    uploadFiles,
    importGoogleDoc,
    deleteDocument,
    downloadDocument,
    updateDocumentInCache,
  } = useDocuments(conversationId);

  // Hook quản lý danh sách bộ thẻ flashcard để liên kết với QuizTab
  const { decks } = useDecks(conversationId);
  const deckOptions = useMemo(
    () =>
      decks.map((d) => ({
        id: d.id,
        name: d.name,
        cardCount: d.stats?.total ?? 0,
      })),
    [decks]
  );

  const currentSubject = subjects.find((s) => s.id === subjectId);
  const currentConversation = conversations.find((c) => c.id === conversationId);

  const subjectName = currentSubject?.name || "Cấu Trúc Dữ Liệu";
  const sessionTitle = currentConversation?.title || "Phiên học mới";

  const handleGoToDocuments = () => {
    setActiveTab("documents");
  };

  const handleTabChange = (tab: TabKey) => {
    clearTabUnseen(tab);
    setActiveTab(tab);
    if (tab === "documents") {
      closeSidePanelCitation();
    }
    if (tab !== "documents" && tab !== "summary") {
      setFocusMode(false);
    }
    if (tab === "analytics") {
      void refreshConversationAnalytics();
    }
  };

  const handleJumpToSourceRef = (ref: SourceReference) => {
    openSidePanelCitation({
      documentId: ref.documentId,
      fileName: ref.fileName,
      pageNo: ref.pageNumbers[0] ?? 1,
      bboxes: ref.bboxes,
      rawContent: ref.snippet,
    });
  };

  const handleOpenDocumentFromAnalytics = (
    documentId: string,
    fileName: string,
    pageNo = 1
  ) => {
    setFocusMode(false);
    navigateToDocumentCitation({
      documentId,
      fileName,
      pageNo: pageNo > 0 ? pageNo : 1,
    });
  };

  const [goalActionFeedback, setGoalActionFeedback] = useState<string | null>(null);

  const handleUpdateDailyGoal = async (minutes: number) => {
    setGoalActionFeedback(null);
    try {
      await updateProfile({ dailyGoalMinutes: minutes });
      await refreshConversationAnalytics();
    } catch (error) {
      setGoalActionFeedback(
        extractUserApiError(error, "Không thể cập nhật mục tiêu học hằng ngày")
      );
      throw error;
    }
  };

  const handleUpdateExamGoal = async (input: {
    examDate: string | null;
    targetScore?: number | null;
  }) => {
    setGoalActionFeedback(null);
    try {
      await updateSubject(subjectId, {
        examDate: input.examDate,
        targetScore: input.targetScore ?? null,
      });
      await refreshConversationAnalytics();
    } catch (error) {
      setGoalActionFeedback(
        extractApiErrorMessage(error, "Không thể cập nhật ngày thi cho môn học")
      );
      throw error;
    }
  };

  const handleTriggerTargetedQuiz = (opts: {
    chunkIds?: string[];
    sectionTitle?: string;
    bloomPreset?: "familiarize" | "balanced" | "exam_prep";
  }) => {
    clearTabUnseen("quiz");
    setFocusMode(false);
    setQuizTargetedRequest({
      nonce: Date.now(),
      chunkIds: opts.chunkIds,
      sectionTitle: opts.sectionTitle,
      bloomPreset: opts.bloomPreset,
    });
    setActiveTab("quiz");
  };

  const handleExecuteStudyAction = (rec: StudyRecommendation) => {
    const p = rec.payload;
    if (
      rec.actionType === "review_due_cards" ||
      rec.actionType === "remediate_leech_cards"
    ) {
      clearTabUnseen("flashcard");
      setFocusMode(false);
      if (p.deckId) {
        setFlashcardOpenRequest({ deckId: p.deckId, nonce: Date.now() });
      }
      setActiveTab("flashcard");
      return;
    }

    if (
      rec.actionType === "targeted_quiz_weak_chunk" ||
      rec.actionType === "address_bloom_gap"
    ) {
      handleTriggerTargetedQuiz({
        chunkIds: p.chunkIds,
        sectionTitle: p.sectionTitle,
        bloomPreset: p.bloomPreset ?? "exam_prep",
      });
      return;
    }

    if (rec.actionType === "read_unstudied_section" && p.documentId) {
      setFocusMode(false);
      navigateToDocumentCitation({
        documentId: p.documentId,
        pageNo: p.pageNo ?? 1,
      });
    }
  };

  const isDocumentViewerActive =
    (activeTab === "documents" || activeTab === "summary") && isViewingDocument;

  return (
    <div
      className={`flex flex-1 min-h-full w-full flex-col transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isFocusMode ? "h-full gap-0" : isDocumentViewerActive ? "gap-2 sm:gap-2.5" : "gap-3 sm:gap-3.5"
      }`}
    >
      {/* 1. Header Toolbar 2 tầng chuẩn Apple — Thu gọn trơn tru khi vào Focus Mode */}
      <div
        className={`shrink-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden ${
          isFocusMode
            ? "max-h-0 -translate-y-4 opacity-0 pointer-events-none"
            : "max-h-20 translate-y-0 opacity-100"
        }`}
      >
        <ConversationHeader
          subjectName={subjectName}
          subjectHref={`/home/${subjectId}`}
          sessionTitle={sessionTitle}
          badgeText="Phiên mới"
        />
      </div>

      {/* 2. Apple Segmented Tab Controller — Tự co giãn linh hoạt, chống tràn tuyệt đối */}
      <div
        className={`shrink-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden ${
          isFocusMode
            ? "max-h-0 -translate-y-4 opacity-0 pointer-events-none"
            : "max-h-16 translate-y-0 opacity-100"
        }`}
      >
        <ConversationHeaderTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          tabs={headerTabs}
        />
      </div>

      {/* 3. Vùng Nội dung Tab (Tab Content Outlet) — Unified Apple Workspace Surface */}
      <main
        className={`flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isFocusMode
            ? "min-h-0 rounded-none border-0 shadow-none bg-white dark:bg-[#0B0D13]"
            : "rounded-[20px] sm:rounded-[24px] border border-black/[0.06] dark:border-white/[0.08] shadow-xs bg-white dark:bg-[#12151C]"
        }`}
      >
        <div
          className={`relative flex flex-1 flex-col overflow-hidden transition-all duration-200 ${
            isFocusMode ? "min-h-0" : ""
          } ${
            isDocumentViewerActive
              ? "p-0 items-stretch justify-start"
              : "p-3 sm:p-5 lg:p-6 items-stretch justify-start overflow-y-auto"
          }`}
        >
          {activeTab === "documents" && (
            <DocumentsTab
              documents={documents}
              isLoading={isDocumentsLoading}
              isUploading={isUploading}
              uploadQueue={uploadQueue}
              errorMessage={documentsError}
              onClearError={clearDocumentsError}
              onUpload={uploadFiles}
              onImportGoogleDoc={importGoogleDoc}
              onDelete={deleteDocument}
              onDownload={downloadDocument}
              onDocumentUpdated={updateDocumentInCache}
              onCreateTargetedQuiz={(opts) =>
                handleTriggerTargetedQuiz({
                  chunkIds: opts.chunkIds,
                  sectionTitle: opts.sectionTitle,
                  bloomPreset: "exam_prep",
                })
              }
              className="w-full flex-1"
            />
          )}

          {activeTab === "summary" && (
            <SummaryTab
              key={summaryOpenRequest ? `summary-${summaryOpenRequest.nonce}` : "summary-default"}
              conversationId={conversationId}
              documents={documents}
              initialSummaryId={summaryOpenRequest?.summaryId}
              onUploadDocument={handleGoToDocuments}
              className="w-full flex-1"
            />
          )}

          {activeTab === "flashcard" && (
            <FlashcardsTab
              conversationId={conversationId}
              initialDeckId={flashcardOpenRequest?.deckId}
              openNonce={flashcardOpenRequest?.nonce}
              documents={documents.map((document) => ({
                id: document.id,
                name: document.file_name,
                meta: `${document.mime_type.toUpperCase()} · ${Math.ceil(document.file_size / 1024)} KB`,
              }))}
              onUploadDocument={handleGoToDocuments}
              hasDocuments={documents.length > 0}
              className="w-full flex-1"
            />
          )}

          {activeTab === "quiz" && (
            <QuizTab
              conversationId={conversationId}
              initialQuizId={quizOpenRequest?.quizId}
              openNonce={quizOpenRequest?.nonce}
              targetedRequest={quizTargetedRequest}
              decks={deckOptions}
              documents={documents.map((document) => ({
                id: document.id,
                name: document.file_name,
                meta: `${document.mime_type.toUpperCase()} · ${Math.ceil(document.file_size / 1024)} KB`,
              }))}
              api={quizApi}
              hasDocuments={documents.length > 0}
              onUploadDocument={handleGoToDocuments}
              onFlashcardsCreated={(info) => {
                publishWorkspaceSync({
                  resource: "flashcard",
                  action: "updated",
                  conversationId,
                  entityId: info.deckId,
                  targetKind: "deck",
                  count: info.created,
                  occurredAt: new Date().toISOString(),
                });
              }}
              className="w-full flex-1"
            />
          )}

          {activeTab === "analytics" && (
            <div className="space-y-4">
              {goalActionFeedback && (
                <div
                  role="alert"
                  className="mx-auto max-w-[1200px] rounded-2xl border border-rose-500/20 bg-rose-50/80 dark:bg-[#FF453A]/10 px-4 py-2.5 text-xs font-medium text-rose-700 dark:text-[#FF6961]"
                >
                  {goalActionFeedback}
                </div>
              )}
              <AnalyticsDashboardView
                mode="conversation"
                data={conversationAnalytics}
                isLoading={isAnalyticsLoading}
                isValidating={isAnalyticsValidating}
                errorMessage={analyticsError}
                windowDays={analyticsWindowDays}
                onWindowDaysChange={setAnalyticsWindowDays}
                onRetry={() => void refreshConversationAnalytics()}
                onExecuteAction={handleExecuteStudyAction}
                onJumpToSource={handleJumpToSourceRef}
                onCreateTargetedQuiz={(opts) =>
                  handleTriggerTargetedQuiz({
                    chunkIds: opts.chunkIds,
                    sectionTitle: opts.sectionTitle,
                    bloomPreset: "exam_prep",
                  })
                }
                onOpenDeck={(deckId) => {
                  clearTabUnseen("flashcard");
                  setFocusMode(false);
                  setFlashcardOpenRequest({ deckId, nonce: Date.now() });
                  setActiveTab("flashcard");
                }}
                onOpenDocument={handleOpenDocumentFromAnalytics}
                userName={user?.name}
                onUpdateDailyGoal={handleUpdateDailyGoal}
                onUpdateExamGoal={handleUpdateExamGoal}
                onGoToFlashcards={() => {
                  clearTabUnseen("flashcard");
                  setFocusMode(false);
                  setActiveTab("flashcard");
                }}
                onGoToQuiz={() => {
                  clearTabUnseen("quiz");
                  setFocusMode(false);
                  setActiveTab("quiz");
                }}
                onGoToDocuments={() => {
                  setFocusMode(false);
                  setActiveTab("documents");
                }}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
