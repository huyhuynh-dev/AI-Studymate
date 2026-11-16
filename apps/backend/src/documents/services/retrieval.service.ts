import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { EmbeddingService } from '../../ai/embedding.service.js';
import { AiService } from '../../ai/ai.service.js';

export const DEFAULT_TOP_K = 8;
export const DEFAULT_RRF_POOL_SIZE = 25;
export const DEFAULT_CANDIDATE_LIMIT = 80;
export const DEFAULT_RRF_K = 60;
export const MAX_KEYWORDS = 5;
const MAX_SUB_QUERIES = 3;
const QUERY_DECOMPOSE_TIMEOUT_MS = 2500;
const RERANK_TIMEOUT_MS = 8000;
const MIN_QUERY_LENGTH_FOR_DECOMPOSE = 35;
const COMPLEX_QUERY_HINT_REGEX =
  /\b(so sánh|khác nhau|giống nhau|phân biệt|ưu nhược điểm|nhược điểm|ưu điểm|và|đồng thời|với|compare|versus|vs|difference)\b/i;

export interface RetrievedChunkAsset {
  id: string;
  assetType: string;
  storageKey: string;
  caption?: string | null;
  pageNo?: number | null;
}

export interface RetrievedNeighborChunk {
  id: string;
  chunkIndex: number;
  content: string;
  pageNumbers: number[];
}

export interface RetrievedChunk {
  id: string;
  documentId: string;
  fileName: string;
  chunkIndex: number;
  pageNumbers: number[];
  content: string;
  rawContent?: string | null;
  headings: string[];
  chunkType: string;
  hasImage: boolean;
  hasTable: boolean;
  bboxes?: unknown;
  assets: RetrievedChunkAsset[];
  neighbors?: {
    prev?: RetrievedNeighborChunk | null;
    next?: RetrievedNeighborChunk | null;
  };
  rrfScore: number;
  vectorRank: number | null;
  keywordRank: number | null;
  rerankScore?: number | null;
  rrfRank?: number | null;
  subQueriesUsed?: string[];
}

export interface AvailableDocumentTocItem {
  text: string;
  level: number;
  pageNo: number | null;
}

export interface AvailableDocumentItem {
  documentId: string;
  fileName: string;
  uploadedAt: Date;
  pageCount?: number | null;
  toc?: AvailableDocumentTocItem[];
}

export interface HybridSearchParams {
  userId: string;
  conversationId: string;
  /**
   * Tham số 1: Câu văn, đoạn văn hoặc câu hỏi giàu ngữ cảnh dùng cho Vector Search (pgvector)
   */
  semanticQuery: string;
  /**
   * Tham số 2: Mảng danh sách các từ khóa/thuật ngữ (tối đa 5 từ) dùng cho Keyword Search (PGRoonga)
   */
  keywords: string[];
  /**
   * Danh sách documentId được người dùng đính kèm ưu tiên tìm kiếm trước (nếu có)
   */
  preferredDocumentIds?: string[];
  /**
   * Lọc theo danh sách số trang cụ thể (ví dụ: [3, 4])
   */
  pageNumbers?: number[];
  /**
   * Lọc theo khoảng trang (ví dụ: { start: 1, end: 10 })
   */
  pageRange?: {
    start: number;
    end: number;
  };
  /**
   * Cờ mở rộng ngữ cảnh liền kề (chunk_index - 1 và chunk_index + 1)
   */
  includeNeighbors?: boolean;
  /**
   * Số lượng chunks kết quả cuối cùng trả về sau bước Rerank (Mặc định: 8)
   */
  topK?: number;
  /**
   * Số lượng ứng viên tối đa lấy từ mỗi nhánh tìm kiếm trước khi RRF (Mặc định: 80)
   */
  candidateLimit?: number;
  /**
   * Số lượng chunks giữ lại ở bước lọc thô RRF trước khi đưa qua Rerank Model (Mặc định: 25)
   */
  rrfPoolSize?: number;
  /**
   * Hằng số làm mượt RRF k (Mặc định: 60)
   */
  rrfK?: number;
  /**
   * Bật/tắt bước Query Transformation & Decomposition (Mặc định: true)
   */
  enableQueryDecompose?: boolean;
  /**
   * Bật/tắt bước Cross-Encoder Reranking (Mặc định: true)
   */
  enableRerank?: boolean;
}

export interface GetDocumentSectionOrPagesParams {
  userId: string;
  conversationId: string;
  documentId: string;
  pageNumbers?: number[];
  headingKeyword?: string;
}

export interface DocumentSectionChunk {
  id: string;
  documentId: string;
  fileName: string;
  chunkIndex: number;
  pageNumbers: number[];
  headings: string[];
  content: string;
  rawContent?: string | null;
  chunkType: string;
  hasImage: boolean;
  hasTable: boolean;
  bboxes?: unknown;
  assets: RetrievedChunkAsset[];
}

export interface DocumentSectionOrPagesOutput {
  documentId: string;
  fileName: string;
  pageCount: number;
  isFullDocument: boolean;
  totalChunks: number;
  chunks: DocumentSectionChunk[];
  message?: string;
}

