"use client";

import React, { useState, useEffect, use } from "react";
import { Share2, MoreHorizontal, Sparkles } from "lucide-react";
import ConversationHeaderRoutes from "@/components/conversations/ConversationHeaderRoutes";
import ConversationHeaderTabs, { TabKey } from "@/components/conversations/ConversationHeaderTabs";
import DocumentsTab from "@/components/conversations/DocumentsTab";
import SummaryTab from "@/components/conversations/SummaryTab/SummaryTab";
import FlashcardsTab from "@/components/conversations/FlashcardTab";
import QuizTab from "@/components/conversations/QuizTab";
import { useFocusMode } from "@/components/layout";
import { useSubjects } from "@/hooks/useSubjects";
import { useConversations } from "@/hooks/useConversations";
import { useDocuments } from "@/hooks/useDocuments";

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
        isFocusMode ? "h-full gap-0" : isDocumentViewerActive ? "gap-2 sm:gap-2.5" : "gap-3 sm:gap-4"
      }`}
    >
      {/* Hàng Header điều hướng: Breadcrumb bên trái & Các nút chức năng bên phải — Trượt lên & Ẩn đi khi vào Focus Mode */}
      <div
        className={`flex shrink-0 flex-wrap items-center justify-between gap-3 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden ${
          isFocusMode
            ? "max-h-0 -translate-y-4 opacity-0 pointer-events-none"
            : "max-h-16 translate-y-0 opacity-100"
        }`}
      >
        {/* Component: Breadcrumb điều hướng Apple */}
        <ConversationHeaderRoutes
          subjectName={subjectName}
          subjectHref={`/home/${subjectId}`}
          sessionTitle={sessionTitle}
          badgeText="Phiên mới"
        />

        {/* Các nút hành động bên phải phong cách Apple Toolbar Pill Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            title="Chia sẻ"
            aria-label="Chia sẻ"
            className="flex h-8.5 w-8.5 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#12151C]/80 backdrop-blur-md text-neutral-600 dark:text-neutral-300 shadow-2xs transition-all duration-200 hover:bg-neutral-100/80 dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-white active:scale-95 cursor-pointer"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Tùy chọn khác"
            aria-label="Tùy chọn khác"
            className="flex h-8.5 w-8.5 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#12151C]/80 backdrop-blur-md text-neutral-600 dark:text-neutral-300 shadow-2xs transition-all duration-200 hover:bg-neutral-100/80 dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-white active:scale-95 cursor-pointer"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {/* Nút bật/tắt Trợ lý AI StudyMate */}
          <div className="relative group">
            <button
              type="button"
              onClick={toggleRightSidebar}
              aria-label="Trợ lý StudyMate AI"
              className={`flex h-8.5 w-8.5 sm:h-9 sm:w-9 items-center justify-center rounded-full border transition-all duration-200 active:scale-95 cursor-pointer ${
                !isRightSidebarCollapsed
                  ? "border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-[#4F46E5] dark:text-[#818CF8] shadow-xs"
                  : "border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#12151C]/80 backdrop-blur-md text-neutral-600 dark:text-neutral-400 hover:border-indigo-200 dark:hover:border-indigo-800/40 hover:bg-indigo-50/50 hover:text-[#4F46E5]"
              }`}
            >
              <Sparkles className="h-4 w-4 text-[#4F46E5] dark:text-[#818CF8] transition-transform duration-200 group-hover:scale-110" />
            </button>
            {/* Apple Floating Tooltip khi hover */}
            <div className="pointer-events-none absolute right-0 top-full mt-2 hidden group-hover:flex items-center z-50 animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="rounded-full bg-[#0B1C30]/90 dark:bg-white/95 backdrop-blur-md px-3 py-1 text-xs font-medium text-white dark:text-[#0B1C30] shadow-xl whitespace-nowrap">
                {isRightSidebarCollapsed ? "Mở Trợ lý StudyMate AI" : "Thu gọn Trợ lý StudyMate AI"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Container chính: Thẻ chứa Tabs & Nội dung với Apple Concentric Radii */}
      <div
        className={`flex flex-1 flex-col bg-white dark:bg-[#12151C] overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isFocusMode
            ? "min-h-0 rounded-none border-0 shadow-none"
            : "rounded-[20px] sm:rounded-[24px] border border-black/[0.06] dark:border-white/[0.08] shadow-xs"
        }`}
      >
        {/* Component: Thanh Tab điều hướng — Trượt lên & Ẩn đi khi vào Focus Mode */}
        <div
          className={`relative z-10 shrink-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden ${
            isFocusMode
              ? "max-h-0 -translate-y-4 opacity-0 border-b-0 pointer-events-none"
              : "max-h-20 translate-y-0 opacity-100"
          }`}
        >
          <ConversationHeaderTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        </div>

        {/* Khu vực nội dung Tab */}
        <div
          className={`relative flex flex-1 flex-col overflow-hidden transition-all duration-200 ${
            isFocusMode ? "min-h-0" : ""
          } ${
            isDocumentViewerActive
              ? "p-0 items-stretch justify-start"
              : "p-4 sm:p-6 md:p-8 items-center justify-center"
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
              onUploadDocument={handleGoToDocuments}
              className="w-full flex-1"
            />
          )}
        </div>
      </div>
    </div>
  );
}
