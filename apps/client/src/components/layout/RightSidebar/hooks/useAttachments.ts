import { useCallback, useRef, useState, type ChangeEvent } from "react";
import type { DocumentItem } from "@/types";
import type { AttachedFile, WorkspaceDoc } from "../types";
import { createId } from "../utils";

export interface UseAttachmentsOptions {
  uploadFile?: (
    file: File,
    onProgress?: (percent: number) => void
  ) => Promise<DocumentItem | undefined>;
}

/**
 * Quản lý tệp đính kèm: tệp từ thiết bị (qua <input type="file"> ẩn)
 * và tài liệu chọn từ Không gian học tập (qua Popover nhúng hoặc Mention @).
 */
export function useAttachments(options?: UseAttachmentsOptions) {
  const { uploadFile } = options || {};
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const openLocalPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleLocalInputChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files;
      if (!selected || selected.length === 0) return;

      const fileList = Array.from(selected);
      e.target.value = ""; // cho phép chọn lại cùng một tệp

      if (!uploadFile) {
        const added: AttachedFile[] = fileList.map((f) => ({
          id: createId("local"),
          name: f.name,
          size: f.size,
          source: "local",
          file: f,
          status: "ready",
        }));
        setFiles((prev) => [...prev, ...added]);
        return;
      }

      // Khởi tạo các item với trạng thái đang tải (uploading)
      const uploadTasks = fileList.map((f) => {
        const tempId = createId("upload");
        const item: AttachedFile = {
          id: tempId,
          name: f.name,
          size: f.size,
          source: "local",
          file: f,
          status: "uploading",
          progress: 0,
        };
        return { file: f, tempId, item };
      });

      setFiles((prev) => [...prev, ...uploadTasks.map((t) => t.item)]);

      // Tiến hành tải lên song song các tệp
      await Promise.allSettled(
        uploadTasks.map(async (task) => {
          try {
            const newDoc = await uploadFile(task.file, (percent) => {
              setFiles((prev) =>
                prev.map((item) =>
                  item.id === task.tempId ? { ...item, progress: percent } : item
                )
              );
            });

            if (newDoc) {
              setFiles((prev) =>
                prev.map((item) =>
                  item.id === task.tempId
                    ? {
                        id: newDoc.id,
                        documentId: newDoc.id,
                        name: newDoc.file_name,
                        size: Number(newDoc.file_size),
                        source: "workspace",
                        status: "ready",
                        progress: 100,
                      }
                    : item
                )
              );
            }
          } catch (err: any) {
            const errMsg = err?.message || "Tải lên thất bại";
            setFiles((prev) =>
              prev.map((item) =>
                item.id === task.tempId
                  ? {
                      ...item,
                      status: "error",
                      errorMessage: errMsg,
                    }
                  : item
              )
            );
          }
        })
      );
    },
    [uploadFile]
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
