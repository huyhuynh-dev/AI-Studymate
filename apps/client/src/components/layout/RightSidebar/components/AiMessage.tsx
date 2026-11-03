"use client";

import React, { useMemo } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  Search,
} from "lucide-react";
import { ASSISTANT_NAME } from "../constants";
import type { ChatMessage } from "../types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { MessageActions } from "./MessageActions";

interface AiMessageProps {
  message: ChatMessage;
  onFollowUp?: (prompt: string) => void;
}

export const AiMessage = React.memo(function AiMessage({
  message,
  onFollowUp,
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
      <div className="space-y-3 rounded-2xl rounded-tl-sm border border-gray-100 bg-gray-50 p-3.5 text-[13px] leading-relaxed text-gray-800">
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

      <MessageActions content={fullText} onFollowUp={onFollowUp} />
    </div>
  );
});

AiMessage.displayName = "AiMessage";
