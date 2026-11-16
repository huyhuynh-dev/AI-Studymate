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
  FileSearch,
  FileText,
  FolderSearch,
  Globe,
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
import { CollapsibleSourceBar } from "./CollapsibleSourceBar";
import {
  extractCitationsMap,
  sanitizeStreamingCitations,
  type CitationBadgeMeta,
} from "@/lib/citation-parser";

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
      <div className="my-2 flex items-center gap-2 rounded-xl border border-[#C7D2FE] dark:border-[#4F46E5]/30 bg-[#EEF2FF] dark:bg-[#4F46E5]/10 p-3 text-xs text-[#4F46E5] dark:text-[#818CF8] shadow-2xs">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#4F46E5]" />
        <span>AI đang chuẩn bị câu hỏi làm rõ yêu cầu…</span>
      </div>
    );
  }

  if (state === "output-available" || isSubmittedLocal) {
    const isSkipped = Boolean(part.output?.skipped);
    const submittedAnswers: Array<{
      id?: string;
      question?: string;
      answer?: string;
    }> = Array.isArray(part.output?.answers) ? part.output.answers : [];

    return (
      <div className="my-2 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 text-xs text-[#0B1C30] dark:text-[#EFF0F6] shadow-2xs">
        <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{isSkipped ? "Đã bỏ qua câu hỏi gợi ý" : "Đã gửi phản hồi"}</span>
        </div>
        {submittedAnswers.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-emerald-100 dark:border-emerald-900/40 pt-2 text-[11px] text-[#464555] dark:text-neutral-300">
            {submittedAnswers.map((ans, idx) => (
              <li key={ans.id || idx} className="leading-snug">
                {ans.question && (
                  <span className="font-medium text-[#777587] dark:text-neutral-400">
                    {ans.question}:{" "}
                  </span>
                )}
                <span className="font-semibold text-[#0B1C30] dark:text-white">
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
    <div className="my-2 space-y-3 rounded-2xl border border-[#C7D2FE] dark:border-[#4F46E5]/30 bg-white dark:bg-[#161922] p-3.5 text-xs text-[#0B1C30] dark:text-[#EFF0F6] shadow-xs">
      <div className="flex items-start gap-2">
        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5] dark:text-[#818CF8]" />
        <div className="space-y-0.5">
          <div className="font-bold text-[#0B1C30] dark:text-[#EFF0F6]">
            Làm rõ yêu cầu
          </div>
          {contextMessage && (
            <p className="text-[11px] leading-relaxed text-[#777587] dark:text-[#9DA3AF]">
              {contextMessage}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-[#E5EEFF] dark:border-white/[0.08] pt-2.5">
        {questions.map((q, qIdx) => {
          const currentSelected = selectedOptions[q.id] || [];
          const allowCustom = q.allowCustomInput !== false;
          return (
            <div key={q.id || qIdx} className="space-y-1.5">
              <div className="font-semibold text-[#0B1C30] dark:text-[#EFF0F6]">
                {questions.length > 1 ? `${qIdx + 1}. ` : ""}
                {q.question}
                {q.allowMultiple && (
                  <span className="ml-1 text-[10px] font-normal text-[#777587] dark:text-neutral-400">
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
                        className={`cursor-pointer rounded-xl border px-2.5 py-1 text-left text-[11px] font-semibold transition-all active:scale-95 ${
                          isSelected
                            ? "border-[#4F46E5] bg-[#4F46E5] text-white shadow-2xs"
                            : "border-[#E5EEFF] dark:border-white/[0.1] bg-[#F8F9FF] dark:bg-white/[0.03] text-[#464555] dark:text-[#EFF0F6] hover:border-[#C7D2FE] hover:text-[#4F46E5]"
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
                  className="w-full rounded-xl border border-[#E5EEFF] dark:border-white/[0.1] bg-[#F8F9FF] dark:bg-white/[0.03] px-3 py-1.5 text-[11px] text-[#0B1C30] dark:text-white placeholder-[#777587] focus:border-[#4F46E5] focus:bg-white dark:focus:bg-black focus:outline-none transition-all"
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
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4F46E5] px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-xs transition-all hover:bg-[#3525CD] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
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

  // Kiểm tra xem message có ít nhất một part có thể hiển thị nội dung hay không
  // (tránh trường hợp chỉ có duy nhất các part kỹ thuật như step-start khiến fallback content bị chặn)
  const hasDisplayableParts = useMemo(() => {
    if (!normalizedParts || normalizedParts.length === 0) return false;
    return normalizedParts.some(
      (p: any) =>
        (p.type === "text" && typeof p.text === "string" && p.text.trim().length > 0) ||
        p.type === "reasoning" ||
        (typeof p.type === "string" && p.type.startsWith("tool-")) ||
        p.type === "dynamic-tool" ||
        p.type === "tool-invocation" ||
        p.type === "source"
    );
  }, [normalizedParts]);

  // 1. Bản đồ dữ liệu trích dẫn chi tiết
  const citationMap = useMemo(() => extractCitationsMap(message), [message]);

  // 2. Xử lý đánh số tuần tự [1], [2]... cho tất cả text parts của message
  const { formattedParts, formattedContentFallback, allCitedList } = useMemo(() => {
    const allocatedNumbers = new Map<string, number>();
    const metaMap = new Map<string, CitationBadgeMeta>();
    const citedList: CitationBadgeMeta[] = [];
    let nextDisplayIndex = 1;

    const formatText = (raw: string) => {
      const sanitized = sanitizeStreamingCitations(raw || "", false);
      const normalized = sanitized.replace(/\]\s*\[(?=[cw]\d)/gi, "] [");
      return normalized.replace(
        /\[\s*([cw]\d+(?:\s*,\s*[cw]\d+)*)\s*\]/gi,
        (_fullMatch, innerGroup: string) => {
          const ids = innerGroup
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter((s) => /^[cw]\d+$/.test(s));

          if (ids.length === 0) return _fullMatch;

          const badges = ids.map((id) => {
            let displayNum = allocatedNumbers.get(id);
            if (!displayNum) {
              displayNum = nextDisplayIndex++;
              allocatedNumbers.set(id, displayNum);

              const item = citationMap.get(id);
              const sourceType = id.startsWith("w") ? "web" : "document";

              const meta: CitationBadgeMeta = {
                displayNumber: displayNum,
                citationId: id,
                sourceType: item?.sourceType || (sourceType as any),
                item,
              };

              metaMap.set(id, meta);
              citedList.push(meta);
            }

            return `[${displayNum}](#citation-${id})`;
          });

          return badges.join(" ");
        }
      );
    };

    if (!hasDisplayableParts) {
      return {
        formattedParts: null,
        formattedContentFallback: formatText(message.content || ""),
        allCitedList: citedList,
      };
    }

    const partsWithFormattedText = normalizedParts.map((p: any) => {
      if (p.type === "text" || typeof p.text === "string") {
        return {
          ...p,
          _formattedText: formatText(p.text || ""),
        };
      }
      return p;
    });

    return {
      formattedParts: partsWithFormattedText,
      formattedContentFallback: null,
      allCitedList: citedList,
    };
  }, [message, normalizedParts, hasDisplayableParts, citationMap]);

  const hasCitation =
    message.hasCitation ||
    allCitedList.length > 0 ||
    (normalizedParts &&
      normalizedParts.some(
        (p: any) =>
          p.type === "source" ||
          ((p.type === "tool-searchDocumentChunks" ||
            p.type === "tool-searchDocuments") &&
            p.state === "output-available" &&
            (p.output?.totalChunks ?? 0) > 0) ||
          (p.type === "tool-getDocumentSectionOrPages" &&
            p.state === "output-available" &&
            (p.output?.totalChunks ?? 0) > 0) ||
          (p.type === "tool-getDocumentsFullContent" &&
            p.state === "output-available" &&
            (p.output?.totalDocuments ?? 0) > 0) ||
          (p.type === "tool-searchInternet" &&
            p.state === "output-available" &&
            (p.output?.totalResults ?? 0) > 0) ||
          (p.type === "tool-extractWebPage" &&
            p.state === "output-available" &&
            (p.output?.totalSuccess ?? 0) > 0)
      )) ||
    (Array.isArray(message.metadata?.citations) &&
      message.metadata.citations.length > 0);

  return (
    <div className="space-y-2 select-text">
      {/* Tên trợ lý */}
      <div className="flex items-center gap-2 select-none">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#EEF2FF] dark:bg-[#4F46E5]/20 text-[#4F46E5] dark:text-[#818CF8] shadow-2xs">
          <Bot className="h-3.5 w-3.5 stroke-[2]" />
        </span>
        <span className="text-xs font-bold text-[#0B1C30] dark:text-[#EFF0F6]">
          {ASSISTANT_NAME}
        </span>
        {hasCitation && (
          <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
            Đã trích dẫn
          </span>
        )}
        {message.timestamp && (
          <span className="ml-auto text-[10px] text-[#777587] dark:text-neutral-500 font-medium">
            {message.timestamp}
          </span>
        )}
      </div>

      {/* Nội dung */}
      <div className="space-y-2.5 rounded-[20px] rounded-tl-[4px] border border-[#E5EEFF] dark:border-white/[0.08] bg-white dark:bg-[#161922] px-4 py-3 text-[13.5px] leading-relaxed text-[#0B1C30] dark:text-[#EFF0F6] shadow-xs">
        {/* Render theo Typed Parts (chuẩn Vercel AI SDK) */}
        {hasDisplayableParts ? (
          (formattedParts || normalizedParts).map((part: any, index: number) => {
            if (part.type === "text" || typeof part.text === "string") {
              return (
                <MarkdownRenderer
                  key={index}
                  content={part._formattedText || part.text || ""}
                  citationMap={citationMap}
                />
              );
            }

            if (part.type === "reasoning") {
              return (
                <details
                  key={index}
                  className="group my-2 rounded-xl border border-[#C7D2FE] dark:border-[#4F46E5]/30 bg-[#EEF2FF]/60 dark:bg-[#4F46E5]/10 p-2.5 text-xs text-[#3525CD] dark:text-[#A5B4FC]"
                >
                  <summary className="flex cursor-pointer items-center gap-1.5 font-semibold select-none">
                    <Brain className="h-3.5 w-3.5 text-[#4F46E5] dark:text-[#818CF8]" />
                    <span>Quá trình suy luận</span>
                    <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2 border-l-2 border-[#C7D2FE] dark:border-[#4F46E5]/40 pl-3 leading-relaxed text-[#464555] dark:text-neutral-300">
                    <MarkdownRenderer
                      content={part.reasoning || part.text || ""}
                    />
                  </div>
                </details>
              );
            }

            // 1. Tool 1: Tìm kiếm đoạn trích cụ thể (searchDocumentChunks / searchDocuments)
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
                  className="group my-2 rounded-xl border border-[#E5EEFF] dark:border-white/[0.08] bg-[#F8F9FF] dark:bg-white/[0.03] p-2.5 text-xs text-[#464555] dark:text-[#EFF0F6] shadow-2xs"
                >
                  <summary className="flex cursor-pointer items-center gap-2 font-semibold select-none">
                    {isRunning && (
                      <>
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#4F46E5]" />
                        <span className="text-[#4F46E5] dark:text-[#818CF8]">
                          Đang tìm kiếm đoạn trích trong tài liệu…
                        </span>
                      </>
                    )}
                    {isDone && (
                      <>
                        <Search className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[#0B1C30] dark:text-white">
                          {totalChunks > 0
                            ? `Đã tra cứu ${totalChunks} đoạn trích từ tài liệu`
                            : "Đã tra cứu tài liệu (không tìm thấy đoạn khớp)"}
                        </span>
                      </>
                    )}
                    {isError && (
                      <>
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                        <span className="text-rose-600 dark:text-rose-400">
                          Lỗi khi tra cứu đoạn trích tài liệu
                        </span>
                      </>
                    )}
                    <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[#777587] transition-transform group-open:rotate-180" />
                  </summary>

                  <div className="mt-2.5 space-y-2 border-t border-[#E5EEFF] dark:border-white/[0.08] pt-2 text-[11px]">
                    {semanticQuery && (
                      <div>
                        <span className="font-semibold text-[#777587] dark:text-neutral-400">
                          Truy vấn ngữ nghĩa:{" "}
                        </span>
                        <span className="italic text-[#0B1C30] dark:text-neutral-200">
                          “{semanticQuery}”
                        </span>
                      </div>
                    )}

                    {keywords.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="font-semibold text-[#777587] dark:text-neutral-400">
                          Từ khóa:{" "}
                        </span>
                        {keywords.map((kw, kwIdx) => (
                          <span
                            key={`${kw}-${kwIdx}`}
                            className="rounded-md bg-[#EEF2FF] dark:bg-[#4F46E5]/20 px-1.5 py-0.5 font-semibold text-[#4F46E5] dark:text-[#818CF8]"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}

                    {isDone && sources.length > 0 && (
                      <div className="space-y-1 pt-0.5">
                        <div className="font-semibold text-[#777587] dark:text-neutral-400">
                          Nguồn tham khảo ({sources.length} tệp):
                        </div>
                        <ul className="space-y-1">
                          {sources.map((src) => (
                            <li
                              key={src.documentId}
                              className="flex items-center justify-between gap-2 rounded-lg bg-white dark:bg-[#12151C] border border-[#E5EEFF] dark:border-white/[0.08] px-2 py-1 text-[#464555] dark:text-neutral-300"
                            >
                              <div className="flex min-w-0 items-center gap-1.5">
                                <FileText className="h-3 w-3 shrink-0 text-[#4F46E5]" />
                                <span className="truncate font-medium">
                                  {src.fileName}
                                </span>
                              </div>
                              <span className="shrink-0 text-[10px] text-[#777587]">
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

            // 1b. Tool: Đọc phân đoạn hoặc trang cụ thể (getDocumentSectionOrPages)
            if (
              part.type === "tool-getDocumentSectionOrPages" ||
              (part.type === "dynamic-tool" &&
                part.toolName === "getDocumentSectionOrPages")
            ) {
              const state: string = part.state || "input-available";
              const isRunning =
                state === "input-streaming" || state === "input-available";
              const isError = state === "output-error";
              const isDone = state === "output-available";

              const fileName: string = part.output?.fileName || "";
              const totalChunks: number = part.output?.totalChunks ?? 0;
              const pageNumbers: number[] = Array.isArray(part.input?.pageNumbers)
                ? part.input.pageNumbers
                : [];
              const headingKeyword: string = part.input?.headingKeyword || "";

              return (
                <details
                  key={index}
                  className="group my-2 rounded-xl border border-[#E5EEFF] dark:border-white/[0.08] bg-[#F8F9FF] dark:bg-white/[0.03] p-2.5 text-xs text-[#464555] dark:text-[#EFF0F6] shadow-2xs"
                >
                  <summary className="flex cursor-pointer items-center gap-2 font-semibold select-none">
                    {isRunning && (
                      <>
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#4F46E5]" />
                        <span className="text-[#4F46E5] dark:text-[#818CF8]">
                          Đang đọc phân đoạn tài liệu…
                        </span>
                      </>
                    )}
                    {isDone && (
                      <>
                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[#0B1C30] dark:text-white">
                          {totalChunks > 0
                            ? `Đã đọc ${totalChunks} phân đoạn từ "${fileName || "tài liệu"}"`
                            : `Đã kiểm tra tài liệu "${fileName || ""}"`}
                        </span>
                      </>
                    )}
                    {isError && (
                      <>
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                        <span className="text-rose-600 dark:text-rose-400">
                          Lỗi khi đọc phân đoạn tài liệu
                        </span>
                      </>
                    )}
                    <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[#777587] transition-transform group-open:rotate-180" />
                  </summary>

                  <div className="mt-2.5 space-y-1.5 border-t border-[#E5EEFF] dark:border-white/[0.08] pt-2 text-[11px]">
                    {fileName && (
                      <div>
                        <span className="font-semibold text-[#777587] dark:text-neutral-400">
                          Tệp:{" "}
                        </span>
                        <span className="font-medium text-[#0B1C30] dark:text-neutral-200">
                          {fileName}
                        </span>
                      </div>
                    )}
                    {pageNumbers.length > 0 && (
                      <div>
                        <span className="font-semibold text-[#777587] dark:text-neutral-400">
                          Trang yêu cầu:{" "}
                        </span>
                        <span className="text-[#0B1C30] dark:text-neutral-200">
                          Trang {pageNumbers.join(", ")}
                        </span>
                      </div>
                    )}
                    {headingKeyword && (
                      <div>
                        <span className="font-semibold text-[#777587] dark:text-neutral-400">
                          Tiêu đề/Mục:{" "}
                        </span>
                        <span className="italic text-[#0B1C30] dark:text-neutral-200">
                          “{headingKeyword}”
                        </span>
                      </div>
                    )}
                  </div>
                </details>
              );
            }

            // 1c. Tool: Tìm kiếm thông tin trên Internet (searchInternet)
            if (
              part.type === "tool-searchInternet" ||
              (part.type === "dynamic-tool" && part.toolName === "searchInternet")
            ) {
              const state: string = part.state || "input-available";
              const isRunning =
                state === "input-streaming" || state === "input-available";
              const isError = state === "output-error";
              const isDone = state === "output-available";

              const query: string =
                part.input?.query || part.output?.query || "";
              const topic: string = part.input?.topic || "general";
              const searchDepth: string = part.input?.searchDepth || "basic";
              const totalResults: number = part.output?.totalResults ?? 0;
              const results: Array<{
                citationId: string;
                title: string;
                url: string;
                domain: string;
                favicon?: string;
                publishedDate?: string;
                contentSnippet: string;
                previewSnippet?: string;
              }> = Array.isArray(part.output?.results) ? part.output.results : [];

              return (
                <details
                  key={index}
                  className="group my-2 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/40 dark:bg-blue-950/10 p-2.5 text-xs text-[#464555] dark:text-[#EFF0F6] shadow-2xs"
                >
                  <summary className="flex cursor-pointer items-center gap-2 font-semibold select-none">
                    {isRunning && (
                      <>
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
                        <span className="text-blue-600 dark:text-blue-400">
                          Đang tìm kiếm thông tin trên Internet…
                        </span>
                      </>
                    )}
                    {isDone && (
                      <>
                        <Globe className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span className="text-[#0B1C30] dark:text-white">
                          {totalResults > 0
                            ? `Đã tra cứu ${totalResults} nguồn từ Internet`
                            : "Đã tìm kiếm Internet (không có kết quả)"}
                        </span>
                      </>
                    )}
                    {isError && (
                      <>
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                        <span className="text-rose-600 dark:text-rose-400">
                          Lỗi khi tìm kiếm trên Internet
                        </span>
                      </>
                    )}
                    <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[#777587] transition-transform group-open:rotate-180" />
                  </summary>

                  <div className="mt-2.5 space-y-2 border-t border-blue-100 dark:border-blue-900/30 pt-2 text-[11px]">
                    {query && (
                      <div>
                        <span className="font-semibold text-[#777587] dark:text-neutral-400">
                          Từ khóa tìm kiếm:{" "}
                        </span>
                        <span className="italic text-[#0B1C30] dark:text-neutral-200">
                          “{query}”
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      {topic !== "general" && (
                        <span className="rounded-md bg-blue-100/70 dark:bg-blue-900/40 px-1.5 py-0.5 font-medium text-blue-700 dark:text-blue-300">
                          Chủ đề: {topic === "news" ? "Tin tức" : topic === "finance" ? "Tài chính" : topic}
                        </span>
                      )}
                      {searchDepth === "advanced" && (
                        <span className="rounded-md bg-indigo-100/70 dark:bg-indigo-900/40 px-1.5 py-0.5 font-medium text-indigo-700 dark:text-indigo-300">
                          Tìm kiếm chuyên sâu (advanced)
                        </span>
                      )}
                    </div>

                    {isDone && results.length > 0 && (
                      <div className="space-y-1.5 pt-0.5">
                        <div className="font-semibold text-[#777587] dark:text-neutral-400">
                          Nguồn web đã tham khảo ({results.length} liên kết):
                        </div>
                        <ul className="space-y-1.5">
                          {results.map((res, rIdx) => (
                            <li
                              key={`${res.url}-${rIdx}`}
                              className="rounded-lg bg-white dark:bg-[#12151C] border border-blue-100 dark:border-white/[0.08] p-2 text-[#464555] dark:text-neutral-300 shadow-2xs hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <a
                                  href={res.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex min-w-0 items-center gap-1.5 font-semibold text-[#0B1C30] dark:text-white hover:text-blue-600 dark:hover:text-blue-400 group/link"
                                >
                                  {res.favicon ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={res.favicon}
                                      alt=""
                                      className="h-3.5 w-3.5 shrink-0 rounded-xs"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <Globe className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                                  )}
                                  <span className="truncate">{res.title}</span>
                                  <ArrowUpRight className="h-3 w-3 shrink-0 text-[#777587] group-hover/link:text-blue-600" />
                                </a>
                                <span className="shrink-0 text-[10px] text-[#777587] font-medium">
                                  {res.domain}
                                </span>
                              </div>
                              {(res.previewSnippet || res.contentSnippet) && (
                                <p className="mt-1 line-clamp-2 text-[11px] text-[#555] dark:text-neutral-400 leading-normal">
                                  {res.previewSnippet || res.contentSnippet}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </details>
              );
            }

            // 1d. Tool: Bóc tách nội dung chi tiết từ Web (extractWebPage)
            if (
              part.type === "tool-extractWebPage" ||
              (part.type === "dynamic-tool" && part.toolName === "extractWebPage")
            ) {
              const state: string = part.state || "input-available";
              const isRunning =
                state === "input-streaming" || state === "input-available";
              const isError = state === "output-error";
              const isDone = state === "output-available";

              const query: string =
                part.input?.query || part.output?.query || "";
              const totalSuccess: number = part.output?.totalSuccess ?? 0;
              const results: Array<{
                citationId: string;
                title: string;
                url: string;
                domain: string;
                favicon?: string;
                extractedContent: string;
                previewSnippet?: string;
              }> = Array.isArray(part.output?.results) ? part.output.results : [];
              const failedResults: Array<{ url: string; error: string }> =
                Array.isArray(part.output?.failedResults)
                  ? part.output.failedResults
                  : [];

              return (
                <details
                  key={index}
                  className="group my-2 rounded-xl border border-sky-100 dark:border-sky-900/30 bg-sky-50/40 dark:bg-sky-950/10 p-2.5 text-xs text-[#464555] dark:text-[#EFF0F6] shadow-2xs"
                >
                  <summary className="flex cursor-pointer items-center gap-2 font-semibold select-none">
                    {isRunning && (
                      <>
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-600 dark:text-sky-400" />
                        <span className="text-sky-600 dark:text-sky-400">
                          Đang đọc sâu nội dung trang web…
                        </span>
                      </>
                    )}
                    {isDone && (
                      <>
                        <FileSearch className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                        <span className="text-[#0B1C30] dark:text-white">
                          {totalSuccess > 0
                            ? `Đã bóc tách nội dung ${totalSuccess} trang web`
                            : "Không thể bóc tách nội dung trang web"}
                        </span>
                      </>
                    )}
                    {isError && (
                      <>
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                        <span className="text-rose-600 dark:text-rose-400">
                          Lỗi khi bóc tách nội dung trang web
                        </span>
                      </>
                    )}
                    <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[#777587] transition-transform group-open:rotate-180" />
                  </summary>

                  <div className="mt-2.5 space-y-2 border-t border-sky-100 dark:border-sky-900/30 pt-2 text-[11px]">
                    {query && (
                      <div>
                        <span className="font-semibold text-[#777587] dark:text-neutral-400">
                          Mục tiêu trích xuất:{" "}
                        </span>
                        <span className="italic text-[#0B1C30] dark:text-neutral-200">
                          “{query}”
                        </span>
                      </div>
                    )}

                    {isDone && results.length > 0 && (
                      <div className="space-y-1.5 pt-0.5">
                        <div className="font-semibold text-[#777587] dark:text-neutral-400">
                          Trang web đã đọc chi tiết ({results.length}):
                        </div>
                        <ul className="space-y-1.5">
                          {results.map((res, rIdx) => (
                            <li
                              key={`${res.url}-${rIdx}`}
                              className="rounded-lg bg-white dark:bg-[#12151C] border border-sky-100 dark:border-white/[0.08] p-2 text-[#464555] dark:text-neutral-300 shadow-2xs hover:border-sky-300 dark:hover:border-sky-700 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <a
                                  href={res.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex min-w-0 items-center gap-1.5 font-semibold text-[#0B1C30] dark:text-white hover:text-sky-600 dark:hover:text-sky-400 group/link"
                                >
                                  {res.favicon ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={res.favicon}
                                      alt=""
                                      className="h-3.5 w-3.5 shrink-0 rounded-xs"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <Globe className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                                  )}
                                  <span className="truncate">{res.title}</span>
                                  <ArrowUpRight className="h-3 w-3 shrink-0 text-[#777587] group-hover/link:text-sky-600" />
                                </a>
                                <span className="shrink-0 text-[10px] text-[#777587] font-medium">
                                  {res.domain}
                                </span>
                              </div>
                              {res.previewSnippet && (
                                <p className="mt-1 line-clamp-2 text-[11px] text-[#555] dark:text-neutral-400 leading-normal">
                                  {res.previewSnippet}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {isDone && failedResults.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <div className="font-semibold text-rose-600 dark:text-rose-400">
                          Trang web không thể truy cập ({failedResults.length}):
                        </div>
                        <ul className="space-y-1">
                          {failedResults.map((f, fIdx) => (
                            <li
                              key={`${f.url}-${fIdx}`}
                              className="flex items-center justify-between gap-2 rounded-lg bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 px-2 py-1 text-[11px] text-rose-700 dark:text-rose-300"
                            >
                              <span className="truncate font-mono text-[10px]">
                                {f.url}
                              </span>
                              <span className="shrink-0 font-medium">
                                {f.error}
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

            // 2. Tool 2: Đọc toàn bộ nội dung tài liệu (getDocumentsFullContent)
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
                  className="group my-2 rounded-xl border border-[#E5EEFF] dark:border-white/[0.08] bg-[#F8F9FF] dark:bg-white/[0.03] p-2.5 text-xs text-[#464555] dark:text-[#EFF0F6] shadow-2xs"
                >
                  <summary className="flex cursor-pointer items-center gap-2 font-semibold select-none">
                    {isRunning && (
                      <>
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#4F46E5]" />
                        <span className="text-[#4F46E5] dark:text-[#818CF8]">
                          Đang đọc toàn bộ nội dung tài liệu…
                        </span>
                      </>
                    )}
                    {isDone && (
                      <>
                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[#0B1C30] dark:text-white">
                          {totalDocuments > 0
                            ? `Đã nạp toàn bộ nội dung ${totalDocuments} tài liệu`
                            : "Đã kiểm tra tài liệu (chưa có văn bản trích xuất)"}
                        </span>
                      </>
                    )}
                    {isError && (
                      <>
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                        <span className="text-rose-600 dark:text-rose-400">
                          Lỗi khi đọc toàn bộ nội dung tài liệu
                        </span>
                      </>
                    )}
                    <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[#777587] transition-transform group-open:rotate-180" />
                  </summary>

                  <div className="mt-2.5 space-y-2 border-t border-[#E5EEFF] dark:border-white/[0.08] pt-2 text-[11px]">
                    <div>
                      <span className="font-semibold text-[#777587] dark:text-neutral-400">
                        Chế độ đọc:{" "}
                      </span>
                      <span className="text-[#0B1C30] dark:text-neutral-200">
                        {fetchAllDocuments
                          ? "Toàn bộ tài liệu trong phiên học"
                          : "Tài liệu được chỉ định"}
                      </span>
                    </div>

                    {isDone && documents.length > 0 && (
                      <div className="space-y-1 pt-0.5">
                        <div className="font-semibold text-[#777587] dark:text-neutral-400">
                          Tài liệu đã nạp ({documents.length} tệp):
                        </div>
                        <ul className="space-y-1">
                          {documents.map((doc) => (
                            <li
                              key={doc.documentId}
                              className="flex items-center justify-between gap-2 rounded-lg bg-white dark:bg-[#12151C] border border-[#E5EEFF] dark:border-white/[0.08] px-2 py-1 text-[#464555] dark:text-neutral-300"
                            >
                              <div className="flex min-w-0 items-center gap-1.5">
                                <FileText className="h-3 w-3 shrink-0 text-[#4F46E5]" />
                                <span className="truncate font-medium">
                                  {doc.fileName}
                                </span>
                              </div>
                              <span className="shrink-0 text-[10px] text-[#777587]">
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
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#E5EEFF] dark:border-white/[0.08] bg-[#F8F9FF] dark:bg-white/[0.03] px-3 py-2 text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8]"
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
                      className="shrink-0 hover:text-[#3525CD]"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              );
            }

            // 3. Tool 3: Kiểm tra danh sách & metadata tài liệu
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
                  className="group my-2 rounded-xl border border-[#E5EEFF] dark:border-white/[0.08] bg-[#F8F9FF] dark:bg-white/[0.03] p-2.5 text-xs text-[#464555] dark:text-[#EFF0F6] shadow-2xs"
                >
                  <summary className="flex cursor-pointer items-center gap-2 font-semibold select-none">
                    {isRunning && (
                      <>
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#4F46E5]" />
                        <span className="text-[#4F46E5] dark:text-[#818CF8]">
                          Đang kiểm tra danh sách tài liệu…
                        </span>
                      </>
                    )}
                    {isDone && (
                      <>
                        <FolderSearch className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[#0B1C30] dark:text-white">
                          Đã kiểm tra {totalDocuments} tài liệu ({readyDocumentsCount} sẵn sàng)
                        </span>
                      </>
                    )}
                    {isError && (
                      <>
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                        <span className="text-rose-600 dark:text-rose-400">
                          Lỗi khi kiểm tra danh sách tài liệu
                        </span>
                      </>
                    )}
                    <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[#777587] transition-transform group-open:rotate-180" />
                  </summary>

                  {isDone && docsList.length > 0 && (
                    <div className="mt-2.5 space-y-1 border-t border-[#E5EEFF] dark:border-white/[0.08] pt-2 text-[11px]">
                      <ul className="space-y-1">
                        {docsList.map((doc) => (
                          <li
                            key={doc.documentId}
                            className="flex items-center justify-between gap-2 rounded-lg bg-white dark:bg-[#12151C] border border-[#E5EEFF] dark:border-white/[0.08] px-2 py-1 text-[#464555] dark:text-neutral-300"
                          >
                            <div className="flex min-w-0 items-center gap-1.5">
                              <FileText className="h-3 w-3 shrink-0 text-[#4F46E5]" />
                              <span className="truncate font-medium">
                                {doc.fileName}
                              </span>
                            </div>
                            <span className="shrink-0 text-[10px] text-[#777587]">
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

            // 4. Tool 4: Hỏi người dùng làm rõ yêu cầu (askUserQuestion)
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

            // 5. Tool 5: Tạo bản tóm tắt tài liệu & Badge mở trực tiếp Tab Tóm tắt
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
                    className="my-2 flex items-center gap-2.5 rounded-2xl border border-[#C7D2FE] dark:border-[#4F46E5]/30 bg-[#EEF2FF] dark:bg-[#4F46E5]/10 p-3.5 text-xs text-[#4F46E5] dark:text-[#818CF8] shadow-2xs"
                  >
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#4F46E5]" />
                    <div className="space-y-0.5">
                      <div className="font-bold text-[#3525CD] dark:text-white">
                        Đang khởi tạo bản tóm tắt học tập bằng AI…
                      </div>
                      <div className="text-[11px] text-[#777587] dark:text-neutral-400">
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
                    className="my-2 flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20 p-3 text-xs text-[#BA1A1A] dark:text-rose-400"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
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
                    className="group my-2 flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[#C7D2FE] dark:border-[#4F46E5]/40 bg-gradient-to-r from-[#EEF2FF] via-white to-[#EEF2FF] dark:from-[#4F46E5]/20 dark:via-[#161922] dark:to-[#4F46E5]/10 p-3.5 text-left shadow-xs transition-all hover:border-[#4F46E5] hover:shadow-md active:scale-[0.99]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5] text-white shadow-xs transition-transform group-hover:scale-105">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-md bg-[#EEF2FF] dark:bg-[#4F46E5]/30 px-1.5 py-0.5 text-[10px] font-bold text-[#4F46E5] dark:text-[#818CF8]">
                            Bản tóm tắt AI
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            • Đã hoàn thành
                          </span>
                        </div>
                        <div className="mt-1 truncate text-xs font-bold text-[#0B1C30] dark:text-white group-hover:text-[#4F46E5]">
                          {summaryTitle}
                        </div>
                      </div>
                    </div>

                    <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-white dark:bg-[#12151C] border border-[#E5EEFF] dark:border-white/[0.1] px-2.5 py-1 text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8] transition-colors group-hover:bg-[#4F46E5] group-hover:text-white shadow-2xs">
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
                  className="my-2 rounded-xl border border-[#E5EEFF] dark:border-white/[0.08] bg-[#F8F9FF] dark:bg-white/[0.03] p-2.5 text-xs text-[#464555] dark:text-neutral-300"
                >
                  <span className="font-semibold text-[#0B1C30] dark:text-white">
                    Công cụ: {invocation?.toolName}
                  </span>
                  <div className="text-[11px] text-[#777587]">
                    Trạng thái: {invocation?.state}
                  </div>
                </div>
              );
            }

            return null;
          })
        ) : (
          <MarkdownRenderer
            content={formattedContentFallback || message.content || ""}
            citationMap={citationMap}
          />
        )}

        {/* Bullets bổ trợ nếu có */}
        {message.bullets && message.bullets.length > 0 && (
          <ul className="space-y-2">
            {message.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" />
                <p>
                  <span className="font-bold text-[#0B1C30] dark:text-white">{b.title}</span>{" "}
                  <span>{b.desc}</span>
                </p>
              </li>
            ))}
          </ul>
        )}

        {/* Thanh tổng hợp nguồn trích dẫn thu gọn (Collapsible Source Bar) */}
        {allCitedList.length > 0 && (
          <CollapsibleSourceBar citedList={allCitedList} />
        )}

        {/* Trích dẫn riêng nếu có */}
        {message.citation && (
          <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#E5EEFF] dark:border-white/[0.08] bg-[#F8F9FF] dark:bg-white/[0.03] px-3 py-2 text-xs font-semibold text-[#4F46E5]">
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
