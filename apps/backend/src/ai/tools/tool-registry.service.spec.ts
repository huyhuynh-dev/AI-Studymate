import { describe, it, expect, vi } from 'vitest';
import {
  ChatSessionToolTracker,
  ToolRegistryService,
} from './tool-registry.service.js';
import {
  type SearchDocumentChunksToolOutput,
  type GetDocumentSectionOrPagesToolOutput,
} from './types.js';
import { createSearchDocumentChunksTool } from './definitions/documents/search-document-chunks.tool.js';
import { createGetDocumentSectionOrPagesTool } from './definitions/documents/get-document-section-or-pages.tool.js';

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
          rawContent: null,
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
            rawContent: null,
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
            rawContent: null,
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

      // Ghi nhận vào tracker
      expect(tracker.getAllCitations()).toHaveLength(2);
      expect(tracker.getCitation('c1')?.chunkId).toBe('chunk-sec-1');
      expect(tracker.getCitation('c2')?.chunkId).toBe('chunk-sec-2');

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

  describe('ToolRegistryService toolset creation', () => {
    it('createChatSessionToolset không chứa getConversationDocumentsMetadata và chứa getDocumentSectionOrPages', () => {
      const registry = new ToolRegistryService();
      const { tools, tracker } = registry.createChatSessionToolset({
        onSearchDocumentChunks: vi.fn(),
        onGetDocumentSectionOrPages: vi.fn(),
      });

      expect(tracker).toBeDefined();
      expect(tools.searchDocumentChunks).toBeDefined();
      expect(tools.getDocumentSectionOrPages).toBeDefined();
      expect(tools.getConversationDocumentsMetadata).toBeUndefined();
      expect(tools.askUserQuestion).toBeDefined();
    });
  });
});
