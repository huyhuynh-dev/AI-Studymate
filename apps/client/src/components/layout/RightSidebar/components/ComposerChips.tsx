import React from "react";
import { AlertCircle, BookOpen, FileText, Loader2, X } from "lucide-react";
import type { AttachedFile } from "../types";

export function ContextChip({ label, title }: { label: string; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#C7D2FE] dark:border-[#4F46E5]/30 bg-[#EEF2FF] dark:bg-[#4F46E5]/20 px-2.5 py-1 text-[11px] font-semibold text-[#4F46E5] dark:text-[#818CF8] shadow-2xs"
    >
      <BookOpen className="h-3 w-3 shrink-0 stroke-[2]" />
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
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#C7D2FE] dark:border-[#4F46E5]/30 bg-[#EEF2FF]/80 dark:bg-[#4F46E5]/15 py-0.5 pl-2.5 pr-1.5 text-[11px] font-semibold text-[#4F46E5] dark:text-[#818CF8] shadow-2xs">
        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[#4F46E5]" />
        <span className="max-w-[120px] truncate" title={file.name}>
          {file.name}
        </span>
        <span className="text-[10px] text-[#4F46E5]/80 font-normal">
          {file.progress !== undefined ? `${file.progress}%` : "..."}
        </span>
        <button
          type="button"
          aria-label={`Hủy tải ${file.name}`}
          onClick={() => onRemove(file.id)}
          className="flex h-4 w-4 cursor-pointer items-center justify-center rounded text-[#4F46E5] transition-colors hover:bg-rose-50 hover:text-rose-600"
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
        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/80 dark:bg-rose-950/30 py-0.5 pl-2.5 pr-1.5 text-[11px] font-semibold text-[#BA1A1A] dark:text-rose-400 shadow-2xs"
      >
        <AlertCircle className="h-3 w-3 shrink-0 text-[#BA1A1A]" />
        <span className="max-w-[120px] truncate" title={file.name}>
          {file.name}
        </span>
        <span className="text-[10px] text-[#BA1A1A] font-normal">Lỗi</span>
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
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5EEFF] dark:border-white/[0.1] bg-white dark:bg-[#161922] py-0.5 pl-2.5 pr-1.5 text-[11px] font-semibold text-[#464555] dark:text-[#EFF0F6] shadow-2xs">
      <FileText className="h-3 w-3 shrink-0 text-[#4F46E5] dark:text-[#818CF8]" />
      <span className="max-w-[120px] truncate" title={file.name}>
        {file.name}
      </span>
      <button
        type="button"
        aria-label={`Gỡ ${file.name}`}
        onClick={() => onRemove(file.id)}
        className="flex h-4 w-4 cursor-pointer items-center justify-center rounded text-[#777587] transition-colors hover:bg-rose-50 hover:text-rose-600"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
