"use client";

import React, { useState } from "react";
import {
  X,
  Sparkles,
  Files,
  FileText,
  Scissors,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  ListOrdered,
  ChevronDown,
} from "lucide-react";
import {
  DocumentItem,
  SummaryScope,
  SummaryMode,
  SummaryLength,
  CreateSummaryRequest,
} from "@/types";

interface SummaryConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (request: CreateSummaryRequest) => void;
  documents: DocumentItem[];
  isSubmitting?: boolean;
}

export default function SummaryConfigModal({
  isOpen,
  onClose,
  onSubmit,
  documents,
  isSubmitting = false,
}: SummaryConfigModalProps) {
  // Lọc các tài liệu đã xử lý thành công (ocr_status === 'done')
  const readyDocs = documents.filter((d) => d.ocr_status === "done");

  const [scope, setScope] = useState<SummaryScope>(
    readyDocs.length > 1 ? "conversation" : "document"
  );
  const [selectedDocId, setSelectedDocId] = useState<string>(
    readyDocs[0]?.id || ""
  );
  const [fromPage, setFromPage] = useState<string>("");
  const [toPage, setToPage] = useState<string>("");
  const [customText, setCustomText] = useState<string>("");
  const [mode, setMode] = useState<SummaryMode>("study_guide");
  const [length, setLength] = useState<SummaryLength>("standard");
  const [customInstruction, setCustomInstruction] = useState<string>("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const request: CreateSummaryRequest = {
      scope,
      mode,
      length,
      customInstruction: customInstruction.trim() || undefined,
    };

    if (scope === "document") {
      request.documentId = selectedDocId || readyDocs[0]?.id;
    } else if (scope === "section") {
      request.documentId = selectedDocId || undefined;
      request.sectionRange = {
        fromPage: fromPage ? parseInt(fromPage, 10) : undefined,
        toPage: toPage ? parseInt(toPage, 10) : undefined,
        customText: customText.trim() || undefined,
      };
    }

    onSubmit(request);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-[24px] bg-white dark:bg-[#161922] shadow-2xl border border-black/[0.06] dark:border-white/[0.1] overflow-hidden animate-in zoom-in-95 duration-200 select-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] px-6 py-4.5 bg-neutral-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
                Thiết lập Tóm tắt Tài liệu AI
              </h2>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                Tối ưu hóa nội dung theo mục tiêu và phong cách học tập của bạn
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* 1. Chọn Nguồn tài liệu (Scope) */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase">
              1. Chọn nguồn tài liệu (Scope)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Option A: Toàn bộ */}
              <button
                type="button"
                onClick={() => setScope("conversation")}
                className={`relative flex flex-col items-start p-3.5 rounded-[16px] border text-left transition-all cursor-pointer ${
                  scope === "conversation"
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-xs"
                    : "border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.12] dark:hover:border-white/[0.15] bg-black/[0.02] dark:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={`p-2 rounded-xl ${scope === "conversation" ? "bg-indigo-600 text-white" : "bg-black/[0.04] dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-400"}`}>
                    <Files className="h-4 w-4" />
                  </div>
                  {scope === "conversation" && <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <span className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100">Toàn bộ tài liệu</span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Tổng hợp {readyDocs.length} tệp đã xử lý
                </span>
              </button>

              {/* Option B: Một tài liệu cụ thể */}
              <button
                type="button"
                onClick={() => setScope("document")}
                className={`relative flex flex-col items-start p-3.5 rounded-[16px] border text-left transition-all cursor-pointer ${
                  scope === "document"
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-xs"
                    : "border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.12] dark:hover:border-white/[0.15] bg-black/[0.02] dark:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={`p-2 rounded-xl ${scope === "document" ? "bg-indigo-600 text-white" : "bg-black/[0.04] dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-400"}`}>
                    <FileText className="h-4 w-4" />
                  </div>
                  {scope === "document" && <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <span className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100">Một tài liệu</span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Tóm tắt riêng 1 file chỉ định
                </span>
              </button>

              {/* Option C: Vùng chọn cụ thể */}
              <button
                type="button"
                onClick={() => setScope("section")}
                className={`relative flex flex-col items-start p-3.5 rounded-[16px] border text-left transition-all cursor-pointer ${
                  scope === "section"
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-xs"
                    : "border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.12] dark:hover:border-white/[0.15] bg-black/[0.02] dark:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={`p-2 rounded-xl ${scope === "section" ? "bg-indigo-600 text-white" : "bg-black/[0.04] dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-400"}`}>
                    <Scissors className="h-4 w-4" />
                  </div>
                  {scope === "section" && <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <span className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100">Vùng chọn cụ thể</span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Khoảng trang hoặc đoạn văn bản
                </span>
              </button>
            </div>

            {/* Sub-inputs when Document is selected */}
            {(scope === "document" || scope === "section") && (
              <div className="pt-2 animate-in fade-in duration-150">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Chọn tệp tài liệu:
                </label>
                <div className="relative">
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1A1E29] px-3.5 py-2.5 pr-10 text-xs sm:text-sm font-medium text-neutral-800 dark:text-neutral-100 shadow-2xs hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-hidden transition-all"
                  >
                    {readyDocs.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.file_name} ({doc.mime_type.includes("pdf") ? "PDF" : "Hình ảnh"})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-3 h-4 w-4 text-neutral-400 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Sub-inputs when Section is selected */}
            {scope === "section" && (
              <div className="rounded-2xl border border-indigo-200/50 dark:border-indigo-800/40 bg-indigo-50/30 dark:bg-indigo-950/20 p-4 space-y-3 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Từ trang số:
                    </label>
                    <input
                      type="number"
                      min={1}
                      placeholder="Ví dụ: 10"
                      value={fromPage}
                      onChange={(e) => setFromPage(e.target.value)}
                      className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1A1E29] px-3 py-2 text-xs sm:text-sm text-neutral-800 dark:text-neutral-100 shadow-2xs focus:border-indigo-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Đến trang số:
                    </label>
                    <input
                      type="number"
                      min={1}
                      placeholder="Ví dụ: 15"
                      value={toPage}
                      onChange={(e) => setToPage(e.target.value)}
                      className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1A1E29] px-3 py-2 text-xs sm:text-sm text-neutral-800 dark:text-neutral-100 shadow-2xs focus:border-indigo-500 outline-hidden"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Hoặc dán đoạn văn bản cần tóm tắt riêng:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Dán đoạn văn bản hoặc nội dung bạn vừa bôi đen vào đây..."
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1A1E29] p-3 text-xs text-neutral-800 dark:text-neutral-100 shadow-2xs focus:border-indigo-500 outline-hidden resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. Kiểu tóm tắt (Summary Mode / Style) */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase">
              2. Kiểu tóm tắt (Style)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Mode A: Key Takeaways */}
              <button
                type="button"
                onClick={() => setMode("key_takeaways")}
                className={`relative flex flex-col items-start p-3.5 rounded-[16px] border text-left transition-all cursor-pointer ${
                  mode === "key_takeaways"
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-xs"
                    : "border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.12] dark:hover:border-white/[0.15] bg-black/[0.02] dark:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={`p-2 rounded-xl ${mode === "key_takeaways" ? "bg-indigo-600 text-white" : "bg-black/[0.04] dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-400"}`}>
                    <ListOrdered className="h-4 w-4" />
                  </div>
                  {mode === "key_takeaways" && <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <span className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100">Dàn ý cốt lõi</span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Gạch đầu dòng ý chính & định nghĩa quan trọng
                </span>
              </button>

              {/* Mode B: Study Guide */}
              <button
                type="button"
                onClick={() => setMode("study_guide")}
                className={`relative flex flex-col items-start p-3.5 rounded-[16px] border text-left transition-all cursor-pointer ${
                  mode === "study_guide"
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-xs"
                    : "border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.12] dark:hover:border-white/[0.15] bg-black/[0.02] dark:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={`p-2 rounded-xl ${mode === "study_guide" ? "bg-indigo-600 text-white" : "bg-black/[0.04] dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-400"}`}>
                    <BookOpen className="h-4 w-4" />
                  </div>
                  {mode === "study_guide" && <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <span className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100">Hồ sơ ôn thi</span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Phân tích sâu, công thức & đối chiếu khái niệm
                </span>
              </button>

              {/* Mode C: Q&A */}
              <button
                type="button"
                onClick={() => setMode("qa_style")}
                className={`relative flex flex-col items-start p-3.5 rounded-[16px] border text-left transition-all cursor-pointer ${
                  mode === "qa_style"
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-xs"
                    : "border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.12] dark:hover:border-white/[0.15] bg-black/[0.02] dark:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={`p-2 rounded-xl ${mode === "qa_style" ? "bg-indigo-600 text-white" : "bg-black/[0.04] dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-400"}`}>
                    <HelpCircle className="h-4 w-4" />
                  </div>
                  {mode === "qa_style" && <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <span className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100">Hỏi & Đáp</span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Trích xuất câu hỏi mấu chốt & câu trả lời
                </span>
              </button>
            </div>
          </div>

          {/* 3. Độ dài mong muốn (Length) - Apple Segmented Control */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase">
              3. Độ dài mong muốn (Length)
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] p-1 border border-black/[0.04] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setLength("short")}
                className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  length === "short"
                    ? "bg-white dark:bg-[#1E2330] text-[#4F46E5] dark:text-[#818CF8] shadow-xs"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                Ngắn gọn (1 trang)
              </button>
              <button
                type="button"
                onClick={() => setLength("standard")}
                className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  length === "standard"
                    ? "bg-white dark:bg-[#1E2330] text-[#4F46E5] dark:text-[#818CF8] shadow-xs"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                Tiêu chuẩn (2–3 trang)
              </button>
              <button
                type="button"
                onClick={() => setLength("detailed")}
                className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  length === "detailed"
                    ? "bg-white dark:bg-[#1E2330] text-[#4F46E5] dark:text-[#818CF8] shadow-xs"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                Chi tiết
              </button>
            </div>
          </div>

          {/* 4. Ghi chú thêm cho AI (Optional) */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Ghi chú thêm cho AI (Tùy chọn):
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Tập trung vào giải thuật đệ quy, bỏ qua phần giới thiệu lịch sử..."
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1A1E29] px-3.5 py-2.5 text-xs sm:text-sm text-neutral-800 dark:text-neutral-100 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-hidden transition-all"
            />
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-black/[0.06] dark:border-white/[0.08] px-6 py-4 bg-neutral-50/50 dark:bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-md shadow-indigo-500/25 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            <span>{isSubmitting ? "Đang chuẩn bị..." : "Bắt đầu tóm tắt"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
