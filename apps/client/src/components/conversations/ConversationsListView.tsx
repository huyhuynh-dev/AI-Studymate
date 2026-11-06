"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Folder,
  Search,
  Plus,
  ArrowLeft,
  ArrowUpRight,
  MoreVertical,
  MessageSquare,
  Sparkles,
} from "lucide-react";
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

  // Lấy thông tin môn học từ hook useSubjects
  const { subjects } = useSubjects();
  const currentSubject = subjects.find((s) => s.id === subjectId);
  const displayTitle = externalTitle || currentSubject?.name || "Không gian học tập";
  const subjectColor = currentSubject?.color || "#4F46E5";

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

  // Click vào cuộc hội thoại -> Chuyển hướng hoặc chọn
  const handleConversationClick = (conversation: ConversationItem) => {
    setFocusedConversationId(conversation.id);
    onSelectConversation?.(conversation);
    onNavigate?.(conversation);
    if (subjectId) {
      router.push(`/home/${subjectId}/${conversation.id}`);
    }
  };

  // Right-click hoặc bấm nút 3 chấm vào cuộc hội thoại
  const handleContextMenu = (e: React.MouseEvent, conversation: ConversationItem) => {
    e.preventDefault();
    e.stopPropagation();
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
    <div className={`w-full flex flex-col select-none ${className}`.trim()}>
      {/* ── Breadcrumb Back Navigation ── */}
      <div className="mb-4">
        <Link
          href="/home"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#777587] hover:text-[#4F46E5] dark:text-[#9DA3AF] dark:hover:text-[#818CF8] transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Tất cả không gian học tập</span>
        </Link>
      </div>

      {/* ── Apple Large Title Section Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-[#E5EEFF] dark:border-white/[0.08]">
        {/* Left: Monogram/Folder + Title & Stats */}
        <div className="flex items-center gap-3.5">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-2xl shadow-xs shrink-0 transition-transform hover:scale-105 duration-200"
            style={{
              backgroundColor: `${subjectColor}16`,
              border: `1px solid ${subjectColor}28`,
              color: subjectColor,
            }}
          >
            <Folder className="w-6 h-6 stroke-[1.8]" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0B1C30] dark:text-[#EFF0F6] tracking-tight leading-tight">
                {displayTitle}
              </h1>
              <span className="tabular-nums text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8] bg-[#EEF2FF] dark:bg-[#4F46E5]/20 border border-[#C7D2FE] dark:border-[#4F46E5]/30 px-2.5 py-0.5 rounded-full shadow-2xs">
                {displayCount} phiên học
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#777587] dark:text-[#9DA3AF] font-normal mt-0.5">
              Quản lý các phiên hội thoại, ghi chú và tài liệu học tập
            </p>
          </div>
        </div>

        {/* Right: Spotlight Search & Primary CTA */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#777587] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Tìm kiếm phiên học..."
              className="w-full pl-9 pr-3.5 py-2 text-sm text-[#0B1C30] dark:text-[#EFF0F6] placeholder-[#777587] bg-white dark:bg-[#12151C] border border-[#E5EEFF] dark:border-white/[0.1] rounded-xl outline-none focus:border-[#4F46E5] focus:ring-3 focus:ring-[#4F46E5]/15 transition-all shadow-2xs"
            />
          </div>

          {/* Primary CTA (Rule of 1 Primary Action) */}
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#4F46E5] hover:bg-[#3525CD] active:scale-[0.98] text-white rounded-xl shadow-md shadow-[#4F46E5]/20 hover:shadow-[#4F46E5]/30 text-sm font-semibold transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="whitespace-nowrap">Tạo phiên học</span>
          </button>
        </div>
      </div>

      {/* ── Conversations List Rows ── */}
      <div className="flex flex-col gap-3">
        {/* 1. Loading Skeleton */}
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#12151C] border border-[#E5EEFF] dark:border-white/[0.08]"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#EFF4FF] dark:bg-white/[0.06]" />
                  <div className="space-y-2">
                    <div className="h-4 w-48 rounded bg-[#E5EEFF] dark:bg-white/[0.08]" />
                    <div className="h-3 w-32 rounded bg-[#EFF4FF] dark:bg-white/[0.04]" />
                  </div>
                </div>
                <div className="h-8 w-8 rounded-full bg-[#EFF4FF] dark:bg-white/[0.06]" />
              </div>
            ))}
          </div>
        ) : !subjectId ? (
          <div className="py-16 text-center text-sm text-[#777587] dark:text-neutral-400 bg-white dark:bg-[#12151C] rounded-2xl border border-dashed border-[#E5EEFF] dark:border-white/[0.1]">
            Vui lòng chọn một Không gian học tập để xem danh sách phiên học.
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
                className={`group relative flex items-center justify-between p-4 sm:p-4.5 rounded-2xl cursor-pointer select-none
                  transition-all duration-200 ease-out border shadow-xs hover:-translate-y-0.5
                  ${
                    isFocused
                      ? "bg-[#EEF2FF] dark:bg-white/[0.08] border-[#4F46E5] ring-2 ring-[#4F46E5]/20 shadow-sm"
                      : "bg-white dark:bg-[#12151C] border-[#E5EEFF] dark:border-white/[0.08] hover:border-[#C7C4D8] dark:hover:border-white/[0.18] hover:shadow-[0_8px_20px_-4px_rgba(79,70,229,0.08)]"
                  }`}
              >
                {/* Left: Squircle Icon + Title & Metadata */}
                <div className="flex items-center gap-3.5 min-w-0 pr-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 duration-200"
                    style={{
                      backgroundColor: `${subjectColor}14`,
                      border: `1px solid ${subjectColor}25`,
                      color: subjectColor,
                    }}
                  >
                    <MessageSquare className="h-5 w-5 stroke-[1.8]" />
                  </div>

                  <div className="min-w-0">
                    <h3
                      className={`text-[15px] font-bold truncate tracking-tight transition-colors ${
                        isFocused
                          ? "text-[#4F46E5] dark:text-[#818CF8]"
                          : "text-[#0B1C30] dark:text-[#EFF0F6] group-hover:text-[#4F46E5] dark:group-hover:text-[#818CF8]"
                      }`}
                    >
                      {conversation.title}
                    </h3>
                    <p className="text-xs text-[#777587] dark:text-[#9DA3AF] mt-0.5 truncate">
                      Phiên hội thoại AI & tài liệu ôn tập
                    </p>
                  </div>
                </div>

                {/* Right: Quick Action Menu Button + Circular Enter Button */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* 3-dots Context Menu Button */}
                  <button
                    type="button"
                    aria-label={`Tùy chọn cho ${conversation.title}`}
                    onClick={(e) => handleContextMenu(e, conversation)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-[#777587] dark:text-[#9DA3AF] opacity-60 group-hover:opacity-100 hover:bg-[#EEF2FF] dark:hover:bg-white/[0.1] hover:text-[#4F46E5] dark:hover:text-white transition-all cursor-pointer"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {/* Circular Navigation Affordance Button */}
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200 shadow-2xs group-hover:scale-105 ${
                      isFocused
                        ? "bg-[#4F46E5] border-[#4F46E5] text-white"
                        : "bg-[#F8F9FF] dark:bg-white/[0.06] border-[#E5EEFF] dark:border-white/[0.1] text-[#777587] group-hover:bg-[#4F46E5] group-hover:border-[#4F46E5] group-hover:text-white"
                    }`}
                  >
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.2 group-hover:-translate-y-0.2" />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          /* Empty Search or No Sessions State */
          <div className="py-16 text-center bg-white dark:bg-[#12151C] rounded-2xl border border-dashed border-[#E5EEFF] dark:border-white/[0.1] p-8 space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2FF] dark:bg-white/[0.06] text-[#4F46E5] dark:text-[#818CF8]">
              <Sparkles className="h-6 w-6 stroke-[1.8]" />
            </div>
            <div>
              <p className="text-base font-bold text-[#0B1C30] dark:text-[#EFF0F6]">
                {searchQuery ? "Không tìm thấy phiên học nào" : "Chưa có phiên học nào"}
              </p>
              <p className="text-xs text-[#777587] dark:text-[#9DA3AF] mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? "Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc để xem toàn bộ danh sách."
                  : "Bắt đầu bằng cách tạo một phiên học mới để cùng AI ôn tập và giải bài tập."}
              </p>
            </div>
            {!searchQuery && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] hover:bg-[#3525CD] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all active:scale-98 cursor-pointer mt-2"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Tạo phiên học đầu tiên</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Apple macOS Context Menu ── */}
      <ConversationContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
        onEdit={handleOpenEditModal}
        onDelete={handleOpenDeleteModal}
      />

      {/* ── Modal Tạo mới / Chỉnh sửa Phiên học ── */}
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

      {/* ── Modal Xác nhận Xóa Phiên học ── */}
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
