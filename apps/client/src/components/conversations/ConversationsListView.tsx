"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Folder, Search, Plus, ChevronRight, Loader2 } from "lucide-react";
import ConversationUpsertModal from "./ConversationUpsertModal";
import DeleteConversationModal from "./DeleteConversationModal";
import ConversationContextMenu, { ContextMenuPosition } from "./ConversationContextMenu";
import { useConversations } from "@/hooks/useConversations";
import { useSubjects } from "@/hooks/useSubjects";
import { useRouter } from "next/navigation";

export interface ConversationItem {
  id: string;
  title: string;
  isActive?: boolean;
}

// Giữ lại alias ConversationSession để đảm bảo tính tương thích
export type ConversationSession = ConversationItem;

export interface ConversationsListViewProps {
  title?: string;
  totalConversationsCount?: number;
  totalSessionsCount?: number;
  subjectId?: string;
  onSelectConversation?: (conversation: ConversationItem) => void;
  onNavigate?: (conversation: ConversationItem) => void;
  onCreateConversation?: () => void;
  onCreateSession?: () => void;
  onSearchChange?: (query: string) => void;
  className?: string;
}

export default function ConversationsListView({
  title: externalTitle,
  totalConversationsCount,
  totalSessionsCount,
  subjectId,
  onSelectConversation,
  onNavigate,
  onCreateConversation,
  onCreateSession,
  onSearchChange,
  className = "",
}: ConversationsListViewProps) {
  const router = useRouter();

  // Lấy tên môn học từ hook useSubjects
  const { subjects } = useSubjects();
  const currentSubject = subjects.find((s) => s.id === subjectId);
  const displayTitle = externalTitle || currentSubject?.name || "Không Gian\nHọc Tập";

  const {
    conversations: apiConversations,
    isLoading,
    createSession,
    updateSession,
    deleteSession,
  } = useConversations(subjectId);

  const conversations = useMemo<ConversationItem[]>(() => {
    return apiConversations.map((c) => ({
      id: c.id,
      title: c.title,
    }));
  }, [apiConversations]);

  const [searchQuery, setSearchQuery] = useState("");
  const [focusedConversationId, setFocusedConversationId] = useState<string | null>(null);

  // Trạng thái Context Menu
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: ContextMenuPosition;
    conversation: ConversationItem | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    conversation: null,
  });

  // Trạng thái Modal Tạo / Chỉnh sửa
  const [upsertModal, setUpsertModal] = useState<{
    isOpen: boolean;
    mode: "create" | "edit";
    conversation: ConversationItem | null;
  }>({
    isOpen: false,
    mode: "create",
    conversation: null,
  });

  // Trạng thái Modal Xóa
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    conversation: ConversationItem | null;
  }>({
    isOpen: false,
    conversation: null,
  });

  // Xử lý tìm kiếm
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    onSearchChange?.(value);
  };

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const lowerQuery = searchQuery.toLowerCase();
    return conversations.filter((item) =>
      item.title.toLowerCase().includes(lowerQuery)
    );
  }, [conversations, searchQuery]);

  // Tắt hiệu ứng Focus khi người dùng click chuột ra ngoài
  useEffect(() => {
    if (focusedConversationId === null) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('[data-conversation-item="true"]') ||
        target?.closest('[data-session-item="true"]') ||
        target?.closest('[data-context-menu="true"]') ||
        target?.closest('[role="dialog"]') ||
        target?.closest('[role="alertdialog"]')
      ) {
        return;
      }
      setFocusedConversationId(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [focusedConversationId]);

  // Click vào cuộc hội thoại -> Focus vào item đó
  const handleConversationClick = (conversation: ConversationItem) => {
    setFocusedConversationId(conversation.id);
    onSelectConversation?.(conversation);
  };

  // Right-click vào cuộc hội thoại -> Focus và hiện Menu thao tác
  const handleContextMenu = (e: React.MouseEvent, conversation: ConversationItem) => {
    e.preventDefault();
    setFocusedConversationId(conversation.id);
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      conversation,
    });
  };

  // Mở modal tạo mới
  const handleOpenCreateModal = () => {
    if (onCreateConversation) {
      onCreateConversation();
    } else {
      onCreateSession?.();
    }
    setUpsertModal({
      isOpen: true,
      mode: "create",
      conversation: null,
    });
  };

  // Mở modal chỉnh sửa từ menu
  const handleOpenEditModal = () => {
    if (!contextMenu.conversation) return;
    setUpsertModal({
      isOpen: true,
      mode: "edit",
      conversation: contextMenu.conversation,
    });
  };

  // Mở modal xóa từ menu
  const handleOpenDeleteModal = () => {
    if (!contextMenu.conversation) return;
    setDeleteModal({
      isOpen: true,
      conversation: contextMenu.conversation,
    });
  };

  const displayCount =
    totalConversationsCount ?? totalSessionsCount ?? conversations.length;

  return (
    <div className={`w-full max-w-4xl mx-auto p-4 sm:p-6 bg-white ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
        {/* Left: Folder Icon & Title */}
        <div className="flex items-center gap-3.5">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-2xl shrink-0"
            style={{
              backgroundColor: currentSubject?.color ? `${currentSubject.color}15` : "#EEF2FF",
              color: currentSubject?.color || "#4F46E5",
            }}
          >
            <Folder className="w-6 h-6 stroke-[1.8]" />
          </div>
          <div className="text-left">
            <h1 className="text-xl font-bold text-gray-900 leading-tight whitespace-pre-line">
              {displayTitle}
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 font-normal mt-0.5">
              {displayCount > 0 ? `${displayCount} phiên học` : "Không có phiên học nào"}
            </p>
          </div>
        </div>

        {/* Right: Search & Create Session Button */}
        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Tìm kiếm phiên học..."
              className="w-full pl-9 pr-3.5 py-2 text-sm text-gray-800 placeholder:text-gray-400 bg-white border border-gray-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>

          {/* Create Session Button */}
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#4845E4] hover:bg-[#3d3bc9] active:bg-[#3432b3] text-white rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="text-xs sm:text-sm font-semibold leading-tight text-center">
              Tạo phiên<br className="hidden sm:inline" /> học
            </span>
          </button>
        </div>
      </div>

      {/* Conversations List */}
      <div className="mt-6 flex flex-col gap-3">
        {isLoading ? (
          <div className="py-12 flex justify-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : !subjectId ? (
          <div className="py-12 text-center text-sm text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
            Vui lòng chọn một Không gian học tập.
          </div>
        ) : filteredConversations.length > 0 ? (
          filteredConversations.map((conversation) => {
            const isFocused = focusedConversationId === conversation.id;
            const conversationId = conversation.id;

            return (
              <div
                key={conversationId}
                tabIndex={0}
                data-conversation-item="true"
                data-session-item="true"
                onClick={() => handleConversationClick(conversation)}
                onContextMenu={(e) => handleContextMenu(e, conversation)}
                className={`flex items-center justify-between px-5 py-3.5 sm:py-4 bg-white border rounded-2xl cursor-pointer select-none
                  transform transition-all duration-200 ease-out hover:scale-[1.015] hover:shadow-md
                  ${
                    isFocused
                      ? "border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50/15 shadow-sm"
                      : "border-gray-200/80 shadow-2xs hover:border-gray-300"
                  }`}
              >
                {/* Status Indicator & Title */}
                <div className="flex items-center gap-3.5 min-w-0 pr-3">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-200 ${
                      isFocused
                        ? "bg-emerald-500 ring-2 ring-emerald-500/20"
                        : conversation.isActive
                        ? "bg-emerald-500 ring-2 ring-emerald-500/20"
                        : "bg-gray-300"
                    }`}
                  />
                  <span
                    className={`text-sm sm:text-base font-semibold truncate transition-colors ${
                      isFocused ? "text-indigo-950 font-bold" : "text-gray-800"
                    }`}
                  >
                    {conversation.title}
                  </span>
                </div>

                {/* Dấu ">" dành cho chuyển hướng */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate?.(conversation);
                    if (subjectId) {
                      router.push(`/home/${subjectId}/${conversationId}`);
                    }
                  }}
                  className="p-1 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-gray-100 transition-colors shrink-0 cursor-pointer"
                  title="Chuyển hướng đến phiên học"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center text-sm text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
            Không tìm thấy phiên học nào phù hợp.
          </div>
        )}
      </div>

      {/* Context Menu khi Right Click */}
      <ConversationContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
        onEdit={handleOpenEditModal}
        onDelete={handleOpenDeleteModal}
      />

      {/* Modal Tạo mới / Chỉnh sửa */}
      <ConversationUpsertModal
        isOpen={upsertModal.isOpen}
        mode={upsertModal.mode}
        initialTitle={upsertModal.conversation?.title || ""}
        onClose={() => setUpsertModal((prev) => ({ ...prev, isOpen: false }))}
        onSubmit={async (title) => {
          if (upsertModal.mode === "create") {
            await createSession(title);
          } else if (upsertModal.mode === "edit" && upsertModal.conversation) {
            await updateSession(upsertModal.conversation.id, title);
          }
          setUpsertModal((prev) => ({ ...prev, isOpen: false }));
        }}
      />

      {/* Modal Xác nhận Xóa */}
      <DeleteConversationModal
        isOpen={deleteModal.isOpen}
        conversationTitle={deleteModal.conversation?.title}
        onClose={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={async () => {
          if (deleteModal.conversation) {
            await deleteSession(deleteModal.conversation.id);
            setDeleteModal((prev) => ({ ...prev, isOpen: false }));
          }
        }}
      />
    </div>
  );
}
