import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { EmbeddingService } from '../../ai/embedding.service.js';

export const DEFAULT_TOP_K = 20;
export const DEFAULT_CANDIDATE_LIMIT = 50;
export const DEFAULT_RRF_K = 60;
export const MAX_KEYWORDS = 5;

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

export interface RetrievedChunk {
  id: string;
  documentId: string;
  fileName: string;
  chunkIndex: number;
  pageNumbers: number[];
  content: string;
  rrfScore: number;
  vectorRank: number | null;
  keywordRank: number | null;
}

export interface AvailableDocumentItem {
  documentId: string;
  fileName: string;
  uploadedAt: Date;
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
   * để cung cấp cho System Prompt của LLM biết tên tài liệu nào ứng với documentId nào.
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
      },
      orderBy: {
        uploaded_at: 'asc',
      },
    });

    return documents.map((doc) => ({
      documentId: doc.id,
      fileName: doc.file_name,
      uploadedAt: doc.uploaded_at,
    }));
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
      keywords = [],
      preferredDocumentIds = [],
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

    // Bước 2: Ưu tiên tìm kiếm trên các tài liệu được đính kèm trước (nếu có)
    if (validPreferredDocIds.length > 0) {
      this.logger.log(
        `[RetrievalService] Ưu tiên tìm kiếm trên ${validPreferredDocIds.length} tài liệu đính kèm cho conversation [${conversationId}]`,
      );
      const preferredResults = await this.executeHybridRrfQuery({
        userId,
        conversationId,
        vectorString,
        pgrnQuery,
        documentIds: validPreferredDocIds,
        topK,
        candidateLimit,
        rrfK,
      });

      if (preferredResults.length > 0) {
        this.logger.log(
          `[RetrievalService] Tìm thấy ${preferredResults.length} chunks từ tài liệu đính kèm`,
        );
        return preferredResults;
      }

      this.logger.log(
        `[RetrievalService] Không tìm thấy chunk nào trong tài liệu đính kèm, chuyển sang tìm kiếm toàn cục trên conversation [${conversationId}]`,
      );
    }

    // Bước 3: Tìm kiếm toàn cục trên tất cả tài liệu thuộc conversationId
    const globalResults = await this.executeHybridRrfQuery({
      userId,
      conversationId,
      vectorString,
      pgrnQuery,
      topK,
      candidateLimit,
      rrfK,
    });

    this.logger.log(
      `[RetrievalService] Hoàn tất Hybrid Search RRF cho conversation [${conversationId}]: trả về ${globalResults.length} chunks`,
    );

    return globalResults;
  }

  private async executeHybridRrfQuery(options: {
    userId: string;
    conversationId: string;
    vectorString: string;
    pgrnQuery: string;
    documentIds?: string[];
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
      topK,
      candidateLimit,
      rrfK,
    } = options;

    const hasKeywords = pgrnQuery.length > 0;
    const documentFilterSql =
      documentIds && documentIds.length > 0
        ? Prisma.sql`AND d."id" = ANY(${documentIds}::uuid[])`
        : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        documentId: string;
        fileName: string;
        chunkIndex: number;
        pageNumbers: number[] | null;
        content: string;
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
      ORDER BY "rrfScore" DESC, v.rn ASC NULLS LAST, k.rn ASC NULLS LAST
      LIMIT ${topK};
    `);

    return rows.map((row) => ({
      id: row.id,
      documentId: row.documentId,
      fileName: row.fileName,
      chunkIndex: Number(row.chunkIndex),
      pageNumbers: Array.isArray(row.pageNumbers) ? row.pageNumbers : [],
      content: row.content,
      rrfScore: Number(row.rrfScore),
      vectorRank: row.vectorRank !== null ? Number(row.vectorRank) : null,
      keywordRank: row.keywordRank !== null ? Number(row.keywordRank) : null,
    }));
  }
}
