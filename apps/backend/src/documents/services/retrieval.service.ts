import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { EmbeddingService } from '../../ai/embedding.service.js';

export const DEFAULT_TOP_K = 20;
export const DEFAULT_CANDIDATE_LIMIT = 50;
export const DEFAULT_RRF_K = 60;
export const MAX_KEYWORDS = 5;

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
   * Số lượng chunks kết quả cuối cùng trả về sau RRF (Mặc định: 20)
   */
  topK?: number;
  /**
   * Số lượng ứng viên tối đa lấy từ mỗi nhánh tìm kiếm trước khi RRF (Mặc định: 50)
   */
  candidateLimit?: number;
  /**
   * Hằng số làm mượt RRF k (Mặc định: 60)
   */
  rrfK?: number;
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
   * Thực hiện Hybrid Search (pgvector + PGRoonga) và hợp nhất kết quả bằng thuật toán
   * Reciprocal Rank Fusion (RRF) trực tiếp trong PostgreSQL CTE.
   *
   * Nếu có `preferredDocumentIds`, hệ thống sẽ ưu tiên tìm trong các tài liệu đính kèm trước.
   * Nếu không tìm thấy kết quả nào trong tài liệu đính kèm, hệ thống tự động mở rộng tìm kiếm
   * ra toàn bộ tài liệu thuộc `conversationId`.
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
      rrfK = DEFAULT_RRF_K,
    } = params;

    const trimmedSemanticQuery = semanticQuery?.trim() || '';
    const pgrnQuery = this.buildPgroongaOrQuery(keywords);

    if (!trimmedSemanticQuery && !pgrnQuery) {
      this.logger.warn(
        `[RetrievalService] Cả semanticQuery và keywords đều rỗng cho conversation [${conversationId}]`,
      );
      return [];
    }

    // Bước 1: Sinh vector embedding 768 chiều cho câu truy vấn ngữ nghĩa
    const queryForEmbedding =
      trimmedSemanticQuery || keywords.slice(0, MAX_KEYWORDS).join(' ');
    const embeddingValues =
      await this.embeddingService.embedSingle(queryForEmbedding);
    const vectorString = `[${embeddingValues.join(',')}]`;

    // Lọc các UUID hợp lệ từ danh sách tài liệu đính kèm (nếu có)
    const validPreferredDocIds = this.extractValidUuids(preferredDocumentIds);

    let results: RetrievedChunk[] = [];

    // Bước 2: Ưu tiên tìm kiếm trên các tài liệu được đính kèm trước (nếu có)
    if (validPreferredDocIds.length > 0) {
      this.logger.log(
        `[RetrievalService] Ưu tiên tìm kiếm trên ${validPreferredDocIds.length} tài liệu đính kèm cho conversation [${conversationId}]`,
      );
      results = await this.executeHybridRrfQuery({
        userId,
        conversationId,
        vectorString,
        pgrnQuery,
        documentIds: validPreferredDocIds,
        pageNumbers,
        pageRange,
        topK,
        candidateLimit,
        rrfK,
      });

      if (results.length > 0) {
        this.logger.log(
          `[RetrievalService] Tìm thấy ${results.length} chunks từ tài liệu đính kèm`,
        );
        if (includeNeighbors) {
          await this.attachNeighbors(results);
        }
        return results;
      }

      this.logger.log(
        `[RetrievalService] Không tìm thấy chunk nào trong tài liệu đính kèm, chuyển sang tìm kiếm toàn cục trên conversation [${conversationId}]`,
      );
    }

    // Bước 3: Tìm kiếm toàn cục trên tất cả tài liệu thuộc conversationId
    results = await this.executeHybridRrfQuery({
      userId,
      conversationId,
      vectorString,
      pgrnQuery,
      pageNumbers,
      pageRange,
      topK,
      candidateLimit,
      rrfK,
    });

    this.logger.log(
      `[RetrievalService] Hoàn tất Hybrid Search RRF cho conversation [${conversationId}]: trả về ${results.length} chunks`,
    );

    if (includeNeighbors && results.length > 0) {
      await this.attachNeighbors(results);
    }

    return results;
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
