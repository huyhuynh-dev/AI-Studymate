"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Folder, Search, Plus, ChevronRight } from "lucide-react";
import ConversationUpsertModal from "./ConversationUpsertModal";
import DeleteConversationModal from "./DeleteConversationModal";
import ConversationContextMenu, { ContextMenuPosition } from "./ConversationContextMenu";

export interface ConversationSession {
  id: string | number;
  title: string;
  isActive?: boolean;
}

export interface ConversationsListViewProps {
  title?: string;
  totalSessionsCount?: number;
  conversations?: ConversationSession[];
  onSelectConversation?: (session: ConversationSession) => void;
  onNavigate?: (session: ConversationSession) => void;
  onCreateSession?: () => void;
  onSearchChange?: (query: string) => void;
  className?: string;
}

const DEFAULT_CONVERSATIONS: ConversationSession[] = [
  {
    id: "1",
    title: "Giải thuật Cân bằng Cây AVL & Red-Black Tree",
    isActive: true,
  },
  {
    id: "2",
    title: "Ôn tập Đồ thị: Duyệt BFS & DFS",
    isActive: false,
  },
  {
    id: "3",
    title: "Độ phức tạp tính toán (Big-O)",
    isActive: false,
  },
  {
    id: "4",
    title: "Hàng đợi ưu tiên (Priority Queue) & Cấu trúc Heap",
    isActive: false,
  },
];

export default function ConversationsListView({
  title = "Cấu Trúc\nDữ Liệu",
  totalSessionsCount,
  conversations: initialConversations = DEFAULT_CONVERSATIONS,
  onSelectConversation,
  onNavigate,
  onCreateSession,
  onSearchChange,
  className = "",
}: ConversationsListViewProps) {
  const [conversations] = useState<ConversationSession[]>(initialConversations);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedSessionId, setFocusedSessionId] = useState<string | number | null>(null);

  // Trạng thái Context Menu
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: ContextMenuPosition;
    session: ConversationSession | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    session: null,
  });

  // Trạng thái Modal Tạo / Chỉnh sửa
  const [upsertModal, setUpsertModal] = useState<{
    isOpen: boolean;
    mode: "create" | "edit";
    session: ConversationSession | null;
  }>({
    isOpen: false,
    mode: "create",
    session: null,
  });

  // Trạng thái Modal Xóa
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    session: ConversationSession | null;
  }>({
    isOpen: false,
    session: null,
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

  // Tắt hiệu ứng Focus khi người dùng click chuột ra ngoài (bất kỳ đâu trên màn hình không phải phiên học)
  useEffect(() => {
    if (focusedSessionId === null) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      // Không tắt focus nếu đang bấm vào phiên học, hoặc tương tác với Context Menu / Modal
      if (
        target?.closest('[data-session-item="true"]') ||
        target?.closest('[data-context-menu="true"]') ||
        target?.closest('[role="dialog"]') ||
        target?.closest('[role="alertdialog"]')
      ) {
        return;
      }
      setFocusedSessionId(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [focusedSessionId]);

  // Click vào phiên học -> Focus vào phiên đó
  const handleSessionClick = (session: ConversationSession) => {
    setFocusedSessionId(session.id);
    onSelectConversation?.(session);
  };

  // Right-click vào phiên học -> Focus và hiện Menu thao tác
  const handleContextMenu = (e: React.MouseEvent, session: ConversationSession) => {
    e.preventDefault();
    setFocusedSessionId(session.id);
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      session,
    });
  };

  // Mở modal tạo mới
  const handleOpenCreateModal = () => {
    onCreateSession?.();
    setUpsertModal({
      isOpen: true,
      mode: "create",
      session: null,
    });
  };

  // Mở modal chỉnh sửa từ menu
  const handleOpenEditModal = () => {
    if (!contextMenu.session) return;
    setUpsertModal({
      isOpen: true,
      mode: "edit",
      session: contextMenu.session,
    });
  };

  // Mở modal xóa từ menu
  const handleOpenDeleteModal = () => {
    if (!contextMenu.session) return;
    setDeleteModal({
      isOpen: true,
      session: contextMenu.session,
    });
  };

  const displayCount = totalSessionsCount ?? conversations.length;

  return (
    <div className={`w-full max-w-4xl mx-auto p-4 sm:p-6 bg-white ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
        {/* Left: Folder Icon & Title */}
        <div className="flex items-center gap-3.5">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50/80 text-indigo-600 shrink-0">
            <Folder className="w-6 h-6 stroke-[1.8]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight whitespace-pre-line">
              {title}
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 font-normal mt-0.5">
              {displayCount} phiên học
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
        {filteredConversations.length > 0 ? (
          filteredConversations.map((session) => {
            const isFocused = focusedSessionId === session.id;

            return (
              <div
                key={session.id}
                tabIndex={0}
                data-session-item="true"
                onClick={() => handleSessionClick(session)}
                onContextMenu={(e) => handleContextMenu(e, session)}
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
                      session.isActive
                        ? "bg-emerald-500 ring-2 ring-emerald-500/20"
                        : "bg-gray-300"
                    }`}
                  />
                  <span
                    className={`text-sm sm:text-base font-semibold truncate transition-colors ${
                      isFocused ? "text-indigo-950 font-bold" : "text-gray-800"
                    }`}
                  >
                    {session.title}
                  </span>
                </div>

                {/* Dấu ">" dành cho chuyển hướng (tạm thời ngăn click lan tỏa và gọi callback) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate?.(session);
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
        initialTitle={upsertModal.session?.title || ""}
        onClose={() => setUpsertModal((prev) => ({ ...prev, isOpen: false }))}
        onSubmit={() => {
          // Gắn sự kiện sẵn sàng nhận logic
        }}
      />

      {/* Modal Xác nhận Xóa */}
      <DeleteConversationModal
        isOpen={deleteModal.isOpen}
        conversationTitle={deleteModal.session?.title}
        onClose={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() => {
          // Gắn sự kiện sẵn sàng nhận logic
        }}
      />
    </div>
  );
}
