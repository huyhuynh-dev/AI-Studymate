import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DoclingService,
  TRANSPARENT_1X1_PNG_DATA_URI,
} from './docling.service.js';
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

    it('should submit async task, strip base64 images, extract pictures and TOC', async () => {
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
              md_content: `# Heading 1\nSample content\n![Chart](data:image/png;base64,${pngBase64})`,
              json_content: {
                pages: {
                  '1': { page_no: 1, image: { uri: `data:image/png;base64,${pngBase64}` } },
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
                    prov: [{ page_no: 1, bbox: { l: 10, t: 20, r: 100, b: 200 } }],
                    annotations: [
                      {
                        text: 'Biểu đồ doanh thu theo quý',
                        predicted_classes: [{ class_name: 'bar_chart', confidence: 0.95 }],
                      },
                    ],
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
        '# Heading 1\nSample content\n![Chart](#/pictures/0)',
      );
      expect(conversion.pageCount).toBe(2);
      expect(conversion.docMetadata).toEqual({
        toc: [{ text: 'Heading 1', level: 1, page_no: 1 }],
        processing_time: 2.35,
        total_tables: 1,
        total_pictures: 1,
      });
      expect(conversion.extractedPictures).toHaveLength(1);
      expect(conversion.extractedPictures[0]).toMatchObject({
        index: 0,
        selfRef: '#/pictures/0',
        assetType: 'bar_chart',
        pageNo: 1,
        vlmDescription: 'Biểu đồ doanh thu theo quý',
        mimeType: 'image/png',
      });
      // Base64 URI must be replaced with valid 1x1 transparent PNG data URI in sanitizedJsonContent
      const sanitizedPictures = (conversion.sanitizedJsonContent?.pictures ??
        []) as Array<Record<string, unknown>>;
      const sanitizedPic = sanitizedPictures[0];
      expect(
        (sanitizedPic.image as Record<string, unknown>).uri,
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

  describe('chunkMarkdownHybrid & chunkFromDoclingJson', () => {
    it('should return empty array for empty or whitespace markdown', async () => {
      const result = await service.chunkMarkdownHybrid('   \n\t  ');
      expect(result).toEqual([]);
    });

    it('should submit async chunk task with multilingual-e5-base tokenizer and return enriched chunks', async () => {
      const markdown =
        '# Section 1\nContent paragraph 1\n\n# Section 2\nContent paragraph 2';

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ task_id: 'chunk-task-123' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            task_id: 'chunk-task-123',
            task_status: 'success',
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            chunks: [
              {
                filename: 'test.md',
                chunk_index: 0,
                text: 'Section 1\nContent paragraph 1',
                raw_text: 'Content paragraph 1',
                num_tokens: 12,
                meta: {
                  headings: ['Section 1'],
                  has_image: false,
                  doc_items: [
                    {
                      self_ref: '#/texts/1',
                      label: 'text',
                      prov: [
                        {
                          page_no: 1,
                          bbox: { l: 10, t: 50, r: 200, b: 80 },
                        },
                      ],
                    },
                  ],
                },
              },
              {
                filename: 'test.md',
                chunk_index: 1,
                page_numbers: [2, 3],
                text: 'Section 2\n| A | B |',
                raw_text: '| A | B |',
                meta: {
                  headings: ['Section 2'],
                  has_image: true,
                  doc_items: [
                    {
                      self_ref: '#/tables/0',
                      label: 'table',
                      prov: [{ page_no: 2 }],
                    },
                    {
                      self_ref: '#/pictures/0',
                      label: 'picture',
                      prov: [{ page_no: 3 }],
                    },
                  ],
                },
              },
            ],
          }),
        } as Response);

      const chunks = await service.chunkMarkdownHybrid(markdown, 'test.md');

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toMatchObject({
        index: 0,
        pageNumbers: [1],
        content: 'Section 1\nContent paragraph 1',
        rawContent: 'Content paragraph 1',
        tokenCount: 12,
        headings: ['Section 1'],
        chunkType: 'text',
        hasImage: false,
        hasTable: false,
      });
      expect(chunks[1]).toMatchObject({
        index: 1,
        pageNumbers: [2, 3],
        content: 'Section 2\n| A | B |',
        rawContent: '| A | B |',
        headings: ['Section 2'],
        chunkType: 'mixed',
        hasImage: true,
        hasTable: true,
        metadata: expect.objectContaining({
          self_refs: ['#/tables/0', '#/pictures/0'],
        }),
      });
    });
  });
});
