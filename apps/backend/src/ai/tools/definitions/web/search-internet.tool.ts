import { tool } from 'ai';
import { z } from 'zod';
import type {
  SearchInternetCallback,
  SearchInternetResultItem,
  SearchInternetToolOutput,
  ToolCallTracker,
} from '../../types.js';

export const searchInternetInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      'Câu truy vấn tìm kiếm ngắn gọn, tối ưu từ khóa bằng ngôn ngữ phù hợp (tiếng Anh cho bài báo khoa học/công nghệ quốc tế, tiếng Việt cho tin tức/quy định/sự kiện tại Việt Nam).',
    ),
  searchDepth: z
    .enum(['basic', 'advanced'])
    .default('basic')
    .describe(
      'Độ sâu tìm kiếm: "basic" cho câu hỏi nhanh hoặc khái niệm thông thường (1 credit); "advanced" cho bài toán học thuật chuyên sâu cần đối chiếu kỹ (2 credits).',
    ),
  language: z
    .string()
    .optional()
    .describe(
      'Mã ngôn ngữ ISO 639-1 (ví dụ: "vi", "en") tương ứng với query để Tavily ưu tiên kết quả cùng ngôn ngữ.',
    ),
  timeRange: z
    .enum(['day', 'week', 'month', 'year'])
    .optional()
    .describe(
      'Bộ lọc thời gian nếu người dùng yêu cầu thông tin mới nhất gần đây.',
    ),
  includeDomains: z
    .array(z.string())
    .max(10)
    .optional()
    .describe(
      'Danh sách tên miền uy tín cần ưu tiên tìm kiếm (ví dụ: ["arxiv.org", "wikipedia.org", "moet.gov.vn"]).',
    ),
  excludeDomains: z
    .array(z.string())
    .max(10)
    .optional()
    .describe('Danh sách tên miền cần loại bỏ khỏi kết quả tìm kiếm.'),
  exactMatch: z
    .boolean()
    .default(false)
    .describe(
      'Đặt true khi query chứa thuật ngữ chuyên ngành hoặc mã định danh cần khớp chính xác 100%.',
    ),
});

export function createSearchInternetTool(
  callback: SearchInternetCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'Tìm kiếm thông tin thực tế, bài báo khoa học, tài liệu kỹ thuật hoặc kiến thức cập nhật trên Internet qua Tavily Search API khi thông tin không có trong tài liệu học tập của người dùng. Tuyệt đối không dùng để tìm dữ liệu cá nhân, điểm số, hay bài tập nội bộ chưa được tải lên. Trả về các trích đoạn kèm nguồn [wX].',
    inputSchema: searchInternetInputSchema,
    execute: async (input): Promise<SearchInternetToolOutput> => {
      console.log(
        `[Tool:searchInternet] 🔎 AI Agent kích hoạt Tool: query="${input.query}", depth="${input.searchDepth || 'basic'}", topic="general"`,
      );
      const response = await callback({
        ...input,
        topic: 'general',
      });

      const mappedResults: SearchInternetResultItem[] = (
        response.results || []
      ).map((r) => {
        let citationId = 'w1';
        if (tracker && typeof tracker.allocateWebCitation === 'function') {
          citationId = tracker.allocateWebCitation({
            title: r.title,
            url: r.url,
            domain: r.domain,
            favicon: r.favicon,
            publishedDate: r.publishedDate,
            previewSnippet: r.previewSnippet || r.contentSnippet,
          });
        }

        return {
          citationId,
          title: r.title,
          url: r.url,
          domain: r.domain,
          favicon: r.favicon,
          publishedDate: r.publishedDate,
          contentSnippet: r.contentSnippet,
          previewSnippet: r.previewSnippet,
        };
      });

      console.log(
        `[Tool:searchInternet] 🎯 Hoàn tất thực thi Tool cho query="${input.query}": Cấp phát ${mappedResults.length} mã trích dẫn (${mappedResults.map((r) => `[${r.citationId}]: ${r.domain}`).join(', ')})`,
      );

      return {
        query: response.query,
        totalResults: mappedResults.length,
        results: mappedResults,
        message: response.message,
      };
    },
    toModelOutput: ({ output }) => {
      const typedOutput = output as SearchInternetToolOutput;
      if (!typedOutput.results || typedOutput.results.length === 0) {
        return {
          type: 'text',
          value:
            typedOutput.message ||
            `Không tìm thấy kết quả Internet nào cho truy vấn: "${typedOutput.query}".`,
        };
      }

      const itemsText = typedOutput.results
        .map(
          (r) =>
            `- [Nguồn Web [${r.citationId}] | Tiêu đề: "${r.title}" | Tên miền: ${r.domain} | URL: ${r.url}${r.publishedDate ? ` | Ngày đăng: ${r.publishedDate}` : ''}]:\n  ${r.contentSnippet}`,
        )
        .join('\n\n');

      return {
        type: 'text',
        value: `[Kết quả tìm kiếm Internet cho truy vấn: "${typedOutput.query}"] (${typedOutput.results.length} nguồn):\n${itemsText}`,
      };
    },
  });
}
