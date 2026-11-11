import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import type { DocumentItem } from "@/types";
import type { AttachedFile, WorkspaceDoc } from "../types";
import { createId } from "../utils";

export interface UseAttachmentsOptions {
  uploadFile?: (
    file: File,
    onProgress?: (percent: number) => void
  ) => Promise<DocumentItem | undefined>;
  documents?: DocumentItem[];
}

/**
 * Quản lý tệp đính kèm: tệp từ thiết bị (qua <input type="file"> ẩn)
 * và tài liệu chọn từ Không gian học tập (qua Popover nhúng hoặc Mention @).
 */
export function useAttachments(options?: UseAttachmentsOptions) {
  const { uploadFile, documents } = options || {};
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tự động đồng bộ trạng thái thực tế từ danh sách documents (SWR Polling)
  useEffect(() => {
    if (!documents || documents.length === 0) return;
    const docMap = new Map(documents.map((d) => [d.id, d]));

    setFiles((prev) => {
      let hasChange = false;
      const next = prev.map((f) => {
        if (!f.documentId) return f;
        const doc = docMap.get(f.documentId);
        if (!doc) return f;

        const isReady = doc.ocr_status === "done" && doc.embed_status === "done";
        const isFailed = doc.ocr_status === "failed" || doc.embed_status === "failed";
        const nextStatus: AttachedFile["status"] = isReady ? "ready" : isFailed ? "error" : "processing";
        const nextErrMsg = isFailed ? (doc.processing_error || "Xử lý tài liệu thất bại") : f.errorMessage;

        if (f.status !== nextStatus || f.errorMessage !== nextErrMsg) {
          hasChange = true;
          return {
            ...f,
            status: nextStatus,
            errorMessage: nextErrMsg,
          };
        }
        return f;
      });

      return hasChange ? next : prev;
    });
  }, [documents]);

  const openLocalPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const uploadLocalFiles = useCallback(
    async (fileList: File[]) => {
      if (!fileList || fileList.length === 0) return;

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
              const isDocReady = newDoc.ocr_status === "done" && newDoc.embed_status === "done";
              const isDocFailed = newDoc.ocr_status === "failed" || newDoc.embed_status === "failed";
              const docStatus: AttachedFile["status"] = isDocReady ? "ready" : isDocFailed ? "error" : "processing";

              setFiles((prev) =>
                prev.map((item) =>
                  item.id === task.tempId
                    ? {
                        id: newDoc.id,
                        documentId: newDoc.id,
                        name: newDoc.file_name,
                        size: Number(newDoc.file_size),
                        source: "workspace",
                        status: docStatus,
                        progress: 100,
                        errorMessage: isDocFailed
                          ? (newDoc.processing_error || "Xử lý tài liệu thất bại")
                          : undefined,
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

  const handleLocalInputChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files;
      if (!selected || selected.length === 0) return;

      const fileList = Array.from(selected);
      e.target.value = ""; // cho phép chọn lại cùng một tệp
      await uploadLocalFiles(fileList);
    },
    [uploadLocalFiles]
  );

  const addWorkspaceDoc = useCallback(
    (docOrName: WorkspaceDoc | string) => {
      setFiles((prev) => {
        if (typeof docOrName === "string") {
          return [
            ...prev,
            { id: createId("ws"), name: docOrName, source: "workspace", status: "ready" },
          ];
        }

        // Tránh thêm trùng lặp cùng một tài liệu Workspace
        if (prev.some((f) => f.source === "workspace" && f.documentId === docOrName.id)) {
          return prev;
        }

        const matched = documents?.find((d) => d.id === docOrName.id);
        let status: AttachedFile["status"] = "ready";
        let errorMessage: string | undefined;

        if (matched) {
          if (matched.ocr_status === "failed" || matched.embed_status === "failed") {
            status = "error";
            errorMessage = matched.processing_error || "Xử lý tài liệu thất bại";
          } else if (matched.ocr_status !== "done" || matched.embed_status !== "done") {
            status = "processing";
          }
        }

        return [
          ...prev,
          {
            id: docOrName.id,
            documentId: docOrName.id,
            name: docOrName.file_name,
            source: "workspace",
            status,
            errorMessage,
          },
        ];
      });
    },
    [documents]
  );

  const addWorkspaceDocs = useCallback(
    (docs: WorkspaceDoc[]) => {
      setFiles((prev) => {
        const existingDocIds = new Set(
          prev
            .filter((f) => f.source === "workspace" && f.documentId)
            .map((f) => f.documentId)
        );

        const docMap = new Map((documents || []).map((d) => [d.id, d]));

        const toAdd: AttachedFile[] = docs
          .filter((doc) => !existingDocIds.has(doc.id))
          .map((doc) => {
            const matched = docMap.get(doc.id);
            let status: AttachedFile["status"] = "ready";
            let errorMessage: string | undefined;

            if (matched) {
              if (matched.ocr_status === "failed" || matched.embed_status === "failed") {
                status = "error";
                errorMessage = matched.processing_error || "Xử lý tài liệu thất bại";
              } else if (matched.ocr_status !== "done" || matched.embed_status !== "done") {
                status = "processing";
              }
            }

            return {
              id: doc.id,
              documentId: doc.id,
              name: doc.file_name,
              source: "workspace",
              status,
              errorMessage,
            };
          });

        if (toAdd.length === 0) return prev;
        return [...prev, ...toAdd];
      });
    },
    [documents]
  );

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const clearFiles = useCallback(() => setFiles([]), []);

  const restoreFiles = useCallback((filesToRestore: AttachedFile[]) => {
    setFiles(filesToRestore);
  }, []);

  return {
    files,
    setFiles,
    restoreFiles,
    inputRef,
    openLocalPicker,
    handleLocalInputChange,
    uploadLocalFiles,
    addWorkspaceDoc,
    addWorkspaceDocs,
    removeFile,
    clearFiles,
  };
}
