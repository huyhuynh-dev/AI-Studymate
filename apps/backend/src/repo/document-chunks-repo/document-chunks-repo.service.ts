import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { DocumentChunk, Prisma } from '../../generated/prisma/client.js';

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
        chunks: Array<{ chunkIndex: number; content: string; embedding: number[] }>
    ): Promise<number> {
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

        await this.prisma.$transaction(async (tx) => {
            await tx.documentChunk.deleteMany({
                where: { document_id: documentId },
            });

            for (const chunk of chunks) {
                const vector = `[${chunk.embedding.join(',')}]`;
                await tx.$executeRaw(
                    Prisma.sql`
                        INSERT INTO "document_chunks" ("id", "document_id", "chunk_index", "content", "embedding", "created_at")
                        VALUES (
                            gen_random_uuid(),
                            ${documentId}::uuid,
                            ${chunk.chunkIndex},
                            ${chunk.content},
                            ${vector}::vector,
                            NOW()
                        )
                    `
                );
            }
        });

        return chunks.length;
    }

    async countByDocumentId(documentId: string): Promise<number> {
        return await this.prisma.documentChunk.count({
            where: { document_id: documentId },
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
