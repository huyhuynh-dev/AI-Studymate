"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  FileText,
  FolderSearch,
  HelpCircle,
  Loader2,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { ASSISTANT_NAME } from "../constants";
import type { ChatMessage } from "../types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { MessageActions } from "./MessageActions";

interface AiMessageProps {
  message: ChatMessage;
  onAddToolOutput?: (params: {
    tool: string;
    toolCallId: string;
    output: unknown;
  }) => void;
  onOpenSummary?: (summaryId: string) => void;
}

interface AskUserQuestionItem {
  id: string;
  question: string;
  options?: string[];
  allowMultiple?: boolean;
  allowCustomInput?: boolean;
}

interface AskUserQuestionCardProps {
  part: any;
  onAddToolOutput?: (params: {
    tool: string;
    toolCallId: string;
    output: unknown;
  }) => void;
}

function AskUserQuestionCard({
  part,
  onAddToolOutput,
}: AskUserQuestionCardProps) {
  const state: string = part.state || "input-available";
  const contextMessage: string = part.input?.contextMessage || "";
  const questions: AskUserQuestionItem[] = Array.isArray(part.input?.questions)
    ? part.input.questions
    : [];

  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string[]>
  >({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [isSubmittedLocal, setIsSubmittedLocal] = useState(false);

  const toggleOption = (qId: string, option: string, allowMultiple?: boolean) => {
    setSelectedOptions((prev) => {
      const current = prev[qId] || [];
      if (allowMultiple) {
        return {
          ...prev,
          [qId]: current.includes(option)
            ? current.filter((item) => item !== option)
            : [...current, option],
        };
      }
      return {
        ...prev,
        [qId]: current.includes(option) ? [] : [option],
      };
    });
  };

  const handleCustomChange = (qId: string, value: string) => {
    setCustomInputs((prev) => ({
      ...prev,
      [qId]: value,
    }));
  };

  const hasAnyAnswer = useMemo(() => {
    return questions.some((q) => {
      const opts = selectedOptions[q.id] || [];
      const custom = (customInputs[q.id] || "").trim();
      return opts.length > 0 || custom.length > 0;
    });
  }, [questions, selectedOptions, customInputs]);

  const handleSubmit = () => {
    if (!onAddToolOutput || !part.toolCallId || isSubmittedLocal) return;

    const answers = questions.map((q) => {
      const opts = selectedOptions[q.id] || [];
      const custom = (customInputs[q.id] || "").trim();
      const combined = [...opts, ...(custom ? [custom] : [])];
      return {
        id: q.id,
        question: q.question,
        selectedOptions: opts,
        customAnswer: custom || undefined,
        answer:
          combined.length > 0 ? combined.join("; ") : "Theo đề xuất mặc định của AI",
      };
    });

    setIsSubmittedLocal(true);
    onAddToolOutput({
      tool: "askUserQuestion",
      toolCallId: part.toolCallId,
      output: { answers },
    });
  };

  if (state === "input-streaming") {
    return (
      <div className="my-2 flex items-center gap-2 rounded-xl border border-indigo-100 bg-white p-3 text-xs text-indigo-700 shadow-2xs">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-600" />
        <span>AI đang chuẩn bị câu hỏi làm rõ yêu cầu…</span>
      </div>
    );
  }

  if (state === "output-available" || isSubmittedLocal) {
    const submittedAnswers: Array<{
      id?: string;
      question?: string;
      answer?: string;
    }> = Array.isArray(part.output?.answers) ? part.output.answers : [];

    return (
      <div className="my-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-xs text-gray-800 shadow-2xs">
        <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span>Đã xác nhận thông tin tóm tắt</span>
        </div>
        {submittedAnswers.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-emerald-100/80 pt-2 text-[11px] text-gray-700">
            {submittedAnswers.map((ans, idx) => (
              <li key={ans.id || idx} className="leading-snug">
                {ans.question && (
                  <span className="font-medium text-gray-600">
                    {ans.question}:{" "}
                  </span>
                )}
                <span className="font-semibold text-gray-900">
                  {ans.answer}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="my-2 space-y-3 rounded-xl border border-indigo-200/80 bg-white p-3.5 text-xs text-gray-800 shadow-xs">
      <div className="flex items-start gap-2">
        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
        <div className="space-y-0.5">
          <div className="font-semibold text-gray-900">
            Làm rõ yêu cầu tóm tắt
          </div>
          {contextMessage && (
            <p className="text-[11px] leading-relaxed text-gray-600">
              {contextMessage}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-gray-100 pt-2.5">
        {questions.map((q, qIdx) => {
          const currentSelected = selectedOptions[q.id] || [];
          const allowCustom = q.allowCustomInput !== false;
          return (
            <div key={q.id || qIdx} className="space-y-1.5">
              <div className="font-medium text-gray-900">
                {questions.length > 1 ? `${qIdx + 1}. ` : ""}
                {q.question}
                {q.allowMultiple && (
                  <span className="ml-1 text-[10px] font-normal text-gray-400">
                    (Có thể chọn nhiều)
                  </span>
                )}
              </div>

              {Array.isArray(q.options) && q.options.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = currentSelected.includes(opt);
                    return (
                      <button
                        key={`${q.id}-opt-${optIdx}`}
                        type="button"
                        onClick={() =>
                          toggleOption(q.id, opt, q.allowMultiple)
                        }
                        className={`cursor-pointer rounded-lg border px-2.5 py-1 text-left text-[11px] font-medium transition-all ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-600 text-white shadow-2xs"
                            : "border-gray-200 bg-gray-50 text-gray-700 hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-700"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {allowCustom && (
                <input
                  type="text"
                  value={customInputs[q.id] || ""}
                  onChange={(e) => handleCustomChange(q.id, e.target.value)}
                  placeholder="Hoặc nhập câu trả lời / yêu cầu riêng của bạn…"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50/70 px-2.5 py-1.5 text-[11px] text-gray-800 placeholder:text-gray-400 focus:border-indigo-400 focus:bg-white focus:outline-none"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!hasAnyAnswer && questions.length > 0}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-2xs transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-3 w-3" />
          <span>Xác nhận & Tiếp tục</span>
        </button>
      </div>
    </div>
  );
}

export const AiMessage = React.memo(function AiMessage({
  message,
  onAddToolOutput,
  onOpenSummary,
}: AiMessageProps) {
  const parts = message.parts;

  // Chuẩn hóa parts để hỗ trợ cả định dạng phẳng lẫn lồng nhau
  const normalizedParts = useMemo(() => {
    if (!parts || parts.length === 0) return [];
    if (
      parts.length > 0 &&
      (parts[0] as any)?.role &&
      Array.isArray((parts[0] as any)?.content)
    ) {
      return (parts[0] as any).content;
    }
    return parts;
  }, [parts]);

  // Trích xuất toàn bộ text để dùng cho hành động Sao chép
  const fullText = useMemo(() => {
    if (normalizedParts && normalizedParts.length > 0) {
      return normalizedParts
        .filter((p: any) => p.type === "text" || typeof p.text === "string")
        .map((p: any) => p.text || "")
        .join("\n\n");
    }
    return message.content || "";
  }, [normalizedParts, message.content]);

  const hasCitation =
    message.hasCitation ||
    (normalizedParts &&
      normalizedParts.some(
        (p: any) =>
          p.type === "source" ||
          ((p.type === "tool-searchDocumentChunks" ||
            p.type === "tool-searchDocuments") &&
            p.state === "output-available" &&
            (p.output?.totalChunks ?? 0) > 0) ||
          (p.type === "tool-getDocumentsFullContent" &&
            p.state === "output-available" &&
            (p.output?.totalDocuments ?? 0) > 0)
      ));

  return (
    <div className="space-y-2">
      {/* Tên trợ lý */}
      <div className="flex items-center gap-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <Bot className="h-3.5 w-3.5" />
        </span>
        <span className="text-xs font-semibold text-gray-900">
          {ASSISTANT_NAME}
        </span>
        {hasCitation && (
          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            Đã trích dẫn
          </span>
        )}
        {message.timestamp && (
          <span className="ml-auto text-[10px] text-gray-400">
            {message.timestamp}
          </span>
        )}
      </div>

      {/* Nội dung */}
      <div className="space-y-2.5 rounded-2xl rounded-tl-sm border border-gray-100 bg-gray-50 px-3.5 py-2.5 text-[13px] leading-[1.3] text-gray-800">
        {/* Render theo Typed Parts (chuẩn Vercel AI SDK 6) */}
        {normalizedParts && normalizedParts.length > 0 ? (
          normalizedParts.map((part: any, index: number) => {
            if (part.type === "text" || typeof part.text === "string") {
              return <MarkdownRenderer key={index} content={part.text || ""} />;
            }

            if (part.type === "reasoning") {
              return (
                <details
                  key={index}
                  className="group my-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5 text-xs text-indigo-900"
                >
                  <summary className="flex cursor-pointer items-center gap-1.5 font-medium select-none">
                    <Brain className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Quá trình suy luận</span>
                    <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2 border-l border-indigo-200 pl-5 leading-relaxed text-gray-700">
                    <MarkdownRenderer
                      content={part.reasoning || part.text || ""}
                    />
                  </div>
                </details>
              );
            }

            // 1. Hiển thị Tool 1: Tìm kiếm đoạn trích cụ thể (searchDocumentChunks / searchDocuments)
            if (
              part.type === "tool-searchDocumentChunks" ||
              part.type === "tool-searchDocuments" ||
              (part.type === "dynamic-tool" &&
                (part.toolName === "searchDocumentChunks" ||
                  part.toolName === "searchDocuments"))
            ) {
              const state: string = part.state || "input-available";
              const isRunning =
                state === "input-streaming" || state === "input-available";
              const isError = state === "output-error";
              const isDone = state === "output-available";

              const semanticQuery: string =
                part.input?.semanticQuery || part.output?.semanticQuery || "";
              const keywords: string[] = Array.isArray(part.input?.keywords)
                ? part.input.keywords
                : Array.isArray(part.output?.keywords)
                  ? part.output.keywords
                  : [];
              const totalChunks: number = part.output?.totalChunks ?? 0;
              const sources: Array<{
                documentId: string;
                fileName: string;
                pageNumbers: number[];
                chunkCount: number;
              }> = Array.isArray(part.output?.sources)
                ? part.output.sources
                : [];

              return (
                <details
                  key={index}
                  className="group my-2 rounded-xl border border-indigo-100 bg-white p-2.5 text-xs text-gray-700 shadow-2xs"
                >
                  <summary className="flex cursor-pointer items-center gap-2 font-medium select-none">
                    {isRunning && (
                      <>
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-600" />
                        <span className="text-indigo-700">
                          Đang tìm kiếm đoạn trích trong tài liệu…
                        </span>
                      </>
                    )}
                    {isDone && (
                      <>
                        <Search className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span className="text-gray-900">
                          {totalChunks > 0
                            ? `Đã tra cứu ${totalChunks} đoạn trích từ tài liệu`
                            : "Đã tra cứu tài liệu (không tìm thấy đoạn khớp)"}
                        </span>
                      </>
                    )}
                    {isError && (
                      <>
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                        <span className="text-red-600">
                          Lỗi khi tra cứu đoạn trích tài liệu
                        </span>
                      </>
                    )}
                    <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
                  </summary>

                  <div className="mt-2.5 space-y-2 border-t border-gray-100 pt-2 text-[11px]">
                    {semanticQuery && (
                      <div>
                        <span className="font-semibold text-gray-600">
                          Truy vấn ngữ nghĩa:{" "}
                        </span>
                        <span className="italic text-gray-800">
                          “{semanticQuery}”
                        </span>
                      </div>
                    )}

                    {keywords.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="font-semibold text-gray-600">
                          Từ khóa:{" "}
                        </span>
                        {keywords.map((kw, kwIdx) => (
                          <span
                            key={`${kw}-${kwIdx}`}
                            className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-700"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}

                    {isDone && sources.length > 0 && (
                      <div className="space-y-1 pt-0.5">
                        <div className="font-semibold text-gray-600">
                          Nguồn tham khảo ({sources.length} tệp):
                        </div>
                        <ul className="space-y-1">
                          {sources.map((src) => (
                            <li
                              key={src.documentId}
                              className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2 py-1 text-gray-700"
                            >
                              <div className="flex min-w-0 items-center gap-1.5">
                                <FileText className="h-3 w-3 shrink-0 text-indigo-500" />
                                <span className="truncate font-medium">
                                  {src.fileName}
                                </span>
                              </div>
                              <span className="shrink-0 text-[10px] text-gray-500">
                                {src.pageNumbers && src.pageNumbers.length > 0
                                  ? `Trang ${src.pageNumbers.join(", ")}`
                                  : `${src.chunkCount} đoạn`}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </details>
              );
            }

            // 2. Hiển thị Tool 2: Đọc toàn bộ nội dung tài liệu (getDocumentsFullContent)
            if (
              part.type === "tool-getDocumentsFullContent" ||
              (part.type === "dynamic-tool" &&
                part.toolName === "getDocumentsFullContent")
            ) {
              const state: string = part.state || "input-available";
              const isRunning =
                state === "input-streaming" || state === "input-available";
              const isError = state === "output-error";
              const isDone = state === "output-available";

              const fetchAllDocuments = Boolean(
                part.input?.fetchAllDocuments ?? part.output?.fetchAllDocuments
              );
              const totalDocuments: number = part.output?.totalDocuments ?? 0;
              const documents: Array<{
                documentId: string;
                fileName: string;
                characterCount: number;
              }> = Array.isArray(part.output?.documents)
                ? part.output.documents
                : [];

              return (
                <details
                  key={index}
                  className="group my-2 rounded-xl border border-indigo-100 bg-white p-2.5 text-xs text-gray-700 shadow-2xs"
                >
                  <summary className="flex cursor-pointer items-center gap-2 font-medium select-none">
                    {isRunning && (
                      <>
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-600" />
                        <span className="text-indigo-700">
                          Đang đọc toàn bộ nội dung tài liệu…
                        </span>
                      </>
                    )}
                    {isDone && (
                      <>
                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span className="text-gray-900">
                          {totalDocuments > 0
                            ? `Đã đọc toàn bộ nội dung ${totalDocuments} tài liệu`
                            : "Đã kiểm tra tài liệu (chưa có văn bản trích xuất)"}
                        </span>
                      </>
                    )}
                    {isError && (
                      <>
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                        <span className="text-red-600">
                          Lỗi khi đọc toàn bộ nội dung tài liệu
                        </span>
                      </>
                    )}
                    <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
                  </summary>

                  <div className="mt-2.5 space-y-2 border-t border-gray-100 pt-2 text-[11px]">
                    <div>
                      <span className="font-semibold text-gray-600">
                        Chế độ đọc:{" "}
                      </span>
                      <span className="text-gray-800">
                        {fetchAllDocuments
                          ? "Toàn bộ tài liệu trong cuộc trò chuyện"
                          : "Tài liệu được chỉ định / đính kèm"}
                      </span>
                    </div>

                    {isDone && documents.length > 0 && (
                      <div className="space-y-1 pt-0.5">
                        <div className="font-semibold text-gray-600">
                          Tài liệu đã nạp ({documents.length} tệp):
                        </div>
                        <ul className="space-y-1">
                          {documents.map((doc) => (
                            <li
                              key={doc.documentId}
                              className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2 py-1 text-gray-700"
                            >
                              <div className="flex min-w-0 items-center gap-1.5">
                                <FileText className="h-3 w-3 shrink-0 text-indigo-500" />
                                <span className="truncate font-medium">
                                  {doc.fileName}
                                </span>
                              </div>
                              <span className="shrink-0 text-[10px] text-gray-500">
                                {Number(doc.characterCount || 0).toLocaleString(
                                  "vi-VN"
                                )}{" "}
                                ký tự
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </details>
              );
            }

            if (part.type === "source") {
              return (
                <div
                  key={index}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-indigo-600"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{part.title || part.url}</span>
                  </div>
                  {part.url && (
                    <a
                      href={part.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 hover:text-indigo-800"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              );
            }

            // 3. Hiển thị Tool 3: Kiểm tra danh sách & metadata tài liệu (getConversationDocumentsMetadata)
            if (
              part.type === "tool-getConversationDocumentsMetadata" ||
              (part.type === "dynamic-tool" &&
                part.toolName === "getConversationDocumentsMetadata")
            ) {
              const state: string = part.state || "input-available";
              const isRunning =
                state === "input-streaming" || state === "input-available";
              const isError = state === "output-error";
              const isDone = state === "output-available";

              const totalDocuments: number = part.output?.totalDocuments ?? 0;
              const readyDocumentsCount: number =
                part.output?.readyDocumentsCount ?? 0;
              const docsList: Array<{
                documentId: string;
                fileName: string;
                ocrStatus: string;
                characterCount: number;
                estimatedPages: number;
              }> = Array.isArray(part.output?.documents)
                ? part.output.documents
                : [];

              return (
                <details
                  key={index}
                  className="group my-2 rounded-xl border border-indigo-100 bg-white p-2.5 text-xs text-gray-700 shadow-2xs"
                >
                  <summary className="flex cursor-pointer items-center gap-2 font-medium select-none">
                    {isRunning && (
                      <>
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-600" />
                        <span className="text-indigo-700">
                          Đang kiểm tra danh sách tài liệu trong cuộc trò chuyện…
                        </span>
                      </>
                    )}
                    {isDone && (
                      <>
                        <FolderSearch className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span className="text-gray-900">
                          Đã kiểm tra {totalDocuments} tài liệu ({readyDocumentsCount} sẵn sàng)
                        </span>
                      </>
                    )}
                    {isError && (
                      <>
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                        <span className="text-red-600">
                          Lỗi khi kiểm tra danh sách tài liệu
                        </span>
                      </>
                    )}
                    <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
                  </summary>

                  {isDone && docsList.length > 0 && (
                    <div className="mt-2.5 space-y-1 border-t border-gray-100 pt-2 text-[11px]">
                      <ul className="space-y-1">
                        {docsList.map((doc) => (
                          <li
                            key={doc.documentId}
                            className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2 py-1 text-gray-700"
                          >
                            <div className="flex min-w-0 items-center gap-1.5">
                              <FileText className="h-3 w-3 shrink-0 text-indigo-500" />
                              <span className="truncate font-medium">
                                {doc.fileName}
                              </span>
                            </div>
                            <span className="shrink-0 text-[10px] text-gray-500">
                              ~{doc.estimatedPages} trang (
                              {Number(doc.characterCount || 0).toLocaleString(
                                "vi-VN"
                              )}{" "}
                              ký tự)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </details>
              );
            }

            // 4. Hiển thị Tool 4: Hỏi người dùng làm rõ yêu cầu (askUserQuestion - Human-in-the-Loop)
            if (
              part.type === "tool-askUserQuestion" ||
              (part.type === "dynamic-tool" &&
                part.toolName === "askUserQuestion")
            ) {
              return (
                <AskUserQuestionCard
                  key={part.toolCallId || index}
                  part={part}
                  onAddToolOutput={onAddToolOutput}
                />
              );
            }

            // 5. Hiển thị Tool 5: Tạo bản tóm tắt tài liệu & Badge mở trực tiếp Tab Tóm tắt (createDocumentSummary)
            if (
              part.type === "tool-createDocumentSummary" ||
              (part.type === "dynamic-tool" &&
                part.toolName === "createDocumentSummary")
            ) {
              const state: string = part.state || "input-available";
              const isRunning =
                state === "input-streaming" || state === "input-available";
              const isError = state === "output-error";
              const isDone = state === "output-available";

              const summaryId: string = part.output?.summaryId || "";
              const summaryTitle: string =
                part.output?.title || "Bản tóm tắt tài liệu";

              if (isRunning) {
                return (
                  <div
                    key={index}
                    className="my-2 flex items-center gap-2.5 rounded-xl border border-indigo-100 bg-white p-3 text-xs text-indigo-700 shadow-2xs"
                  >
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-600" />
                    <div className="space-y-0.5">
                      <div className="font-semibold text-indigo-900">
                        Đang khởi tạo bản tóm tắt học tập bằng AI…
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Quá trình tổng hợp cấu trúc BlockNote có thể mất vài giây
                      </div>
                    </div>
                  </div>
                );
              }

              if (isError) {
                return (
                  <div
                    key={index}
                    className="my-2 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50/60 p-3 text-xs text-red-700"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                    <span>Không thể tạo bản tóm tắt tài liệu. Vui lòng thử lại.</span>
                  </div>
                );
              }

              if (isDone && summaryId) {
                const handleBadgeClick = () => {
                  if (onOpenSummary) {
                    onOpenSummary(summaryId);
                  } else if (typeof window !== "undefined") {
                    window.sessionStorage.setItem(
                      "studymate:open-summary-id",
                      summaryId
                    );
                    window.dispatchEvent(
                      new CustomEvent("studymate:open-summary", {
                        detail: { summaryId },
                      })
                    );
                  }
                };

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={handleBadgeClick}
                    title={`Nhấn để mở "${summaryTitle}" trong Tab Tóm tắt`}
                    className="group my-2 flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-indigo-200/90 bg-gradient-to-r from-indigo-50/90 via-white to-indigo-50/50 px-3.5 py-2.5 text-left shadow-xs transition-all hover:border-indigo-400 hover:shadow-md active:scale-[0.99]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-2xs transition-transform group-hover:scale-105">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                            Bản tóm tắt AI
                          </span>
                          <span className="text-[10px] font-medium text-emerald-600">
                            • Đã tạo thành công
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-xs font-bold text-gray-900 group-hover:text-indigo-700">
                          {summaryTitle}
                        </div>
                      </div>
                    </div>

                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                      <span>Mở</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </button>
                );
              }
            }

            if (part.type === "tool-invocation") {
              const invocation = part.toolInvocation;
              return (
                <div
                  key={index}
                  className="my-2 rounded-xl border border-gray-200 bg-white p-2.5 text-xs text-gray-700"
                >
                  <span className="font-semibold text-gray-900">
                    Công cụ: {invocation?.toolName}
                  </span>
                  <div className="text-[11px] text-gray-500">
                    Trạng thái: {invocation?.state}
                  </div>
                </div>
              );
            }

            return null;
          })
        ) : (
          <MarkdownRenderer content={message.content || ""} />
        )}

        {/* Bullets bổ trợ nếu có */}
        {message.bullets && message.bullets.length > 0 && (
          <ul className="space-y-2">
            {message.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                <p>
                  <span className="font-semibold text-gray-900">{b.title}</span>{" "}
                  <span>{b.desc}</span>
                </p>
              </li>
            ))}
          </ul>
        )}

        {/* Trích dẫn riêng nếu có */}
        {message.citation && (
          <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-indigo-600">
            <div className="flex min-w-0 items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{message.citation}</span>
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
          </div>
        )}
      </div>

      <MessageActions content={fullText} />
    </div>
  );
});

AiMessage.displayName = "AiMessage";
