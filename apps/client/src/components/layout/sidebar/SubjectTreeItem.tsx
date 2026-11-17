"use client";

import React, { useMemo } from "react";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  MoreVertical,
  Pin,
  Plus,
  MessageSquare,
} from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import type { Conversation, Subject } from "@/types";

export interface SubjectTreeItemProps {
  subject: Subject;
  isActive: boolean;
  isExpanded: boolean;
  isSubjectMenuOpen: boolean;
  activeConversationId?: string | null;
  activeConversationMenuId?: string | null;
  pinnedConversationIds: Set<string>;
  onToggleExpand: (subjectId: string) => void;
  onSelectSubject: (subject: Subject) => void;
  onCreateConversation: (subject: Subject, e: React.MouseEvent) => void;
  onToggleSubjectMenu: (
    subject: Subject,
    e: React.MouseEvent<HTMLButtonElement>
  ) => void;
  onSelectConversation: (subjectId: string, conversation: Conversation) => void;
  onTogglePinConversation: (conversationId: string, e: React.MouseEvent) => void;
  onToggleConversationMenu: (
    subjectId: string,
    conversation: Conversation,
    e: React.MouseEvent<HTMLButtonElement>
  ) => void;
}

const MAX_RECENT_CONVERSATIONS = 5;

function parseTimestamp(value?: string): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

