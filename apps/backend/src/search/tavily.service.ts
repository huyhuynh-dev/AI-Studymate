import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tavily } from '@tavily/core';

export interface TavilySearchParams {
  query: string;
  searchDepth?: 'basic' | 'advanced';
  topic?: 'general' | 'news' | 'finance';
  language?: string;
  timeRange?: 'day' | 'week' | 'month' | 'year';
  includeDomains?: string[];
  excludeDomains?: string[];
  exactMatch?: boolean;
}

export interface TavilySearchResultItem {
  title: string;
  url: string;
  domain: string;
  favicon?: string;
  publishedDate?: string;
  contentSnippet: string;
  previewSnippet: string;
}

export interface TavilySearchToolOutput {
  query: string;
  totalResults: number;
  results: TavilySearchResultItem[];
  message?: string;
}

export interface TavilyExtractParams {
  urls: string[];
  query: string;
}

export interface TavilyExtractResultItem {
  title: string;
  url: string;
  domain: string;
  favicon?: string;
  extractedContent: string;
  previewSnippet: string;
}

export interface TavilyExtractFailedItem {
  url: string;
  error: string;
}

export interface TavilyExtractToolOutput {
  query: string;
  totalSuccess: number;
  totalFailed: number;
  results: TavilyExtractResultItem[];
  failedResults: TavilyExtractFailedItem[];
  message?: string;
}

/**
 * Trích xuất tên miền ngắn gọn từ URL (ví dụ: https://www.arxiv.org/abs/... -> arxiv.org)
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Trích xuất tiêu đề từ dòng heading (# ...) đầu tiên trong nội dung Markdown
 */
