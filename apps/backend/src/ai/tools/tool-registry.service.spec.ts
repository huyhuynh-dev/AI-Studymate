import { describe, it, expect, vi } from 'vitest';
import {
  ChatSessionToolTracker,
  ToolRegistryService,
} from './tool-registry.service.js';
import {
  type SearchDocumentChunksToolOutput,
  type GetDocumentSectionOrPagesToolOutput,
  type SearchInternetToolOutput,
  type ExtractWebPageToolOutput,
  type WebCitationItem,
} from './types.js';
import { createSearchDocumentChunksTool } from './definitions/documents/search-document-chunks.tool.js';
import { createGetDocumentSectionOrPagesTool } from './definitions/documents/get-document-section-or-pages.tool.js';
import { createSearchInternetTool } from './definitions/web/search-internet.tool.js';
import { createExtractWebPageTool } from './definitions/web/extract-web-page.tool.js';
import { HttpLoggingFilter } from '../../common/filters/http-logging.filter.js';

describe('ToolRegistryService & ChatSessionToolTracker', () => {
  describe('ChatSessionToolTracker - Turn-Scoped Citation Counter', () => {
    it('nên cấp phát citationId tuần tự (c1..c5) ở bước 1 và tiếp nối (c6..c10) ở bước 2', () => {
      const tracker = new ChatSessionToolTracker();

      // Bước 1: Gọi công cụ lần 1
      const id1 = tracker.allocateCitation({
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        fileName: 'File1.pdf',
        pageNumbers: [1],
        headings: ['Heading 1'],
        content: 'Content 1',
      });
      const id2 = tracker.allocateCitation({
        chunkId: 'chunk-2',
        documentId: 'doc-1',
        fileName: 'File1.pdf',
        pageNumbers: [2],
        headings: ['Heading 2'],
        content: 'Content 2',
      });

      expect(id1).toBe('c1');
      expect(id2).toBe('c2');

      // Bước 2: Gọi công cụ lần 2 (Multi-step tool calling trong cùng turn)
      const id3 = tracker.allocateCitation({
        chunkId: 'chunk-3',
        documentId: 'doc-2',
        fileName: 'File2.pdf',
        pageNumbers: [5],
        headings: ['Heading 3'],
        content: 'Content 3',
      });

      expect(id3).toBe('c3');
      expect(tracker.getAllCitations()).toHaveLength(3);
      expect(tracker.getAllCitations().map((c) => c.citationId)).toEqual([
        'c1',
        'c2',
        'c3',
      ]);
    });

    it('nên tái sử dụng citationId cũ nếu cùng 1 chunk được gọi lại ở bước sau', () => {
      const tracker = new ChatSessionToolTracker();

      const idFirst = tracker.allocateCitation({
        chunkId: 'chunk-duplicate',
        documentId: 'doc-1',
        fileName: 'File1.pdf',
        pageNumbers: [1],
        headings: [],
        content: 'Nội dung trùng',
      });
      expect(idFirst).toBe('c1');

      // Cấp phát chunk khác
      const idSecond = tracker.allocateCitation({
        chunkId: 'chunk-other',
        documentId: 'doc-1',
        fileName: 'File1.pdf',
        pageNumbers: [2],
        headings: [],
        content: 'Nội dung khác',
      });
      expect(idSecond).toBe('c2');

      // Cấp phát lại chunk-duplicate ở bước sau
      const idDuplicateAgain = tracker.allocateCitation({
        chunkId: 'chunk-duplicate',
        documentId: 'doc-1',
        fileName: 'File1.pdf',
        pageNumbers: [1],
        headings: [],
        content: 'Nội dung trùng',
      });
      expect(idDuplicateAgain).toBe('c1'); // Vẫn là c1, không tăng bộ đếm
      expect(tracker.getAllCitations()).toHaveLength(2);
    });
  });

  describe('searchDocumentChunksTool', () => {
    it('nên gán citationId và hiển thị includeNeighbors trong toModelOutput (kèm khử trùng lặp)', async () => {
      const tracker = new ChatSessionToolTracker();
      const mockCallback = vi.fn().mockResolvedValue([
        {
          id: 'chunk-10',
          documentId: 'doc-1',
          fileName: 'GiaiTich.pdf',
          chunkIndex: 10,
          pageNumbers: [5],
          headings: ['Đạo hàm'],
          content: 'Nội dung chính chunk 10',
          rawContent: 'Đạo hàm của hàm số f(x) tại điểm x0...',
          chunkType: 'text',
          hasImage: false,
          hasTable: false,
          bboxes: null,
          assets: [],
          neighbors: {
            prev: {
              id: 'chunk-9',
              chunkIndex: 9,
              content: 'Ngữ cảnh trước chunk 9',
              pageNumbers: [4],
            },
            next: {
              id: 'chunk-11',
              chunkIndex: 11,
              content: 'Ngữ cảnh sau chunk 11',
              pageNumbers: [6],
            },
          },
          rrfScore: 0.03,
          vectorRank: 1,
          keywordRank: 1,
        },
        // Giả sử chunk-11 cũng nằm sẵn trong danh sách kết quả chính!
        {
          id: 'chunk-11',
          documentId: 'doc-1',
          fileName: 'GiaiTich.pdf',
          chunkIndex: 11,
          pageNumbers: [6],
          headings: ['Vi phân'],
          content: 'Nội dung chính chunk 11',
          rawContent: null,
          chunkType: 'text',
          hasImage: false,
          hasTable: false,
          bboxes: null,
          assets: [],
          rrfScore: 0.02,
          vectorRank: 2,
          keywordRank: 2,
        },
      ]);

      const toolInstance = createSearchDocumentChunksTool(mockCallback, tracker);
      expect(toolInstance.execute).toBeDefined();

      const output = (await toolInstance.execute!(
        {
          semanticQuery: 'Đạo hàm là gì',
          keywords: ['đạo hàm'],
          includeNeighbors: true,
        },
        { toolCallId: 'tc-1', messages: [] },
      )) as SearchDocumentChunksToolOutput;

      expect(output.chunks).toHaveLength(2);
      expect(output.chunks[0].citationId).toBe('c1');
      expect(output.chunks[1].citationId).toBe('c2');

      // Tinh gọn payload: part.output không chứa rawContent, bboxes, assets
      expect(output.chunks[0].previewSnippet).toBeDefined();
      expect(output.chunks[0].rawContent).toBeUndefined();
      expect(output.chunks[0].bboxes).toBeUndefined();
      expect(output.chunks[0].assets).toBeUndefined();

      // Nhưng tracker VẪN BẢO TOÀN 100% dữ liệu gốc cho Popover / PDF Jumper
      const trackedCitation = tracker.getCitation('c1');
      expect(trackedCitation?.rawContent).toBe('Đạo hàm của hàm số f(x) tại điểm x0...');
      expect(trackedCitation?.bboxes).toBeNull();
      expect(trackedCitation?.assets).toEqual([]);

      expect(toolInstance.toModelOutput).toBeDefined();
      const modelOutput = toolInstance.toModelOutput!({ output }) as {
        type: 'text';
        value: string;
      };
      expect(modelOutput.type).toBe('text');
      const text = modelOutput.value;

      // Kiểm tra có mã trích dẫn [c1] và [c2]
      expect(text).toContain('[Dẫn chứng [c1]');
      expect(text).toContain('[Dẫn chứng [c2]');

      // Ngữ cảnh trước chunk 9 chưa có trong kết quả chính nên được hiển thị
      expect(text).toContain('Ngữ cảnh trước liền kề #9');
      expect(text).toContain('Ngữ cảnh trước chunk 9');

      // Ngữ cảnh sau chunk 11 đã nằm sẵn trong kết quả chính (chunk-11) nên phải ĐƯỢC KHỬ TRÙNG LẶP
      expect(text).not.toContain('Ngữ cảnh sau liền kề #11');
    });
  });

  describe('getDocumentSectionOrPagesTool', () => {
    it('nên cấp phát citationId và ghi nhận vào tracker giống searchDocumentChunks', async () => {
      const tracker = new ChatSessionToolTracker();
      const mockCallback = vi.fn().mockResolvedValue({
        documentId: 'doc-1',
        fileName: 'Chuong2.pdf',
        pageCount: 10,
        isFullDocument: true,
        totalChunks: 2,
        chunks: [
          {
            id: 'chunk-sec-1',
            documentId: 'doc-1',
            fileName: 'Chuong2.pdf',
            chunkIndex: 0,
            pageNumbers: [1],
            headings: ['Phần 1'],
            content: 'Nội dung trang 1',
            rawContent: 'Đoạn trích nội dung gốc đầy đủ của trang 1...',
            chunkType: 'text',
            bboxes: null,
            assets: [],
          },
          {
            id: 'chunk-sec-2',
            documentId: 'doc-1',
            fileName: 'Chuong2.pdf',
            chunkIndex: 1,
            pageNumbers: [2],
            headings: ['Phần 2'],
            content: 'Nội dung trang 2',
            rawContent: 'Đoạn trích nội dung gốc đầy đủ của trang 2...',
            chunkType: 'text',
            bboxes: null,
            assets: [],
          },
        ],
      });

      const toolInstance = createGetDocumentSectionOrPagesTool(
        mockCallback,
        tracker,
      );
      expect(toolInstance.execute).toBeDefined();

      const output = (await toolInstance.execute!(
        {
          documentId: 'doc-1',
          pageNumbers: [1, 2],
        },
        { toolCallId: 'tc-2', messages: [] },
      )) as GetDocumentSectionOrPagesToolOutput;

      expect(output.chunks[0].citationId).toBe('c1');
      expect(output.chunks[1].citationId).toBe('c2');

      // Tinh gọn payload: part.output không chứa rawContent, bboxes, assets
      expect(output.chunks[0].previewSnippet).toBeDefined();
      expect(output.chunks[0].rawContent).toBeUndefined();
      expect(output.chunks[0].bboxes).toBeUndefined();
      expect(output.chunks[0].assets).toBeUndefined();

      // Ghi nhận vào tracker với đầy đủ 100% dữ liệu gốc
      expect(tracker.getAllCitations()).toHaveLength(2);
      expect(tracker.getCitation('c1')?.chunkId).toBe('chunk-sec-1');
      expect(tracker.getCitation('c1')?.rawContent).toBe('Đoạn trích nội dung gốc đầy đủ của trang 1...');
      expect(tracker.getCitation('c2')?.chunkId).toBe('chunk-sec-2');
      expect(tracker.getCitation('c2')?.rawContent).toBe('Đoạn trích nội dung gốc đầy đủ của trang 2...');

      // Kiểm tra toModelOutput
      expect(toolInstance.toModelOutput).toBeDefined();
      const modelOutput = toolInstance.toModelOutput!({ output }) as {
        type: 'text';
        value: string;
      };
      expect(modelOutput.value).toContain('[Dẫn chứng [c1]');
      expect(modelOutput.value).toContain('[Dẫn chứng [c2]');
      expect(modelOutput.value).toContain('Trang 1');
    });
  });

  describe('ChatSessionToolTracker - Web Citations & Deduplication', () => {
    it('cấp phát mã w1, w2 độc lập với c1, c2 và khử trùng lặp theo URL', () => {
      const tracker = new ChatSessionToolTracker();

      // Cấp phát 1 mã trích dẫn tài liệu
      const c1 = tracker.allocateCitation({
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        fileName: 'tailieu.pdf',
        pageNumbers: [1],
        headings: ['Phần 1'],
        content: 'Nội dung PDF',
      });
      expect(c1).toBe('c1');

      // Cấp phát trích dẫn Web lần đầu
      const w1 = tracker.allocateWebCitation({
        title: 'GraphRAG Overview',
        url: 'https://arxiv.org/abs/2404.16130/',
        domain: 'arxiv.org',
        favicon: 'https://arxiv.org/favicon.ico',
        publishedDate: '2026-04-24',
        previewSnippet: 'Tóm tắt bài báo GraphRAG...',
      });
      expect(w1).toBe('w1');

      // Cấp phát URL khác
      const w2 = tracker.allocateWebCitation({
        title: 'Wikipedia AI',
        url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
        domain: 'en.wikipedia.org',
        previewSnippet: 'AI article snippet...',
      });
      expect(w2).toBe('w2');

      // Tái sử dụng cùng URL w1 (với trailing slash khác nhau vẫn khử trùng lặp)
      const w1Duplicate = tracker.allocateWebCitation({
        title: 'GraphRAG: From Local to Global',
        url: 'https://arxiv.org/abs/2404.16130',
        domain: 'arxiv.org',
        previewSnippet: 'Đoạn trích cập nhật từ extract...',
      });
      expect(w1Duplicate).toBe('w1');

      // Kiểm tra danh sách getAllCitations
      const allCitations = tracker.getAllCitations();
      expect(allCitations).toHaveLength(3); // 1 doc (c1) + 2 web (w1, w2)
      expect(allCitations[0].citationId).toBe('c1');
      expect((allCitations[0] as any).sourceType).toBe('document');
      expect(allCitations[1].citationId).toBe('w1');
      expect((allCitations[1] as WebCitationItem).sourceType).toBe('web');
      expect((allCitations[1] as WebCitationItem).title).toBe('GraphRAG: From Local to Global');

      // Kiểm tra Ràng buộc 3: WebCitationItem không chứa trường content 4000 ký tự
      expect((allCitations[1] as any).content).toBeUndefined();
      expect((allCitations[1] as WebCitationItem).previewSnippet).toBeDefined();
    });
  });

  describe('searchInternetTool', () => {
    it('thực thi execute, cấp phát mã wX vào tracker và định dạng toModelOutput chuẩn', async () => {
      const tracker = new ChatSessionToolTracker();
      const mockCallback = vi.fn().mockResolvedValue({
        query: 'Microsoft GraphRAG',
        totalResults: 1,
        results: [
          {
            title: 'Microsoft GraphRAG Documentation',
            url: 'https://microsoft.github.io/graphrag',
            domain: 'microsoft.github.io',
            favicon: 'https://microsoft.github.io/favicon.ico',
            publishedDate: '2026-01-15',
            contentSnippet: 'GraphRAG is a modular graph-based RAG pipeline.',
            previewSnippet: 'GraphRAG is a modular...',
          },
        ],
      });

      const toolInstance = createSearchInternetTool(mockCallback, tracker);
      const output = (await toolInstance.execute!(
        { query: 'Microsoft GraphRAG', searchDepth: 'basic' },
        { toolCallId: 'tc-search-1', messages: [] },
      )) as SearchInternetToolOutput;

      expect(output.totalResults).toBe(1);
      expect(output.results[0].citationId).toBe('w1');
      expect(output.results[0].domain).toBe('microsoft.github.io');

      expect(toolInstance.toModelOutput).toBeDefined();
      const modelOut = toolInstance.toModelOutput!({ output }) as {
        type: 'text';
        value: string;
      };
      expect(modelOut.value).toContain('[Nguồn Web [w1] | Tiêu đề: "Microsoft GraphRAG Documentation"');
      expect(modelOut.value).toContain('https://microsoft.github.io/graphrag');
    });
  });

  describe('extractWebPageTool', () => {
    it('thực thi execute, cấp phát mã wX vào tracker và định dạng toModelOutput Markdown', async () => {
      const tracker = new ChatSessionToolTracker();
      const mockCallback = vi.fn().mockResolvedValue({
        query: 'Trích xuất thuật toán',
        totalSuccess: 1,
        totalFailed: 0,
        results: [
          {
            title: 'GraphRAG Paper',
            url: 'https://arxiv.org/abs/2404.16130',
            domain: 'arxiv.org',
            favicon: 'https://arxiv.org/favicon.ico',
            extractedContent: 'Chi tiết thuật toán cộng đồng đồ thị...',
            previewSnippet: 'Chi tiết thuật toán...',
          },
        ],
        failedResults: [],
      });

      const toolInstance = createExtractWebPageTool(mockCallback, tracker);
      const output = (await toolInstance.execute!(
        { urls: ['https://arxiv.org/abs/2404.16130'], query: 'Trích xuất thuật toán' },
        { toolCallId: 'tc-extract-1', messages: [] },
      )) as ExtractWebPageToolOutput;

      expect(output.totalSuccess).toBe(1);
      expect(output.results[0].citationId).toBe('w1');

      const modelOut = toolInstance.toModelOutput!({ output }) as {
        type: 'text';
        value: string;
      };
      expect(modelOut.value).toContain('[Nguồn Web [w1] | Tiêu đề: "GraphRAG Paper"');
      expect(modelOut.value).toContain('Chi tiết thuật toán cộng đồng đồ thị...');
    });
  });

  describe('ToolRegistryService toolset creation & validation', () => {
    it('createChatSessionToolset đăng ký searchInternet và extractWebPage khi có callback', () => {
      const registry = new ToolRegistryService();
      const { tools, tracker } = registry.createChatSessionToolset({
        onSearchDocumentChunks: vi.fn(),
        onGetDocumentSectionOrPages: vi.fn(),
        onSearchInternet: vi.fn(),
        onExtractWebPage: vi.fn(),
      });

      expect(tracker).toBeDefined();
      expect(tools.searchDocumentChunks).toBeDefined();
      expect(tools.getDocumentSectionOrPages).toBeDefined();
      expect(tools.searchInternet).toBeDefined();
      expect(tools.extractWebPage).toBeDefined();
      expect(tools.getConversationDocumentsMetadata).toBeUndefined();
      expect(tools.askUserQuestion).toBeDefined();
    });

    it('getChatValidationTools chứa đầy đủ schema của searchInternet và extractWebPage', () => {
      const registry = new ToolRegistryService();
      const validationTools = registry.getChatValidationTools();

      expect(validationTools.searchInternet).toBeDefined();
      expect(validationTools.extractWebPage).toBeDefined();
      expect(validationTools.searchDocumentChunks).toBeDefined();
    });
  });

  describe('HttpLoggingFilter status code preservation', () => {
    it('bảo toàn mã HTTP status và message khi gặp non-HttpException có trường status/statusCode (như 413 PayloadTooLargeError)', () => {
      const filter = new HttpLoggingFilter();
      const mockJson = vi.fn();
      const mockStatus = vi.fn().mockReturnValue({ json: mockJson });
      const mockHost = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'POST',
            url: '/api/chat-agent/stream',
            ip: '127.0.0.1',
            headers: {},
          }),
          getResponse: () => ({
            status: mockStatus,
          }),
        }),
      } as any;

      const payloadTooLargeError = new Error('request entity too large') as any;
      payloadTooLargeError.status = 413;
      payloadTooLargeError.type = 'entity.too.large';

      filter.catch(payloadTooLargeError, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(413);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 413,
          message: 'request entity too large',
        }),
      );
    });
  });
});