export default function SubjectTreeItem({
  subject,
  isActive,
  isExpanded,
  isSubjectMenuOpen,
  activeConversationId,
  activeConversationMenuId,
  pinnedConversationIds,
  onToggleExpand,
  onSelectSubject,
  onCreateConversation,
  onToggleSubjectMenu,
  onSelectConversation,
  onTogglePinConversation,
  onToggleConversationMenu,
}: SubjectTreeItemProps) {
  const subjectColor = subject.color || "#4F46E5";

  // Chỉ tải danh sách phiên học khi môn học đang được mở rộng
  const { conversations, isLoading } = useConversations(
    isExpanded ? subject.id : null
  );

  // Sắp xếp theo: Đã ghim trước -> Thời gian cập nhật gần nhất (updated_at giảm dần), tối đa 5 mục
  const recentConversations = useMemo(() => {
    if (!conversations || conversations.length === 0) return [];
    const sorted = [...conversations].sort((a, b) => {
      const aPinned = pinnedConversationIds.has(a.id) ? 1 : 0;
      const bPinned = pinnedConversationIds.has(b.id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      const aTime = parseTimestamp(a.updated_at || a.created_at);
      const bTime = parseTimestamp(b.updated_at || b.created_at);
      return bTime - aTime;
    });
    return sorted.slice(0, MAX_RECENT_CONVERSATIONS);
  }, [conversations, pinnedConversationIds]);

  return (
    <div className="px-1">
      {/* Subject Row */}
      <div
        className={`group relative flex w-full items-center justify-between rounded-xl px-1.5 py-1.5 transition-all duration-150 motion-reduce:transition-none ${
          isActive
            ? "bg-[#EEF2FF] dark:bg-white/[0.10] text-[#3525CD] dark:text-white shadow-2xs"
            : "text-[#464555] dark:text-neutral-300 hover:bg-[#F8F9FF] dark:hover:bg-white/[0.04] hover:text-[#0B1C30] dark:hover:text-white"
        }`}
      >
        {/* Left: Expand Chevron + Folder Icon + Subject Name */}
        <div className="flex flex-1 items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(subject.id);
            }}
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? `Thu gọn danh sách phiên học của ${subject.name}`
                : `Mở rộng danh sách phiên học của ${subject.name}`
            }
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#777587] dark:text-neutral-400 hover:bg-[#E5EEFF]/70 dark:hover:bg-white/[0.08] hover:text-[#0B1C30] dark:hover:text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-[#4F46E5] focus-visible:outline-offset-1 transition-all motion-reduce:transition-none cursor-pointer"
          >
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                isExpanded ? "rotate-90 text-[#4F46E5] dark:text-[#818CF8]" : ""
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => onSelectSubject(subject)}
            className="flex flex-1 items-center gap-2 min-w-0 py-0.5 pr-1 text-left rounded-lg focus-visible:outline-2 focus-visible:outline-[#4F46E5] focus-visible:outline-offset-1 cursor-pointer"
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105 motion-reduce:transition-none"
              style={{ backgroundColor: `${subjectColor}18` }}
            >
              {isActive || isExpanded ? (
                <FolderOpen
                  className="h-3.5 w-3.5"
                  style={{ color: subjectColor }}
                />
              ) : (
                <Folder
                  className="h-3.5 w-3.5"
                  style={{ color: subjectColor }}
                />
              )}
            </span>
            <span
              title={subject.name}
              className={`text-[0.8125rem] truncate leading-snug tracking-tight ${
                isActive ? "font-semibold" : "font-medium"
              }`}
            >
              {subject.name}
            </span>
          </button>
        </div>

        {/* Right: Quick Create Conversation (+) & Subject 3-dots Menu */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCreateConversation(subject, e);
            }}
            aria-label={`Tạo phiên học mới trong ${subject.name}`}
            title="Tạo phiên học mới"
            className="flex h-6 w-6 items-center justify-center rounded-md text-[#777587] dark:text-neutral-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-[#E5EEFF] dark:hover:bg-white/[0.1] hover:text-[#4F46E5] dark:hover:text-[#818CF8] active:scale-95 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[#4F46E5] transition-all motion-reduce:transition-none cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-menu-trigger="true"
            aria-label={`Tùy chọn cho ${subject.name}`}
            title="Tùy chọn môn học"
            onClick={(e) => onToggleSubjectMenu(subject, e)}
            className={`flex h-6 w-6 items-center justify-center rounded-md transition-all motion-reduce:transition-none active:scale-95 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[#4F46E5] cursor-pointer ${
              isSubjectMenuOpen
                ? "bg-[#E5EEFF] dark:bg-white/[0.12] text-[#0B1C30] dark:text-white opacity-100"
                : "text-[#777587] dark:text-neutral-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-[#E5EEFF] dark:hover:bg-white/[0.1] hover:text-[#0B1C30] dark:hover:text-white"
            }`}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded Conversations List (Max 5 recent by updated_at) */}
      {isExpanded && (
        <div className="mt-1 ml-4 pl-2.5 border-l border-[#E5EEFF] dark:border-white/[0.08] space-y-0.5">
          {isLoading && recentConversations.length === 0 ? (
            <div className="space-y-1 py-1 animate-pulse">
              {[1, 2].map((idx) => (
                <div
                  key={idx}
                  className="h-7 rounded-lg bg-[#F8F9FF] dark:bg-white/[0.04]"
                />
              ))}
            </div>
          ) : recentConversations.length === 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCreateConversation(subject, e);
              }}
              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[0.75rem] text-[#777587] dark:text-neutral-500 hover:text-[#4F46E5] dark:hover:text-[#818CF8] hover:bg-[#F8F9FF] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3 shrink-0" />
              <span className="truncate">Tạo phiên học đầu tiên</span>
            </button>
          ) : (
            recentConversations.map((conv) => {
              const isConvActive = activeConversationId === conv.id;
              const isPinned = pinnedConversationIds.has(conv.id);
              const isConvMenuOpen = activeConversationMenuId === conv.id;

              return (
                <div
                  key={conv.id}
                  className={`group/conv relative flex items-center justify-between rounded-lg px-2 py-1.5 transition-all duration-150 motion-reduce:transition-none ${
                    isConvActive
                      ? "bg-[#EEF2FF]/90 dark:bg-white/[0.08] text-[#3525CD] dark:text-white font-medium"
                      : "text-[#464555] dark:text-neutral-400 hover:bg-[#F8F9FF] dark:hover:bg-white/[0.04] hover:text-[#0B1C30] dark:hover:text-neutral-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectConversation(subject.id, conv)}
                    className="flex flex-1 items-center gap-2 min-w-0 pr-1 text-left rounded focus-visible:outline-2 focus-visible:outline-[#4F46E5] cursor-pointer"
                  >
                    <MessageSquare
                      className={`h-3 w-3 shrink-0 ${
                        isConvActive
                          ? "text-[#4F46E5] dark:text-[#818CF8]"
                          : "text-[#777587]/70 dark:text-neutral-500"
                      }`}
                    />
                    <span
                      title={conv.title}
                      className="text-[0.78125rem] truncate leading-snug"
                    >
                      {conv.title}
                    </span>
                  </button>

                  {/* Conversation Actions: Pin + 3-dots */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePinConversation(conv.id, e);
                      }}
                      aria-label={
                        isPinned
                          ? `Bỏ ghim ${conv.title}`
                          : `Ghim ${conv.title}`
                      }
                      aria-pressed={isPinned}
                      title={isPinned ? "Bỏ ghim" : "Ghim lên đầu"}
                      className={`flex h-5 w-5 items-center justify-center rounded transition-all motion-reduce:transition-none active:scale-95 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[#4F46E5] cursor-pointer ${
                        isPinned
                          ? "text-[#4F46E5] dark:text-[#818CF8] opacity-100 hover:bg-[#E5EEFF] dark:hover:bg-white/[0.1]"
                          : "text-[#777587] dark:text-neutral-400 opacity-0 group-hover/conv:opacity-100 group-focus-within/conv:opacity-100 hover:bg-[#E5EEFF] dark:hover:bg-white/[0.1] hover:text-[#0B1C30] dark:hover:text-white"
                      }`}
                    >
                      <Pin
                        className={`h-3 w-3 ${
                          isPinned ? "fill-current" : ""
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      data-menu-trigger="true"
                      onClick={(e) =>
                        onToggleConversationMenu(subject.id, conv, e)
                      }
                      aria-label={`Tùy chọn cho ${conv.title}`}
                      title="Tùy chọn phiên học"
                      className={`flex h-5 w-5 items-center justify-center rounded transition-all motion-reduce:transition-none active:scale-95 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[#4F46E5] cursor-pointer ${
                        isConvMenuOpen
                          ? "bg-[#E5EEFF] dark:bg-white/[0.12] text-[#0B1C30] dark:text-white opacity-100"
                          : "text-[#777587] dark:text-neutral-400 opacity-0 group-hover/conv:opacity-100 group-focus-within/conv:opacity-100 hover:bg-[#E5EEFF] dark:hover:bg-white/[0.1] hover:text-[#0B1C30] dark:hover:text-white"
                      }`}
                    >
                      <MoreVertical className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
