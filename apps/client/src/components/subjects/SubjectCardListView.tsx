"use client";

import React, { useState } from "react";
import { Folder, MoreVertical, Edit3, Trash2, Plus, ArrowUpRight, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSubjects } from "@/hooks/useSubjects";
import { Subject } from "@/types";
import WelcomeComponent from "./WelcomeComponent";
import CreateWorkspaceModal from "./CreateWorkspaceModal";
import DeleteWorkspaceModal from "./DeleteWorkspaceModal";

export default function SubjectCardListView() {
  const { subjects, isLoading, createSubject, updateSubject, deleteSubject } = useSubjects();
  const router = useRouter();

  // Modals state
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [workspaceModalMode, setWorkspaceModalMode] = useState<"create" | "edit">("create");
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);

  // Dropdown Action Menu
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

  const handleSubjectClick = (subject: Subject) => {
    router.push(`/home/${subject.id}`);
  };

  const handleOpenCreateModal = () => {
    setWorkspaceModalMode("create");
    setEditingSubject(null);
    setIsWorkspaceModalOpen(true);
  };

  const handleOpenEditModal = (subject: Subject, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionMenuOpenId(null);
    setWorkspaceModalMode("edit");
    setEditingSubject(subject);
    setIsWorkspaceModalOpen(true);
  };

  const handleOpenDeleteModal = (subject: Subject, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionMenuOpenId(null);
    setDeletingSubject(subject);
    setIsDeleteModalOpen(true);
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

  if (isLoading) {
    return (
      <div className="w-full space-y-8 animate-pulse">
        {/* Skeleton Header */}
        <div className="flex items-center justify-between pb-6 border-b border-[#E5EEFF] dark:border-white/[0.08]">
          <div className="space-y-2">
            <div className="h-7 w-48 rounded-lg bg-[#E5EEFF] dark:bg-white/[0.08]" />
            <div className="h-4 w-72 rounded-lg bg-[#EFF4FF] dark:bg-white/[0.06]" />
          </div>
          <div className="h-10 w-36 rounded-xl bg-[#E5EEFF] dark:bg-white/[0.08]" />
        </div>

        {/* Skeleton Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-52 rounded-[22px] bg-white dark:bg-[#12151C] border border-[#E5EEFF] dark:border-white/[0.08] p-5 flex flex-col justify-between"
            >
              <div className="flex justify-between items-center">
                <div className="h-11 w-11 rounded-xl bg-[#EFF4FF] dark:bg-white/[0.06]" />
                <div className="h-6 w-16 rounded-full bg-[#EFF4FF] dark:bg-white/[0.06]" />
              </div>
              <div className="space-y-2">
                <div className="h-5 w-3/4 rounded-md bg-[#E5EEFF] dark:bg-white/[0.08]" />
                <div className="h-3.5 w-1/2 rounded-md bg-[#EFF4FF] dark:bg-white/[0.05]" />
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-[#F0F4FF] dark:border-white/[0.05]">
                <div className="h-6 w-24 rounded-full bg-[#EFF4FF] dark:bg-white/[0.06]" />
                <div className="h-8 w-8 rounded-full bg-[#EFF4FF] dark:bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center py-12">
        <WelcomeComponent />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col">
      {/* ── Apple Large Title Section Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-[#E5EEFF] dark:border-white/[0.08]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1C30] dark:text-[#EFF0F6]">
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
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4F46E5] hover:bg-[#3525CD] active:scale-[0.98] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#4F46E5]/20 hover:shadow-[#4F46E5]/30 transition-all duration-150 cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Tạo không gian</span>
        </button>
      </div>

      {/* ── Apple Luxury Workspace Cards Grid (Light & Dark Mode) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {subjects.map((subject) => {
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
                style={{
                  backgroundImage: `radial-gradient(circle at 92% 12%, ${subjectColor}22 0%, transparent 65%)`,
                }}
                className="relative flex flex-col justify-between h-52 rounded-[22px] p-5 bg-white dark:bg-[#12151C] border border-[#E5EEFF] dark:border-white/[0.1] shadow-[0_4px_20px_-4px_rgba(11,28,48,0.05),0_1px_3px_-1px_rgba(11,28,48,0.03)] hover:border-[#C7C4D8] dark:hover:border-white/[0.22] hover:shadow-[0_16px_32px_-8px_rgba(79,70,229,0.12),0_4px_12px_-2px_rgba(11,28,48,0.04)] dark:hover:shadow-[0_16px_32px_-8px_rgba(0,0,0,0.5)] hover:-translate-y-1 active:scale-[0.99] transition-all duration-200 cursor-pointer text-left overflow-hidden"
              >
                {/* ── Top Bar: Icon + Action & Subtle Pill ── */}
                <div className="flex items-center justify-between">
                  {/* Squircle Icon with soft tactile depth */}
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl shadow-xs transition-transform group-hover:scale-105 duration-200"
                    style={{
                      backgroundColor: `${subjectColor}18`,
                      border: `1px solid ${subjectColor}33`,
                    }}
                  >
                    <Folder className="h-5 w-5" style={{ color: subjectColor }} />
                  </div>

                  {/* Top-Right: Quick Tag + Context Menu */}
                  <div className="flex items-center gap-1.5">
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F8F9FF] dark:bg-white/[0.06] border border-[#E5EEFF] dark:border-white/[0.1] text-[10px] font-semibold text-[#777587] dark:text-[#EFF0F6] uppercase tracking-wider">
                      <BookOpen className="h-2.5 w-2.5" />
                      Môn học
                    </span>

                    {/* 3-dots Context Menu Button */}
                    <div className="relative">
                      <button
                        type="button"
                        aria-label={`Tùy chọn ${subject.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionMenuOpenId(isMenuOpen ? null : subject.id);
                        }}
                        className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                          isMenuOpen
                            ? "bg-[#E5EEFF] dark:bg-white/[0.15] text-[#0B1C30] dark:text-white opacity-100"
                            : "text-[#777587] dark:text-[#9DA3AF] opacity-60 group-hover:opacity-100 hover:bg-[#E5EEFF] dark:hover:bg-white/[0.1] hover:text-[#0B1C30] dark:hover:text-white"
                        }`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {/* macOS Style Context Menu */}
                      {isMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-30 cursor-default"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionMenuOpenId(null);
                            }}
                          />
                          <div className="absolute right-0 top-full z-40 mt-1 w-36 rounded-xl border border-[#E5EEFF] dark:border-white/[0.12] bg-white/95 dark:bg-[#161922]/95 backdrop-blur-xl p-1 shadow-lg shadow-[#0B1C30]/5 dark:shadow-black/40 animate-in fade-in zoom-in-95 duration-100 select-none">
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditModal(subject, e)}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#464555] dark:text-[#EFF0F6] hover:bg-[#4F46E5] hover:text-white transition-colors cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Chỉnh sửa</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleOpenDeleteModal(subject, e)}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Xóa</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Middle: Typography & Subject Overview ── */}
                <div className="space-y-1 my-2">
                  <h3 className="font-bold text-[#0B1C30] dark:text-[#EFF0F6] text-base sm:text-lg line-clamp-1 tracking-tight group-hover:text-[#4F46E5] dark:group-hover:text-[#818CF8] transition-colors">
                    {subject.name}
                  </h3>
                  <p className="text-xs text-[#777587] dark:text-[#9DA3AF] line-clamp-1">
                    Không gian ôn luyện & quản lý tài liệu
                  </p>
                </div>

                {/* ── Bottom Bar: Structured Metadata & Interactive Circle Button ── */}
                <div className="flex items-center justify-between pt-3 border-t border-[#F0F4FF] dark:border-white/[0.08]">
                  {/* Status chip with glowing colored dot */}
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F8F9FF] dark:bg-white/[0.06] border border-[#E5EEFF] dark:border-white/[0.1] text-[11px] font-semibold text-[#464555] dark:text-[#EFF0F6]">
                    <span
                      className="h-2 w-2 rounded-full shadow-xs"
                      style={{ backgroundColor: subjectColor }}
                    />
                    <span>Tài liệu học tập</span>
                  </div>

                  {/* Elegant Circular Action Button */}
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F8F9FF] dark:bg-white/[0.08] border border-[#E5EEFF] dark:border-white/[0.1] text-[#777587] dark:text-neutral-300 group-hover:bg-[#4F46E5] group-hover:border-[#4F46E5] group-hover:text-white group-hover:scale-105 active:scale-95 transition-all duration-200 shadow-2xs">
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.2 group-hover:-translate-y-0.2" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modal Tạo mới & Chỉnh sửa Không gian ── */}
      <CreateWorkspaceModal
        isOpen={isWorkspaceModalOpen}
        mode={workspaceModalMode}
        initialData={editingSubject}
        onClose={() => setIsWorkspaceModalOpen(false)}
        onSubmit={handleWorkspaceFormSubmit}
      />

      {/* ── Modal Xác nhận Xóa Không gian ── */}
      <DeleteWorkspaceModal
        isOpen={isDeleteModalOpen}
        subject={deletingSubject}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
