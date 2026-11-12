import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {
  extractDomain,
  extractTitleFromMarkdown,
  TavilyService,
  truncateText,
} from './tavily.service.js';

// Mock @tavily/core
const mockSearch = vi.fn();
const mockExtract = vi.fn();
vi.mock('@tavily/core', () => ({
  tavily: vi.fn(() => ({
    search: mockSearch,
    extract: mockExtract,
  })),
}));

describe('TavilyService & Helper Functions', () => {
  describe('Helper Functions', () => {
    it('extractDomain trích xuất hostname sạch (bỏ www)', () => {
      expect(extractDomain('https://www.arxiv.org/abs/2404.16130')).toBe('arxiv.org');
      expect(extractDomain('https://en.wikipedia.org/wiki/AI')).toBe('en.wikipedia.org');
      expect(extractDomain('invalid-url')).toBe('invalid-url');
    });

    it('extractTitleFromMarkdown bóc tách tiêu đề heading 1 hoặc heading 2', () => {
      expect(
        extractTitleFromMarkdown('# Kiến trúc GraphRAG của Microsoft\nNội dung chi tiết...'),
      ).toBe('Kiến trúc GraphRAG của Microsoft');

      expect(
        extractTitleFromMarkdown('## Thuật toán Dijkstra\nNội dung...'),
      ).toBe('Thuật toán Dijkstra');

      expect(extractTitleFromMarkdown('Không có heading nào ở đây')).toBeNull();
      expect(extractTitleFromMarkdown(null)).toBeNull();
    });

    it('truncateText cắt ngắn văn bản an toàn kèm dấu ba chấm', () => {
      const short = 'Ngắn gọn';
      expect(truncateText(short, 100)).toBe('Ngắn gọn');

      const long = 'A'.repeat(50);
      expect(truncateText(long, 20)).toBe('A'.repeat(20) + '...');
      expect(truncateText(null)).toBe('');
    });
  });

  describe('TavilyService when TAVILY_API_KEY is missing (Graceful Fallback Mode)', () => {
    it('search và extract không quăng lỗi mà trả về kết quả rỗng kèm thông báo an toàn', async () => {
      const mockConfigService = {
        get: vi.fn().mockReturnValue(undefined),
      } as unknown as ConfigService;

      const service = new TavilyService(mockConfigService);

      const searchRes = await service.search({ query: 'GraphRAG' });
      expect(searchRes.totalResults).toBe(0);
      expect(searchRes.results).toEqual([]);
      expect(searchRes.message).toBe('Tìm kiếm Internet bị lỗi.');

      const extractRes = await service.extract({
        urls: ['https://arxiv.org/abs/123'],
        query: 'tóm tắt',
      });
      expect(extractRes.totalSuccess).toBe(0);
      expect(extractRes.results).toEqual([]);
      expect(extractRes.message).toBe('Tìm kiếm Internet bị lỗi.');
    });
  });

  describe('TavilyService with active API key', () => {
    const mockConfigService = {
      get: vi.fn().mockReturnValue('tvly-test-api-key-12345'),
    } as unknown as ConfigService;

    it('search gọi đúng cấu hình cố định chuẩn Production và ánh xạ kết quả chuẩn', async () => {
      mockSearch.mockResolvedValueOnce({
        query: 'Deep learning',
        results: [
          {
            title: 'Bài viết AI | ScienceDirect',
            url: 'https://www.sciencedirect.com/article/ai',
            content: 'Nội dung bài viết về deep learning rất chi tiết...',
            favicon: 'https://sciencedirect.com/favicon.ico',
            publishedDate: '2026-03-01',
          },
        ],
      });

      const service = new TavilyService(mockConfigService);
      const res = await service.search({
        query: 'Deep learning',
        searchDepth: 'advanced',
        includeDomains: ['sciencedirect.com'],
      });

      expect(mockSearch).toHaveBeenCalledWith('Deep learning', {
        searchDepth: 'advanced',
        topic: 'general',
        language: undefined,
        timeRange: undefined,
        includeDomains: ['sciencedirect.com'],
        excludeDomains: undefined,
        includeDomainsMode: 'prefer',
        exactMatch: false,
        chunksPerSource: 3,
        maxResults: 5,
        includePublishedDate: true,
        filterByPublishedDate: false,
        includeFavicon: true,
        safeSearch: true,
        includeAnswer: false,
        includeRawContent: false,
        includeImages: false,
        timeout: 15,
      });

      expect(res.totalResults).toBe(1);
      expect(res.results[0].title).toBe('Bài viết AI | ScienceDirect');
      expect(res.results[0].domain).toBe('sciencedirect.com');
      expect(res.results[0].previewSnippet).toBeDefined();
    });

    it('extract gọi đúng cấu hình cố định và bóc tách title từ Markdown heading', async () => {
      mockExtract.mockResolvedValueOnce({
        results: [
          {
            url: 'https://arxiv.org/abs/2404.16130',
            rawContent: '# GraphRAG: From Local to Global\nĐây là tóm tắt bài báo...',
            favicon: 'https://arxiv.org/favicon.ico',
          },
        ],
        failedResults: [
          {
            url: 'https://private.com/paper',
            error: '403 Forbidden',
          },
        ],
      });

      const service = new TavilyService(mockConfigService);
      const res = await service.extract({
        urls: ['https://arxiv.org/abs/2404.16130', 'https://private.com/paper'],
        query: 'GraphRAG architecture',
      });

      expect(mockExtract).toHaveBeenCalledWith(
        ['https://arxiv.org/abs/2404.16130', 'https://private.com/paper'],
        {
          query: 'GraphRAG architecture',
          chunksPerSource: 5,
          extractDepth: 'advanced',
          format: 'markdown',
          includeFavicon: true,
          includeImages: false,
          timeout: 30,
        },
      );

      expect(res.totalSuccess).toBe(1);
      expect(res.totalFailed).toBe(1);
      // Fallback title trích xuất từ Markdown heading # GraphRAG: From Local to Global
      expect(res.results[0].title).toBe('GraphRAG: From Local to Global');
      expect(res.results[0].domain).toBe('arxiv.org');
      expect(res.results[0].extractedContent).toContain('GraphRAG: From Local to Global');
      expect(res.failedResults[0].error).toBe('403 Forbidden');
    });

    it('bắt lỗi khi Tavily API ném exception và trả về kết quả an toàn (không sập luồng)', async () => {
      mockSearch.mockRejectedValueOnce(new Error('Rate limit exceeded (429)'));

      const service = new TavilyService(mockConfigService);
      const res = await service.search({ query: 'Thử nghiệm lỗi' });

      expect(res.totalResults).toBe(0);
      expect(res.results).toEqual([]);
      expect(res.message).toBe('Tìm kiếm Internet bị lỗi.');
    });
  });
});