export interface GetDocumentsFullContentParams {
  userId: string;
  conversationId: string;
  /**
   * Danh sách documentId cụ thể do LLM truyền vào khi người dùng yêu cầu tóm tắt/đọc tài liệu A, B, C
   */
  documentIds?: string[];
  /**
   * Đặt là true khi người dùng yêu cầu tóm tắt hoặc tổng hợp toàn bộ tài liệu có trong cuộc trò chuyện
   */
  fetchAllDocuments?: boolean;
  /**
   * Danh sách documentId được người dùng đính kèm trong khung chat (ưu tiên nếu không chỉ định documentIds)
   */
  preferredDocumentIds?: string[];
}

export interface DocumentFullContent {
  documentId: string;
  fileName: string;
  rawText: string;
  characterCount: number;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    @Optional() private readonly aiService?: AiService,
  ) {}

  private extractValidUuids(ids?: string[]): string[] {
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    return Array.from(
      new Set(
        ids
          .filter((id) => typeof id === 'string')
          .map((id) => id.trim())
          .filter((id) => UUID_REGEX.test(id)),
      ),
    );
  }

  /**
   * Lấy danh mục tài liệu khả dụng (đã hoàn tất trích xuất văn bản OCR) trong cuộc trò chuyện
   * để cung cấp cho System Prompt của LLM biết tên tài liệu nào ứng với documentId nào,
   * kèm số trang và mục lục rút gọn (TOC cấp H1, H2).
   */
  async getAvailableDocumentsCatalog(
    userId: string,
    conversationId: string,
  ): Promise<AvailableDocumentItem[]> {
    const documents = await this.prisma.document.findMany({
      where: {
        conversation_id: conversationId,
        user_id: userId,
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

    return documents.map((doc) => {
      let toc: AvailableDocumentTocItem[] = [];
      if (
        doc.doc_metadata &&
        typeof doc.doc_metadata === 'object' &&
        'toc' in doc.doc_metadata &&
        Array.isArray((doc.doc_metadata as any).toc)
      ) {
        const rawToc = (doc.doc_metadata as any).toc;
        toc = rawToc
          .filter(
            (item: any) =>
              item &&
              typeof item.text === 'string' &&
              (item.level === 1 || item.level === 2),
          )
          .slice(0, 15) // Giới hạn tối đa 15 mục để bảo vệ context window
          .map((item: any) => ({
            text: String(item.text).trim(),
            level: Number(item.level),
            pageNo: item.page_no ? Number(item.page_no) : null,
          }));
      }

      return {
        documentId: doc.id,
        fileName: doc.file_name,
        uploadedAt: doc.uploaded_at,
        pageCount: doc.page_count ?? null,
        toc,
      };
    });
  }

  /**
   * Truy xuất các đoạn văn bản (chunks) theo phân đoạn hoặc trang của tài liệu.
   * Nếu tài liệu ngắn (<= 15 trang) và không chỉ định trang/mục: trả về toàn bộ chunks.
   * Nếu tài liệu dài hoặc có chỉ định trang/mục: chỉ lọc đúng phạm vi yêu cầu để chống tràn context window.
   */
  async getDocumentSectionOrPages(
    params: GetDocumentSectionOrPagesParams,
  ): Promise<DocumentSectionOrPagesOutput> {
    const { userId, conversationId, documentId, pageNumbers, headingKeyword } =
      params;

    const doc = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        conversation_id: conversationId,
        user_id: userId,
        ocr_status: 'done',
      },
      select: {
        id: true,
        file_name: true,
        page_count: true,
      },
    });

    if (!doc) {
      this.logger.warn(
        `[RetrievalService] Không tìm thấy tài liệu [${documentId}] trong conversation [${conversationId}]`,
      );
      return {
        documentId,
        fileName: 'Unknown',
        pageCount: 0,
        isFullDocument: false,
        totalChunks: 0,
        chunks: [],
        message: 'Không tìm thấy tài liệu hoặc bạn không có quyền truy cập.',
      };
    }

    const pageCount = doc.page_count ?? 1;
    const isTargetingPages =
      Array.isArray(pageNumbers) && pageNumbers.length > 0;
    const isTargetingHeading =
      typeof headingKeyword === 'string' && headingKeyword.trim().length > 0;

    let chunkWhere: Prisma.DocumentChunkWhereInput = {
      document_id: doc.id,
    };

    let isFullDocument = false;

    if (isTargetingPages) {
      const sanitizedPages = pageNumbers.filter(
        (p) => Number.isInteger(p) && p > 0,
      );
      chunkWhere = {
        ...chunkWhere,
        page_numbers: {
          hasSome: sanitizedPages,
        },
      };
    } else if (isTargetingHeading) {
      const kw = headingKeyword.trim().toLowerCase();
      chunkWhere = {
        ...chunkWhere,
        OR: [
          { headings: { has: headingKeyword.trim() } },
          { content: { contains: kw, mode: 'insensitive' } },
        ],
      };
    } else if (pageCount <= 15) {
      isFullDocument = true;
    } else {
      this.logger.log(
        `[RetrievalService] Tài liệu [${doc.id}] dài (${pageCount} trang). Giới hạn 20 chunks đầu tiên.`,
      );
    }

    const chunks = await this.prisma.documentChunk.findMany({
      where: chunkWhere,
      select: {
        id: true,
        chunk_index: true,
        page_numbers: true,
        headings: true,
        content: true,
        raw_content: true,
        chunk_type: true,
        has_image: true,
        has_table: true,
        bboxes: true,
        assets: {
          select: {
            id: true,
            asset_type: true,
            storage_key: true,
            caption: true,
            page_no: true,
          },
        },
      },
      orderBy: {
        chunk_index: 'asc',
      },
      take: isFullDocument ? undefined : 20,
    });

    const mappedChunks: DocumentSectionChunk[] = chunks.map((c) => ({
      id: c.id,
      documentId: doc.id,
      fileName: doc.file_name,
      chunkIndex: c.chunk_index,
      pageNumbers: c.page_numbers,
      headings: c.headings,
      content: c.content,
      rawContent: c.raw_content,
      chunkType: String(c.chunk_type),
      hasImage: c.has_image,
      hasTable: c.has_table,
      bboxes: c.bboxes,
      assets: c.assets.map((a) => ({
        id: a.id,
        assetType: a.asset_type,
        storageKey: a.storage_key,
        caption: a.caption,
        pageNo: a.page_no,
      })),
    }));

    return {
      documentId: doc.id,
      fileName: doc.file_name,
      pageCount,
      isFullDocument,
      totalChunks: mappedChunks.length,
      chunks: mappedChunks,
      ...(pageCount > 15 && !isTargetingPages && !isTargetingHeading
        ? {
            message: `Tài liệu có độ dài ${pageCount} trang (> 15 trang). Trả về tối đa ${mappedChunks.length} chunks mở đầu. Hãy chỉ định 'pageNumbers' hoặc 'headingKeyword' nếu cần đọc chi tiết các phần tiếp theo.`,
          }
        : {}),
    };
  }

  /**
   * Truy xuất toàn bộ nội dung văn bản (raw_text) của một, một nhóm hoặc tất cả tài liệu
   * thuộc cuộc trò chuyện, phục vụ các yêu cầu tóm tắt hoặc câu hỏi tổng quan.
   */
  async getDocumentsFullContent(
    params: GetDocumentsFullContentParams,
  ): Promise<DocumentFullContent[]> {
    const {
      userId,
      conversationId,
      documentIds = [],
      fetchAllDocuments = false,
      preferredDocumentIds = [],
    } = params;

    const validRequestedIds = this.extractValidUuids(documentIds);
    const validPreferredIds = this.extractValidUuids(preferredDocumentIds);

    // Trường hợp 1: Yêu cầu lấy toàn bộ tài liệu trong cuộc trò chuyện
    if (fetchAllDocuments) {
      this.logger.log(
        `[RetrievalService] Lấy toàn bộ raw_text của tất cả tài liệu trong conversation [${conversationId}]`,
      );
      return this.queryDocumentsRawText(userId, conversationId);
    }

    // Trường hợp 2: LLM chỉ định danh sách documentIds cụ thể (ví dụ tài liệu A, B, C)
    if (validRequestedIds.length > 0) {
      this.logger.log(
        `[RetrievalService] Lấy raw_text cho ${validRequestedIds.length} tài liệu được chỉ định trong conversation [${conversationId}]`,
      );
      const requestedDocs = await this.queryDocumentsRawText(
        userId,
        conversationId,
        validRequestedIds,
      );
      if (requestedDocs.length > 0) {
        return requestedDocs;
      }

      this.logger.warn(
        `[RetrievalService] Không tìm thấy tài liệu khớp với documentIds được chỉ định, chuyển sang phạm vi mặc định của conversation [${conversationId}]`,
      );
    }

    // Trường hợp 3: Người dùng có đính kèm tài liệu trong khung chat -> ưu tiên lấy tài liệu đính kèm
    if (validPreferredIds.length > 0) {
      this.logger.log(
        `[RetrievalService] Ưu tiên lấy raw_text cho ${validPreferredIds.length} tài liệu đính kèm trong conversation [${conversationId}]`,
      );
      const preferredDocs = await this.queryDocumentsRawText(
        userId,
        conversationId,
        validPreferredIds,
      );
      if (preferredDocs.length > 0) {
        return preferredDocs;
      }
    }

    // Trường hợp 4: Fallback lấy toàn bộ tài liệu trong cuộc trò chuyện
    return this.queryDocumentsRawText(userId, conversationId);
  }

  private async queryDocumentsRawText(
    userId: string,
    conversationId: string,
    targetDocumentIds?: string[],
  ): Promise<DocumentFullContent[]> {
    const docs = await this.prisma.document.findMany({
      where: {
        conversation_id: conversationId,
        user_id: userId,
        ocr_status: 'done',
        raw_text: {
          not: null,
        },
        ...(targetDocumentIds && targetDocumentIds.length > 0
          ? { id: { in: targetDocumentIds } }
          : {}),
      },
      select: {
        id: true,
        file_name: true,
        raw_text: true,
      },
      orderBy: {
        uploaded_at: 'asc',
      },
    });

    const results: DocumentFullContent[] = [];
    for (const doc of docs) {
      const trimmedText = doc.raw_text?.trim() || '';
      if (!trimmedText) continue;

      results.push({
        documentId: doc.id,
        fileName: doc.file_name,
        rawText: trimmedText,
        characterCount: trimmedText.length,
      });
    }

    return results;
  }

  /**
   * Làm sạch và giới hạn mảng từ khóa (tối đa 5 từ khóa), sau đó ghép thành
   * biểu thức truy vấn OR của PGRoonga: `"từ khóa 1" OR "từ khóa 2"`
   */
  buildPgroongaOrQuery(keywords: string[]): string {
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return '';
    }

    const seen = new Set<string>();
    const sanitizedKeywords: string[] = [];

    for (const raw of keywords) {
      if (typeof raw !== 'string') continue;
      // Loại bỏ các ký tự điều khiển cú pháp đặc biệt của PGRoonga để tránh syntax error
      const cleaned = raw
        .replace(/["()\\*+\-~<>:|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleaned) continue;

      const lower = cleaned.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);

      sanitizedKeywords.push(`"${cleaned}"`);
      if (sanitizedKeywords.length >= MAX_KEYWORDS) {
        break;
      }
    }

    return sanitizedKeywords.join(' OR ');
  }

  /**
   * Pipeline Truy xuất 5 Bước:
   * - Bước 0: Query Transformation & Decomposition (tách 1-3 subQueries + mở rộng từ khóa Việt-Anh).
   * - Bước 1: Multi-Source Retrieval (Vector Top-N + PGroonga Top-N, N=80) cho từng subQuery.
   * - Bước 2: Multi-Query RRF Coarse Filtering (k=60 -> giữ Top-M, mặc định M=25).
   * - Bước 3: Cross-Encoder Rerank Model (bge-reranker-v2-m3 -> chọn Top-K xuất sắc nhất).
   * - Bước 4: Gắn neighbors (chunk_index ± 1) cho Top-K cuối cùng nếu được yêu cầu.
   *
   * Nếu có `preferredDocumentIds`, ưu tiên tìm trong tài liệu đính kèm trước khi mở rộng toàn phiên.
   */
  async searchRelevantChunks(
    params: HybridSearchParams,
  ): Promise<RetrievedChunk[]> {
    const {
      userId,
      conversationId,
      semanticQuery,
      keywords,
      preferredDocumentIds = [],
      pageNumbers,
      pageRange,
      includeNeighbors = false,
      topK = DEFAULT_TOP_K,
      candidateLimit = DEFAULT_CANDIDATE_LIMIT,
      rrfPoolSize,
      rrfK = DEFAULT_RRF_K,
      enableQueryDecompose = true,
      enableRerank = true,
    } = params;

    const trimmedSemanticQuery = semanticQuery?.trim() || '';
    const normalizedInputKeywords = Array.isArray(keywords)
      ? keywords
          .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
          .map((k) => k.trim())
      : [];
    const fallbackPgrnQuery = this.buildPgroongaOrQuery(normalizedInputKeywords);

    if (!trimmedSemanticQuery && !fallbackPgrnQuery) {
      this.logger.warn(
        `[RetrievalService] Cả semanticQuery và keywords đều rỗng cho conversation [${conversationId}]`,
      );
      return [];
    }

    const shouldRunRerank = Boolean(this.aiService && enableRerank);
    const effectivePoolSize = shouldRunRerank
      ? Math.max(rrfPoolSize ?? DEFAULT_RRF_POOL_SIZE, topK * 3)
      : (rrfPoolSize ?? topK);

    // Bước 0: Query Transformation & Decomposition
    const plannedQueries = await this.decomposeAndExpandQuery(
      trimmedSemanticQuery,
      normalizedInputKeywords,
      enableQueryDecompose,
    );

    // Bước 1: Sinh vector embedding cho toàn bộ subQueries
    const queryTexts = plannedQueries.map(
      (sq) =>
        sq.semanticQuery.trim() ||
        sq.keywords.slice(0, MAX_KEYWORDS).join(' '),
    );
    const vectorStrings = await this.embedSubQueries(queryTexts);

    const validPreferredDocIds = this.extractValidUuids(preferredDocumentIds);
    let rrfPool: RetrievedChunk[] = [];

    // Bước 1 & 2: Truy xuất đa nguồn & Lọc thô RRF (ưu tiên tài liệu đính kèm)
    if (validPreferredDocIds.length > 0) {
      this.logger.log(
        `[RetrievalService] Ưu tiên tìm kiếm trên ${validPreferredDocIds.length} tài liệu đính kèm cho conversation [${conversationId}]`,
      );
      rrfPool = await this.executeScopedMultiQueryRrf({
        userId,
        conversationId,
        plannedQueries,
        vectorStrings,
        documentIds: validPreferredDocIds,
        pageNumbers,
        pageRange,
        poolSize: effectivePoolSize,
        candidateLimit,
        rrfK,
      });

      if (rrfPool.length === 0) {
        this.logger.log(
          `[RetrievalService] Không tìm thấy chunk nào trong tài liệu đính kèm, chuyển sang tìm kiếm toàn cục trên conversation [${conversationId}]`,
        );
      }
    }

    if (rrfPool.length === 0) {
      rrfPool = await this.executeScopedMultiQueryRrf({
        userId,
        conversationId,
        plannedQueries,
        vectorStrings,
        pageNumbers,
        pageRange,
        poolSize: effectivePoolSize,
        candidateLimit,
        rrfK,
      });
    }

    this.logger.log(
      `[RetrievalService] [Bước 1 & 2 - RRF Coarse Filter] Conversation=${conversationId} | ${plannedQueries.length} subQuery(s) | N=${candidateLimit}/nhánh -> RRF Pool thu được M=${rrfPool.length} chunks`,
    );

    if (rrfPool.length === 0) {
      return [];
    }

    // Bước 3: Lọc tinh bằng Cross-Encoder Rerank Model (bge-reranker-v2-m3)
    const originalQueryForRerank =
      trimmedSemanticQuery ||
      normalizedInputKeywords.slice(0, MAX_KEYWORDS).join(' ');
    const subQueriesUsed = plannedQueries.map((q) => q.semanticQuery);

    const finalResults = await this.rerankCandidateChunks({
      query: originalQueryForRerank,
      rrfPool,
      topK,
      subQueriesUsed,
      enableRerank,
    });

    // Bước 4: Mở rộng ngữ cảnh liền kề trên Top-K cuối cùng
    if (includeNeighbors && finalResults.length > 0) {
      await this.attachNeighbors(finalResults);
    }

    return finalResults;
  }

  private async decomposeAndExpandQuery(
    semanticQuery: string,
    keywords: string[],
    enableQueryDecompose: boolean,
  ): Promise<Array<{ semanticQuery: string; keywords: string[] }>> {
    const fallbackPlan = [
      {
        semanticQuery,
        keywords: keywords.slice(0, MAX_KEYWORDS),
      },
    ];

    if (!enableQueryDecompose || !this.aiService || !semanticQuery) {
      return fallbackPlan;
    }

    const isShortSimpleQuery =
      semanticQuery.length < MIN_QUERY_LENGTH_FOR_DECOMPOSE &&
      !COMPLEX_QUERY_HINT_REGEX.test(semanticQuery);
    if (isShortSimpleQuery) {
      this.logger.log(
        `[RetrievalService] [Bước 0 - Fast-path] Truy vấn ngắn/đơn giản -> Giữ nguyên 1 truy vấn gốc (0ms LLM)`,
      );
      return fallbackPlan;
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      QUERY_DECOMPOSE_TIMEOUT_MS,
    );

    try {
      const { object } = await this.aiService.generateObjectForFeature(
        'QUERY_DECOMPOSE',
        { semanticQuery, keywords },
        { abortSignal: controller.signal },
      );

      if (!object || !Array.isArray(object.subQueries) || object.subQueries.length === 0) {
        return fallbackPlan;
      }

      const sanitizedSubQueries = object.subQueries
        .slice(0, MAX_SUB_QUERIES)
        .map((sq, idx) => {
          const cleanSemantic =
            typeof sq?.semanticQuery === 'string' && sq.semanticQuery.trim()
              ? sq.semanticQuery.trim()
              : semanticQuery;
          const expandedKeywords = Array.isArray(sq?.keywords)
            ? sq.keywords
                .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
                .map((k) => k.trim())
            : [];

          // Đảm bảo không làm rơi từ khóa gốc quan trọng ở subQuery đầu tiên
          const mergedKeywords =
            idx === 0
              ? Array.from(new Set([...keywords, ...expandedKeywords]))
              : expandedKeywords;

          return {
            semanticQuery: cleanSemantic,
            keywords: (mergedKeywords.length > 0 ? mergedKeywords : keywords).slice(
              0,
              MAX_KEYWORDS,
            ),
          };
        })
        .filter((sq) => sq.semanticQuery.length > 0 || sq.keywords.length > 0);

      if (sanitizedSubQueries.length === 0) {
        return fallbackPlan;
      }

      const elapsedMs = Date.now() - startTime;
      const summary = sanitizedSubQueries
        .map(
          (sq, i) =>
            `  - SubQuery #${i + 1}: "${sq.semanticQuery}" | keywords=[${sq.keywords.join(', ')}]`,
        )
        .join('\n');
      this.logger.log(
        `[RetrievalService] [Bước 0 - Query Decomposition] isComplex=${Boolean(object.isComplex)} | Tách thành ${sanitizedSubQueries.length} subQuery(s) (${elapsedMs}ms):\n${summary}`,
      );

      return sanitizedSubQueries;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[RetrievalService] [Bước 0 - Fallback] Query Decomposition thất bại (${msg}), giữ nguyên truy vấn gốc`,
      );
      return fallbackPlan;
    } finally {
      clearTimeout(timer);
    }
  }

  private async embedSubQueries(queryTexts: string[]): Promise<string[]> {
    if (queryTexts.length === 1) {
      const singleVector = await this.embeddingService.embedSingle(queryTexts[0]);
      return [`[${singleVector.join(',')}]`];
    }

    if (typeof this.embeddingService.embedBatch === 'function') {
      const batchResults = await this.embeddingService.embedBatch(queryTexts);
      return batchResults
        .sort((a, b) => a.index - b.index)
        .map((item) => `[${item.values.join(',')}]`);
    }

    const vectors = await Promise.all(
      queryTexts.map((text) => this.embeddingService.embedSingle(text)),
    );
    return vectors.map((values) => `[${values.join(',')}]`);
  }

  private async executeScopedMultiQueryRrf(options: {
    userId: string;
    conversationId: string;
    plannedQueries: Array<{ semanticQuery: string; keywords: string[] }>;
    vectorStrings: string[];
    documentIds?: string[];
    pageNumbers?: number[];
    pageRange?: { start: number; end: number };
    poolSize: number;
    candidateLimit: number;
    rrfK: number;
  }): Promise<RetrievedChunk[]> {
    const {
      userId,
      conversationId,
      plannedQueries,
      vectorStrings,
      documentIds,
      pageNumbers,
      pageRange,
      poolSize,
      candidateLimit,
      rrfK,
    } = options;

    const perQueryResults = await Promise.all(
      plannedQueries.map((sq, index) =>
        this.executeHybridRrfQuery({
          userId,
          conversationId,
          vectorString: vectorStrings[index],
          pgrnQuery: this.buildPgroongaOrQuery(sq.keywords),
          documentIds,
          pageNumbers,
          pageRange,
          topK: poolSize,
          candidateLimit,
          rrfK,
        }),
      ),
    );

    if (perQueryResults.length === 1) {
      return perQueryResults[0].slice(0, poolSize);
    }

    return this.fuseMultiQueryRrfResults(perQueryResults, poolSize, rrfK);
  }

  private fuseMultiQueryRrfResults(
    perQueryResults: RetrievedChunk[][],
    poolSize: number,
    rrfK: number,
  ): RetrievedChunk[] {
    const fusedMap = new Map<
      string,
      { chunk: RetrievedChunk; multiRrfScore: number }
    >();

    for (const queryChunks of perQueryResults) {
      for (let rankIdx = 0; rankIdx < queryChunks.length; rankIdx++) {
        const chunk = queryChunks[rankIdx];
        const contribution = 1.0 / (rrfK + rankIdx + 1) + chunk.rrfScore * 0.1;
        const existing = fusedMap.get(chunk.id);

        if (!existing) {
          fusedMap.set(chunk.id, {
            chunk: { ...chunk },
            multiRrfScore: contribution,
          });
          continue;
        }

        existing.multiRrfScore += contribution;
        existing.chunk.rrfScore = Number(
          Math.max(existing.chunk.rrfScore, chunk.rrfScore).toFixed(5),
        );
        existing.chunk.vectorRank = this.pickBetterRank(
          existing.chunk.vectorRank,
          chunk.vectorRank,
        );
        existing.chunk.keywordRank = this.pickBetterRank(
          existing.chunk.keywordRank,
          chunk.keywordRank,
        );
      }
    }

    return Array.from(fusedMap.values())
      .sort((a, b) => b.multiRrfScore - a.multiRrfScore)
      .slice(0, poolSize)
      .map((entry) => ({
        ...entry.chunk,
        rrfScore: Number(entry.multiRrfScore.toFixed(5)),
      }));
  }

  private pickBetterRank(a: number | null, b: number | null): number | null {
    if (a === null) return b;
    if (b === null) return a;
    return Math.min(a, b);
  }

  private formatChunkForRerank(chunk: RetrievedChunk): string {
    const headingPrefix =
      chunk.headings && chunk.headings.length > 0
        ? `[Mục: ${chunk.headings.join(' > ')}]\n`
        : '';
    return `${headingPrefix}${chunk.content}`;
  }

  private async rerankCandidateChunks(options: {
    query: string;
    rrfPool: RetrievedChunk[];
    topK: number;
    subQueriesUsed: string[];
    enableRerank: boolean;
  }): Promise<RetrievedChunk[]> {
    const { query, rrfPool, topK, subQueriesUsed, enableRerank } = options;

    if (!this.aiService || !enableRerank) {
      const sliced = rrfPool.slice(0, topK);
      if (subQueriesUsed.length > 1) {
        return sliced.map((c) => ({ ...c, subQueriesUsed }));
      }
      return sliced;
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RERANK_TIMEOUT_MS);

    try {
      const documentsForRerank = rrfPool.map((chunk) =>
        this.formatChunkForRerank(chunk),
      );
      const { ranking } = await this.aiService.rerankDocuments({
        query,
        documents: documentsForRerank,
        topN: topK,
        abortSignal: controller.signal,
      });

      const seenIndexes = new Set<number>();
      const sortedRanking = [...ranking]
        .filter(
          (item) =>
            Number.isInteger(item.originalIndex) &&
            item.originalIndex >= 0 &&
            item.originalIndex < rrfPool.length,
        )
        .sort((a, b) => b.score - a.score)
        .filter((item) => {
          if (seenIndexes.has(item.originalIndex)) return false;
          seenIndexes.add(item.originalIndex);
          return true;
        })
        .slice(0, topK);

      if (sortedRanking.length === 0) {
        return rrfPool.slice(0, topK).map((chunk, idx) => ({
          ...chunk,
          rerankScore: null,
          rrfRank: idx + 1,
          ...(subQueriesUsed.length > 1 ? { subQueriesUsed } : {}),
        }));
      }

      const rerankedChunks: RetrievedChunk[] = sortedRanking.map((item) => {
        const candidate = rrfPool[item.originalIndex];
        return {
          ...candidate,
          rerankScore: Number(item.score.toFixed(4)),
          rrfRank: item.originalIndex + 1,
          ...(subQueriesUsed.length > 1 ? { subQueriesUsed } : {}),
        };
      });

      const elapsedMs = Date.now() - startTime;
      const traceLines = rerankedChunks
        .map((c, idx) => {
          const pages = c.pageNumbers?.join(', ') || 'N/A';
          return `  #${idx + 1} (RRF #${c.rrfRank} -> Rerank #${idx + 1} | rerankScore=${c.rerankScore} | rrfScore=${c.rrfScore} | vRank=${c.vectorRank}, kRank=${c.keywordRank}) Chunk #${c.chunkIndex} (Trang ${pages})`;
        })
        .join('\n');

      this.logger.log(
        `[RetrievalService] [Bước 3 - Cross-Encoder Rerank] Model=bge-reranker-v2-m3 | Chấm điểm ${rrfPool.length} chunks -> chọn Top K=${rerankedChunks.length} (${elapsedMs}ms)\n[RetrievalService] [Kết quả Rerank Top-K]:\n${traceLines}`,
      );

      return rerankedChunks;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[RetrievalService] Rerank model không khả dụng (${msg}), tự động fallback về Top-K RRF`,
      );
      return rrfPool.slice(0, topK).map((chunk, idx) => ({
        ...chunk,
        rerankScore: null,
        rrfRank: idx + 1,
        ...(subQueriesUsed.length > 1 ? { subQueriesUsed } : {}),
      }));
    } finally {
      clearTimeout(timer);
    }
  }

  private async executeHybridRrfQuery(options: {
    userId: string;
    conversationId: string;
    vectorString: string;
    pgrnQuery: string;
    documentIds?: string[];
    pageNumbers?: number[];
    pageRange?: { start: number; end: number };
    topK: number;
    candidateLimit: number;
    rrfK: number;
  }): Promise<RetrievedChunk[]> {
    const {
      userId,
      conversationId,
      vectorString,
      pgrnQuery,
      documentIds,
      pageNumbers,
      pageRange,
      topK,
      candidateLimit,
      rrfK,
    } = options;

    const hasKeywords = pgrnQuery.length > 0;
    const documentFilterSql =
      documentIds && documentIds.length > 0
        ? Prisma.sql`AND d."id" = ANY(${documentIds}::uuid[])`
        : Prisma.empty;

    const targetPages = new Set<number>();
    if (Array.isArray(pageNumbers)) {
      for (const p of pageNumbers) {
        if (Number.isInteger(p) && p > 0) targetPages.add(p);
      }
    }
    if (
      pageRange &&
      Number.isInteger(pageRange.start) &&
      Number.isInteger(pageRange.end)
    ) {
      const start = Math.max(1, Math.min(pageRange.start, pageRange.end));
      const end = Math.min(
        start + 100,
        Math.max(pageRange.start, pageRange.end),
      );
      for (let i = start; i <= end; i++) {
        targetPages.add(i);
      }
    }

    const pageFilterSql =
      targetPages.size > 0
        ? Prisma.sql`AND dc."page_numbers" && ${Array.from(targetPages)}::integer[]`
        : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        documentId: string;
        fileName: string;
        chunkIndex: number;
        pageNumbers: number[] | null;
        content: string;
        rawContent: string | null;
        headings: string[] | null;
        chunkType: string;
        hasImage: boolean;
        hasTable: boolean;
        bboxes: unknown;
        assetsJson: unknown;
        rrfScore: number;
        vectorRank: number | null;
        keywordRank: number | null;
      }>
    >(Prisma.sql`
      WITH
      allowed_docs AS (
        SELECT
          d."id",
          d."file_name"
        FROM "documents" d
        WHERE d."conversation_id" = ${conversationId}::uuid
          AND d."user_id" = ${userId}::uuid
          AND d."embed_status" = 'done'
          ${documentFilterSql}
      ),
      vector_search AS (
        SELECT
          dc."id",
          ROW_NUMBER() OVER (
            ORDER BY dc."embedding" <=> ${vectorString}::vector ASC, dc."chunk_index" ASC
          ) AS rn
        FROM "document_chunks" dc
        INNER JOIN allowed_docs ad ON ad."id" = dc."document_id"
        WHERE dc."embedding" IS NOT NULL
          ${pageFilterSql}
        ORDER BY dc."embedding" <=> ${vectorString}::vector ASC, dc."chunk_index" ASC
        LIMIT ${candidateLimit}
      ),
      keyword_search AS (
        SELECT
          dc."id",
          ROW_NUMBER() OVER (
            ORDER BY pgroonga_score(dc.tableoid, dc.ctid) DESC, dc."chunk_index" ASC
          ) AS rn
        FROM "document_chunks" dc
        INNER JOIN allowed_docs ad ON ad."id" = dc."document_id"
        WHERE ${hasKeywords}
          AND dc."content" &@~ ${pgrnQuery}
          ${pageFilterSql}
        ORDER BY pgroonga_score(dc.tableoid, dc.ctid) DESC, dc."chunk_index" ASC
        LIMIT ${candidateLimit}
      )
      SELECT
        dc."id" AS "id",
        dc."document_id" AS "documentId",
        ad."file_name" AS "fileName",
        dc."chunk_index" AS "chunkIndex",
        dc."page_numbers" AS "pageNumbers",
        dc."content" AS "content",
        dc."raw_content" AS "rawContent",
        dc."headings" AS "headings",
        dc."chunk_type"::text AS "chunkType",
        dc."has_image" AS "hasImage",
        dc."has_table" AS "hasTable",
        dc."bboxes" AS "bboxes",
        COALESCE(asset_sub.assets_json, '[]'::json) AS "assetsJson",
        (
          COALESCE(1.0 / (${rrfK} + v.rn), 0.0) +
          COALESCE(1.0 / (${rrfK} + k.rn), 0.0)
        )::float AS "rrfScore",
        v.rn::int AS "vectorRank",
        k.rn::int AS "keywordRank"
      FROM vector_search v
      FULL OUTER JOIN keyword_search k ON v."id" = k."id"
      INNER JOIN "document_chunks" dc ON dc."id" = COALESCE(v."id", k."id")
      INNER JOIN allowed_docs ad ON ad."id" = dc."document_id"
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'id', da."id",
          'assetType', da."asset_type",
          'storageKey', da."storage_key",
          'caption', da."caption",
          'pageNo', da."page_no"
        )) AS assets_json
        FROM "document_assets" da
        WHERE da."chunk_id" = dc."id"
      ) asset_sub ON true
      ORDER BY "rrfScore" DESC, v.rn ASC NULLS LAST, k.rn ASC NULLS LAST
      LIMIT ${topK};
    `);

    return rows.map((row) => {
      const rawAssets = row.assetsJson;
      const assets: RetrievedChunkAsset[] = Array.isArray(rawAssets)
        ? rawAssets
            .filter((a: any) => a && typeof a === 'object')
            .map((a: any) => ({
              id: String(a.id),
              assetType: String(a.assetType || 'image'),
              storageKey: String(a.storageKey || ''),
              caption: a.caption ? String(a.caption) : null,
              pageNo: a.pageNo ? Number(a.pageNo) : null,
            }))
        : [];

      return {
        id: row.id,
        documentId: row.documentId,
        fileName: row.fileName,
        chunkIndex: Number(row.chunkIndex),
        pageNumbers: Array.isArray(row.pageNumbers) ? row.pageNumbers : [],
        content: row.content,
        rawContent: row.rawContent,
        headings: Array.isArray(row.headings) ? row.headings : [],
        chunkType: String(row.chunkType || 'text'),
        hasImage: Boolean(row.hasImage),
        hasTable: Boolean(row.hasTable),
        bboxes: row.bboxes,
        assets,
        rrfScore: Number(row.rrfScore),
        vectorRank: row.vectorRank !== null ? Number(row.vectorRank) : null,
        keywordRank: row.keywordRank !== null ? Number(row.keywordRank) : null,
      };
    });
  }

  private async attachNeighbors(chunks: RetrievedChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    const requestsByDoc = new Map<string, Set<number>>();
    for (const chunk of chunks) {
      let set = requestsByDoc.get(chunk.documentId);
      if (!set) {
        set = new Set<number>();
        requestsByDoc.set(chunk.documentId, set);
      }
      if (chunk.chunkIndex > 0) {
        set.add(chunk.chunkIndex - 1);
      }
      set.add(chunk.chunkIndex + 1);
    }

    const orConditions: Array<{
      document_id: string;
      chunk_index: { in: number[] };
    }> = [];
    for (const [docId, indexes] of requestsByDoc.entries()) {
      if (indexes.size > 0) {
        orConditions.push({
          document_id: docId,
          chunk_index: { in: Array.from(indexes) },
        });
      }
    }

    if (orConditions.length === 0) return;

    const neighborRows = await this.prisma.documentChunk.findMany({
      where: {
        OR: orConditions,
      },
      select: {
        id: true,
        document_id: true,
        chunk_index: true,
        content: true,
        page_numbers: true,
      },
    });

    const neighborMap = new Map<string, RetrievedNeighborChunk>();
    for (const row of neighborRows) {
      neighborMap.set(`${row.document_id}:${row.chunk_index}`, {
        id: row.id,
        chunkIndex: row.chunk_index,
        content: row.content,
        pageNumbers: row.page_numbers,
      });
    }

    for (const chunk of chunks) {
      chunk.neighbors = {
        prev:
          neighborMap.get(`${chunk.documentId}:${chunk.chunkIndex - 1}`) ??
          null,
        next:
          neighborMap.get(`${chunk.documentId}:${chunk.chunkIndex + 1}`) ??
          null,
      };
    }
  }
}
