import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { DocumentChunk, Prisma } from '../../generated/prisma/client.js';

export interface InsertedChunkRecord {
    id: string;
    chunkIndex: number;
    pageNumbers: number[];
    content: string;
    hasImage: boolean;
    metadata?: Record<string, unknown>;
}

@Injectable()
export class DocumentChunksRepoService {
    constructor(private readonly prisma: PrismaService) {}

    async createDocumentChunk(
        documentId: string,
        userId: string,
        data: Omit<Prisma.DocumentChunkUncheckedCreateInput, 'document_id'>
    ): Promise<DocumentChunk> {
        const document = await this.prisma.document.findFirst({
            where: {
                id: documentId,
                user_id: userId,
            },
            select: {
                id: true,
            },
        });

        if (!document) {
            throw new NotFoundException('Không tìm thấy tài liệu hoặc bạn không có quyền truy cập');
        }

        return await this.prisma.documentChunk.create({
            data: {
                ...data,
                document_id: documentId,
            },
        });
    }

    async getAllDocumentChunks(
        documentId: string,
        userId: string
    ): Promise<DocumentChunk[]> {
        return await this.prisma.documentChunk.findMany({
            where: {
                document_id: documentId,
                document: {
                    user_id: userId,
                },
            },
            orderBy: {
                chunk_index: 'asc',
            },
        });
    }

    async getDocumentChunkById(
        chunkId: string,
        documentId: string,
        userId: string
    ): Promise<DocumentChunk | null> {
        return await this.prisma.documentChunk.findFirst({
            where: {
                id: chunkId,
                document_id: documentId,
                document: {
                    user_id: userId,
                },
            },
        });
    }

