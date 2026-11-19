"use client";

import React, { useState, useEffect, use, useMemo } from "react";
import ConversationHeader from "@/components/conversations/ConversationHeader";
import ConversationHeaderTabs, { TabKey } from "@/components/conversations/ConversationHeaderTabs";
import DocumentsTab from "@/components/conversations/DocumentsTab/DocumentsTab";
import SummaryTab from "@/components/conversations/SummaryTab/SummaryTab";
import FlashcardsTab from "@/components/conversations/FlashcardTab";
import QuizTab, { type TargetedQuizRequest } from "@/components/conversations/QuizTab";
import AnalyticsDashboardView from "@/components/analytics/AnalyticsDashboardView";
import { useFocusMode } from "@/components/layout";
import { useCitationNavigation } from "@/contexts/CitationNavigationContext";
import { useSubjects } from "@/hooks/useSubjects";
import { useConversations } from "@/hooks/useConversations";
import { useDocuments } from "@/hooks/useDocuments";
import { useDecks } from "@/hooks/useDecks";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useConversationAnalytics } from "@/hooks/useLearningAnalytics";
import { quizApi } from "@/services/quiz.api";
import { extractApiErrorMessage } from "@/services/subjects.api";
import { extractUserApiError } from "@/services/users.api";
import type { SourceReference, StudyRecommendation } from "@/types";

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
  const {
    isFocusMode,
    isViewingDocument,
    setFocusMode,
    isRightSidebarCollapsed,
    toggleRightSidebar,
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
  }, []);

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
  }, [setFocusMode]);

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
        setFocusMode(false);
        setActiveTab("quiz");
        setQuizOpenRequest({ quizId: targetId, nonce: Date.now() });
      }
    };

    window.addEventListener("studymate:open-quiz", handleOpenQuizEvent);
    return () => {
      window.removeEventListener("studymate:open-quiz", handleOpenQuizEvent);
    };
  }, [setFocusMode]);

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
    deleteDocument,
    downloadDocument,
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
          isRightSidebarCollapsed={isRightSidebarCollapsed}
          onToggleRightSidebar={toggleRightSidebar}
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
              onDelete={deleteDocument}
              onDownload={downloadDocument}
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
                  setFocusMode(false);
                  setFlashcardOpenRequest({ deckId, nonce: Date.now() });
                  setActiveTab("flashcard");
                }}
                onOpenDocument={handleOpenDocumentFromAnalytics}
                userName={user?.name}
                onUpdateDailyGoal={handleUpdateDailyGoal}
                onUpdateExamGoal={handleUpdateExamGoal}
                onGoToFlashcards={() => {
                  setFocusMode(false);
                  setActiveTab("flashcard");
                }}
                onGoToQuiz={() => {
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
