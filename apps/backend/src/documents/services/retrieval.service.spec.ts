import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetrievalService } from './retrieval.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EmbeddingService } from '../../ai/embedding.service.js';

describe('RetrievalService', () => {
  let service: RetrievalService;
  let prismaMock: { $queryRaw: ReturnType<typeof vi.fn> };
  let embeddingMock: { embedSingle: ReturnType<typeof vi.fn> };

  const dummyVector = Array.from({ length: 768 }, (_, i) =>
    Number((i * 0.001).toFixed(4)),
  );
  const validUserId = '11111111-1111-4111-8111-111111111111';
  const validConversationId = '22222222-2222-4222-8222-222222222222';
  const validDocId = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    prismaMock = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    };
    embeddingMock = {
      embedSingle: vi.fn().mockResolvedValue(dummyVector),
    };

    service = new RetrievalService(
      prismaMock as unknown as PrismaService,
      embeddingMock as unknown as EmbeddingService,
    );
  });

  describe('buildPgroongaOrQuery', () => {
    it('nên ghép các từ khóa bằng toán tử OR và bọc trong dấu ngoặc kép', () => {
      const query = service.buildPgroongaOrQuery([
        'cây nhị phân',
        'AVL',
        'xoay trái',
      ]);
      expect(query).toBe('"cây nhị phân" OR "AVL" OR "xoay trái"');
    });

    it('nên giới hạn tối đa 5 từ khóa và loại bỏ các từ khóa trùng lặp hoặc rỗng', () => {
      const query = service.buildPgroongaOrQuery([
        'k1',
        'K1',
        '  ',
        'k2',
        'k3',
        'k4',
        'k5',
        'k6',
        'k7',
      ]);
      expect(query).toBe('"k1" OR "k2" OR "k3" OR "k4" OR "k5"');
    });

    it('nên loại bỏ các ký tự điều khiển đặc biệt của PGRoonga', () => {
      const query = service.buildPgroongaOrQuery(['(cây* "AVL")', '-nhánh']);
      expect(query).toBe('"cây AVL" OR "nhánh"');
    });

    it('nên trả về chuỗi rỗng nếu mảng từ khóa rỗng', () => {
      expect(service.buildPgroongaOrQuery([])).toBe('');
    });
  });

  describe('searchRelevantChunks', () => {
    it('nên trả về mảng rỗng nếu cả semanticQuery và keywords đều rỗng', async () => {
      const result = await service.searchRelevantChunks({
        userId: validUserId,
        conversationId: validConversationId,
        semanticQuery: '   ',
        keywords: [],
      });

      expect(result).toEqual([]);
      expect(embeddingMock.embedSingle).not.toHaveBeenCalled();
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    it('nên gọi embedSingle và truy vấn SQL CTE RRF toàn cục khi không có tài liệu đính kèm', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([
        {
          id: '44444444-4444-4444-8444-444444444444',
          documentId: validDocId,
          fileName: 'Giao_trinh_CTDL.pdf',
          chunkIndex: 2,
          pageNumbers: [12, 13],
          content: 'Cây AVL là cây nhị phân tìm kiếm tự cân bằng.',
          rrfScore: 0.03278,
          vectorRank: 1,
          keywordRank: 1,
        },
      ]);

      const results = await service.searchRelevantChunks({
        userId: validUserId,
        conversationId: validConversationId,
        semanticQuery: 'Cây AVL tự cân bằng hoạt động như thế nào?',
        keywords: ['cây AVL', 'tự cân bằng'],
      });

      expect(embeddingMock.embedSingle).toHaveBeenCalledWith(
        'Cây AVL tự cân bằng hoạt động như thế nào?',
      );
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: '44444444-4444-4444-8444-444444444444',
        documentId: validDocId,
        fileName: 'Giao_trinh_CTDL.pdf',
        chunkIndex: 2,
        pageNumbers: [12, 13],
        content: 'Cây AVL là cây nhị phân tìm kiếm tự cân bằng.',
        rrfScore: 0.03278,
        vectorRank: 1,
        keywordRank: 1,
      });
    });

    it('nên ưu tiên tìm trong preferredDocumentIds trước, và nếu có kết quả thì trả về ngay', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([
        {
          id: '55555555-5555-4555-8555-555555555555',
          documentId: validDocId,
          fileName: 'Slide_AVL.pdf',
          chunkIndex: 0,
          pageNumbers: [5],
          content: 'Định nghĩa phép xoay đơn và xoay kép.',
          rrfScore: 0.032,
          vectorRank: 1,
          keywordRank: 2,
        },
      ]);

      const results = await service.searchRelevantChunks({
        userId: validUserId,
        conversationId: validConversationId,
        semanticQuery: 'Các phép xoay trên cây AVL',
        keywords: ['xoay đơn', 'xoay kép'],
        preferredDocumentIds: [validDocId],
      });

      expect(embeddingMock.embedSingle).toHaveBeenCalledTimes(1);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
      expect(results[0].fileName).toBe('Slide_AVL.pdf');
    });

    it('nên fallback sang tìm kiếm toàn cục trên conversationId nếu preferredDocumentIds trả về 0 kết quả', async () => {
      prismaMock.$queryRaw
        .mockResolvedValueOnce([]) // Lần 1: tìm trên preferredDocumentIds -> rỗng
        .mockResolvedValueOnce([
          // Lần 2: fallback toàn cục -> có kết quả
          {
            id: '66666666-6666-4666-8666-666666666666',
            documentId: '77777777-7777-4777-8777-777777777777',
            fileName: 'Tai_lieu_chung.pdf',
            chunkIndex: 4,
            pageNumbers: [20],
            content: 'Nội dung tìm thấy từ tài liệu chung trong cuộc trò chuyện.',
            rrfScore: 0.01639,
            vectorRank: 1,
            keywordRank: null,
          },
        ]);

      const results = await service.searchRelevantChunks({
        userId: validUserId,
        conversationId: validConversationId,
        semanticQuery: 'Câu hỏi nằm ở tài liệu khác',
        keywords: ['tài liệu khác'],
        preferredDocumentIds: [validDocId],
      });

      expect(embeddingMock.embedSingle).toHaveBeenCalledTimes(1);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(1);
      expect(results[0].fileName).toBe('Tai_lieu_chung.pdf');
      expect(results[0].keywordRank).toBeNull();
    });
  });
});
