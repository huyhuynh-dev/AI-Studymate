import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetrievalService } from './retrieval.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EmbeddingService } from '../../ai/embedding.service.js';

describe('RetrievalService', () => {
  let service: RetrievalService;
  let prismaMock: {
    $queryRaw: ReturnType<typeof vi.fn>;
    document: { findMany: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
    documentChunk: { findMany: ReturnType<typeof vi.fn> };
  };
  let embeddingMock: { embedSingle: ReturnType<typeof vi.fn> };

  const dummyVector = Array.from({ length: 768 }, (_, i) =>
    Number((i * 0.001).toFixed(4)),
  );
  const validUserId = '11111111-1111-4111-8111-111111111111';
  const validConversationId = '22222222-2222-4222-8222-222222222222';
  const validDocId = '33333333-3333-4333-8333-333333333333';
  const validDocId2 = '44444444-4444-4444-8444-444444444444';

  beforeEach(() => {
    prismaMock = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      document: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      documentChunk: {
        findMany: vi.fn().mockResolvedValue([]),
      },
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

  describe('getAvailableDocumentsCatalog', () => {
    it('nên trả về danh mục các tài liệu đã hoàn tất OCR kèm page_count và toc', async () => {
      const now = new Date();
      prismaMock.document.findMany.mockResolvedValueOnce([
        {
          id: validDocId,
          file_name: 'Chuong_1.pdf',
          uploaded_at: now,
          page_count: 25,
          doc_metadata: {
            toc: [
              { text: 'Chương 1: Giới thiệu', level: 1, page_no: 1 },
              { text: '1.1 Khái niệm cơ bản', level: 2, page_no: 3 },
              { text: '1.1.1 Chi tiết sâu', level: 3, page_no: 4 }, // level 3 sẽ bị lọc bỏ
            ],
          },
        },
      ]);

      const catalog = await service.getAvailableDocumentsCatalog(
        validUserId,
        validConversationId,
      );

      expect(prismaMock.document.findMany).toHaveBeenCalledWith({
        where: {
          conversation_id: validConversationId,
          user_id: validUserId,
          ocr_status: 'done',
        },
        select: {
          id: true,
          file_name: true,
          uploaded_at: true,
          page_count: true,
          doc_metadata: true,
        },
        orderBy: {
          uploaded_at: 'asc',
        },
      });
      expect(catalog).toEqual([
        {
          documentId: validDocId,
          fileName: 'Chuong_1.pdf',
          uploadedAt: now,
          pageCount: 25,
          toc: [
            { text: 'Chương 1: Giới thiệu', level: 1, pageNo: 1 },
            { text: '1.1 Khái niệm cơ bản', level: 2, pageNo: 3 },
          ],
        },
      ]);
    });
  });

  describe('getDocumentsFullContent', () => {
    it('nên lấy toàn bộ tài liệu trong conversation khi fetchAllDocuments = true', async () => {
      prismaMock.document.findMany.mockResolvedValueOnce([
        {
          id: validDocId,
          file_name: 'Tai_lieu_A.pdf',
          raw_text: 'Nội dung đầy đủ của tài liệu A',
        },
        {
          id: validDocId2,
          file_name: 'Tai_lieu_B.pdf',
          raw_text: 'Nội dung đầy đủ của tài liệu B',
        },
      ]);

      const docs = await service.getDocumentsFullContent({
        userId: validUserId,
        conversationId: validConversationId,
        fetchAllDocuments: true,
      });

      expect(docs).toHaveLength(2);
      expect(docs[0]).toEqual({
        documentId: validDocId,
        fileName: 'Tai_lieu_A.pdf',
        rawText: 'Nội dung đầy đủ của tài liệu A',
        characterCount: 'Nội dung đầy đủ của tài liệu A'.length,
      });
    });

    it('nên lấy đúng các tài liệu được chỉ định trong documentIds', async () => {
      prismaMock.document.findMany.mockResolvedValueOnce([
        {
          id: validDocId,
          file_name: 'Tai_lieu_A.pdf',
          raw_text: 'Nội dung tài liệu A',
        },
      ]);

      const docs = await service.getDocumentsFullContent({
        userId: validUserId,
        conversationId: validConversationId,
        documentIds: [validDocId],
      });

      expect(prismaMock.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: [validDocId] },
          }),
        }),
      );
      expect(docs).toHaveLength(1);
      expect(docs[0].documentId).toBe(validDocId);
    });

    it('nên ưu tiên lấy tài liệu đính kèm (preferredDocumentIds) nếu không chỉ định documentIds', async () => {
      prismaMock.document.findMany.mockResolvedValueOnce([
        {
          id: validDocId2,
          file_name: 'Slide_Dinh_Kem.pdf',
          raw_text: 'Nội dung slide đính kèm',
        },
      ]);

      const docs = await service.getDocumentsFullContent({
        userId: validUserId,
        conversationId: validConversationId,
        preferredDocumentIds: [validDocId2],
      });

      expect(prismaMock.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: [validDocId2] },
          }),
        }),
      );
      expect(docs).toHaveLength(1);
      expect(docs[0].fileName).toBe('Slide_Dinh_Kem.pdf');
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
          rawContent: '# Cây AVL...',
          headings: ['Cây AVL'],
          chunkType: 'text',
          hasImage: false,
          hasTable: false,
          bboxes: null,
          assetsJson: [],
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
        rawContent: '# Cây AVL...',
        headings: ['Cây AVL'],
        chunkType: 'text',
        hasImage: false,
        hasTable: false,
        bboxes: null,
        assets: [],
        rrfScore: 0.03278,
        vectorRank: 1,
        keywordRank: 1,
      });
    });

    it('nên tự động nạp chunk_index ± 1 khi includeNeighbors = true', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([
        {
          id: 'chunk-2',
          documentId: validDocId,
          fileName: 'Giao_trinh_CTDL.pdf',
          chunkIndex: 2,
          pageNumbers: [12],
          content: 'Nội dung chunk 2',
          rawContent: null,
          headings: [],
          chunkType: 'text',
          hasImage: false,
          hasTable: false,
          bboxes: null,
          assetsJson: [],
          rrfScore: 0.03,
          vectorRank: 1,
          keywordRank: 1,
        },
      ]);

      prismaMock.documentChunk.findMany.mockResolvedValueOnce([
        {
          id: 'chunk-1',
          document_id: validDocId,
          chunk_index: 1,
          content: 'Nội dung chunk 1 (tiền đề)',
          page_numbers: [11],
        },
        {
          id: 'chunk-3',
          document_id: validDocId,
          chunk_index: 3,
          content: 'Nội dung chunk 3 (kết luận)',
          page_numbers: [13],
        },
      ]);

      const results = await service.searchRelevantChunks({
        userId: validUserId,
        conversationId: validConversationId,
        semanticQuery: 'Tìm kiếm kèm hàng xóm',
        keywords: ['hàng xóm'],
        includeNeighbors: true,
      });

      expect(results[0].neighbors).toBeDefined();
      expect(results[0].neighbors?.prev?.content).toBe(
        'Nội dung chunk 1 (tiền đề)',
      );
      expect(results[0].neighbors?.next?.content).toBe(
        'Nội dung chunk 3 (kết luận)',
      );
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

  describe('getDocumentSectionOrPages', () => {
    it('nên trả về toàn bộ chunks khi tài liệu ngắn (<= 15 trang)', async () => {
      prismaMock.document.findFirst.mockResolvedValueOnce({
        id: validDocId,
        file_name: 'Tai_lieu_ngan.pdf',
        page_count: 5,
      });

      prismaMock.documentChunk.findMany.mockResolvedValueOnce([
        {
          id: 'chunk-1',
          chunk_index: 0,
          page_numbers: [1, 2],
          headings: ['Mở đầu'],
          content: 'Nội dung trang 1 và 2',
          raw_content: '# Mở đầu\nNội dung trang 1 và 2',
          chunk_type: 'text',
          bboxes: null,
          assets: [],
        },
      ]);

      const output = await service.getDocumentSectionOrPages({
        userId: validUserId,
        conversationId: validConversationId,
        documentId: validDocId,
      });

      expect(output.isFullDocument).toBe(true);
      expect(output.totalChunks).toBe(1);
      expect(output.chunks[0].headings).toEqual(['Mở đầu']);
    });

    it('nên lọc theo pageNumbers khi được chỉ định', async () => {
      prismaMock.document.findFirst.mockResolvedValueOnce({
        id: validDocId,
        file_name: 'Tai_lieu_dai.pdf',
        page_count: 50,
      });

      prismaMock.documentChunk.findMany.mockResolvedValueOnce([
        {
          id: 'chunk-3',
          chunk_index: 2,
          page_numbers: [3],
          headings: ['Trang 3'],
          content: 'Nội dung trang 3',
          raw_content: 'Nội dung trang 3',
          chunk_type: 'text',
          bboxes: null,
          assets: [],
        },
      ]);

      const output = await service.getDocumentSectionOrPages({
        userId: validUserId,
        conversationId: validConversationId,
        documentId: validDocId,
        pageNumbers: [3],
      });

      expect(prismaMock.documentChunk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            document_id: validDocId,
            page_numbers: { hasSome: [3] },
          }),
        }),
      );
      expect(output.chunks).toHaveLength(1);
      expect(output.chunks[0].pageNumbers).toEqual([3]);
    });
  });
});
