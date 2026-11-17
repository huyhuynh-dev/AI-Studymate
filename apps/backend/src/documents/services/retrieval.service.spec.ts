import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetrievalService } from './retrieval.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EmbeddingService } from '../../ai/embedding.service.js';
import type { AiService } from '../../ai/ai.service.js';

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

  describe('Pipeline 5 bước: Query Decomposition + Multi-Query RRF + Cross-Encoder Rerank', () => {
    let aiServiceMock: {
      generateObjectForFeature: ReturnType<typeof vi.fn>;
      rerankDocuments: ReturnType<typeof vi.fn>;
    };
    let enhancedEmbeddingMock: {
      embedSingle: ReturnType<typeof vi.fn>;
      embedBatch: ReturnType<typeof vi.fn>;
    };
    let enhancedService: RetrievalService;

    beforeEach(() => {
      aiServiceMock = {
        generateObjectForFeature: vi.fn(),
        rerankDocuments: vi.fn(),
      };
      enhancedEmbeddingMock = {
        embedSingle: vi.fn().mockResolvedValue(dummyVector),
        embedBatch: vi.fn().mockResolvedValue([
          { index: 0, values: dummyVector },
          { index: 1, values: dummyVector },
        ]),
      };
      enhancedService = new RetrievalService(
        prismaMock as unknown as PrismaService,
        enhancedEmbeddingMock as unknown as EmbeddingService,
        aiServiceMock as unknown as AiService,
      );
    });

    it('nên bỏ qua Query Decomposition (Fast-path) với câu hỏi ngắn đơn giản và vẫn chạy Rerank Model đảo thứ hạng Top-K', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([
        {
          id: 'chunk-rrf-1',
          documentId: validDocId,
          fileName: 'OS.pdf',
          chunkIndex: 1,
          pageNumbers: [10],
          content: 'Deadlock xuất hiện ở mục lục chương 4.',
          headings: ['Chương 4'],
          chunkType: 'text',
          hasImage: false,
          hasTable: false,
          bboxes: null,
          assetsJson: [],
          rrfScore: 0.032,
          vectorRank: 1,
          keywordRank: 1,
        },
        {
          id: 'chunk-rrf-2',
          documentId: validDocId,
          fileName: 'OS.pdf',
          chunkIndex: 5,
          pageNumbers: [15],
          content: 'Deadlock là trạng thái các tiến trình chờ đợi vòng tròn tài nguyên của nhau.',
          headings: ['4.1 Khái niệm Deadlock'],
          chunkType: 'text',
          hasImage: false,
          hasTable: false,
          bboxes: null,
          assetsJson: [],
          rrfScore: 0.015,
          vectorRank: 3,
          keywordRank: null,
        },
      ]);

      aiServiceMock.rerankDocuments.mockResolvedValueOnce({
        ranking: [
          { originalIndex: 1, score: -0.75, document: 'doc2' },
          { originalIndex: 0, score: -5.4, document: 'doc1' },
        ],
      });

      const results = await enhancedService.searchRelevantChunks({
        userId: validUserId,
        conversationId: validConversationId,
        semanticQuery: 'Deadlock là gì?',
        keywords: ['deadlock'],
        topK: 2,
      });

      expect(aiServiceMock.generateObjectForFeature).not.toHaveBeenCalled();
      expect(aiServiceMock.rerankDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'Deadlock là gì?',
          topN: 2,
          documents: [
            '[Mục: Chương 4]\nDeadlock xuất hiện ở mục lục chương 4.',
            '[Mục: 4.1 Khái niệm Deadlock]\nDeadlock là trạng thái các tiến trình chờ đợi vòng tròn tài nguyên của nhau.',
          ],
        }),
      );
      expect(results[0].id).toBe('chunk-rrf-2');
      expect(results[0].rerankScore).toBe(-0.75);
      expect(results[0].rrfRank).toBe(2);
      expect(results[1].id).toBe('chunk-rrf-1');
      expect(results[1].rerankScore).toBe(-5.4);
      expect(results[1].rrfRank).toBe(1);
    });

    it('nên tách câu hỏi so sánh thành 2 subQueries, hợp nhất Multi-Query RRF và lọc tinh qua Rerank Model', async () => {
      aiServiceMock.generateObjectForFeature.mockResolvedValueOnce({
        object: {
          isComplex: true,
          subQueries: [
            {
              semanticQuery: 'Thuật toán lập lịch CPU Round Robin và quantum time',
              keywords: ['Round Robin', 'CPU scheduling', 'time quantum'],
            },
            {
              semanticQuery: 'Thuật toán Banker tránh deadlock trong hệ điều hành',
              keywords: ['Banker', 'deadlock avoidance', 'safe state'],
            },
          ],
        },
      });

      prismaMock.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 'chunk-rr',
            documentId: validDocId,
            fileName: 'OS.pdf',
            chunkIndex: 10,
            pageNumbers: [22],
            content: 'Round Robin chia sẻ CPU công bằng theo lát thời gian q.',
            headings: ['Chương 2: Round Robin'],
            chunkType: 'text',
            hasImage: false,
            hasTable: false,
            bboxes: null,
            assetsJson: [],
            rrfScore: 0.031,
            vectorRank: 1,
            keywordRank: 1,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'chunk-banker',
            documentId: validDocId,
            fileName: 'OS.pdf',
            chunkIndex: 42,
            pageNumbers: [58],
            content: 'Thuật toán Banker kiểm tra trạng thái an toàn trước khi cấp phát tài nguyên.',
            headings: ['Chương 4: Banker'],
            chunkType: 'text',
            hasImage: false,
            hasTable: false,
            bboxes: null,
            assetsJson: [],
            rrfScore: 0.016,
            vectorRank: 1,
            keywordRank: null,
          },
        ]);

      aiServiceMock.rerankDocuments.mockResolvedValueOnce({
        ranking: [
          { originalIndex: 1, score: -0.92, document: 'banker' },
          { originalIndex: 0, score: -1.15, document: 'rr' },
        ],
      });

      const results = await enhancedService.searchRelevantChunks({
        userId: validUserId,
        conversationId: validConversationId,
        semanticQuery: 'So sánh ưu nhược điểm của thuật toán lập lịch CPU Round Robin ở Chương 2 và thuật toán Banker tránh deadlock ở Chương 4',
        keywords: ['Round Robin', 'Banker'],
        topK: 2,
      });

      expect(aiServiceMock.generateObjectForFeature).toHaveBeenCalledWith(
        'QUERY_DECOMPOSE',
        expect.objectContaining({
          keywords: ['Round Robin', 'Banker'],
        }),
        expect.any(Object),
      );
      expect(enhancedEmbeddingMock.embedBatch).toHaveBeenCalledWith([
        'Thuật toán lập lịch CPU Round Robin và quantum time',
        'Thuật toán Banker tránh deadlock trong hệ điều hành',
      ]);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('chunk-banker');
      expect(results[0].rerankScore).toBe(-0.92);
      expect(results[0].subQueriesUsed).toEqual([
        'Thuật toán lập lịch CPU Round Robin và quantum time',
        'Thuật toán Banker tránh deadlock trong hệ điều hành',
      ]);
      expect(results[1].id).toBe('chunk-rr');
    });

    it('nên fallback an toàn khi Query Decomposition và Rerank Server gặp lỗi', async () => {
      aiServiceMock.generateObjectForFeature.mockRejectedValueOnce(
        new Error('FAST model timeout'),
      );
      prismaMock.$queryRaw.mockResolvedValueOnce([
        {
          id: 'chunk-fallback-1',
          documentId: validDocId,
          fileName: 'CSDL.pdf',
          chunkIndex: 3,
          pageNumbers: [8],
          content: 'Hệ quản trị CSDL quan hệ (RDBMS) lưu dữ liệu dưới dạng bảng.',
          headings: ['Chương 1: RDBMS'],
          chunkType: 'text',
          hasImage: false,
          hasTable: false,
          bboxes: null,
          assetsJson: [],
          rrfScore: 0.029,
          vectorRank: 1,
          keywordRank: 2,
        },
      ]);
      aiServiceMock.rerankDocuments.mockRejectedValueOnce(
        new Error('ECONNREFUSED 127.0.0.1:8081'),
      );

      const results = await enhancedService.searchRelevantChunks({
        userId: validUserId,
        conversationId: validConversationId,
        semanticQuery: 'So sánh ưu nhược điểm của CSDL quan hệ RDBMS và NoSQL trong tài liệu này',
        keywords: ['CSDL quan hệ', 'RDBMS'],
        topK: 5,
      });

      expect(enhancedEmbeddingMock.embedSingle).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('chunk-fallback-1');
      expect(results[0].rerankScore).toBeNull();
      expect(results[0].rrfRank).toBe(1);
    });

    it('bỏ qua QUERY_DECOMPOSE khi enableQueryDecompose=false và không gọi rerankDocuments khi enableRerank=false', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([
        {
          id: 'chunk-no-rerank-1',
          documentId: validDocId,
          fileName: 'OS.pdf',
          chunkIndex: 1,
          pageNumbers: [4],
          content: 'Round Robin sử dụng hàng đợi FIFO.',
          headings: ['2.1 Scheduling'],
          chunkType: 'text',
          hasImage: false,
          hasTable: false,
          bboxes: null,
          assetsJson: [],
          rrfScore: 0.03,
          vectorRank: 1,
          keywordRank: 2,
        },
        {
          id: 'chunk-no-rerank-2',
          documentId: validDocId,
          fileName: 'OS.pdf',
          chunkIndex: 2,
          pageNumbers: [5],
          content: 'Banker kiểm tra điều kiện an toàn.',
          headings: ['4.2 Deadlock'],
          chunkType: 'text',
          hasImage: false,
          hasTable: false,
          bboxes: null,
          assetsJson: [],
          rrfScore: 0.02,
          vectorRank: 2,
          keywordRank: null,
        },
      ]);

      const results = await enhancedService.searchRelevantChunks({
        userId: validUserId,
        conversationId: validConversationId,
        semanticQuery:
          'So sánh ưu nhược điểm của thuật toán lập lịch CPU Round Robin và thuật toán Banker',
        keywords: ['Round Robin', 'Banker'],
        topK: 2,
        enableQueryDecompose: false,
        enableRerank: false,
      });

      expect(aiServiceMock.generateObjectForFeature).not.toHaveBeenCalled();
      expect(aiServiceMock.rerankDocuments).not.toHaveBeenCalled();
      expect(results).toHaveLength(2);
      expect(results[0].rerankScore).toBeUndefined();
      expect(results.map((r) => r.id)).toEqual([
        'chunk-no-rerank-1',
        'chunk-no-rerank-2',
      ]);
    });

    it('nới effectiveRrfPoolSize >= topK * 3 (vd topK=12 -> M=36) và gộp bảo toàn từ khóa gốc khi subQuery có chuỗi rỗng', async () => {
      aiServiceMock.generateObjectForFeature.mockResolvedValueOnce({
        object: {
          isComplex: true,
          subQueries: [
            {
              semanticQuery: '  ',
              keywords: ['  ', 'indexing'],
            },
            {
              semanticQuery: 'B-Tree index structure in RDBMS',
              keywords: ['B-Tree', 'RDBMS'],
            },
          ],
        },
      });

      prismaMock.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 'chk-pool-1',
            documentId: validDocId,
            fileName: 'DB.pdf',
            chunkIndex: 1,
            pageNumbers: [2],
            content: 'Index tối ưu hóa truy vấn SQL.',
            headings: ['Indexing'],
            chunkType: 'text',
            hasImage: false,
            hasTable: false,
            bboxes: null,
            assetsJson: [],
            rrfScore: 0.035,
            vectorRank: 1,
            keywordRank: 1,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'chk-pool-2',
            documentId: validDocId,
            fileName: 'DB.pdf',
            chunkIndex: 5,
            pageNumbers: [12],
            content: 'B-Tree giữ dữ liệu sắp xếp cân bằng.',
            headings: ['B-Tree'],
            chunkType: 'text',
            hasImage: false,
            hasTable: false,
            bboxes: null,
            assetsJson: [],
            rrfScore: 0.015,
            vectorRank: 2,
            keywordRank: null,
          },
        ]);

      aiServiceMock.rerankDocuments.mockResolvedValueOnce({
        ranking: [
          { originalIndex: 1, score: -0.35, document: 'btree' },
          { originalIndex: 0, score: -1.1, document: 'idx' },
        ],
      });

      const results = await enhancedService.searchRelevantChunks({
        userId: validUserId,
        conversationId: validConversationId,
        semanticQuery:
          'So sánh cơ chế SQL Index và cấu trúc cây B-Tree trong cơ sở dữ liệu quan hệ',
        keywords: ['SQL Index'],
        topK: 12,
      });

      // SubQuery #1 phải fallback semanticQuery về câu gốc khi AI trả chuỗi trống
      expect(enhancedEmbeddingMock.embedBatch).toHaveBeenCalledWith([
        'So sánh cơ chế SQL Index và cấu trúc cây B-Tree trong cơ sở dữ liệu quan hệ',
        'B-Tree index structure in RDBMS',
      ]);

      // Kiểm tra LIMIT truyền vào SQL CTE phải là 36 (>= topK * 3)
      const firstSqlTemplate = prismaMock.$queryRaw.mock.calls[0][0] as {
        values?: unknown[];
      };
      expect(firstSqlTemplate.values).toContain(36);
      expect(results.map((r) => r.id)).toEqual(['chk-pool-2', 'chk-pool-1']);
    });
  });
});