    async updateDocumentChunk(
        chunkId: string,
        documentId: string,
        userId: string,
        data: Prisma.DocumentChunkUpdateInput
    ): Promise<DocumentChunk> {
        try {
            return await this.prisma.documentChunk.update({
                where: {
                    id: chunkId,
                    document_id: documentId,
                    document: {
                        user_id: userId,
                    },
                },
                data,
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new NotFoundException('Không tìm thấy đoạn tài liệu hoặc bạn không có quyền truy cập');
            }
            throw error;
        }
    }

    async updateDocumentChunkEmbedding(
        chunkId: string,
        documentId: string,
        userId: string,
        embedding: number[]
    ): Promise<void> {
        if (
            embedding.length !== 768 ||
            embedding.some((value) => !Number.isFinite(value))
        ) {
            throw new BadRequestException('Embedding phải chứa đúng 768 giá trị số hợp lệ');
        }

        const vector = `[${embedding.join(',')}]`;
        const updatedRows = await this.prisma.$executeRaw(
            Prisma.sql`
                UPDATE "document_chunks"
                SET "embedding" = ${vector}::vector
                WHERE "id" = ${chunkId}::uuid
                  AND "document_id" = ${documentId}::uuid
                  AND EXISTS (
                      SELECT 1
                      FROM "documents"
                      WHERE "documents"."id" = "document_chunks"."document_id"
                        AND "documents"."user_id" = ${userId}::uuid
                  )
            `
        );

        if (updatedRows === 0) {
            throw new NotFoundException('Không tìm thấy đoạn tài liệu hoặc bạn không có quyền truy cập');
        }
    }

    /**
     * Xóa toàn bộ chunks cũ của document (đảm bảo idempotent khi BullMQ retry)
     * và lưu danh sách chunks kèm vector 768 chiều vào pgvector trong một transaction.
     */
    async replaceChunksWithEmbeddings(
        documentId: string,
        chunks: Array<{
            chunkIndex: number;
            pageNumbers: number[];
            content: string;
            embedding: number[];
            rawContent?: string;
            tokenCount?: number;
            headings?: string[];
            bboxes?: unknown[];
            chunkType?: 'text' | 'table' | 'code' | 'formula' | 'image_desc' | 'mixed';
            hasImage?: boolean;
            hasTable?: boolean;
            metadata?: Record<string, unknown>;
        }>
    ): Promise<InsertedChunkRecord[]> {
        for (const chunk of chunks) {
            if (
                chunk.embedding.length !== 768 ||
                chunk.embedding.some((value) => !Number.isFinite(value))
            ) {
                throw new BadRequestException(
                    `Chunk #${chunk.chunkIndex} có vector embedding không hợp lệ (yêu cầu 768 chiều)`
                );
            }
        }

        const insertedRecords: InsertedChunkRecord[] = [];

        await this.prisma.$transaction(async (tx) => {
            await tx.documentChunk.deleteMany({
                where: { document_id: documentId },
            });

            for (const chunk of chunks) {
                const vector = `[${chunk.embedding.join(',')}]`;
                const rows = await tx.$queryRaw<Array<{ id: string }>>(
                    Prisma.sql`
                        INSERT INTO "document_chunks" (
                            "id", "document_id", "chunk_index", "page_numbers", "content",
                            "raw_content", "token_count", "headings", "bboxes", "chunk_metadata",
                            "chunk_type", "has_image", "has_table", "embedding", "created_at"
                        )
                        VALUES (
                            gen_random_uuid(),
                            ${documentId}::uuid,
                            ${chunk.chunkIndex},
                            ${chunk.pageNumbers}::integer[],
                            ${chunk.content},
                            ${chunk.rawContent ?? null},
                            ${chunk.tokenCount ?? null},
                            ${chunk.headings ?? []}::text[],
                            ${chunk.bboxes ? JSON.stringify(chunk.bboxes) : null}::jsonb,
                            ${chunk.metadata ? JSON.stringify(chunk.metadata) : null}::jsonb,
                            ${chunk.chunkType ?? 'text'}::"ChunkType",
                            ${chunk.hasImage ?? false},
                            ${chunk.hasTable ?? false},
                            ${vector}::vector,
                            NOW()
                        )
                        RETURNING "id"
                    `
                );

                if (rows[0]?.id) {
                    insertedRecords.push({
                        id: rows[0].id,
                        chunkIndex: chunk.chunkIndex,
                        pageNumbers: chunk.pageNumbers,
                        content: chunk.content,
                        hasImage: chunk.hasImage ?? false,
                        metadata: chunk.metadata,
                    });
                }
            }
        });

        return insertedRecords;
    }

    async countByDocumentId(documentId: string): Promise<number> {
        return await this.prisma.documentChunk.count({
            where: { document_id: documentId },
        });
    }

    async findChunkRecordsByDocumentId(
        documentId: string
    ): Promise<InsertedChunkRecord[]> {
        const rows = await this.prisma.documentChunk.findMany({
            where: { document_id: documentId },
            orderBy: { chunk_index: 'asc' },
            select: {
                id: true,
                chunk_index: true,
                page_numbers: true,
                content: true,
                has_image: true,
                bboxes: true,
                chunk_metadata: true,
            },
        });

        return rows.map((row) => ({
            id: row.id,
            chunkIndex: row.chunk_index,
            pageNumbers: row.page_numbers,
            content: row.content,
            hasImage: row.has_image,
            metadata:
                row.chunk_metadata && typeof row.chunk_metadata === 'object'
                    ? (row.chunk_metadata as Record<string, unknown>)
                    : undefined,
        }));
    }

    /**
     * Sao chép toàn bộ chunks (bao gồm cả vector embedding 768 chiều) từ tài liệu nguồn sang tài liệu đích
     * khi phát hiện trùng lặp file_hash trong cùng cuộc trò chuyện.
     */
    async cloneChunksFromDocument(
        sourceDocumentId: string,
        targetDocumentId: string
    ): Promise<number> {
        return await this.prisma.$transaction(async (tx) => {
            await tx.documentChunk.deleteMany({
                where: { document_id: targetDocumentId },
            });

            const copiedCount = await tx.$executeRaw(
                Prisma.sql`
                    INSERT INTO "document_chunks" (
                        "id", "document_id", "chunk_index", "page_numbers", "content",
                        "raw_content", "token_count", "headings", "bboxes", "chunk_metadata",
                        "chunk_type", "has_image", "has_table", "embedding", "created_at"
                    )
                    SELECT
                        gen_random_uuid(),
                        ${targetDocumentId}::uuid,
                        "chunk_index",
                        "page_numbers",
                        "content",
                        "raw_content",
                        "token_count",
                        "headings",
                        "bboxes",
                        "chunk_metadata",
                        "chunk_type",
                        "has_image",
                        "has_table",
                        "embedding",
                        NOW()
                    FROM "document_chunks"
                    WHERE "document_id" = ${sourceDocumentId}::uuid
                    ORDER BY "chunk_index" ASC
                `
            );

            return Number(copiedCount);
        });
    }

    async deleteDocumentChunk(
        chunkId: string,
        documentId: string,
        userId: string
    ): Promise<DocumentChunk> {
        try {
            return await this.prisma.documentChunk.delete({
                where: {
                    id: chunkId,
                    document_id: documentId,
                    document: {
                        user_id: userId,
                    },
                },
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new NotFoundException('Không tìm thấy đoạn tài liệu hoặc bạn không có quyền truy cập');
            }
            throw error;
        }
    }
}