export function extractTitleFromMarkdown(rawContent?: string | null): string | null {
  if (!rawContent) return null;
  const match = rawContent.match(/^#{1,3}\s+(.+)$/m);
  if (match && match[1]) {
    const heading = match[1].trim();
    if (heading.length > 0 && heading.length < 250) {
      return heading;
    }
  }
  return null;
}

/**
 * Cắt ngắn văn bản an toàn kèm dấu ba chấm nếu vượt ngưỡng
 */
export function truncateText(text?: string | null, maxLength = 4000): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

@Injectable()
export class TavilyService {
  private readonly logger = new Logger(TavilyService.name);
  private readonly client?: ReturnType<typeof tavily>;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('TAVILY_API_KEY');
    if (apiKey && apiKey.trim().length > 0) {
      this.client = tavily({ apiKey: apiKey.trim() });
      this.logger.log('[TavilyService] Đã khởi tạo TavilyClient thành công.');
    } else {
      this.logger.warn(
        '[TavilyService] Chưa cấu hình TAVILY_API_KEY trong môi trường (.env). Các tính năng tìm kiếm Internet sẽ hoạt động ở chế độ fallback.',
      );
    }
  }

  /**
   * Tìm kiếm trên Internet bằng Tavily Search API
   */
  async search(params: TavilySearchParams): Promise<TavilySearchToolOutput> {
    const startTime = Date.now();
    this.logger.log(
      `[TavilyService] 🌐 GỌI TAVILY SEARCH: query="${params.query}" | depth=${params.searchDepth || 'basic'} | topic=${params.topic || 'general'} | timeRange=${params.timeRange || 'none'} | domains=${params.includeDomains?.join(',') || 'all'}`,
    );

    if (!this.client) {
      this.logger.warn(
        `[TavilyService] ⚠️ Không thể tìm kiếm Internet cho truy vấn "${params.query}": Thiếu TAVILY_API_KEY trong .env.`,
      );
      return {
        query: params.query,
        totalResults: 0,
        results: [],
        message: 'Tìm kiếm Internet bị lỗi.',
      };
    }

    try {
      const response = await this.client.search(params.query, {
        searchDepth: params.searchDepth || 'basic',
        topic: params.topic || 'general',
        language: params.language,
        timeRange: params.timeRange,
        includeDomains:
          params.includeDomains && params.includeDomains.length > 0
            ? params.includeDomains
            : undefined,
        excludeDomains:
          params.excludeDomains && params.excludeDomains.length > 0
            ? params.excludeDomains
            : undefined,
        includeDomainsMode:
          params.includeDomains && params.includeDomains.length > 0
            ? 'prefer'
            : undefined,
        exactMatch: params.exactMatch ?? false,
        // Cấu hình cứng chuẩn Production theo kiến trúc
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

      const rawResults = Array.isArray(response?.results) ? response.results : [];
      const duration = Date.now() - startTime;

      if (rawResults.length === 0) {
        this.logger.warn(
          `[TavilyService] ⚠️ TAVILY SEARCH KHÔNG CÓ KẾ QUẢ (0 results sau ${duration}ms) cho query="${params.query}". Response object: ${JSON.stringify(response)}`,
        );
      } else {
        this.logger.log(
          `[TavilyService] ✅ TAVILY SEARCH THÀNH CÔNG (${duration}ms): Nhận được ${rawResults.length} kết quả cho query="${params.query}"`,
        );
      }

      const results: TavilySearchResultItem[] = rawResults.map((r, idx) => {
        const domain = extractDomain(r.url);
        const title = r.title?.trim() || domain;
        const contentSnippet = truncateText(r.content, 800);
        const previewSnippet = truncateText(r.content, 300);

        this.logger.log(
          `   [${idx + 1}] "${title}" | Domain: ${domain} | URL: ${r.url} | Ngày: ${r.publishedDate || 'N/A'} | Snippet: ${contentSnippet.slice(0, 120)}...`,
        );

        return {
          title,
          url: r.url,
          domain,
          favicon: r.favicon,
          publishedDate: r.publishedDate,
          contentSnippet,
          previewSnippet,
        };
      });

      return {
        query: params.query,
        totalResults: results.length,
        results,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorDetails = error?.response?.data || error?.data || error?.message || String(error);
      this.logger.error(
        `[TavilyService] ❌ LỖI TAVILY SEARCH (${duration}ms) cho query="${params.query}": ${error?.message || error}. Chi tiết lỗi từ Tavily: ${typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : errorDetails}`,
        error?.stack,
      );
      return {
        query: params.query,
        totalResults: 0,
        results: [],
        message: 'Tìm kiếm Internet bị lỗi.',
      };
    }
  }

  /**
   * Bóc tách nội dung chi tiết từ 1-3 URL bằng Tavily Extract API
   */
  async extract(params: TavilyExtractParams): Promise<TavilyExtractToolOutput> {
    const startTime = Date.now();
    this.logger.log(
      `[TavilyService] 📄 GỌI TAVILY EXTRACT: URLs=[${params.urls.join(', ')}] | query="${params.query}"`,
    );

    if (!this.client) {
      this.logger.warn(
        `[TavilyService] ⚠️ Không thể bóc tách nội dung Web cho URLs [${params.urls.join(', ')}]: Thiếu TAVILY_API_KEY trong .env.`,
      );
      return {
        query: params.query,
        totalSuccess: 0,
        totalFailed: params.urls.length,
        results: [],
        failedResults: params.urls.map((u) => ({
          url: u,
          error: 'Thiếu API Key',
        })),
        message: 'Tìm kiếm Internet bị lỗi.',
      };
    }

    try {
      const response = await this.client.extract(params.urls, {
        query: params.query,
        chunksPerSource: 5,
        extractDepth: 'advanced',
        format: 'markdown',
        includeFavicon: true,
        includeImages: false,
        timeout: 30,
      });

      const rawResults = Array.isArray(response?.results) ? response.results : [];
      const rawFailed = Array.isArray(response?.failedResults)
        ? response.failedResults
        : [];
      const duration = Date.now() - startTime;

      this.logger.log(
        `[TavilyService] ✅ TAVILY EXTRACT HOÀN TẤT (${duration}ms): Thành công ${rawResults.length} URLs, Thất bại ${rawFailed.length} URLs`,
      );

      const results: TavilyExtractResultItem[] = rawResults.map((r, idx) => {
        const domain = extractDomain(r.url);
        // Fallback title: title từ Tavily (nếu có) -> Heading 1 trong markdown -> domain
        const extractedHeading = extractTitleFromMarkdown(r.rawContent);
        const title = (r as any).title?.trim() || extractedHeading || domain;
        const extractedContent = truncateText(r.rawContent, 4000);
        const previewSnippet = truncateText(r.rawContent, 300);

        this.logger.log(
          `   [Trang ${idx + 1}] "${title}" (${domain}) | Độ dài nội dung: ${extractedContent.length} ký tự`,
        );

        return {
          title,
          url: r.url,
          domain,
          favicon: r.favicon,
          extractedContent,
          previewSnippet,
        };
      });

      const failedResults: TavilyExtractFailedItem[] = rawFailed.map((f) => {
        this.logger.warn(
          `   ⚠️ [Bóc tách thất bại] URL: ${f.url} | Lý do: ${f.error}`,
        );
        return {
          url: f.url,
          error: f.error || 'Không thể truy cập trang web',
        };
      });

      return {
        query: params.query,
        totalSuccess: results.length,
        totalFailed: failedResults.length,
        results,
        failedResults,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorDetails = error?.response?.data || error?.data || error?.message || String(error);
      this.logger.error(
        `[TavilyService] ❌ LỖI TAVILY EXTRACT (${duration}ms) cho URLs [${params.urls.join(', ')}]: ${error?.message || error}. Chi tiết: ${typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : errorDetails}`,
        error?.stack,
      );
      return {
        query: params.query,
        totalSuccess: 0,
        totalFailed: params.urls.length,
        results: [],
        failedResults: params.urls.map((u) => ({
          url: u,
          error: 'Lỗi kết nối',
        })),
        message: 'Tìm kiếm Internet bị lỗi.',
      };
    }
  }
}
