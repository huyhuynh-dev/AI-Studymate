import { describe, it, expect, vi } from 'vitest';
import {
  ChatSessionToolTracker,
  ToolRegistryService,
} from './tool-registry.service.js';
import {
  type CitationItem,
  type DocumentCitationItem,
  type SearchDocumentChunksToolOutput,
  type GetDocumentSectionOrPagesToolOutput,
  type SearchInternetToolOutput,
  type ExtractWebPageToolOutput,
  type CreateFlashcardsToolOutput,
  type CreateQuizToolOutput,
  type WebCitationItem,
} from './types.js';

function expectDocumentCitation(
  citation: CitationItem | undefined,
): DocumentCitationItem {
  if (!citation || citation.sourceType !== 'document') {
    throw new Error('Expected DocumentCitationItem');
  }
  return citation;
}
import { createSearchDocumentChunksTool } from './definitions/documents/search-document-chunks.tool.js';
import { createGetDocumentSectionOrPagesTool } from './definitions/documents/get-document-section-or-pages.tool.js';
import { createSearchInternetTool } from './definitions/web/search-internet.tool.js';
import { createExtractWebPageTool } from './definitions/web/extract-web-page.tool.js';
import { createCreateFlashcardsTool } from './definitions/flashcards/create-flashcards.tool.js';
import { createCreateQuizTool } from './definitions/quiz/create-quiz.tool.js';
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
      const trackedCitation = expectDocumentCitation(tracker.getCitation('c1'));
      expect(trackedCitation.rawContent).toBe('Đạo hàm của hàm số f(x) tại điểm x0...');
      expect(trackedCitation.bboxes).toBeNull();
      expect(trackedCitation.assets).toEqual([]);

      expect(toolInstance.toModelOutput).toBeDefined();
      const modelOutput = toolInstance.toModelOutput!({
        toolCallId: 'tc-1',
        input: {
          semanticQuery: 'Đạo hàm là gì',
          keywords: ['đạo hàm'],
          includeNeighbors: true,
        },
        output,
      }) as {
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

    it('nên lưu vết subQueriesUsed, rerankScore, rrfScore, rrfRank, vectorRank và keywordRank vào tracker và lightweightOutput', async () => {
      const tracker = new ChatSessionToolTracker();
      const mockCallback = vi.fn().mockResolvedValue([
        {
          id: 'chunk-rerank-1',
          documentId: 'doc-1',
          fileName: 'OS.pdf',
          chunkIndex: 12,
          pageNumbers: [20],
          headings: ['Deadlock Avoidance'],
          content: 'Banker algorithm checks safe state before resource allocation.',
          rawContent: 'Banker algorithm checks safe state before resource allocation.',
          chunkType: 'text',
          hasImage: false,
          hasTable: false,
          bboxes: null,
          assets: [],
          rrfScore: 0.024684,
          rerankScore: -0.6123,
          rrfRank: 4,
          vectorRank: 2,
          keywordRank: 1,
          subQueriesUsed: ['Round Robin scheduling', 'Banker algorithm deadlock'],
        },
      ]);

      const toolInstance = createSearchDocumentChunksTool(mockCallback, tracker);
      const input = {
        semanticQuery: 'So sánh Round Robin và Banker',
        keywords: ['Round Robin', 'Banker'],
      };
      const output = (await toolInstance.execute!(input, {
        toolCallId: 'tc-rerank-1',
        messages: [],
      })) as SearchDocumentChunksToolOutput;

      expect(output.subQueriesUsed).toEqual([
        'Round Robin scheduling',
        'Banker algorithm deadlock',
      ]);
      expect(output.chunks[0]).toMatchObject({
        citationId: 'c1',
        rrfScore: 0.02468,
        rerankScore: -0.6123,
        rrfRank: 4,
        vectorRank: 2,
        keywordRank: 1,
      });

      const tracked = expectDocumentCitation(tracker.getCitation('c1'));
      expect(tracked).toMatchObject({
        rrfScore: 0.02468,
        rerankScore: -0.6123,
        rrfRank: 4,
        vectorRank: 2,
        keywordRank: 1,
      });

      const lightweight = tracker.getLightweightOutput('tc-rerank-1') as {
        subQueriesUsed?: string[];
        citationIds?: string[];
      };
      expect(lightweight.subQueriesUsed).toEqual([
        'Round Robin scheduling',
        'Banker algorithm deadlock',
      ]);
      expect(lightweight.citationIds).toEqual(['c1']);

      const modelOut = toolInstance.toModelOutput!({
        toolCallId: 'tc-rerank-1',
        input,
        output,
      }) as { type: 'text'; value: string };
      expect(modelOut.value).toContain('Rerank: -0.6123');
      expect(modelOut.value).toContain('RRF Score: 0.02468');
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
      const sec1 = expectDocumentCitation(tracker.getCitation('c1'));
      const sec2 = expectDocumentCitation(tracker.getCitation('c2'));
      expect(sec1.chunkId).toBe('chunk-sec-1');
      expect(sec1.rawContent).toBe('Đoạn trích nội dung gốc đầy đủ của trang 1...');
      expect(sec2.chunkId).toBe('chunk-sec-2');
      expect(sec2.rawContent).toBe('Đoạn trích nội dung gốc đầy đủ của trang 2...');

      // Kiểm tra toModelOutput
      expect(toolInstance.toModelOutput).toBeDefined();
      const modelOutput = toolInstance.toModelOutput!({
        toolCallId: 'tc-2',
        input: {
          documentId: 'doc-1',
          pageNumbers: [1, 2],
        },
        output,
      }) as {
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
      const searchInput = {
        query: 'Microsoft GraphRAG',
        searchDepth: 'basic' as const,
        exactMatch: false,
      };
      const output = (await toolInstance.execute!(
        searchInput,
        { toolCallId: 'tc-search-1', messages: [] },
      )) as SearchInternetToolOutput;

      expect(output.totalResults).toBe(1);
      expect(output.results[0].citationId).toBe('w1');
      expect(output.results[0].domain).toBe('microsoft.github.io');

      expect(toolInstance.toModelOutput).toBeDefined();
      const modelOut = toolInstance.toModelOutput!({
        toolCallId: 'tc-search-1',
        input: searchInput,
        output,
      }) as {
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
      const extractInput = {
        urls: ['https://arxiv.org/abs/2404.16130'],
        query: 'Trích xuất thuật toán',
      };
      const output = (await toolInstance.execute!(
        extractInput,
        { toolCallId: 'tc-extract-1', messages: [] },
      )) as ExtractWebPageToolOutput;

      expect(output.totalSuccess).toBe(1);
      expect(output.results[0].citationId).toBe('w1');

      const modelOut = toolInstance.toModelOutput!({
        toolCallId: 'tc-extract-1',
        input: extractInput,
        output,
      }) as {
        type: 'text';
        value: string;
      };
      expect(modelOut.value).toContain('[Nguồn Web [w1] | Tiêu đề: "GraphRAG Paper"');
      expect(modelOut.value).toContain('Chi tiết thuật toán cộng đồng đồ thị...');
    });
  });

  describe('createFlashcardsTool', () => {
    it('thực thi execute, lưu lightweightOutput vào tracker và định dạng toModelOutput chuẩn', async () => {
      const tracker = new ChatSessionToolTracker();
      const mockCallback = vi.fn().mockResolvedValue({
        deckId: 'deck-uuid-123',
        deckName: 'Cấu trúc dữ liệu - Cây AVL',
        deckDescription: 'Ôn tập nguyên lý cân bằng cây AVL',
        targetKind: 'new',
        savedCount: 10,
        requestedCount: 10,
        droppedCount: 0,
        types: ['basic', 'cloze'],
        documentNames: ['Giao_trinh_CTDL.pdf'],
        createdAt: '2026-11-16T10:00:00.000Z',
      });

      const toolInstance = createCreateFlashcardsTool(mockCallback, tracker);
      expect(toolInstance.execute).toBeDefined();

      const output = (await toolInstance.execute!(
        {
          documentIds: ['doc-1'],
          count: 10,
          types: ['basic', 'cloze'],
          deckName: 'Cấu trúc dữ liệu - Cây AVL',
        },
        { toolCallId: 'tc-fc-1', messages: [] },
      )) as CreateFlashcardsToolOutput;

      expect(output.deckId).toBe('deck-uuid-123');
      expect(output.savedCount).toBe(10);

      const lightweight = tracker.getLightweightOutput('tc-fc-1');
      expect(lightweight).toEqual({
        deckId: 'deck-uuid-123',
        deckName: 'Cấu trúc dữ liệu - Cây AVL',
        deckDescription: 'Ôn tập nguyên lý cân bằng cây AVL',
        targetKind: 'new',
        savedCount: 10,
        requestedCount: 10,
        droppedCount: 0,
        types: ['basic', 'cloze'],
        documentNames: ['Giao_trinh_CTDL.pdf'],
        createdAt: '2026-11-16T10:00:00.000Z',
      });

      const modelOut = toolInstance.toModelOutput!({
        toolCallId: 'tc-fc-1',
        input: {
          documentIds: ['doc-1'],
          count: 10,
          types: ['basic', 'cloze'],
          deckName: 'Cấu trúc dữ liệu - Cây AVL',
        },
        output,
      }) as {
        type: 'text';
        value: string;
      };
      expect(modelOut.type).toBe('text');
      expect(modelOut.value).toContain('deck-uuid-123');
      expect(modelOut.value).toContain('Cấu trúc dữ liệu - Cây AVL');
      expect(modelOut.value).toContain('10/10 thẻ');
    });
  });

  describe('createQuizTool', () => {
    it('thực thi execute, lưu lightweightOutput vào tracker và định dạng toModelOutput chuẩn', async () => {
      const tracker = new ChatSessionToolTracker();
      const mockCallback = vi.fn().mockResolvedValue({
        quizId: 'quiz-uuid-456',
        title: 'Đề kiểm tra Cây AVL',
        description: 'Kiểm tra kiến thức phép xoay cây AVL',
        source: 'ai',
        questionCount: 10,
        requestedCount: 10,
        types: ['single_choice', 'essay'],
        difficulty: 'applied',
        documentNames: ['Giao_trinh_CTDL.pdf'],
        createdAt: '2026-11-16T10:30:00.000Z',
      });

      const toolInstance = createCreateQuizTool(mockCallback, tracker);
      expect(toolInstance.execute).toBeDefined();

      const output = (await toolInstance.execute!(
        {
          documentIds: ['doc-1'],
          questionCount: 10,
          types: ['single_choice', 'essay'],
          difficulty: 'applied',
        },
        { toolCallId: 'tc-qz-1', messages: [] },
      )) as CreateQuizToolOutput;

      expect(output.quizId).toBe('quiz-uuid-456');
      expect(output.questionCount).toBe(10);

      const lightweight = tracker.getLightweightOutput('tc-qz-1');
      expect(lightweight).toEqual({
        quizId: 'quiz-uuid-456',
        title: 'Đề kiểm tra Cây AVL',
        description: 'Kiểm tra kiến thức phép xoay cây AVL',
        source: 'ai',
        questionCount: 10,
        requestedCount: 10,
        types: ['single_choice', 'essay'],
        difficulty: 'applied',
        documentNames: ['Giao_trinh_CTDL.pdf'],
        createdAt: '2026-11-16T10:30:00.000Z',
      });

      const modelOut = toolInstance.toModelOutput!({
        toolCallId: 'tc-qz-1',
        input: {
          documentIds: ['doc-1'],
          questionCount: 10,
          types: ['single_choice', 'essay'],
          difficulty: 'applied',
        },
        output,
      }) as {
        type: 'text';
        value: string;
      };
      expect(modelOut.type).toBe('text');
      expect(modelOut.value).toContain('quiz-uuid-456');
      expect(modelOut.value).toContain('Đề kiểm tra Cây AVL');
      expect(modelOut.value).toContain('10/10 câu');
    });

    it('truyền bloomPreset tùy chọn xuống callback createQuiz', async () => {
      const tracker = new ChatSessionToolTracker();
      const mockCallback = vi.fn().mockResolvedValue({
        quizId: 'quiz-bloom-1',
        title: 'Đề luyện thi',
        description: '',
        source: 'ai',
        questionCount: 8,
        requestedCount: 8,
        types: ['single_choice'],
        difficulty: 'advanced',
        documentNames: ['OS.pdf'],
        createdAt: '2026-11-16T11:00:00.000Z',
      });

      const toolInstance = createCreateQuizTool(mockCallback, tracker);
      await toolInstance.execute!(
        {
          documentIds: ['doc-1'],
          questionCount: 8,
          types: ['single_choice'],
          difficulty: 'advanced',
          bloomPreset: 'exam_prep',
        },
        { toolCallId: 'tc-qz-bloom', messages: [] },
      );

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          bloomPreset: 'exam_prep',
          difficulty: 'advanced',
          questionCount: 8,
        }),
      );
    });
  });

  describe('ToolRegistryService toolset creation & validation', () => {
    it('createChatSessionToolset đăng ký searchInternet, extractWebPage, createFlashcards và createQuiz khi có callback', () => {
      const registry = new ToolRegistryService();
      const { tools, tracker } = registry.createChatSessionToolset({
        onSearchDocumentChunks: vi.fn(),
        onGetDocumentSectionOrPages: vi.fn(),
        onSearchInternet: vi.fn(),
        onExtractWebPage: vi.fn(),
        onCreateFlashcards: vi.fn(),
        onCreateQuiz: vi.fn(),
      });

      expect(tracker).toBeDefined();
      expect(tools.searchDocumentChunks).toBeDefined();
      expect(tools.getDocumentSectionOrPages).toBeDefined();
      expect(tools.searchInternet).toBeDefined();
      expect(tools.extractWebPage).toBeDefined();
      expect(tools.createFlashcards).toBeDefined();
      expect(tools.createQuiz).toBeDefined();
      expect(tools.getConversationDocumentsMetadata).toBeUndefined();
      expect(tools.askUserQuestion).toBeDefined();
    });

    it('getChatValidationTools chứa đầy đủ schema của searchInternet, extractWebPage, createFlashcards và createQuiz', () => {
      const registry = new ToolRegistryService();
      const validationTools = registry.getChatValidationTools();

      expect(validationTools.searchInternet).toBeDefined();
      expect(validationTools.extractWebPage).toBeDefined();
      expect(validationTools.searchDocumentChunks).toBeDefined();
      expect(validationTools.createFlashcards).toBeDefined();
      expect(validationTools.createQuiz).toBeDefined();
    });

    it('extractAssistantUIParts trích xuất đúng part tool-createQuiz kèm lightweightOutput', () => {
      const registry = new ToolRegistryService();
      const tracker = new ChatSessionToolTracker();
      tracker.recordOutput(
        'tc-qz-extract',
        'createQuiz',
        { quizId: 'quiz-999' },
        {
          quizId: 'quiz-999',
          title: 'Đề ôn tập Đệ quy',
          source: 'ai',
          questionCount: 10,
          requestedCount: 10,
          types: ['single_choice'],
          difficulty: 'basic',
        },
      );

      const parts = registry.extractAssistantUIParts(
        [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolName: 'createQuiz',
                toolCallId: 'tc-qz-extract',
                input: {
                  questionCount: 10,
                  types: ['single_choice'],
                  difficulty: 'basic',
                },
              },
              {
                type: 'text',
                text: 'Mình đã tạo xong đề kiểm tra Đệ quy cho bạn.',
              },
            ],
          },
        ],
        tracker,
      );

      expect(parts).toEqual([
        {
          type: 'tool-createQuiz',
          toolCallId: 'tc-qz-extract',
          state: 'output-available',
          input: {
            questionCount: 10,
            types: ['single_choice'],
            difficulty: 'basic',
          },
          output: {
            quizId: 'quiz-999',
            title: 'Đề ôn tập Đệ quy',
            source: 'ai',
            questionCount: 10,
            requestedCount: 10,
            types: ['single_choice'],
            difficulty: 'basic',
          },
        },
        {
          type: 'text',
          text: 'Mình đã tạo xong đề kiểm tra Đệ quy cho bạn.',
        },
      ]);
    });

    it('extractAssistantUIParts trích xuất đúng part tool-createFlashcards kèm lightweightOutput', () => {
      const registry = new ToolRegistryService();
      const tracker = new ChatSessionToolTracker();
      tracker.recordOutput(
        'tc-fc-extract',
        'createFlashcards',
        { deckId: 'deck-999' },
        {
          deckId: 'deck-999',
          deckName: 'Bộ thẻ Đệ quy',
          savedCount: 12,
          requestedCount: 12,
          types: ['basic'],
        },
      );

      const parts = registry.extractAssistantUIParts(
        [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolName: 'createFlashcards',
                toolCallId: 'tc-fc-extract',
                input: { count: 12, types: ['basic'] },
              },
              {
                type: 'text',
                text: 'Mình đã tạo xong bộ thẻ Đệ quy cho bạn.',
              },
            ],
          },
        ],
        tracker,
      );

      expect(parts).toEqual([
        {
          type: 'tool-createFlashcards',
          toolCallId: 'tc-fc-extract',
          state: 'output-available',
          input: { count: 12, types: ['basic'] },
          output: {
            deckId: 'deck-999',
            deckName: 'Bộ thẻ Đệ quy',
            savedCount: 12,
            requestedCount: 12,
            types: ['basic'],
          },
        },
        {
          type: 'text',
          text: 'Mình đã tạo xong bộ thẻ Đệ quy cho bạn.',
        },
      ]);
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

  describe('Phase 2 L2 Read Tools & ACI Tool Count Guard (< 20 tools)', () => {
    it('đăng ký đủ 4 L2 Read Tools trong cả getChatValidationTools và createChatSessionToolset (< 20 tools)', async () => {
      const registry = new ToolRegistryService();
      const validationTools = registry.getChatValidationTools();

      expect(validationTools.getNoteContent).toBeDefined();
      expect(validationTools.getQuizContent).toBeDefined();
      expect(validationTools.getDeckCards).toBeDefined();
      expect(validationTools.searchWorkspaceResources).toBeDefined();

      const onGetNoteContent = vi.fn().mockResolvedValue({
        found: true,
        summaryId: 'sum-1',
        title: 'Ôn tập chương 2',
        sectionOutline: ['H1: Tổng quan'],
        matchedSection: null,
        contentMarkdown: '# Tổng quan\n\nNội dung ghi chú.',
        totalChars: 31,
        charOffset: 0,
        truncated: false,
      });
      const onGetQuizContent = vi.fn().mockResolvedValue({
        found: true,
        quizId: 'quiz-1',
        quizTitle: 'Quiz Kiểm Tra',
        examIntegrityEnforced: true,
        totalQuestions: 5,
        filteredCount: 1,
        returnedCount: 1,
        offset: 0,
        hasMore: false,
        questions: [
          {
            questionId: 'q-1',
            displayNumber: 1,
            questionType: 'single_choice',
            questionText: '2 + 2 bằng mấy?',
            points: 1,
            options: [
              { label: 'A', id: 'o1', text: '3' },
              { label: 'B', id: 'o2', text: '4' },
            ],
          },
        ],
      });
      const onGetDeckCards = vi.fn().mockResolvedValue({
        found: true,
        deckId: 'deck-1',
        deckName: 'Deck AVL',
        totalCards: 1,
        dueCount: 1,
        filteredCount: 1,
        returnedCount: 1,
        offset: 0,
        hasMore: false,
        cards: [
          {
            cardId: 'card-1',
            cardType: 'basic',
            state: 'learning',
            intervalDays: 1,
            frontText: 'Hệ số cân bằng?',
            backText: '[ANSWER_HIDDEN_BY_STUDY_GUARD]',
            answerHidden: true,
          },
        ],
      });
      const onSearchWorkspaceResources = vi.fn().mockResolvedValue({
        scope: 'subject',
        query: 'AVL',
        totalResults: 1,
        items: [
          {
            id: 'sum-1',
            type: 'note',
            title: 'Ghi chú Cây AVL',
            conversationTitle: 'Chương 2',
            subjectName: 'CTDL',
          },
        ],
      });

      const { tools } = registry.createChatSessionToolset({
        onSearchDocumentChunks: vi.fn().mockResolvedValue([]),
        onGetDocumentSectionOrPages: vi.fn(),
        onCreateDocumentSummary: vi.fn(),
        onCreateFlashcards: vi.fn(),
        onCreateQuiz: vi.fn(),
        onGetNoteContent,
        onGetQuizContent,
        onGetDeckCards,
        onSearchWorkspaceResources,
        onSearchInternet: vi.fn(),
        onExtractWebPage: vi.fn(),
        onSuperDocInspect: vi.fn(),
        onSuperDocStreamText: vi.fn(),
        onSuperDocPerformAction: vi.fn(),
        onSuperDocApiSearch: vi.fn(),
        onSuperDocApiCall: vi.fn(),
      });

      const activeToolNames = Object.keys(tools);
      // Tối đa 17 tools kể cả 5 SuperDoc tools (luôn < 20 tools theo chuẩn Production)
      expect(activeToolNames.length).toBe(17);
      expect(activeToolNames.length).toBeLessThan(20);

      const noteOutput = await tools.getNoteContent.execute(
        { summaryId: 'sum-1' },
        { toolCallId: 'tc-note-1' },
      );
      const noteModelOut = tools.getNoteContent.toModelOutput({
        output: noteOutput,
      });
      expect(noteModelOut.value).toContain('Ôn tập chương 2');
      expect(noteModelOut.value).toContain('Nội dung ghi chú.');

      const quizOutput = await tools.getQuizContent.execute(
        { quizId: 'quiz-1' },
        { toolCallId: 'tc-quiz-1' },
      );
      const quizModelOut = tools.getQuizContent.toModelOutput({
        output: quizOutput,
      });
      expect(quizModelOut.value).toContain('EXAM_INTEGRITY_MODE_ACTIVE');
      expect(quizModelOut.value).toContain('2 + 2 bằng mấy?');

      const deckOutput = await tools.getDeckCards.execute(
        { deckId: 'deck-1' },
        { toolCallId: 'tc-deck-1' },
      );
      const deckModelOut = tools.getDeckCards.toModelOutput({
        output: deckOutput,
      });
      expect(deckModelOut.value).toContain('ĐÃ ẨN BỞI STUDY GUARD');

      const searchOutput = await tools.searchWorkspaceResources.execute(
        { query: 'AVL', scope: 'subject' },
        { toolCallId: 'tc-ws-1' },
      );
      const searchModelOut = tools.searchWorkspaceResources.toModelOutput({
        output: searchOutput,
      });
      expect(searchModelOut.value).toContain('[NOTE] "Ghi chú Cây AVL"');
    });

    it('searchDocumentChunks chuyển tiếp documentIds khi LLM lọc theo tài liệu cụ thể', async () => {
      const onSearchDocumentChunks = vi.fn().mockResolvedValue([]);
      const toolInstance = createSearchDocumentChunksTool(
        onSearchDocumentChunks,
      );

      await toolInstance.execute(
        {
          semanticQuery: 'cây cân bằng',
          keywords: ['AVL'],
          documentIds: ['doc-specific-1'],
        },
        { toolCallId: 'tc-scoped-1' } as any,
      );

      expect(onSearchDocumentChunks).toHaveBeenCalledWith(
        expect.objectContaining({
          documentIds: ['doc-specific-1'],
        }),
      );
    });
  });
});
