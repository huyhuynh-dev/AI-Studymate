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
      'Concise keyword-optimized search query in the appropriate language (English for international papers/tech, Vietnamese for local news/regulations).',
    ),
  searchDepth: z
    .enum(['basic', 'advanced'])
    .default('basic')
    .describe(
      'Search depth: "basic" for quick lookups or general concepts (1 credit); "advanced" for in-depth academic research (2 credits).',
    ),
  language: z
    .string()
    .optional()
    .describe(
      'ISO 639-1 language code (e.g., "vi", "en") matching the query to prioritize results in that language.',
    ),
  timeRange: z
    .enum(['day', 'week', 'month', 'year'])
    .optional()
    .describe(
      'Time filter when the user asks for recent or up-to-date information.',
    ),
  includeDomains: z
    .array(z.string())
    .max(10)
    .optional()
    .describe(
      'Trusted domains to prioritize (e.g., ["arxiv.org", "wikipedia.org", "moet.gov.vn"]).',
    ),
  excludeDomains: z
    .array(z.string())
    .max(10)
    .optional()
    .describe('Domains to exclude from search results.'),
  exactMatch: z
    .boolean()
    .default(false)
    .describe(
      'Set to true when the query contains technical terms or identifiers requiring an exact match.',
    ),
});

export function createSearchInternetTool(
  callback: SearchInternetCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'Search the Internet via Tavily Search API for factual information, academic papers, technical docs, or recent developments not covered in the user’s workspace documents. NEVER use this for private user data, grades, or unpublished internal coursework. Returns snippets with web citation IDs [wX].',
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
