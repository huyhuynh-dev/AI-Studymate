"use client";

import React, { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  Calendar,
  Edit3,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import {
  FloatingActionMenu,
  FloatingActionMenuItem,
  computeFloatingMenuPosition,
  type FloatingMenuPosition,
} from "@/components/ui/FloatingActionMenu";
import { IconButton } from "@/components/ui/IconButton";
import { SubjectIconBadge } from "@/components/ui/SubjectIconBadge";
import { useSubjects } from "@/hooks/useSubjects";
import type { Subject } from "@/types";
import CreateWorkspaceModal from "./CreateWorkspaceModal";
import DeleteWorkspaceModal from "./DeleteWorkspaceModal";
import WelcomeComponent from "./WelcomeComponent";

type SortOrder = "recent" | "name";

const DATE_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatIsoDate(value?: string | null): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return DATE_FORMATTER.format(timestamp);
}

function formatSubjectSubtitle(subject: Subject): {
  label: string;
  hasExamDate: boolean;
} {
  const formattedExam = formatIsoDate(subject.examDate);
  if (formattedExam) {
    return { label: `Ngày thi: ${formattedExam}`, hasExamDate: true };
  }
  const formattedUpdated = formatIsoDate(subject.updated_at || subject.created_at);
  if (formattedUpdated) {
    return { label: `Cập nhật ${formattedUpdated}`, hasExamDate: false };
  }
  return { label: "Sẵn sàng ôn luyện", hasExamDate: false };
}

function SubjectGridSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải danh sách không gian học tập…"
      className="w-full space-y-8 animate-pulse motion-reduce:animate-none"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5EEFF] dark:border-white/[0.08]">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-[#E5EEFF] dark:bg-white/[0.08]" />
          <div className="h-4 w-72 max-w-full rounded-lg bg-[#EFF4FF] dark:bg-white/[0.06]" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-[#E5EEFF] dark:bg-white/[0.08]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="min-h-[184px] rounded-[20px] bg-white dark:bg-[#12151C] border border-[#E5EEFF] dark:border-white/[0.08] p-5 flex flex-col justify-between"
          >
            <div className="flex justify-between items-center">
              <div className="h-11 w-11 rounded-xl bg-[#EFF4FF] dark:bg-white/[0.06]" />
              <div className="h-8 w-8 rounded-lg bg-[#EFF4FF] dark:bg-white/[0.06]" />
            </div>
            <div className="space-y-2 my-3">
              <div className="h-5 w-3/4 rounded-md bg-[#E5EEFF] dark:bg-white/[0.08]" />
              <div className="h-3.5 w-1/2 rounded-md bg-[#EFF4FF] dark:bg-white/[0.05]" />
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-[#F0F4FF] dark:border-white/[0.05]">
              <div className="h-6 w-28 rounded-full bg-[#EFF4FF] dark:bg-white/[0.06]" />
              <div className="h-8 w-8 rounded-full bg-[#EFF4FF] dark:bg-white/[0.06]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SubjectCardProps {
  subject: Subject;
  isMenuOpen: boolean;
  onOpenMenu: (subject: Subject, event: React.MouseEvent<HTMLButtonElement>) => void;
}

function SubjectCard({ subject, isMenuOpen, onOpenMenu }: SubjectCardProps) {
  const subjectColor = subject.color || "#4F46E5";
  const subtitle = formatSubjectSubtitle(subject);
  const statusLabel =
    subject.targetScore != null
      ? `Mục tiêu: ${subject.targetScore}`
      : "Không gian môn học";

  return (
    <div className="relative group">
      <Link
        href={`/home/${subject.id}`}
        className="relative flex flex-col justify-between min-h-[184px] rounded-[20px] p-5 bg-white dark:bg-[#12151C] border border-[#E5EEFF] dark:border-white/[0.1] shadow-[0_4px_20px_-4px_rgba(11,28,48,0.05),0_1px_3px_-1px_rgba(11,28,48,0.03)] hover:border-[#C7C4D8] dark:hover:border-white/[0.22] hover:shadow-[0_16px_32px_-8px_rgba(79,70,229,0.12),0_4px_12px_-2px_rgba(11,28,48,0.04)] dark:hover:shadow-[0_16px_32px_-8px_rgba(0,0,0,0.5)] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5 active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5] transition-[border-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none text-left"
      >
        {/* Ambient radial tint layer (isolated overflow so focus ring & shadow remain crisp) */}
        <div
          aria-hidden="true"
          style={{
            backgroundImage: `radial-gradient(circle at 92% 12%, ${subjectColor}22 0%, transparent 65%)`,
          }}
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[20px]"
        />

        {/* Top Bar: Subject Squircle Icon */}
        <div className="relative flex items-center justify-between pr-10">
          <SubjectIconBadge
            color={subjectColor}
            size="lg"
            className="transition-transform duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 motion-reduce:transform-none"
          />
        </div>

        {/* Middle: Subject Name & Real Metadata */}
        <div className="relative space-y-1.5 my-3 min-w-0">
          <h2
            title={subject.name}
            className="font-bold font-heading text-[#0B1C30] dark:text-[#EFF0F6] text-base sm:text-lg line-clamp-2 leading-snug tracking-tight group-hover:text-[#4F46E5] dark:group-hover:text-[#818CF8] transition-colors duration-150"
          >
            {subject.name}
          </h2>
          <p className="inline-flex items-center gap-1.5 text-[13px] text-[#5E5C6E] dark:text-[#9DA3AF] truncate max-w-full">
            {subtitle.hasExamDate ? (
              <Calendar aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            ) : null}
            <span className="truncate">{subtitle.label}</span>
          </p>
        </div>

        {/* Bottom Bar: Status Pill & Navigation Indicator */}
        <div className="relative flex items-center justify-between gap-2 pt-3 border-t border-[#F0F4FF] dark:border-white/[0.08]">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F8F9FF] dark:bg-white/[0.06] border border-[#E5EEFF] dark:border-white/[0.1] text-xs font-medium font-heading text-[#464555] dark:text-[#EFF0F6] truncate">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full shadow-2xs"
              style={{ backgroundColor: subjectColor }}
            />
            <span className="truncate">{statusLabel}</span>
          </span>

          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F8F9FF] dark:bg-white/[0.08] border border-[#E5EEFF] dark:border-white/[0.1] text-[#5E5C6E] dark:text-[#9DA3AF] group-hover:bg-[#4F46E5] group-hover:border-[#4F46E5] group-hover:text-white [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 transition-[background-color,border-color,color,transform] duration-200 motion-reduce:transition-none shadow-2xs"
          >
            <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" />
          </span>
        </div>
      </Link>

      {/* Sibling Context Menu Trigger (not nested inside Link) */}
      <div className="absolute top-4 right-4 z-10">
        <IconButton
          data-menu-trigger="true"
          label={`Tùy chọn ${subject.name}`}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          isActive={isMenuOpen}
          onClick={(e) => onOpenMenu(subject, e)}
          className="rounded-lg"
        >
          <MoreVertical aria-hidden="true" className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

export default function SubjectCardListView() {
  const {
    subjects,
    isLoading,
    error,
    createSubject,
    updateSubject,
    deleteSubject,
    refresh,
  } = useSubjects();

  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [workspaceModalMode, setWorkspaceModalMode] = useState<"create" | "edit">("create");
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);

  const [menuState, setMenuState] = useState<{
    subject: Subject;
    position: FloatingMenuPosition;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent");

  const visibleSubjects = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    const filtered = normalizedQuery
      ? subjects.filter((subject) =>
          subject.name.toLowerCase().includes(normalizedQuery)
        )
      : subjects;

    if (sortOrder === "name") {
      return filtered.toSorted((a, b) =>
        a.name.localeCompare(b.name, "vi", { sensitivity: "base" })
      );
    }

    return filtered.toSorted((a, b) => {
      const aTime = Date.parse(a.updated_at || a.created_at) || 0;
      const bTime = Date.parse(b.updated_at || b.created_at) || 0;
      return bTime - aTime;
    });
  }, [subjects, deferredQuery, sortOrder]);

  const handleOpenCreateModal = () => {
    setWorkspaceModalMode("create");
    setEditingSubject(null);
    setIsWorkspaceModalOpen(true);
  };

  const handleOpenEditModal = (subject: Subject, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuState(null);
    setWorkspaceModalMode("edit");
    setEditingSubject(subject);
    setIsWorkspaceModalOpen(true);
  };

  const handleOpenDeleteModal = (subject: Subject, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuState(null);
    setDeletingSubject(subject);
    setIsDeleteModalOpen(true);
  };

  const handleToggleCardMenu = (
    subject: Subject,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (menuState?.subject.id === subject.id) {
      setMenuState(null);
      return;
    }

    const position = computeFloatingMenuPosition(
      event.currentTarget.getBoundingClientRect(),
      { menuWidth: 148, menuHeight: 84 }
    );
    setMenuState({ subject, position });
  };

  const handleWorkspaceFormSubmit = async (data: { name: string; color: string }) => {
    if (workspaceModalMode === "create") {
      await createSubject(data);
    } else if (workspaceModalMode === "edit" && editingSubject) {
      await updateSubject(editingSubject.id, data);
    }
    setIsWorkspaceModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (deletingSubject) {
      await deleteSubject(deletingSubject.id);
      setIsDeleteModalOpen(false);
    }
  };

  if (isLoading && subjects.length === 0) {
    return <SubjectGridSkeleton />;
  }

  if (error && subjects.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-10">
        <EmptyState
          tone="error"
          surface="card"
          className="w-full max-w-lg"
          icon={<AlertCircle className="h-6 w-6" />}
          title="Không thể tải danh sách không gian"
          description={error}
          action={
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] hover:bg-[#3525CD] px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5] transition-[background-color,transform] duration-150 motion-reduce:transition-none cursor-pointer"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              <span>Thử lại</span>
            </button>
          }
        />
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center py-8 sm:py-12">
        <WelcomeComponent />
      </div>
    );
  }

  const showFilterBar = subjects.length >= 4;

  return (
    <div className="w-full flex flex-col">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-[#E5EEFF] dark:border-white/[0.08]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold font-heading tracking-tight text-[#0B1C30] dark:text-[#EFF0F6] text-balance">
              Không gian học tập
            </h1>
            <span className="tabular-nums text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8] bg-[#EEF2FF] dark:bg-[#4F46E5]/20 border border-[#C7D2FE] dark:border-[#4F46E5]/30 px-2.5 py-0.5 rounded-full shadow-2xs">
              {subjects.length} không gian
            </span>
          </div>
          <p className="text-sm text-[#464555] dark:text-[#9DA3AF] mt-1">
            Chọn không gian môn học để quản lý tài liệu và tiếp tục ôn luyện
          </p>
        </div>

        {/* Primary CTA (Rule of 1 Primary Action) */}
        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4F46E5] hover:bg-[#3525CD] active:scale-[0.97] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#4F46E5]/20 hover:shadow-[#4F46E5]/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5] transition-[background-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none cursor-pointer self-start sm:self-auto shrink-0 select-none"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          <span>Tạo không gian</span>
        </button>
      </div>

      {/* Search & Sort Toolbar (auto-shown when 4+ subjects exist) */}
      {showFilterBar ? (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5E5C6E] dark:text-[#9DA3AF]"
            />
            <input
              type="search"
              name="subjectSearch"
              autoComplete="off"
              aria-label="Tìm kiếm không gian học tập"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm không gian…"
              className="w-full rounded-xl border border-[#E5EEFF] dark:border-white/[0.1] bg-white dark:bg-[#12151C] pl-9 pr-3.5 py-2 text-sm text-[#0B1C30] dark:text-[#EFF0F6] placeholder-[#5E5C6E] dark:placeholder-[#9DA3AF] outline-none focus:border-[#4F46E5] focus:ring-3 focus:ring-[#4F46E5]/15 transition-[border-color,box-shadow] duration-150 shadow-2xs"
            />
          </div>

          <div
            role="group"
            aria-label="Sắp xếp danh sách"
            className="inline-flex self-start rounded-xl border border-[#E5EEFF] dark:border-white/[0.08] bg-[#EFF4FF] dark:bg-white/[0.04] p-1 select-none"
          >
            <button
              type="button"
              aria-pressed={sortOrder === "recent"}
              onClick={() => setSortOrder("recent")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[#4F46E5] cursor-pointer ${
                sortOrder === "recent"
                  ? "bg-white dark:bg-[#1E2330] text-[#4F46E5] dark:text-[#818CF8] shadow-2xs"
                  : "text-[#5E5C6E] dark:text-[#9DA3AF] hover:text-[#0B1C30] dark:hover:text-white"
              }`}
            >
              Mới cập nhật
            </button>
            <button
              type="button"
              aria-pressed={sortOrder === "name"}
              onClick={() => setSortOrder("name")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[#4F46E5] cursor-pointer ${
                sortOrder === "name"
                  ? "bg-white dark:bg-[#1E2330] text-[#4F46E5] dark:text-[#818CF8] shadow-2xs"
                  : "text-[#5E5C6E] dark:text-[#9DA3AF] hover:text-[#0B1C30] dark:hover:text-white"
              }`}
            >
              Tên A–Z
            </button>
          </div>
        </div>
      ) : null}

      {/* Workspace Cards Grid or Filtered Empty State */}
      {visibleSubjects.length === 0 ? (
        <EmptyState
          surface="card"
          icon={<Search className="h-5 w-5" />}
          title="Không tìm thấy không gian phù hợp"
          description="Thử tìm với từ khóa khác hoặc xóa bộ lọc để xem toàn bộ không gian học tập."
          action={
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="rounded-xl border border-[#E5EEFF] dark:border-white/[0.1] bg-[#F8F9FF] dark:bg-white/[0.06] hover:bg-[#E5EEFF] dark:hover:bg-white/[0.1] px-4 py-2 text-xs font-semibold text-[#464555] dark:text-[#EFF0F6] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[#4F46E5] transition-[background-color,transform] duration-150 cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {visibleSubjects.map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              isMenuOpen={menuState?.subject.id === subject.id}
              onOpenMenu={handleToggleCardMenu}
            />
          ))}
        </div>
      )}

      {/* Floating Context Menu (Portaled outside cards) */}
      <FloatingActionMenu
        isOpen={Boolean(menuState)}
        position={menuState?.position ?? null}
        onClose={() => setMenuState(null)}
        widthClass="w-36"
        ariaLabel={
          menuState ? `Tùy chọn cho ${menuState.subject.name}` : "Tùy chọn không gian"
        }
      >
        <FloatingActionMenuItem
          icon={<Edit3 className="h-3.5 w-3.5" />}
          onClick={(e) => {
            if (menuState) handleOpenEditModal(menuState.subject, e);
          }}
        >
          Chỉnh sửa
        </FloatingActionMenuItem>
        <FloatingActionMenuItem
          tone="danger"
          icon={<Trash2 className="h-3.5 w-3.5" />}
          onClick={(e) => {
            if (menuState) handleOpenDeleteModal(menuState.subject, e);
          }}
        >
          Xóa
        </FloatingActionMenuItem>
      </FloatingActionMenu>

      {/* Modal Tạo mới & Chỉnh sửa Không gian */}
      <CreateWorkspaceModal
        isOpen={isWorkspaceModalOpen}
        mode={workspaceModalMode}
        initialData={editingSubject}
        onClose={() => setIsWorkspaceModalOpen(false)}
        onSubmit={handleWorkspaceFormSubmit}
      />

      {/* Modal Xác nhận Xóa Không gian */}
      <DeleteWorkspaceModal
        isOpen={isDeleteModalOpen}
        subject={deletingSubject}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
