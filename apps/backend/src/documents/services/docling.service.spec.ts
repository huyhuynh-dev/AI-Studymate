import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DoclingService,
  TRANSPARENT_1X1_PNG_DATA_URI,
} from './docling.service.js';
import {
  buildDoclingConvertPayload,
  DEFAULT_PICTURE_DESCRIPTION_AREA_THRESHOLD,
} from '../payloads/index.js';
import { ConfigService } from '@nestjs/config';

describe('DoclingService', () => {
  let service: DoclingService;
  let configService: ConfigService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    configService = {
      get: vi.fn((key: string) => {
        if (key === 'DOCLING_SERVER_URL') return 'http://localhost:5001';
        if (key === 'DOCLING_TIMEOUT_SECONDS') return '10';
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new DoclingService(configService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('buildDoclingConvertPayload', () => {
    it('sets picture_description_area_threshold to 0.01 by default so figures >= 1% page area are described', () => {
      const payload = buildDoclingConvertPayload({
        fileName: 'Popular_Search_Algorithms.pdf',
        base64String: 'dGVzdA==',
        vlmApi: {
          url: 'http://host.docker.internal:20128/v1/chat/completions',
          apiKey: 'sk-test',
          model: 'groq/qwen/qwen3.8-27b',
        },
      });

      const options = payload.options as Record<string, unknown>;
      expect(options.do_picture_description).toBe(true);
      expect(options.picture_description_area_threshold).toBe(
        DEFAULT_PICTURE_DESCRIPTION_AREA_THRESHOLD,
      );
      expect(options.picture_description_area_threshold).toBe(0.01);
    });
  });

  describe('isHealthy', () => {
    it('should return true when health check succeeds with ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' }),
      } as Response);

      const result = await service.isHealthy();
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5001/health',
        expect.any(Object),
      );
    });

    it('should return false when health check fails or errors', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error('Connection refused'));

      const result = await service.isHealthy();
      expect(result).toBe(false);
    });
  });

  describe('convertDocument & convertDocumentToMarkdown', () => {
    it('should return empty string for empty buffer', async () => {
      const result = await service.convertDocumentToMarkdown(
        Buffer.alloc(0),
        'empty.pdf',
      );
      expect(result).toBe('');
    });

    it('should submit async task, strip base64 images, extract pictures (both meta and annotations) and TOC', async () => {
      const buffer = Buffer.from('dummy-pdf-content');
      const pngBase64 = Buffer.from('fake-png-binary').toString('base64');

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ task_id: 'task-123' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ task_id: 'task-123', task_status: 'success' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'success',
            processing_time: 2.345,
            document: {
              filename: 'sample.pdf',
              md_content: `# Heading 1\nSample content\n![Chart](data:image/png;base64,${pngBase64})\n![Diagram](data:image/png;base64,${pngBase64})`,
              json_content: {
                pages: {
                  '1': {
                    page_no: 1,
                    image: { uri: `data:image/png;base64,${pngBase64}` },
                  },
                  '2': { page_no: 2 },
                },
                texts: [
                  {
                    label: 'section_header',
                    text: 'Heading 1',
                    level: 1,
                    prov: [{ page_no: 1 }],
                  },
                ],
                tables: [{}],
                pictures: [
                  {
                    self_ref: '#/pictures/0',
                    label: 'picture',
                    prov: [
                      { page_no: 1, bbox: { l: 10, t: 20, r: 100, b: 200 } },
                    ],
                    annotations: [
                      {
                        text: 'Biểu đồ doanh thu theo quý',
                        predicted_classes: [
                          { class_name: 'bar_chart', confidence: 0.95 },
                        ],
                      },
                    ],
                    image: {
                      mimetype: 'image/png',
                      uri: `data:image/png;base64,${pngBase64}`,
                    },
                  },
                  {
                    self_ref: '#/pictures/1',
                    label: 'picture',
                    prov: [
                      { page_no: 2, bbox: { l: 30, t: 40, r: 180, b: 220 } },
                    ],
                    meta: {
                      description: {
                        text: 'Sơ đồ minh họa thuật toán tìm kiếm chiều sâu DFS',
                      },
                      classification: {
                        predictions: [
                          { class_name: 'flow_chart', confidence: 0.92 },
                        ],
                      },
                    },
                    image: {
                      mimetype: 'image/png',
                      uri: `data:image/png;base64,${pngBase64}`,
                    },
                  },
                ],
              },
            },
          }),
        } as Response);

      const conversion = await service.convertDocument(buffer, 'sample.pdf');

      expect(conversion.mdContent).toBe(
        '# Heading 1\nSample content\n![Chart](#/pictures/0)\n![Diagram](#/pictures/1)',
      );
      expect(conversion.pageCount).toBe(2);
      expect(conversion.docMetadata).toEqual({
        toc: [{ text: 'Heading 1', level: 1, page_no: 1 }],
        processing_time: 2.35,
        total_tables: 1,
        total_pictures: 2,
      });
      expect(conversion.extractedPictures).toHaveLength(2);
      expect(conversion.extractedPictures[0]).toMatchObject({
        index: 0,
        selfRef: '#/pictures/0',
        assetType: 'bar_chart',
        pageNo: 1,
        vlmDescription: 'Biểu đồ doanh thu theo quý',
        mimeType: 'image/png',
      });
      expect(conversion.extractedPictures[1]).toMatchObject({
        index: 1,
        selfRef: '#/pictures/1',
        assetType: 'flow_chart',
        pageNo: 2,
        vlmDescription: 'Sơ đồ minh họa thuật toán tìm kiếm chiều sâu DFS',
        mimeType: 'image/png',
      });

      // Base64 URI must be replaced with valid 1x1 transparent PNG data URI in both pages and pictures
      const sanitizedPages = conversion.sanitizedJsonContent?.pages as Record<
        string,
        Record<string, unknown>
      >;
      expect((sanitizedPages['1'].image as Record<string, unknown>).uri).toBe(
        TRANSPARENT_1X1_PNG_DATA_URI,
      );

      const sanitizedPictures = (conversion.sanitizedJsonContent?.pictures ??
        []) as Array<Record<string, unknown>>;
      expect(
        (sanitizedPictures[0].image as Record<string, unknown>).uri,
      ).toBe(TRANSPARENT_1X1_PNG_DATA_URI);
      expect(
        (sanitizedPictures[1].image as Record<string, unknown>).uri,
      ).toBe(TRANSPARENT_1X1_PNG_DATA_URI);
    });

    it('should throw an error if task status reports failure', async () => {
      const buffer = Buffer.from('corrupt-pdf');

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ task_id: 'task-fail' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            task_id: 'task-fail',
            task_status: 'failure',
            error_message: 'Corrupted document format',
          }),
        } as Response);

      await expect(
        service.convertDocumentToMarkdown(buffer, 'corrupt.pdf'),
      ).rejects.toThrow('Corrupted document format');
    });
  });

  describe('chunkMarkdownHybrid & chunkFromDoclingJson & enrichChunksWithDoclingJson', () => {
    it('should return empty array for empty or whitespace markdown', async () => {
      const result = await service.chunkMarkdownHybrid('   \n\t  ');
      expect(result).toEqual([]);
    });

    it('resolves top-level doc_items JSON Pointers from ChunkedDocumentResultItem in chunkFromDoclingJson', async () => {
      const sanitizedJsonContent = {
        texts: [
          {
            self_ref: '#/texts/0',
            label: 'text',
            text: 'Giới thiệu về thuật toán BFS.',
            prov: [
              { page_no: 1, bbox: { l: 50, t: 100, r: 400, b: 140 } },
            ],
          },
          {
            self_ref: '#/texts/1',
            label: 'caption',
            text: 'Hình 1: Cây tìm kiếm BFS',
            prov: [
              { page_no: 1, bbox: { l: 60, t: 310, r: 250, b: 330 } },
            ],
          },
          {
            self_ref: '#/texts/2',
            label: 'code',
            text: 'function bfs(root) { return []; }',
            prov: [
              { page_no: 2, bbox: { l: 50, t: 400, r: 450, b: 500 } },
            ],
          },
        ],
        tables: [
          {
            self_ref: '#/tables/0',
            label: 'table',
            prov: [
              { page_no: 2, bbox: { l: 40, t: 100, r: 500, b: 280 } },
            ],
          },
        ],
        pictures: [
          {
            self_ref: '#/pictures/0',
            label: 'picture',
            captions: [{ $ref: '#/texts/1' }],
            prov: [
              { page_no: 1, bbox: { l: 60, t: 150, r: 350, b: 300 } },
            ],
            meta: {
              description: { text: 'Mô tả sơ đồ cây BFS' },
              classification: {
                predictions: [{ class_name: 'diagram', confidence: 0.9 }],
              },
            },
          },
        ],
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ task_id: 'chunk-json-task' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            task_id: 'chunk-json-task',
            task_status: 'success',
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            chunks: [
              {
                filename: 'algo.json',
                chunk_index: 0,
                text: '1. BFS\nGiới thiệu về thuật toán BFS.\nHình 1: Cây tìm kiếm BFS',
                raw_text: 'Giới thiệu về thuật toán BFS.\nHình 1: Cây tìm kiếm BFS',
                num_tokens: 28,
                headings: ['1. BFS'],
                captions: ['Hình 1: Cây tìm kiếm BFS'],
                doc_items: ['#/texts/0', '#/texts/1'],
                page_numbers: [1],
                metadata: {
                  has_image: false,
                },
              },
              {
                filename: 'algo.json',
                chunk_index: 1,
                text: '2. So sánh\n| Thuật toán | Độ phức tạp |\n| --- | --- |\n| BFS | O(V+E) |\n```js\nfunction bfs(root) { return []; }\n```',
                raw_text: '| Thuật toán | Độ phức tạp |\n| --- | --- |\n| BFS | O(V+E) |',
                num_tokens: 45,
                headings: ['2. So sánh'],
                doc_items: ['#/tables/0', '#/texts/2'],
                page_numbers: [2],
                metadata: {
                  has_image: false,
                },
              },
            ],
          }),
        } as Response);

      const chunks = await service.chunkFromDoclingJson(
        sanitizedJsonContent,
        'algo.pdf',
      );

      expect(chunks).toHaveLength(2);
      // Chunk 0 had '#/texts/1' which is caption of '#/pictures/0' -> bridged automatically!
      expect(chunks[0].pageNumbers).toEqual([1]);
      expect(chunks[0].hasImage).toBe(true);
      expect(chunks[0].hasTable).toBe(false);
      expect(chunks[0].chunkType).toBe('image_desc');
      expect(chunks[0].metadata?.self_refs).toEqual(
        expect.arrayContaining(['#/texts/0', '#/texts/1', '#/pictures/0']),
      );
      expect(chunks[0].bboxes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            self_ref: '#/texts/0',
            page_no: 1,
          }),
          expect.objectContaining({
            self_ref: '#/pictures/0',
            page_no: 1,
          }),
        ]),
      );

      // Chunk 1 has table + code block -> mixed
      expect(chunks[1].pageNumbers).toEqual([2]);
      expect(chunks[1].hasTable).toBe(true);
      expect(chunks[1].chunkType).toBe('mixed');
      expect(chunks[1].bboxes).toHaveLength(2);
    });

    it('enriches Markdown fallback chunks via reverse matching and content heuristics', () => {
      const sanitizedJsonContent = {
        texts: [
          {
            self_ref: '#/texts/0',
            label: 'text',
            text: 'Thuật toán tìm kiếm A* sử dụng hàm heuristic để ước lượng chi phí.',
            prov: [{ page_no: 3, bbox: { l: 10, t: 20, r: 300, b: 60 } }],
          },
        ],
        tables: [],
        pictures: [],
      };

      const extractedPictures = [
        {
          index: 1,
          selfRef: '#/pictures/1',
          assetType: 'diagram',
          pageNo: 3,
          bbox: { l: 50, t: 100, r: 400, b: 300 },
          caption: 'Hình 2: Minh họa đường đi A*',
          vlmDescription: 'Sơ đồ lưới các ô vuông mô tả đường đi ngắn nhất của thuật toán A*',
          mimeType: 'image/png',
          buffer: Buffer.from('test'),
        },
      ];

      const fallbackChunks = [
        {
          index: 0,
          pageNumbers: [1],
          content:
            'Thuật toán tìm kiếm A* sử dụng hàm heuristic để ước lượng chi phí.\nHình 2: Minh họa đường đi A*\n| Node | Cost |\n| --- | --- |\n| A | 5 |',
          rawContent:
            'Thuật toán tìm kiếm A* sử dụng hàm heuristic để ước lượng chi phí.',
          bboxes: [],
          metadata: { self_refs: [] },
        },
      ];

      const enriched = service.enrichChunksWithDoclingJson(
        fallbackChunks,
        sanitizedJsonContent,
        extractedPictures,
      );

      expect(enriched[0].pageNumbers).toContain(3);
      expect(enriched[0].hasTable).toBe(true);
      expect(enriched[0].hasImage).toBe(true);
      expect(enriched[0].chunkType).toBe('mixed');
      expect(enriched[0].metadata?.self_refs).toEqual(
        expect.arrayContaining(['#/texts/0', '#/pictures/1']),
      );
      expect(enriched[0].bboxes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ self_ref: '#/texts/0', page_no: 3 }),
          expect.objectContaining({ self_ref: '#/pictures/1', page_no: 3 }),
        ]),
      );
    });
  });
});
