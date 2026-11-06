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
      className={`flex flex-1 min-h-full w-full flex-col transition-all duration-300 ease-in-out ${
        isFocusMode ? "h-full gap-0" : isDocumentViewerActive ? "gap-2.5" : "gap-4"
      }`}
    >
      {/* Hàng Header điều hướng: Breadcrumb bên trái & Các nút chức năng bên phải — Trượt lên & Ẩn đi khi vào Focus Mode */}
      <div
        className={`flex shrink-0 flex-wrap items-center justify-between gap-3 transition-all duration-300 ease-in-out overflow-hidden ${
          isFocusMode
            ? "max-h-0 -translate-y-4 opacity-0 pointer-events-none"
            : "max-h-16 translate-y-0 opacity-100"
        }`}
      >
        {/* Component: Breadcrumb điều hướng */}
        <ConversationHeaderRoutes
          subjectName={subjectName}
          subjectHref={`/home/${subjectId}`}
          sessionTitle={sessionTitle}
          badgeText="Phiên mới"
        />

        {/* Các nút hành động bên phải: Chia sẻ, Tùy chọn & Trợ lý StudyMate AI */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Chia sẻ"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-600 shadow-xs transition-all hover:bg-gray-50 hover:text-gray-900 active:scale-[0.98] cursor-pointer"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Tùy chọn khác"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-600 shadow-xs transition-all hover:bg-gray-50 hover:text-gray-900 active:scale-[0.98] cursor-pointer"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          <div className="relative group">
            <button
              type="button"
              onClick={toggleRightSidebar}
              aria-label="Trợ lý StudyMate AI"
              className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-xs transition-all active:scale-[0.98] cursor-pointer ${
                !isRightSidebarCollapsed
                  ? "border-indigo-200 bg-indigo-50 text-indigo-600 shadow-indigo-100/50"
                  : "border-gray-100 bg-white text-gray-600 hover:border-indigo-100 hover:bg-indigo-50/50 hover:text-indigo-600"
              }`}
            >
              <Sparkles className="h-4 w-4 text-indigo-600 transition-transform group-hover:scale-110" />
            </button>
            {/* Dark Tooltip khi hover */}
            <div className="pointer-events-none absolute right-0 top-full mt-2 hidden group-hover:flex items-center z-50 animate-in fade-in-50 zoom-in-95 duration-100">
              <div className="rounded-lg bg-white/95 backdrop-blur-sm border border-slate-200/80 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-md shadow-slate-200/50 whitespace-nowrap">
                {isRightSidebarCollapsed ? "Mở Trợ lý StudyMate AI" : "Thu gọn Trợ lý StudyMate AI"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Container chính: Thẻ màu trắng chứa Tabs & Nội dung (Tự động xoá viền & bo góc khi vào Focus Mode) */}
      <div
        className={`flex flex-1 flex-col bg-white overflow-hidden transition-all duration-300 ease-in-out ${
          isFocusMode
            ? "min-h-0 rounded-none border-0 shadow-none"
            : "rounded-2xl sm:rounded-3xl border border-gray-100 shadow-xs"
        }`}
      >
        {/* Component: Thanh Tab điều hướng — Trượt lên & Ẩn đi khi vào Focus Mode */}
        <div
          className={`relative z-10 shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
            isFocusMode
              ? "max-h-0 -translate-y-4 opacity-0 border-b-0 pointer-events-none"
              : "max-h-20 translate-y-0 opacity-100 border-b border-gray-100"
          }`}
        >
          <ConversationHeaderTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        </div>

        {/* Khu vực nội dung Tab (Loại bỏ padding thừa khi đang xem PDF/Ảnh để giải quyết Box-in-box Syndrome) */}
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
