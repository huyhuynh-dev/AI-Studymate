"use client";

import React, { useState, useEffect, use, useMemo } from "react";
import ConversationHeader from "@/components/conversations/ConversationHeader";
import ConversationHeaderTabs, { TabKey } from "@/components/conversations/ConversationHeaderTabs";
import DocumentsTab from "@/components/conversations/DocumentsTab/DocumentsTab";
import SummaryTab from "@/components/conversations/SummaryTab/SummaryTab";
import FlashcardsTab from "@/components/conversations/FlashcardTab";
import QuizTab from "@/components/conversations/QuizTab";
import { useFocusMode } from "@/components/layout";
import { useSubjects } from "@/hooks/useSubjects";
import { useConversations } from "@/hooks/useConversations";
import { useDocuments } from "@/hooks/useDocuments";
import { useDecks } from "@/hooks/useDecks";
import { quizApi } from "@/services/quiz.api";

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
  const {
    isFocusMode,
    isViewingDocument,
    setFocusMode,
    isRightSidebarCollapsed,
    toggleRightSidebar,
  } = useFocusMode();

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

  // Lấy dữ liệu môn học và danh sách cuộc hội thoại thực tế
  const { subjects } = useSubjects();
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
    if (tab !== "documents" && tab !== "summary") {
      setFocusMode(false);
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
              onUploadDocument={handleGoToDocuments}
              hasDocuments={documents.length > 0}
              className="w-full flex-1"
            />
          )}

          {activeTab === "quiz" && (
            <QuizTab
              conversationId={conversationId}
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
        </div>
      </main>
    </div>
  );
}
