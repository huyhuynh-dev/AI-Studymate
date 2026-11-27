"use client";

import React, {
  startTransition,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Folder,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Edit3,
  Trash2,
  AlertCircle,
  RefreshCw,
  Plus,
} from "lucide-react";
import { useSWRConfig } from "swr";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSubjects } from "@/hooks/useSubjects";
import { conversationsApi } from "@/services/conversations.api";
import { logoutWithWorkspaceStateFlush } from "@/lib/logout-with-state-flush";
import { CURRENT_USER_CACHE_KEY } from "@/hooks/useCurrentUser";
import type { Conversation, Subject } from "@/types";
import {
  CreateWorkspaceModal,
  DeleteWorkspaceModal,
} from "@/components/subjects";
import {
  ConversationUpsertModal,
  DeleteConversationModal,
} from "@/components/conversations";
import {
  FloatingActionMenu,
  FloatingActionMenuItem,
  computeFloatingMenuPosition,
  type FloatingMenuPosition,
} from "@/components/ui/FloatingActionMenu";
import SubjectTreeItem from "./sidebar/SubjectTreeItem";
import UserProfileMenu from "./sidebar/UserProfileMenu";

const PINNED_STORAGE_KEY = "studymate:pinned_conversations:v1";

type ContextMenuAnchor =
  | {
      type: "subject";
      subject: Subject;
      position: FloatingMenuPosition;
    }
  | {
      type: "conversation";
      subjectId: string;
      conversation: Conversation;
      position: FloatingMenuPosition;
    };

export interface LeftSidebarProps {
  /** User information for profile card at bottom */
  user?: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  /** Consecutive study streak in days */
  streakDays?: number;
  /** Experience points gained */
  xp?: number;
  /** Weekly memorization progress */
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  /** Active selected subject/workspace ID */
  selectedSubjectId?: string;
  /** Active selected document ID */
  activeDocId?: string;
  /** Whether the sidebar is collapsed */
  isCollapsed?: boolean;
  /** Callback to toggle collapse */
  onToggleCollapse?: () => void;
  /** Callback when user selects a subject */
  onSelectSubject?: (subject: Subject) => void;
  /** Callback when user selects a document */
  onSelectDocument?: (id: string) => void;
  /** Callback when new folder icon is clicked */
  onNewFolder?: () => void;
  /** Callback when a new workspace is created */
  onCreateWorkspace?: (workspace: { name: string; color: string }) => void;
  /** Callback when settings icon is clicked */
  onSettingsClick?: () => void;
  /** Callback invoked after navigating to a subject/conversation (e.g. close mobile drawer) */
  onNavigateItem?: () => void;
  /** Additional container classes */
  className?: string;
}

