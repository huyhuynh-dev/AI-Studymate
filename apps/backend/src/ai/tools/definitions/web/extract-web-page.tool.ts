import { tool } from 'ai';
import { z } from 'zod';
import type {
  ExtractWebPageCallback,
  ExtractWebPageResultItem,
  ExtractWebPageToolOutput,
  ToolCallTracker,
} from '../../types.js';

export const extractWebPageInputSchema = z.object({
  urls: z
    .array(z.string().url())
    .min(1)
    .max(3)
    .describe(
      'List of 1 to 3 website URLs to extract detailed content from.',
    ),
  query: z
    .string()
    .min(1)
    .describe(
      'Specific goal or question for extracting content from the webpage (used by Tavily to filter and rerank relevant passages).',
    ),
});

export function createExtractWebPageTool(
  callback: ExtractWebPageCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'Deeply extract clean Markdown content from 1–3 specific URLs via Tavily Extract API. Use when the student shares direct URLs or when deeper reading of a searchInternet result is needed. Always pass a clear `query`; if a URL is blocked or fails, fall back to search snippets or ask the student to paste the excerpt.',
    inputSchema: extractWebPageInputSchema,
    execute: async (input): Promise<ExtractWebPageToolOutput> => {
      console.log(
        `[Tool:extractWebPage] 📖 AI Agent kích hoạt Tool: URLs=[${input.urls.join(', ')}], query="${input.query}"`,
      );
      const response = await callback(input);

      const mappedResults: ExtractWebPageResultItem[] = (
        response.results || []
      ).map((r) => {
        let citationId = 'w1';
        if (tracker && typeof tracker.allocateWebCitation === 'function') {
          // Chỉ truyền previewSnippet ngắn (<= 400 ký tự) vào tracker để lưu DB gọn nhẹ,
          // TUYỆT ĐỐI không lưu content 4.000 ký tự vào tracker/metadata.citations
          citationId = tracker.allocateWebCitation({
            title: r.title,
            url: r.url,
            domain: r.domain,
            favicon: r.favicon,
            previewSnippet: r.previewSnippet,
          });
        }

        return {
          citationId,
          title: r.title,
          url: r.url,
          domain: r.domain,
          favicon: r.favicon,
          extractedContent: r.extractedContent,
          previewSnippet: r.previewSnippet,
        };
      });

      console.log(
        `[Tool:extractWebPage] 🎯 Hoàn tất thực thi Tool cho query="${input.query}": Thành công ${mappedResults.length} URLs, Thất bại ${(response.failedResults || []).length} URLs`,
      );

      return {
        query: response.query,
        totalSuccess: mappedResults.length,
        totalFailed: (response.failedResults || []).length,
        results: mappedResults,
        failedResults: response.failedResults || [],
        message: response.message,
      };
    },
    toModelOutput: ({ output }) => {
      const typedOutput = output as ExtractWebPageToolOutput;
      const parts: string[] = [];

      if (typedOutput.results && typedOutput.results.length > 0) {
        const successText = typedOutput.results
          .map(
            (r) =>
              `- [Nguồn Web [${r.citationId}] | Tiêu đề: "${r.title}" | Tên miền: ${r.domain} | URL: ${r.url}]:\n${r.extractedContent}`,
          )
          .join('\n\n');
        parts.push(
          `[Nội dung bóc tách từ Web cho mục tiêu: "${typedOutput.query}"] (${typedOutput.results.length} trang):\n${successText}`,
        );
      }

      if (typedOutput.failedResults && typedOutput.failedResults.length > 0) {
        const failText = typedOutput.failedResults
          .map((f) => `- ${f.url} (Lỗi: ${f.error})`)
          .join('\n');
        parts.push(`[Các URL không thể truy cập]:\n${failText}`);
      }

      if (parts.length === 0) {
        return {
          type: 'text',
          value:
            typedOutput.message ||
            `Không bóc tách được nội dung từ các URL đã cho.`,
        };
      }

      return {
        type: 'text',
        value: parts.join('\n\n'),
      };
    },
  });
}
