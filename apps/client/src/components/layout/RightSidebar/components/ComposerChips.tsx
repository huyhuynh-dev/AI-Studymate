import React from "react";
import { AlertCircle, BookOpen, FileText, Loader2, X } from "lucide-react";
import type { AttachedFile } from "../types";

export function ContextChip({ label, title }: { label: string; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700"
    >
      <BookOpen className="h-3 w-3 shrink-0" />
      <span className="max-w-[140px] truncate">{label}</span>
    </span>
  );
}

interface FileChipProps {
  file: AttachedFile;
  onRemove: (id: string) => void;
}

export function FileChip({ file, onRemove }: FileChipProps) {
  const isUploading = file.status === "uploading";
  const isError = file.status === "error";

  if (isUploading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50/70 py-0.5 pl-2 pr-1 text-[11px] font-medium text-indigo-700">
        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-indigo-600" />
        <span className="max-w-[120px] truncate" title={file.name}>
          {file.name}
        </span>
        <span className="text-[10px] text-indigo-500 font-normal">
          {file.progress !== undefined ? `${file.progress}%` : "..."}
        </span>
        <button
          type="button"
          aria-label={`Hủy tải ${file.name}`}
          onClick={() => onRemove(file.id)}
          className="flex h-4 w-4 cursor-pointer items-center justify-center rounded text-indigo-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
        >
          <X className="h-3 w-3" />
        </button>
      </span>
    );
  }

  if (isError) {
    return (
      <span
        title={file.errorMessage || "Tải lên thất bại"}
        className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50/80 py-0.5 pl-2 pr-1 text-[11px] font-medium text-rose-700"
      >
        <AlertCircle className="h-3 w-3 shrink-0 text-rose-500" />
        <span className="max-w-[120px] truncate" title={file.name}>
          {file.name}
        </span>
        <span className="text-[10px] text-rose-500 font-normal">Lỗi</span>
        <button
          type="button"
          aria-label={`Gỡ ${file.name}`}
          onClick={() => onRemove(file.id)}
          className="flex h-4 w-4 cursor-pointer items-center justify-center rounded text-rose-400 transition-colors hover:bg-rose-100 hover:text-rose-600"
        >
          <X className="h-3 w-3" />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white py-0.5 pl-2 pr-1 text-[11px] font-medium text-gray-700">
      <FileText className="h-3 w-3 shrink-0 text-indigo-500" />
      <span className="max-w-[120px] truncate" title={file.name}>
        {file.name}
      </span>
      <button
        type="button"
        aria-label={`Gỡ ${file.name}`}
        onClick={() => onRemove(file.id)}
        className="flex h-4 w-4 cursor-pointer items-center justify-center rounded text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
