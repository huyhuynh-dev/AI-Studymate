"use client";

import React, { useState } from "react";
import { Folder, MoreVertical, Edit3, Trash2, Plus, Loader2 } from "lucide-react";
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
      const created = await createSubject(data);
      if (created?.id) {
        router.push(`/home/${created.id}`);
      }
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
      <div className="flex h-full w-full min-h-100 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <WelcomeComponent />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white/50 p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm min-h-125">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Các Không Gian Học Tập</h2>
          <p className="text-gray-500 text-sm mt-1">Chọn một không gian học tập để bắt đầu ôn luyện</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:bg-indigo-700 hover:shadow-indigo-500/35 active:scale-95 cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span className="hidden sm:inline">Tạo mới</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {subjects.map((subject) => {
          const subjectColor = subject.color || "#4F46E5";
          const isMenuOpen = actionMenuOpenId === subject.id;

          return (
            <div key={subject.id} className="relative group h-full">
              <div
                onClick={() => handleSubjectClick(subject)}
                className="flex flex-col h-full bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group-hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50/80 shadow-inner"
                    style={{ backgroundColor: `${subjectColor}15` }}
                  >
                    <Folder className="h-6 w-6" style={{ color: subjectColor }} />
                  </div>

                  {/* Dropdown menu trigger */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMenuOpenId(isMenuOpen ? null : subject.id);
                      }}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {isMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-30 cursor-default"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuOpenId(null);
                          }}
                        />
                        <div className="absolute right-0 top-full z-40 mt-1 w-36 rounded-xl border border-gray-100 bg-white p-1 shadow-lg ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditModal(subject, e)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors cursor-pointer"
                          >
                            <Edit3 className="h-4 w-4 text-indigo-600" />
                            <span>Chỉnh sửa</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenDeleteModal(subject, e)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4 text-rose-600" />
                            <span>Xóa</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-auto">
                  <h3 className="font-semibold text-gray-900 text-lg line-clamp-1 mb-1">{subject.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: subjectColor }}
                    />
                    <span>Không gian học tập</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <CreateWorkspaceModal
        isOpen={isWorkspaceModalOpen}
        mode={workspaceModalMode}
        initialData={editingSubject}
        onClose={() => setIsWorkspaceModalOpen(false)}
        onSubmit={handleWorkspaceFormSubmit}
      />

      <DeleteWorkspaceModal
        isOpen={isDeleteModalOpen}
        subject={deletingSubject}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
