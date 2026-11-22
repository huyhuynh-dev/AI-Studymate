import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { DocumentChunk, Prisma } from '../../generated/prisma/client.js';
import {
    computeChunkContentHash,
    type ExistingChunkForDiff,
    type InsertChunkPlanItem,
    type KeptChunkPlanItem,
} from '../../documents/helpers/chunk-diff.helper.js';

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

    /**
     * Lấy danh sách chunks (kèm page_numbers, headings, bboxes) cho nhiều tài liệu một lượt,
     * phục vụ sinh Flashcard & Quiz AI gắn nguồn gốc tọa độ.
     */
    async findChunksByDocumentIds(
        documentIds: string[],
        userId?: string
    ): Promise<
        Array<{
            id: string;
            document_id: string;
            chunk_index: number;
            content: string;
            raw_content: string | null;
            page_numbers: number[];
            headings: string[];
            bboxes: Prisma.JsonValue | null;
        }>
    > {
        const uniqueIds = [...new Set(documentIds.filter(Boolean))];
        if (uniqueIds.length === 0) return [];

        return await this.prisma.documentChunk.findMany({
            where: {
                document_id: { in: uniqueIds },
                ...(userId ? { document: { user_id: userId } } : {}),
            },
            select: {
                id: true,
                document_id: true,
                chunk_index: true,
                content: true,
                raw_content: true,
                page_numbers: true,
                headings: true,
                bboxes: true,
            },
            orderBy: [{ document_id: 'asc' }, { chunk_index: 'asc' }],
        });
    }

    /**
     * Truy xuất danh sách chunks mục tiêu (kèm các chunk liền kề chunk_index ± 1 trong cùng tài liệu)
     * phục vụ tính năng Weak-Chunk Targeted Quiz mà vẫn giữ đầy đủ ngữ cảnh và tọa độ source_refs.
     */
    async findChunksWithNeighborsByIds(
        chunkIds: string[],
        userId: string,
        conversationId: string
    ): Promise<
        Array<{
            documentId: string;
            fileName: string;
            chunks: Array<{
                id: string;
                chunkIndex: number;
                content: string;
                rawContent: string | null;
                pageNumbers: number[];
                headings: string[];
                bboxes: Prisma.JsonValue | null;
            }>;
        }>
    > {
        const uniqueIds = [...new Set(chunkIds.filter(Boolean))];
        if (uniqueIds.length === 0) return [];

        const targetRows = await this.prisma.documentChunk.findMany({
            where: {
                id: { in: uniqueIds },
                document: {
                    user_id: userId,
                    conversation_id: conversationId,
                },
            },
            select: {
                id: true,
                document_id: true,
                chunk_index: true,
                content: true,
                raw_content: true,
                page_numbers: true,
                headings: true,
                bboxes: true,
                document: {
                    select: {
                        file_name: true,
                    },
                },
            },
        });

        if (targetRows.length === 0) return [];

        const neighborIndexesByDoc = new Map<string, Set<number>>();
        const docNameMap = new Map<string, string>();

        for (const row of targetRows) {
            docNameMap.set(row.document_id, row.document.file_name);
            let idxSet = neighborIndexesByDoc.get(row.document_id);
            if (!idxSet) {
                idxSet = new Set<number>();
                neighborIndexesByDoc.set(row.document_id, idxSet);
            }
            if (row.chunk_index > 0) idxSet.add(row.chunk_index - 1);
            idxSet.add(row.chunk_index);
            idxSet.add(row.chunk_index + 1);
        }

        const orConditions = Array.from(neighborIndexesByDoc.entries()).map(
            ([docId, indexes]) => ({
                document_id: docId,
                chunk_index: { in: Array.from(indexes) },
            })
        );

        const expandedRows = await this.prisma.documentChunk.findMany({
            where: {
                OR: orConditions,
                document: {
                    user_id: userId,
                    conversation_id: conversationId,
                },
            },
            select: {
                id: true,
                document_id: true,
                chunk_index: true,
                content: true,
                raw_content: true,
                page_numbers: true,
                headings: true,
                bboxes: true,
                document: {
                    select: {
                        file_name: true,
                    },
                },
            },
            orderBy: [{ document_id: 'asc' }, { chunk_index: 'asc' }],
        });

        const grouped = new Map<
            string,
            {
                documentId: string;
                fileName: string;
                chunks: Array<{
                    id: string;
                    chunkIndex: number;
                    content: string;
                    rawContent: string | null;
                    pageNumbers: number[];
                    headings: string[];
                    bboxes: Prisma.JsonValue | null;
                }>;
            }
        >();

        for (const row of expandedRows) {
            let entry = grouped.get(row.document_id);
            if (!entry) {
                entry = {
                    documentId: row.document_id,
                    fileName:
                        docNameMap.get(row.document_id) ??
                        row.document.file_name,
                    chunks: [],
                };
                grouped.set(row.document_id, entry);
            }
            entry.chunks.push({
                id: row.id,
                chunkIndex: row.chunk_index,
                content: row.content,
                rawContent: row.raw_content,
                pageNumbers: row.page_numbers,
                headings: row.headings,
                bboxes: row.bboxes,
            });
        }

        return Array.from(grouped.values());
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
            contentHash?: string;
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
                const contentHash =
                    chunk.contentHash ??
                    computeChunkContentHash({
                        content: chunk.content,
                        headings: chunk.headings,
                    });
                const rows = await tx.$queryRaw<Array<{ id: string }>>(
                    Prisma.sql`
                        INSERT INTO "document_chunks" (
                            "id", "document_id", "chunk_index", "page_numbers", "content",
                            "raw_content", "content_hash", "token_count", "headings", "bboxes", "chunk_metadata",
                            "chunk_type", "has_image", "has_table", "embedding", "created_at"
                        )
                        VALUES (
                            gen_random_uuid(),
                            ${documentId}::uuid,
                            ${chunk.chunkIndex},
                            ${chunk.pageNumbers}::integer[],
                            ${chunk.content},
                            ${chunk.rawContent ?? null},
                            ${contentHash},
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

    async findExistingChunksForDiff(
        documentId: string
    ): Promise<ExistingChunkForDiff[]> {
        const rows = await this.prisma.documentChunk.findMany({
            where: { document_id: documentId },
            orderBy: { chunk_index: 'asc' },
            select: {
                id: true,
                chunk_index: true,
                content_hash: true,
                content: true,
                headings: true,
            },
        });

        return rows.map((row) => ({
            id: row.id,
            chunkIndex: row.chunk_index,
            contentHash: row.content_hash,
            content: row.content,
            headings: row.headings,
        }));
    }

    /**
     * Phương án 2: Áp dụng kế hoạch Incremental Chunk Diffing trong một Prisma transaction duy nhất.
     * - Xóa chunk dư thừa (`toDeleteIds`).
     * - Dùng 2-Phase Negative-Index Shift để cập nhật `chunk_index` & metadata cho `keptChunks` mà KHÔNG chạm vào `id` (UUID) hay `embedding` 768 chiều cũ.
     * - Chỉ INSERT các chunk mới/sửa đổi (`toInsertWithEmbeddings`) kèm vector mới.
     */
    async applyIncrementalChunkPlanWithEmbeddings(
        documentId: string,
        plan: {
            keptChunks: KeptChunkPlanItem[];
            toInsertWithEmbeddings: Array<
                InsertChunkPlanItem & { embedding: number[] }
            >;
            toDeleteIds: string[];
        }
    ): Promise<InsertedChunkRecord[]> {
        for (const item of plan.toInsertWithEmbeddings) {
            if (
                item.embedding.length !== 768 ||
                item.embedding.some((value) => !Number.isFinite(value))
            ) {
                throw new BadRequestException(
                    `Chunk #${item.chunkIndex} có vector embedding không hợp lệ (yêu cầu 768 chiều)`
                );
            }
        }

        const resultRecords: InsertedChunkRecord[] = [];

        await this.prisma.$transaction(async (tx) => {
            if (plan.toDeleteIds.length > 0) {
                await tx.documentChunk.deleteMany({
                    where: {
                        document_id: documentId,
                        id: { in: plan.toDeleteIds },
                    },
                });
            }

            // Phase 1: Dời tạm các chunk giữ nguyên bị đổi vị trí sang index âm để tránh xung đột @@unique([document_id, chunk_index])
            let shiftCounter = 0;
            for (const kept of plan.keptChunks) {
                if (kept.previousChunkIndex === kept.chunkIndex) continue;
                shiftCounter += 1;
                const tempNegativeIndex = -shiftCounter;
                await tx.$executeRaw(
                    Prisma.sql`
                        UPDATE "document_chunks"
                        SET "chunk_index" = ${tempNegativeIndex}
                        WHERE "id" = ${kept.existingId}::uuid
                          AND "document_id" = ${documentId}::uuid
                    `
                );
            }

            // Phase 2: Cập nhật vị trí & metadata mới cho keptChunks, bảo toàn 100% UUID và vector embedding cũ
            for (const kept of plan.keptChunks) {
                const { chunk } = kept;
                await tx.$executeRaw(
                    Prisma.sql`
                        UPDATE "document_chunks"
                        SET "chunk_index" = ${kept.chunkIndex},
                            "page_numbers" = ${chunk.pageNumbers}::integer[],
                            "raw_content" = ${chunk.rawContent ?? null},
                            "content_hash" = ${kept.contentHash},
                            "token_count" = ${chunk.tokenCount ?? null},
                            "headings" = ${chunk.headings ?? []}::text[],
                            "bboxes" = ${chunk.bboxes ? JSON.stringify(chunk.bboxes) : null}::jsonb,
                            "chunk_metadata" = ${chunk.metadata ? JSON.stringify(chunk.metadata) : null}::jsonb,
                            "chunk_type" = ${chunk.chunkType ?? 'text'}::"ChunkType",
                            "has_image" = ${chunk.hasImage ?? false},
                            "has_table" = ${chunk.hasTable ?? false}
                        WHERE "id" = ${kept.existingId}::uuid
                          AND "document_id" = ${documentId}::uuid
                    `
                );

                resultRecords.push({
                    id: kept.existingId,
                    chunkIndex: kept.chunkIndex,
                    pageNumbers: chunk.pageNumbers,
                    content: chunk.content,
                    hasImage: chunk.hasImage ?? false,
                    metadata: chunk.metadata,
                });
            }

            // Phase 3: Chèn các chunk mới / bị sửa đổi kèm vector 768 chiều
            for (const ins of plan.toInsertWithEmbeddings) {
                const { chunk } = ins;
                const vector = `[${ins.embedding.join(',')}]`;
                const rows = await tx.$queryRaw<Array<{ id: string }>>(
                    Prisma.sql`
                        INSERT INTO "document_chunks" (
                            "id", "document_id", "chunk_index", "page_numbers", "content",
                            "raw_content", "content_hash", "token_count", "headings", "bboxes", "chunk_metadata",
                            "chunk_type", "has_image", "has_table", "embedding", "created_at"
                        )
                        VALUES (
                            gen_random_uuid(),
                            ${documentId}::uuid,
                            ${ins.chunkIndex},
                            ${chunk.pageNumbers}::integer[],
                            ${chunk.content},
                            ${chunk.rawContent ?? null},
                            ${ins.contentHash},
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
                    resultRecords.push({
                        id: rows[0].id,
                        chunkIndex: ins.chunkIndex,
                        pageNumbers: chunk.pageNumbers,
                        content: chunk.content,
                        hasImage: chunk.hasImage ?? false,
                        metadata: chunk.metadata,
                    });
                }
            }
        });

        return resultRecords.sort((a, b) => a.chunkIndex - b.chunkIndex);
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
                        "raw_content", "content_hash", "token_count", "headings", "bboxes", "chunk_metadata",
                        "chunk_type", "has_image", "has_table", "embedding", "created_at"
                    )
                    SELECT
                        gen_random_uuid(),
                        ${targetDocumentId}::uuid,
                        "chunk_index",
                        "page_numbers",
                        "content",
                        "raw_content",
                        "content_hash",
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
