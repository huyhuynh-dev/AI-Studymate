"use client";

import React, { useState, use } from "react";
import { Share2, MoreHorizontal } from "lucide-react";
import ConversationHeaderRoutes from "@/components/conversations/ConversationHeaderRoutes";
import ConversationHeaderTabs, { TabKey } from "@/components/conversations/ConversationHeaderTabs";
import DocumentsTab from "@/components/conversations/DocumentsTab";
import SummaryTab from "@/components/conversations/SummaryTab";
import FlashcardsTab from "@/components/conversations/FlashcardsTab";
import QuizTab from "@/components/conversations/QuizTab";
import { useSubjects } from "@/hooks/useSubjects";
import { useConversations } from "@/hooks/useConversations";

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

  // Lấy dữ liệu môn học và danh sách cuộc hội thoại thực tế
  const { subjects } = useSubjects();
  const { conversations } = useConversations(subjectId);

  const currentSubject = subjects.find((s) => s.id === subjectId);
  const currentConversation = conversations.find((c) => c.id === conversationId);

  const subjectName = currentSubject?.name || "Cấu Trúc Dữ Liệu";
  const sessionTitle = currentConversation?.title || "Phiên học mới";

  const handleUpload = (files: File[]) => {
    console.log("Uploaded files:", files);
  };

  const handleGoToDocuments = () => {
    setActiveTab("documents");
  };

  return (
    <div className="flex h-full w-full flex-col gap-4">
      {/* Hàng Header điều hướng: Breadcrumb bên trái & Các nút chức năng bên phải */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Component: Breadcrumb điều hướng */}
        <ConversationHeaderRoutes
          subjectName={subjectName}
          subjectHref={`/home/${subjectId}`}
          sessionTitle={sessionTitle}
          badgeText="Phiên mới"
        />

        {/* Các nút hành động bên phải: Chia sẻ & Thêm tùy chọn */}
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
        </div>
      </div>

      {/* Container chính: Thẻ màu trắng bo góc lớn chứa Tabs & Nội dung */}
      <div className="flex flex-1 flex-col rounded-3xl border border-gray-100 bg-white shadow-xs overflow-hidden">
        {/* Component: Thanh Tab điều hướng */}
        <ConversationHeaderTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Khu vực nội dung Tab */}
        <div className="flex flex-1 flex-col items-center justify-center p-4 sm:p-6 md:p-8">
          {activeTab === "documents" && (
            <DocumentsTab onUpload={handleUpload} className="w-full" />
          )}

          {activeTab === "summary" && (
            <SummaryTab
              onUploadDocument={handleGoToDocuments}
              className="w-full"
            />
          )}

          {activeTab === "flashcard" && (
            <FlashcardsTab
              onUploadDocument={handleGoToDocuments}
              className="w-full"
            />
          )}

          {activeTab === "quiz" && (
            <QuizTab
              onUploadDocument={handleGoToDocuments}
              className="w-full"
            />
          )}
        </div>
      </div>
    </div>
  );
}