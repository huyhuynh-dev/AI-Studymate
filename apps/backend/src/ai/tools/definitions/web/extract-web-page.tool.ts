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
      'Danh sách tối đa 1 đến 3 đường link website cần bóc tách nội dung chi tiết.',
    ),
  query: z
    .string()
    .min(1)
    .describe(
      'Mục tiêu hoặc câu hỏi cụ thể cần trích xuất thông tin trong trang web (bắt buộc để Tavily lọc và xếp hạng đúng đoạn văn bản cần tìm).',
    ),
});

export function createExtractWebPageTool(
  callback: ExtractWebPageCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'Đọc sâu và trích xuất nội dung Markdown sạch từ 1–3 URL cụ thể bằng Tavily Extract API. Dùng khi người dùng gửi kèm link (URL) trong tin nhắn hoặc khi cần đọc chi tiết nội dung từ một URL tìm được qua searchInternet. Luôn truyền `query` rõ ràng để lọc đúng đoạn cần thiết; nếu URL bị chặn hoặc lỗi, có thể dựa vào snippet hoặc nhờ người dùng dán nội dung.',
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
