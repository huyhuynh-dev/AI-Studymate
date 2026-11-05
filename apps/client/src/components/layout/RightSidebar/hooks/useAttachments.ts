import { useCallback, useRef, useState, type ChangeEvent } from "react";
import type { AttachedFile, WorkspaceDoc } from "../types";
import { createId } from "../utils";

/**
 * Quản lý tệp đính kèm: tệp từ thiết bị (qua <input type="file"> ẩn)
 * và tài liệu chọn từ Không gian học tập (qua Popover nhúng hoặc Mention @).
 */
export function useAttachments() {
  const [files, setFiles] = useState<AttachedFile[]>([]);
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

  const addWorkspaceDocs = useCallback((docs: WorkspaceDoc[]) => {
    setFiles((prev) => {
      const existingDocIds = new Set(
        prev
          .filter((f) => f.source === "workspace" && f.documentId)
          .map((f) => f.documentId)
      );

      const toAdd: AttachedFile[] = docs
        .filter((doc) => !existingDocIds.has(doc.id))
        .map((doc) => ({
          id: doc.id,
          documentId: doc.id,
          name: doc.file_name,
          source: "workspace",
        }));

      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd];
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
    addWorkspaceDoc,
    addWorkspaceDocs,
    removeFile,
    clearFiles,
  };
}
