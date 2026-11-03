import { useCallback, useRef, useState, type ChangeEvent } from "react";
import type { AttachedFile, WorkspaceDoc } from "../types";
import { createId } from "../utils";

/**
 * Quản lý tệp đính kèm: tệp từ thiết bị (qua <input type="file"> ẩn)
 * và tài liệu chọn từ Không gian học tập (qua modal).
 */
export function useAttachments() {
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openLocalPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleLocalInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files;
      if (!selected || selected.length === 0) return;

      const added: AttachedFile[] = Array.from(selected).map((f) => ({
        id: createId("local"),
        name: f.name,
        size: f.size,
        source: "local",
        file: f,
      }));
      setFiles((prev) => [...prev, ...added]);
      e.target.value = ""; // cho phép chọn lại cùng một tệp
    },
    []
  );

  const openWorkspaceModal = useCallback(() => setIsWorkspaceModalOpen(true), []);
  const closeWorkspaceModal = useCallback(() => setIsWorkspaceModalOpen(false), []);

  const addWorkspaceDoc = useCallback((docOrName: WorkspaceDoc | string) => {
    setFiles((prev) => {
      if (typeof docOrName === "string") {
        return [
          ...prev,
          { id: createId("ws"), name: docOrName, source: "workspace" },
        ];
      }

      // Tránh thêm trùng lặp cùng một tài liệu Workspace
      if (prev.some((f) => f.source === "workspace" && f.documentId === docOrName.id)) {
        return prev;
      }

      return [
        ...prev,
        {
          id: docOrName.id,
          documentId: docOrName.id,
          name: docOrName.file_name,
          source: "workspace",
        },
      ];
    });
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const clearFiles = useCallback(() => setFiles([]), []);

  return {
    files,
    inputRef,
    openLocalPicker,
    handleLocalInputChange,
    isWorkspaceModalOpen,
    openWorkspaceModal,
    closeWorkspaceModal,
    addWorkspaceDoc,
    removeFile,
    clearFiles,
  };
}
