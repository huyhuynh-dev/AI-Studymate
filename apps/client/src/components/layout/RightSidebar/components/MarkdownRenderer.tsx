"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";
import "katex/dist/katex.min.css";

interface CodeBlockProps {
  language?: string;
  value: string;
}

function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy error
    }
  };

  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-gray-800 bg-gray-950 text-gray-100 shadow-xs">
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/90 px-3.5 py-1.5 text-[11px] text-gray-400">
        <span className="font-mono lowercase">{language || "text"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors hover:bg-gray-800 hover:text-gray-200"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Đã chép</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Sao chép</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto text-[12px] leading-relaxed font-mono">
        <SyntaxHighlighter
          language={language || "text"}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: "0.75rem 0.875rem",
            background: "transparent",
            fontSize: "12px",
            lineHeight: "1.5",
          }}
          codeTagProps={{
            style: {
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            },
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export const MarkdownRenderer = React.memo(function MarkdownRenderer({
  content,
}: {
  content: string;
}) {
  return (
    <div className="prose prose-sm max-w-none text-inherit">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { output: "htmlAndMathml", throwOnError: false }]]}
        components={{
          table: ({ children }) => (
            <div className="my-2.5 overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full border-collapse text-left text-xs text-gray-800">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-gray-200 bg-gray-100/70 font-semibold text-gray-900">
              {children}
            </thead>
          ),
          th: ({ children }) => <th className="px-3 py-2">{children}</th>,
          td: ({ children }) => (
            <td className="border-t border-gray-100 px-3 py-2">{children}</td>
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");
            const isInline = !match && !codeString.includes("\n");

            if (isInline) {
              return (
                <code
                  className="rounded bg-gray-200/70 px-1 py-0.5 font-mono text-[12px] font-medium text-indigo-950"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock
                language={match ? match[1] : undefined}
                value={codeString}
              />
            );
          },
          ul: ({ children }) => (
            <ul className="my-1.5 list-disc space-y-1 pl-4 text-[13px]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1.5 list-decimal space-y-1 pl-4 text-[13px]">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-indigo-400 pl-3 italic text-gray-600">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 underline hover:text-indigo-700"
            >
              {children}
            </a>
          ),
          p: ({ children }) => (
            <p className="my-1.5 first:mt-0 last:mb-0 leading-relaxed whitespace-pre-wrap break-words">
              {children}
            </p>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

MarkdownRenderer.displayName = "MarkdownRenderer";
