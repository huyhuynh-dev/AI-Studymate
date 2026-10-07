"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  FolderPlus,
  Flame,
  Folder,
  FolderOpen,
  Settings,
  PanelLeftClose,
  MoreVertical,
  Edit3,
  Trash2,
  AlertCircle,
  RefreshCw,
  Plus,
} from "lucide-react";
import { useSubjects } from "@/hooks/useSubjects";
import { Subject } from "@/services/subjects.api";
import CreateWorkspaceModal from "./CreateWorkspaceModal";
import DeleteWorkspaceModal from "./DeleteWorkspaceModal";

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
  streakDays = 14,
  xp = 180,
  progress = {
    current: 42,
    total: 50,
    percentage: 84,
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
  const [activeId, setActiveId] = useState<string | null>(selectedSubjectId || null);

  // State quản lý Modals
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [workspaceModalMode, setWorkspaceModalMode] = useState<"create" | "edit">("create");
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);

  // State menu 3 chấm (Dropdown Action Menu)
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

  // Chọn môn học
  const handleSubjectClick = (subject: Subject) => {
    setActiveId(subject.id);
    onSelectSubject?.(subject);
  };

  // Mở modal tạo mới
  const handleOpenCreateModal = () => {
    setWorkspaceModalMode("create");
    setEditingSubject(null);
    setIsWorkspaceModalOpen(true);
    onNewFolder?.();
  };

  // Mở modal chỉnh sửa
  const handleOpenEditModal = (subject: Subject, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionMenuOpenId(null);
    setWorkspaceModalMode("edit");
    setEditingSubject(subject);
    setIsWorkspaceModalOpen(true);
  };

  // Mở modal xóa
  const handleOpenDeleteModal = (subject: Subject, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionMenuOpenId(null);
    setDeletingSubject(subject);
    setIsDeleteModalOpen(true);
  };

  // Submit Tạo mới hoặc Cập nhật
  const handleWorkspaceFormSubmit = async (data: { name: string; color: string }) => {
    if (workspaceModalMode === "create") {
      const created = await createSubject(data);
      onCreateWorkspace?.(data);
      if (!activeId) {
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
      className={`flex h-full flex-col justify-between border-r border-gray-100 bg-white select-none transition-all duration-300 ease-in-out ${
        isCollapsed
          ? "w-0 p-0 border-r-0 overflow-hidden opacity-0 pointer-events-none"
          : "w-72 p-4 opacity-100"
      } ${className}`.trim()}
    >
      {/* ── Top & Main Content ── */}
      <div className="flex flex-col space-y-4 overflow-y-auto">
        {/* Section Header: Workspace Title + Add Folder + Collapse */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold tracking-wider text-gray-500 uppercase">
            KHÔNG GIAN HỌC TẬP
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              aria-label="Thêm không gian mới"
              title="Thêm không gian học tập"
              className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Thu gọn sidebar trái"
                title="Thu gọn sidebar"
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Streak & XP Banner ── */}
        <div className="flex items-center justify-between rounded-2xl border border-blue-100/60 bg-blue-50/60 p-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-600 shadow-2xs">
              <Flame className="h-5 w-5 fill-emerald-500 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                Chuỗi {streakDays} ngày
              </p>
              <p className="text-xs text-gray-500">Học tích cực</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-300 px-2.5 py-1 text-xs font-bold text-emerald-950 shadow-2xs">
            +{xp} XP
          </span>
        </div>

        {/* ── Document Folders / Subjects Section ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-bold tracking-wider text-gray-400 uppercase">
              THƯ MỤC TÀI LIỆU
            </p>
            {subjects.length > 0 && (
              <span className="text-[11px] font-medium text-gray-400">
                {subjects.length} không gian
              </span>
            )}
          </div>

          {/* 1. Loading Skeleton State */}
          {isLoading && subjects.length === 0 && (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl bg-gray-50 p-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-4 w-4 rounded-md bg-gray-200" />
                    <div className="h-3.5 w-28 rounded-md bg-gray-200" />
                  </div>
                  <div className="h-3 w-3 rounded-full bg-gray-200" />
                </div>
              ))}
            </div>
          )}

          {/* 2. Error State */}
          {error && subjects.length === 0 && (
            <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3 text-center space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-xs text-rose-600 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => refresh()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Thử lại</span>
              </button>
            </div>
          )}

          {/* 3. Empty State */}
          {!isLoading && subjects.length === 0 && !error && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-4 text-center space-y-2.5">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Folder className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700">
                  Chưa có không gian học tập nào
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Tạo không gian để bắt đầu quản lý tài liệu
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tạo không gian</span>
              </button>
            </div>
          )}

          {/* 4. Real Subjects List */}
          {subjects.map((subject) => {
            const isActive = activeId === subject.id;
            const subjectColor = subject.color || "#4F46E5";
            const isMenuOpen = actionMenuOpenId === subject.id;

            return (
              <div key={subject.id} className="relative group">
                <div
                  onClick={() => handleSubjectClick(subject)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleSubjectClick(subject);
                    }
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer ${
                    isActive
                      ? "bg-indigo-50/80 text-indigo-900 shadow-2xs font-semibold"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium"
                  }`}
                >
                  {/* Left: Folder Icon & Name */}
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    {isActive ? (
                      <FolderOpen
                        className="h-4 w-4 shrink-0 transition-colors"
                        style={{ color: subjectColor }}
                      />
                    ) : (
                      <Folder
                        className="h-4 w-4 shrink-0 transition-colors"
                        style={{ color: subjectColor }}
                      />
                    )}
                    <span
                      title={subject.name}
                      className="text-xs sm:text-sm truncate leading-snug"
                    >
                      {subject.name}
                    </span>
                  </div>

                  {/* Right: Color Dot or Action Menu Trigger */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="h-2 w-2 rounded-full transition-transform group-hover:scale-125"
                      style={{ backgroundColor: subjectColor }}
                    />

                    {/* 3-dots Menu Button */}
                    <button
                      type="button"
                      aria-label={`Tùy chọn cho ${subject.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMenuOpenId(isMenuOpen ? null : subject.id);
                      }}
                      className={`rounded-md p-1 transition-colors cursor-pointer ${
                        isMenuOpen
                          ? "bg-gray-200 text-gray-800"
                          : "text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-700"
                      }`}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Dropdown Action Menu */}
                {isMenuOpen && (
                  <>
                    {/* Backdrop to close menu when clicking outside */}
                    <div
                      className="fixed inset-0 z-30 cursor-default"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMenuOpenId(null);
                      }}
                    />

                    <div className="absolute right-2 top-10 z-40 w-36 rounded-xl border border-gray-100 bg-white p-1 shadow-lg ring-1 ring-black/5 animate-in fade-in-50 zoom-in-95 duration-100">
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditModal(subject, e)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Chỉnh sửa</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleOpenDeleteModal(subject, e)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Weekly Goal Progress Card ── */}
        <div className="rounded-2xl border border-blue-100/60 bg-blue-50/50 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-700">
              Chỉ tiêu ghi nhớ tuần
            </span>
            <span className="font-bold text-indigo-600 text-sm">
              {progress.percentage}%
            </span>
          </div>

          <div className="my-2 h-2 w-full overflow-hidden rounded-full bg-indigo-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          <p className="text-xs text-gray-500">
            {progress.current} / {progress.total} khái niệm cốt lõi
          </p>
        </div>
      </div>

      {/* ── Bottom: User Profile & Settings ── */}
      <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-gray-200 shadow-2xs">
            <Image
              src={
                user.avatarUrl ||
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
              }
              alt={user.name}
              width={36}
              height={36}
              unoptimized
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
              {user.name}
            </p>
            <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSettingsClick}
          aria-label="Cài đặt"
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors cursor-pointer shrink-0"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

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
    </aside>
  );
}

export { LeftSidebar };