export default function LeftSidebar({
  user,
  selectedSubjectId,
  isCollapsed = false,
  onToggleCollapse,
  onSelectSubject,
  onNewFolder,
  onCreateWorkspace,
  onSettingsClick,
  onNavigateItem,
  className = "",
}: LeftSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { mutate: globalMutate } = useSWRConfig();

  const urlSubjectId = searchParams.get("subject_id");

  // Trích xuất subjectId và conversationId từ pathname: /home/{subjectId}/{conversationId}
  const { routeSubjectId, routeConversationId } = useMemo(() => {
    if (!pathname) return { routeSubjectId: null, routeConversationId: null };
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] === "home") {
      return {
        routeSubjectId: segments[1] ?? null,
        routeConversationId: segments[2] ?? null,
      };
    }
    return { routeSubjectId: null, routeConversationId: null };
  }, [pathname]);

  const displayName = user?.name || "Tài khoản";
  const displayEmail = user?.email || "Đang đồng bộ…";
  const userInitials =
    displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "U";

  // SWR hook quản lý danh sách và CRUD Không gian học tập
  const {
    subjects,
    isLoading,
    error,
    createSubject,
    updateSubject,
    deleteSubject,
    refresh,
  } = useSubjects();

  // State quản lý Không gian đang chọn & đang mở rộng
  const [activeId, setActiveId] = useState<string | null>(
    selectedSubjectId || routeSubjectId || urlSubjectId || null
  );
  const [expandedSubjectIds, setExpandedSubjectIds] = useState<Set<string>>(
    () => {
      const initial = selectedSubjectId || routeSubjectId || urlSubjectId;
      return initial ? new Set([initial]) : new Set();
    }
  );

  // Danh sách ID phiên học được ghim (lưu trong localStorage, đọc sau mount để tránh lệch hydration)
  const [pinnedConversationIds, setPinnedConversationIds] = useState<
    Set<string>
  >(() => new Set());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PINNED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setPinnedConversationIds(
            new Set(parsed.filter((id): id is string => typeof id === "string"))
          );
        }
      }
    } catch {
      // Bỏ qua lỗi đọc localStorage
    }
  }, []);

  useEffect(() => {
    const resolvedSubjectId = routeSubjectId || urlSubjectId;
    if (resolvedSubjectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveId(resolvedSubjectId);
      setExpandedSubjectIds((prev) => {
        if (prev.has(resolvedSubjectId)) return prev;
        const next = new Set(prev);
        next.add(resolvedSubjectId);
        return next;
      });
    }
  }, [routeSubjectId, urlSubjectId]);

  // State quản lý Modals cho Subject
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [workspaceModalMode, setWorkspaceModalMode] = useState<"create" | "edit">(
    "create"
  );
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);

  // State quản lý Modals cho Conversation
  const [convModalOpen, setConvModalOpen] = useState(false);
  const [convModalMode, setConvModalMode] = useState<"create" | "edit">(
    "create"
  );
  const [convTargetSubjectId, setConvTargetSubjectId] = useState<string | null>(
    null
  );
  const [editingConversation, setEditingConversation] =
    useState<Conversation | null>(null);

  const [deleteConvModalOpen, setDeleteConvModalOpen] = useState(false);
  const [deletingConversation, setDeletingConversation] =
    useState<Conversation | null>(null);

  const [railTooltip, setRailTooltip] = useState<{
    text: string;
    top: number;
  } | null>(null);

  const handleToggleCollapse = () => {
    setRailTooltip(null);
    onToggleCollapse?.();
  };

  // State menu 3 chấm (Apple macOS Context Menu) cho cả Subject và Conversation
  const [menuAnchor, setMenuAnchor] = useState<ContextMenuAnchor | null>(null);

  const handleToggleSubjectMenu = useCallback(
    (subject: Subject, e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (
        menuAnchor?.type === "subject" &&
        menuAnchor.subject.id === subject.id
      ) {
        setMenuAnchor(null);
        return;
      }
      const position = computeFloatingMenuPosition(
        e.currentTarget.getBoundingClientRect(),
        { menuWidth: 148, menuHeight: 84 }
      );
      setMenuAnchor({ type: "subject", subject, position });
    },
    [menuAnchor]
  );

  const handleToggleConversationMenu = useCallback(
    (
      subjectId: string,
      conversation: Conversation,
      e: React.MouseEvent<HTMLButtonElement>
    ) => {
      e.stopPropagation();
      if (
        menuAnchor?.type === "conversation" &&
        menuAnchor.conversation.id === conversation.id
      ) {
        setMenuAnchor(null);
        return;
      }
      const position = computeFloatingMenuPosition(
        e.currentTarget.getBoundingClientRect(),
        { menuWidth: 148, menuHeight: 84 }
      );
      setMenuAnchor({
        type: "conversation",
        subjectId,
        conversation,
        position,
      });
    },
    [menuAnchor]
  );

  const handleToggleExpandSubject = useCallback((subjectId: string) => {
    startTransition(() => {
      setExpandedSubjectIds((prev) => {
        const next = new Set(prev);
        if (next.has(subjectId)) {
          next.delete(subjectId);
        } else {
          next.add(subjectId);
        }
        return next;
      });
    });
  }, []);

  // Chọn môn học (Link tự điều hướng, callback chỉ cập nhật state)
  const handleSelectSubject = useCallback(
    (subject: Subject) => {
      setActiveId(subject.id);
      onSelectSubject?.(subject);
    },
    [onSelectSubject]
  );

  // Ghim / Bỏ ghim phiên học
  const handleTogglePinConversation = useCallback(
    (conversationId: string) => {
      startTransition(() => {
        setPinnedConversationIds((prev) => {
          const next = new Set(prev);
          if (next.has(conversationId)) {
            next.delete(conversationId);
          } else {
            next.add(conversationId);
          }
          try {
            window.localStorage.setItem(
              PINNED_STORAGE_KEY,
              JSON.stringify(Array.from(next))
            );
          } catch {
            // Bỏ qua lỗi lưu localStorage
          }
          return next;
        });
      });
    },
    []
  );

  // Mở modal tạo mới Subject
  const handleOpenCreateModal = () => {
    setWorkspaceModalMode("create");
    setEditingSubject(null);
    setIsWorkspaceModalOpen(true);
    onNewFolder?.();
  };

  // Mở modal chỉnh sửa Subject
  const handleOpenEditSubjectModal = (
    subject: Subject,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    setMenuAnchor(null);
    setWorkspaceModalMode("edit");
    setEditingSubject(subject);
    setIsWorkspaceModalOpen(true);
  };

  // Mở modal xóa Subject
  const handleOpenDeleteSubjectModal = (
    subject: Subject,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    setMenuAnchor(null);
    setDeletingSubject(subject);
    setIsDeleteModalOpen(true);
  };

  const handleWorkspaceFormSubmit = async (data: {
    name: string;
    color: string;
  }) => {
    if (workspaceModalMode === "create") {
      const created = await createSubject(data);
      onCreateWorkspace?.(data);
      if (created?.id) {
        setActiveId(created.id);
        onSelectSubject?.(created);
      }
    } else if (workspaceModalMode === "edit" && editingSubject) {
      await updateSubject(editingSubject.id, data);
    }
  };

  const handleConfirmDeleteSubject = async () => {
    if (!deletingSubject) return;
    await deleteSubject(deletingSubject.id);
    if (activeId === deletingSubject.id) {
      setActiveId(null);
    }
  };

  // Mở modal tạo Conversation ngay trên giao diện hiện tại
  const handleOpenCreateConversation = useCallback((subject: Subject) => {
    setMenuAnchor(null);
    setConvModalMode("create");
    setConvTargetSubjectId(subject.id);
    setEditingConversation(null);
    setConvModalOpen(true);
  }, []);

  // Mở modal sửa Conversation
  const handleOpenEditConversation = (
    subjectId: string,
    conversation: Conversation,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    setMenuAnchor(null);
    setConvModalMode("edit");
    setConvTargetSubjectId(subjectId);
    setEditingConversation(conversation);
    setConvModalOpen(true);
  };

  // Mở modal xóa Conversation
  const handleOpenDeleteConversation = (
    subjectId: string,
    conversation: Conversation,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    setMenuAnchor(null);
    setConvTargetSubjectId(subjectId);
    setDeletingConversation(conversation);
    setDeleteConvModalOpen(true);
  };

  const handleConversationFormSubmit = async (title: string) => {
    if (!convTargetSubjectId) return;
    const cacheKey = `/subjects/${convTargetSubjectId}/conversations`;

    if (convModalMode === "create") {
      const created = await conversationsApi.create({
        subject_id: convTargetSubjectId,
        title,
      });
      setExpandedSubjectIds((prev) => {
        const next = new Set(prev);
        next.add(convTargetSubjectId);
        return next;
      });
      await globalMutate<Conversation[]>(
        cacheKey,
        (current = []) => [created, ...current],
        { revalidate: true }
      );
    } else if (convModalMode === "edit" && editingConversation) {
      const updated = await conversationsApi.updateTitle(
        editingConversation.id,
        title
      );
      await globalMutate<Conversation[]>(
        cacheKey,
        (current = []) =>
          current.map((c) => (c.id === editingConversation.id ? updated : c)),
        { revalidate: false }
      );
    }
  };

  const handleConfirmDeleteConversation = async () => {
    if (!deletingConversation || !convTargetSubjectId) return;
    const deletedId = deletingConversation.id;
    const targetSubjectId = convTargetSubjectId;
    const cacheKey = `/subjects/${targetSubjectId}/conversations`;

    await conversationsApi.delete(deletedId);

    // Xóa khỏi danh sách ghim nếu có
    if (pinnedConversationIds.has(deletedId)) {
      handleTogglePinConversation(deletedId);
    }

    // Cập nhật SWR cache ngay lập tức để item thứ 6+ tự động thế chỗ đảm bảo tối đa 5 item
    await globalMutate<Conversation[]>(
      cacheKey,
      (current = []) => current.filter((c) => c.id !== deletedId),
      { revalidate: true }
    );

    if (routeConversationId === deletedId) {
      router.push(`/home/${targetSubjectId}`);
    }
  };

  const handleNavigateProfile = (tab?: string) => {
    if (!tab && onSettingsClick) {
      onSettingsClick();
      return;
    }
    if (tab && tab !== "profile") {
      router.push(`/profile?tab=${encodeURIComponent(tab)}`);
      return;
    }
    router.push("/profile");
  };

  const handleLogout = async () => {
    await logoutWithWorkspaceStateFlush();
    await globalMutate(CURRENT_USER_CACHE_KEY, undefined, { revalidate: false });
    router.replace("/auth/login");
  };

  return (
    <aside
      className={`flex h-full flex-col justify-between border-r border-[#E5EEFF] dark:border-white/[0.08] bg-white dark:bg-[#12151C] select-none transition-[width,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        isCollapsed ? "w-14 px-1.5 py-3 items-center" : "w-68 p-3 opacity-100"
      } ${className}`.trim()}
    >
      {isCollapsed ? (
        /* ── Collapsed Rail Mode ── */
        <div className="flex h-full w-full flex-col justify-between items-center">
          {/* Phần đầu (Thu gọn): Logo, Mở rộng & Tạo mới */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <Link
              href="/home"
              aria-label="Trang chủ AI StudyMate"
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setRailTooltip({
                  text: "AI StudyMate",
                  top: rect.top + rect.height / 2,
                });
              }}
              onMouseLeave={() => setRailTooltip(null)}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-[#4F46E5] transition-transform duration-150 motion-reduce:transition-none"
            >
              <Image
                src="/logo.svg"
                alt="AI StudyMate"
                width={26}
                height={26}
                unoptimized
                className="h-6.5 w-6.5"
              />
            </Link>

            {onToggleCollapse && (
              <button
                type="button"
                onClick={handleToggleCollapse}
                aria-label="Mở rộng thanh bên"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setRailTooltip({
                    text: "Mở rộng thanh bên",
                    top: rect.top + rect.height / 2,
                  });
                }}
                onMouseLeave={() => setRailTooltip(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#777587] hover:text-[#0B1C30] dark:hover:text-white hover:bg-[#F8F9FF] dark:hover:bg-white/[0.06] active:scale-95 focus-visible:outline-2 focus-visible:outline-[#4F46E5] transition-[color,background-color,transform] duration-150 motion-reduce:transition-none cursor-pointer"
              >
                <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenCreateModal}
              aria-label="Tạo không gian mới"
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setRailTooltip({
                  text: "Tạo không gian mới",
                  top: rect.top + rect.height / 2,
                });
              }}
              onMouseLeave={() => setRailTooltip(null)}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[#5E5C6E] dark:text-[#9DA3AF] hover:text-[#4F46E5] hover:bg-[#EEF2FF] dark:hover:bg-white/[0.06] active:scale-95 focus-visible:outline-2 focus-visible:outline-[#4F46E5] transition-[color,background-color,transform] duration-150 motion-reduce:transition-none cursor-pointer"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          {/* Phần giữa (Thu gọn): Danh sách môn học */}
          <div className="flex-1 w-full min-h-0 flex flex-col items-center gap-1.5 py-3 overflow-y-auto overflow-x-hidden overscroll-contain no-scrollbar">
            {subjects.map((subject) => {
              const isActive = activeId === subject.id;
              const subjectColor = subject.color || "#4F46E5";

              return (
                <Link
                  key={subject.id}
                  href={`/home/${subject.id}`}
                  onClick={() => {
                    handleSelectSubject(subject);
                    onNavigateItem?.();
                  }}
                  aria-label={subject.name}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setRailTooltip({
                      text: subject.name,
                      top: rect.top + rect.height / 2,
                    });
                  }}
                  onMouseLeave={() => setRailTooltip(null)}
                  className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg active:scale-95 focus-visible:outline-2 focus-visible:outline-[#4F46E5] transition-[color,background-color,transform] duration-150 motion-reduce:transition-none ${
                    isActive
                      ? "bg-[#EEF2FF] dark:bg-white/[0.12] text-[#4F46E5] shadow-2xs ring-1 ring-[#C7D2FE] dark:ring-white/20"
                      : "text-[#5E5C6E] dark:text-[#9DA3AF] hover:bg-[#F8F9FF] dark:hover:bg-white/[0.04] hover:text-[#0B1C30] dark:hover:text-white"
                  }`}
                >
                  {isActive ? (
                    <FolderOpen
                      aria-hidden="true"
                      className="h-4 w-4"
                      style={{ color: subjectColor }}
                    />
                  ) : (
                    <Folder
                      aria-hidden="true"
                      className="h-4 w-4"
                      style={{ color: subjectColor }}
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full ring-1 ring-white dark:ring-neutral-900"
                    style={{ backgroundColor: subjectColor }}
                  />
                </Link>
              );
            })}
          </div>

          {/* Phần cuối (Thu gọn): Avatar người dùng */}
          <div className="flex flex-col items-center pt-2.5 border-t border-[#E5EEFF] dark:border-white/[0.08] shrink-0 w-full">
            <button
              type="button"
              onClick={() => handleNavigateProfile()}
              aria-label="Hồ sơ & Cài đặt tài khoản"
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setRailTooltip({
                  text: "Hồ sơ & Cài đặt",
                  top: rect.top + rect.height / 2,
                });
              }}
              onMouseLeave={() => setRailTooltip(null)}
              className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[#E5EEFF] dark:border-white/[0.1] bg-gradient-to-br from-indigo-500 to-violet-600 text-[0.6875rem] font-bold text-white hover:ring-2 hover:ring-[#4F46E5]/40 transition-[box-shadow,transform] duration-150 motion-reduce:transition-none cursor-pointer active:scale-95 focus-visible:outline-2 focus-visible:outline-[#4F46E5]"
            >
              {user?.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt={displayName}
                  width={32}
                  height={32}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{userInitials}</span>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* ── Full Expanded Sidebar Mode ── */
        <>
          {/* 1. Phần đầu: Logo, Tên ứng dụng & Nút thu gọn */}
          <div className="flex items-center justify-between gap-2 pb-3 mb-2 border-b border-[#E5EEFF] dark:border-white/[0.08] shrink-0 px-1">
            <Link
              href="/home"
              onClick={() => onNavigateItem?.()}
              className="flex items-center gap-2.5 min-w-0 group rounded-lg focus-visible:outline-2 focus-visible:outline-[#4F46E5] focus-visible:outline-offset-2"
            >
              <Image
                src="/logo.svg"
                alt="Logo AI StudyMate"
                width={28}
                height={28}
                unoptimized
                className="h-7 w-7 shrink-0 transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none"
              />
              <span
                translate="no"
                className="text-[0.9375rem] font-bold font-heading tracking-tight text-[#0B1C30] dark:text-[#EFF0F6] truncate group-hover:text-[#4F46E5] dark:group-hover:text-[#818CF8] transition-colors duration-150"
              >
                AI StudyMate
              </span>
            </Link>

            {onToggleCollapse && (
              <button
                type="button"
                onClick={handleToggleCollapse}
                aria-label="Thu gọn thanh bên"
                title="Thu gọn"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#5E5C6E] dark:text-[#9DA3AF] hover:text-[#0B1C30] dark:hover:text-white hover:bg-[#F8F9FF] dark:hover:bg-white/[0.06] active:scale-95 focus-visible:outline-2 focus-visible:outline-[#4F46E5] transition-[color,background-color,transform] duration-150 motion-reduce:transition-none cursor-pointer"
              >
                <PanelLeftClose aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* 2. Phần giữa: Danh sách Subject & tối đa 5 Conversation gần nhất */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-2 pb-2 shrink-0">
              <span className="text-[0.6875rem] font-semibold font-heading tracking-wider text-[#5E5C6E] dark:text-[#9DA3AF] uppercase">
                Không gian học tập
              </span>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                aria-label="Tạo không gian học tập mới"
                title="Tạo không gian mới"
                className="relative flex h-6 w-6 items-center justify-center rounded-lg text-[#5E5C6E] dark:text-[#9DA3AF] hover:text-[#4F46E5] dark:hover:text-[#818CF8] hover:bg-[#EEF2FF] dark:hover:bg-white/[0.06] active:scale-95 focus-visible:outline-2 focus-visible:outline-[#4F46E5] transition-[color,background-color,transform] duration-150 motion-reduce:transition-none cursor-pointer after:content-[''] after:absolute after:-inset-1.5 [@media(pointer:fine)]:after:hidden"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar space-y-0.5 pr-0.5 pb-2">
              {/* Loading Skeleton */}
              {isLoading && subjects.length === 0 && (
                <div
                  aria-busy="true"
                  aria-label="Đang tải danh sách không gian học tập…"
                  className="space-y-1 animate-pulse motion-reduce:animate-none px-1"
                >
                  {[1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl bg-[#F8F9FF] dark:bg-white/[0.04] p-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-4 w-4 rounded-md bg-[#E5EEFF] dark:bg-white/[0.08]" />
                        <div className="h-3.5 w-24 rounded-md bg-[#E5EEFF] dark:bg-white/[0.08]" />
                      </div>
                      <div className="h-2 w-2 rounded-full bg-[#E5EEFF] dark:bg-white/[0.08]" />
                    </div>
                  ))}
                </div>
              )}

              {/* Error State */}
              {error && subjects.length === 0 && (
                <div className="rounded-xl border border-rose-200/60 bg-rose-50/50 dark:bg-rose-950/20 p-3 text-center space-y-2 mx-1">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                    <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span className="truncate">{error}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => refresh()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-white dark:bg-neutral-900 px-2.5 py-1 text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-[#4F46E5] transition-colors duration-150 cursor-pointer"
                  >
                    <RefreshCw aria-hidden="true" className="h-3 w-3" />
                    <span>Thử lại</span>
                  </button>
                </div>
              )}

              {/* Empty State */}
              {!isLoading && subjects.length === 0 && !error && (
                <div className="rounded-2xl border border-dashed border-[#E5EEFF] dark:border-white/[0.1] bg-[#F8F9FF] dark:bg-white/[0.02] p-4 text-center space-y-2.5 mx-1">
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
                    <Folder aria-hidden="true" className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold font-heading text-[#0B1C30] dark:text-neutral-200">
                      Chưa có không gian nào
                    </p>
                    <p className="text-[0.6875rem] text-[#5E5C6E] dark:text-[#9DA3AF] mt-0.5">
                      Tạo không gian để quản lý tài liệu
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] hover:bg-[#3525CD] px-3 py-1.5 text-xs font-medium text-white shadow-xs active:scale-95 focus-visible:outline-2 focus-visible:outline-[#4F46E5] focus-visible:outline-offset-2 transition-[background-color,transform] duration-150 motion-reduce:transition-none cursor-pointer"
                  >
                    <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                    <span>Tạo không gian</span>
                  </button>
                </div>
              )}

              {/* Subject Tree Items */}
              {subjects.map((subject) => (
                <SubjectTreeItem
                  key={subject.id}
                  subject={subject}
                  isActive={activeId === subject.id}
                  isExpanded={expandedSubjectIds.has(subject.id)}
                  isSubjectMenuOpen={
                    menuAnchor?.type === "subject" &&
                    menuAnchor.subject.id === subject.id
                  }
                  activeConversationId={routeConversationId}
                  activeConversationMenuId={
                    menuAnchor?.type === "conversation"
                      ? menuAnchor.conversation.id
                      : null
                  }
                  pinnedConversationIds={pinnedConversationIds}
                  onToggleExpand={handleToggleExpandSubject}
                  onSelectSubject={handleSelectSubject}
                  onNavigateItem={onNavigateItem}
                  onCreateConversation={handleOpenCreateConversation}
                  onToggleSubjectMenu={handleToggleSubjectMenu}
                  onTogglePinConversation={handleTogglePinConversation}
                  onToggleConversationMenu={handleToggleConversationMenu}
                />
              ))}
            </div>
          </div>

          {/* 3. Phần cuối: User Profile & Dropdown Menu Settings */}
          <UserProfileMenu
            displayName={displayName}
            displayEmail={displayEmail}
            userInitials={userInitials}
            avatarUrl={user?.avatarUrl}
            onNavigateProfile={handleNavigateProfile}
            onLogout={handleLogout}
          />
        </>
      )}

      {/* ── Apple macOS Floating Context Menu (Subject & Conversation) ── */}
      <FloatingActionMenu
        isOpen={Boolean(menuAnchor)}
        position={menuAnchor?.position ?? null}
        onClose={() => setMenuAnchor(null)}
        widthClass="w-36"
        ariaLabel={
          menuAnchor?.type === "subject"
            ? `Tùy chọn cho ${menuAnchor.subject.name}`
            : menuAnchor?.type === "conversation"
              ? `Tùy chọn cho ${menuAnchor.conversation.title}`
              : "Tùy chọn"
        }
      >
        <FloatingActionMenuItem
          icon={<Edit3 className="h-3.5 w-3.5" />}
          onClick={(e) => {
            if (!menuAnchor) return;
            if (menuAnchor.type === "subject") {
              handleOpenEditSubjectModal(menuAnchor.subject, e);
            } else {
              handleOpenEditConversation(
                menuAnchor.subjectId,
                menuAnchor.conversation,
                e
              );
            }
          }}
        >
          Chỉnh sửa
        </FloatingActionMenuItem>
        <FloatingActionMenuItem
          tone="danger"
          icon={<Trash2 className="h-3.5 w-3.5" />}
          onClick={(e) => {
            if (!menuAnchor) return;
            if (menuAnchor.type === "subject") {
              handleOpenDeleteSubjectModal(menuAnchor.subject, e);
            } else {
              handleOpenDeleteConversation(
                menuAnchor.subjectId,
                menuAnchor.conversation,
                e
              );
            }
          }}
        >
          Xóa
        </FloatingActionMenuItem>
      </FloatingActionMenu>

      {/* ── Modal Tạo mới & Chỉnh sửa Không gian học tập ── */}
      <CreateWorkspaceModal
        isOpen={isWorkspaceModalOpen}
        mode={workspaceModalMode}
        initialData={editingSubject}
        onClose={() => {
          setIsWorkspaceModalOpen(false);
          setEditingSubject(null);
        }}
        onSubmit={handleWorkspaceFormSubmit}
      />

      {/* ── Modal Xác nhận Xóa Không gian học tập ── */}
      <DeleteWorkspaceModal
        isOpen={isDeleteModalOpen}
        subject={deletingSubject}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingSubject(null);
        }}
        onConfirm={handleConfirmDeleteSubject}
      />

      {/* ── Modal Tạo mới & Chỉnh sửa Phiên học (Conversation) ── */}
      <ConversationUpsertModal
        isOpen={convModalOpen}
        mode={convModalMode}
        initialTitle={editingConversation?.title ?? ""}
        onClose={() => {
          setConvModalOpen(false);
          setEditingConversation(null);
          setConvTargetSubjectId(null);
        }}
        onSubmit={handleConversationFormSubmit}
      />

      {/* ── Modal Xác nhận Xóa Phiên học (Conversation) ── */}
      <DeleteConversationModal
        isOpen={deleteConvModalOpen}
        conversationTitle={deletingConversation?.title}
        onClose={() => {
          setDeleteConvModalOpen(false);
          setDeletingConversation(null);
          setConvTargetSubjectId(null);
        }}
        onConfirm={handleConfirmDeleteConversation}
      />

      {/* ── Apple Floating Pill Tooltip (Rail Mode) ── */}
      {isCollapsed && railTooltip && (
        <div
          style={{
            position: "fixed",
            top: `${railTooltip.top}px`,
            left: "60px",
          }}
          className="z-50 -translate-y-1/2 pointer-events-none animate-in fade-in-50 zoom-in-95 duration-100 motion-reduce:animate-none"
        >
          <div className="rounded-lg bg-[#0B1C30]/95 dark:bg-white/95 backdrop-blur-md px-2.5 py-1 text-[0.6875rem] font-medium text-white dark:text-[#0B1C30] shadow-xl whitespace-nowrap">
            {railTooltip.text}
          </div>
        </div>
      )}
    </aside>
  );
}

export { LeftSidebar };
