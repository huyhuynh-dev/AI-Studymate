"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Folder,
  FolderOpen,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  MoreVertical,
  Edit3,
  Trash2,
  AlertCircle,
  RefreshCw,
  Plus,
} from "lucide-react";
import { useSubjects } from "@/hooks/useSubjects";
import { Subject } from "@/types";
import { CreateWorkspaceModal, DeleteWorkspaceModal } from "@/components/subjects";
import { useRouter, useSearchParams } from "next/navigation";

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
  /** Additional container classes */
  className?: string;
}

export default function LeftSidebar({
  user = {
    name: "Nguyễn Văn A",
    email: "a.nguyen@student.edu.vn",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  },
  selectedSubjectId,
  isCollapsed = false,
  onToggleCollapse,
  onSelectSubject,
  onNewFolder,
  onCreateWorkspace,
  onSettingsClick,
  className = "",
}: LeftSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSubjectId = searchParams.get("subject_id");

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

  // State quản lý Không gian đang chọn
  const [activeId, setActiveId] = useState<string | null>(selectedSubjectId || urlSubjectId || null);

  useEffect(() => {
    if (urlSubjectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveId(urlSubjectId);
    }
  }, [urlSubjectId]);

  // State quản lý Modals
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [workspaceModalMode, setWorkspaceModalMode] = useState<"create" | "edit">("create");
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);
  const [railTooltip, setRailTooltip] = useState<{ text: string; top: number } | null>(null);

  const handleToggleCollapse = () => {
    setRailTooltip(null);
    onToggleCollapse?.();
  };

  // State menu 3 chấm (Apple macOS Context Menu)
  const [menuAnchor, setMenuAnchor] = useState<{
    subject: Subject;
    top: number;
    left: number;
  } | null>(null);

  // Đóng action menu khi click ra ngoài hoặc scroll / resize
  useEffect(() => {
    if (!menuAnchor) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('[data-menu-trigger="true"]') ||
        target?.closest('[data-dropdown-menu="true"]')
      ) {
        return;
      }
      setMenuAnchor(null);
    };

    const handleScrollOrResize = () => {
      setMenuAnchor(null);
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [menuAnchor]);

  const handleToggleActionMenu = (
    subject: Subject,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
    if (menuAnchor?.subject.id === subject.id) {
      setMenuAnchor(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 84;
    const menuWidth = 148;

    let top = rect.bottom + 4;
    if (top + menuHeight > window.innerHeight) {
      top = Math.max(8, rect.top - menuHeight - 4);
    }

    let left = rect.right - menuWidth;
    if (left < 8) {
      left = 8;
    }

    setMenuAnchor({
      subject,
      top,
      left,
    });
  };

  // Chọn môn học
  const handleSubjectClick = (subject: Subject) => {
    setActiveId(subject.id);
    onSelectSubject?.(subject);
    router.push(`/home/${subject.id}`);
  };

  // Mở modal tạo mới
  const handleOpenCreateModal = () => {
    setWorkspaceModalMode("create");
    setEditingSubject(null);
    setIsWorkspaceModalOpen(true);
    onNewFolder?.();
  };

  // Mở modal chỉnh sửa
  const handleOpenEditModal = (subject: Subject, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMenuAnchor(null);
    setWorkspaceModalMode("edit");
    setEditingSubject(subject);
    setIsWorkspaceModalOpen(true);
  };

  // Mở modal xóa
  const handleOpenDeleteModal = (subject: Subject, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMenuAnchor(null);
    setDeletingSubject(subject);
    setIsDeleteModalOpen(true);
  };

  const handleWorkspaceFormSubmit = async (data: { name: string; color: string }) => {
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

  // Xác nhận Xóa
  const handleConfirmDelete = async () => {
    if (!deletingSubject) return;
    await deleteSubject(deletingSubject.id);
    if (activeId === deletingSubject.id) {
      setActiveId(null);
    }
  };

  return (
    <aside
      className={`flex h-full flex-col justify-between border-r border-[#E5EEFF] dark:border-white/[0.08] bg-white dark:bg-[#12151C] select-none transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isCollapsed ? "w-14 px-1.5 py-3 items-center" : "w-68 p-3.5 opacity-100"
      } ${className}`.trim()}
    >
      {isCollapsed ? (
        /* ── Collapsed Rail Mode ── */
        <div className="flex h-full w-full flex-col justify-between items-center">
          {/* Top: Expand & Quick Create */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            {onToggleCollapse && (
              <button
                type="button"
                onClick={handleToggleCollapse}
                aria-label="Mở rộng thanh bên"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setRailTooltip({ text: "Mở rộng thanh bên", top: rect.top + rect.height / 2 });
                }}
                onMouseLeave={() => setRailTooltip(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#777587] hover:text-[#0B1C30] dark:hover:text-white hover:bg-[#F8F9FF] dark:hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenCreateModal}
              aria-label="Tạo không gian mới"
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setRailTooltip({ text: "Tạo không gian mới", top: rect.top + rect.height / 2 });
              }}
              onMouseLeave={() => setRailTooltip(null)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#777587] hover:text-[#4F46E5] hover:bg-[#EEF2FF] active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Middle: Workspaces list */}
          <div className="flex-1 w-full min-h-0 flex flex-col items-center gap-1.5 py-3 overflow-y-auto overflow-x-hidden no-scrollbar">
            {subjects.map((subject) => {
              const isActive = activeId === subject.id;
              const subjectColor = subject.color || "#4F46E5";

              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => handleSubjectClick(subject)}
                  aria-label={subject.name}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setRailTooltip({ text: subject.name, top: rect.top + rect.height / 2 });
                  }}
                  onMouseLeave={() => setRailTooltip(null)}
                  className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg active:scale-95 transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#EEF2FF] text-[#4F46E5] shadow-2xs ring-1 ring-[#C7D2FE]"
                      : "text-[#777587] hover:bg-[#F8F9FF] dark:hover:bg-white/[0.04] hover:text-[#0B1C30]"
                  }`}
                >
                  {isActive ? (
                    <FolderOpen
                      className="h-4 w-4 transition-transform"
                      style={{ color: subjectColor }}
                    />
                  ) : (
                    <Folder
                      className="h-4 w-4 transition-transform"
                      style={{ color: subjectColor }}
                    />
                  )}
                  {/* Concentric Accent Dot */}
                  <span
                    className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full ring-1 ring-white dark:ring-neutral-900"
                    style={{ backgroundColor: subjectColor }}
                  />
                </button>
              );
            })}
          </div>

          {/* Bottom: User avatar */}
          <div className="flex flex-col items-center pt-2.5 border-t border-[#E5EEFF] dark:border-white/[0.08] shrink-0 w-full">
            <button
              type="button"
              onClick={onSettingsClick}
              aria-label="Cài đặt tài khoản"
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setRailTooltip({ text: "Cài đặt tài khoản", top: rect.top + rect.height / 2 });
              }}
              onMouseLeave={() => setRailTooltip(null)}
              className="relative h-8 w-8 overflow-hidden rounded-full border border-[#E5EEFF] dark:border-white/[0.1] hover:ring-2 hover:ring-[#4F46E5]/40 transition-all cursor-pointer active:scale-95"
            >
              <Image
                src={
                  user.avatarUrl ||
                  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                }
                alt={user.name}
                width={32}
                height={32}
                unoptimized
                className="h-full w-full object-cover"
              />
            </button>
          </div>
        </div>
      ) : (
        /* ── Full Expanded Sidebar Mode ── */
        <>
          <div className="flex-1 min-h-0 flex flex-col space-y-3 overflow-y-auto no-scrollbar pr-0.5">
            {/* Header: macOS Split-View Title + Actions */}
            <div className="flex items-center justify-between px-2 pt-1 pb-1">
              <span className="text-[11px] font-semibold font-heading tracking-wider text-[#777587] dark:text-neutral-400 uppercase">
                Không gian học tập
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  aria-label="Tạo không gian học tập"
                  title="Tạo không gian mới"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#777587] hover:text-[#4F46E5] hover:bg-[#EEF2FF] dark:hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                </button>
                {onToggleCollapse && (
                  <button
                    type="button"
                    onClick={handleToggleCollapse}
                    aria-label="Thu gọn thanh bên"
                    title="Thu gọn"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#777587] hover:text-[#0B1C30] dark:hover:text-white hover:bg-[#F8F9FF] dark:hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Workspaces List */}
            <div className="space-y-0.5">
              {/* 1. Loading Skeleton */}
              {isLoading && subjects.length === 0 && (
                <div className="space-y-1 animate-pulse px-1">
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

              {/* 2. Error State */}
              {error && subjects.length === 0 && (
                <div className="rounded-xl border border-rose-200/60 bg-rose-50/50 dark:bg-rose-950/20 p-3 text-center space-y-2 mx-1">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="truncate">{error}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => refresh()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-white dark:bg-neutral-900 px-2.5 py-1 text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Thử lại</span>
                  </button>
                </div>
              )}

              {/* 3. Empty State */}
              {!isLoading && subjects.length === 0 && !error && (
                <div className="rounded-2xl border border-dashed border-[#E5EEFF] dark:border-white/[0.1] bg-[#F8F9FF] dark:bg-white/[0.02] p-4 text-center space-y-2.5 mx-1">
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
                    <Folder className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold font-heading text-[#0B1C30] dark:text-neutral-300">
                      Chưa có không gian nào
                    </p>
                    <p className="text-[11px] text-[#777587] dark:text-neutral-500 mt-0.5">
                      Tạo không gian để quản lý tài liệu
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] hover:bg-[#3525CD] px-3 py-1.5 text-xs font-medium text-white shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Tạo không gian</span>
                  </button>
                </div>
              )}

              {/* 4. Subject Items */}
              {subjects.map((subject) => {
                const isActive = activeId === subject.id;
                const subjectColor = subject.color || "#4F46E5";
                const isMenuOpen = menuAnchor?.subject.id === subject.id;

                return (
                  <div key={subject.id} className="relative group px-1">
                    <div
                      onClick={() => handleSubjectClick(subject)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          handleSubjectClick(subject);
                        }
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all duration-150 cursor-pointer ${
                        isActive
                          ? "bg-[#EEF2FF] dark:bg-white/[0.12] text-[#3525CD] dark:text-white font-semibold shadow-2xs"
                          : "text-[#464555] dark:text-neutral-400 hover:bg-[#F8F9FF] dark:hover:bg-white/[0.04] hover:text-[#0B1C30] dark:hover:text-neutral-200 font-medium"
                      }`}
                    >
                      {/* Left: Icon & Subject Name */}
                      <div className="flex items-center gap-2.5 min-w-0 pr-1">
                        <div
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105"
                          style={{ backgroundColor: `${subjectColor}16` }}
                        >
                          {isActive ? (
                            <FolderOpen
                              className="h-3.5 w-3.5 transition-colors"
                              style={{ color: subjectColor }}
                            />
                          ) : (
                            <Folder
                              className="h-3.5 w-3.5 transition-colors"
                              style={{ color: subjectColor }}
                            />
                          )}
                        </div>
                        <span
                          title={subject.name}
                          className="text-[13px] truncate leading-tight tracking-tight"
                        >
                          {subject.name}
                        </span>
                      </div>

                      {/* Right: Dot Indicator & More Action Trigger */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* 3-dots Menu Button */}
                        <button
                          type="button"
                          data-menu-trigger="true"
                          aria-label={`Tùy chọn cho ${subject.name}`}
                          onClick={(e) => handleToggleActionMenu(subject, e)}
                          className={`rounded-md p-1 transition-all cursor-pointer ${
                            isMenuOpen
                              ? "bg-[#E5EEFF] dark:bg-white/[0.12] text-[#0B1C30] dark:text-white opacity-100"
                              : "text-[#777587] opacity-0 group-hover:opacity-100 hover:bg-[#E5EEFF] dark:hover:bg-white/[0.06] hover:text-[#0B1C30] dark:hover:text-neutral-200"
                          }`}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>

                        <span
                          className={`h-2 w-2 rounded-full transition-transform ${
                            isMenuOpen ? "hidden" : "group-hover:hidden"
                          }`}
                          style={{ backgroundColor: subjectColor }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom: User Profile & Quick Settings */}
          <div className="border-t border-[#E5EEFF] dark:border-white/[0.08] pt-3 px-1 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[#E5EEFF] dark:border-white/[0.1]">
                <Image
                  src={
                    user.avatarUrl ||
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                  }
                  alt={user.name}
                  width={32}
                  height={32}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold font-heading text-[#0B1C30] dark:text-neutral-100 truncate leading-snug">
                  {user.name}
                </p>
                <p className="text-[11px] text-[#777587] dark:text-neutral-500 truncate leading-none">
                  {user.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onSettingsClick}
              aria-label="Cài đặt"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#777587] hover:text-[#0B1C30] dark:hover:text-neutral-200 hover:bg-[#F8F9FF] dark:hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {/* ── Apple macOS Floating Context Menu ── */}
      {menuAnchor && (
        <div
          data-dropdown-menu="true"
          style={{
            position: "fixed",
            top: `${menuAnchor.top}px`,
            left: `${menuAnchor.left}px`,
          }}
          className="z-50 w-36 rounded-xl border border-[#E5EEFF] dark:border-white/[0.12] bg-white/95 dark:bg-[#12151C]/95 backdrop-blur-xl p-1 shadow-lg shadow-[#0B1C30]/5 animate-in fade-in-50 zoom-in-95 duration-100 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => handleOpenEditModal(menuAnchor.subject, e)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#464555] dark:text-neutral-200 hover:bg-[#4F46E5] hover:text-white transition-colors cursor-pointer"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Chỉnh sửa</span>
          </button>
          <button
            type="button"
            onClick={(e) => handleOpenDeleteModal(menuAnchor.subject, e)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Xóa</span>
          </button>
        </div>
      )}

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
        onConfirm={handleConfirmDelete}
      />

      {/* ── Apple Floating Pill Tooltip (Rail Mode) ── */}
      {isCollapsed && railTooltip && (
        <div
          style={{
            position: "fixed",
            top: `${railTooltip.top}px`,
            left: "60px",
          }}
          className="z-50 -translate-y-1/2 pointer-events-none animate-in fade-in-50 zoom-in-95 duration-100"
        >
          <div className="rounded-lg bg-[#0B1C30]/95 dark:bg-white/95 backdrop-blur-md px-2.5 py-1 text-[11px] font-medium text-white dark:text-[#0B1C30] shadow-xl whitespace-nowrap">
            {railTooltip.text}
          </div>
        </div>
      )}
    </aside>
  );
}

export { LeftSidebar };
