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
            embedding.length !== 1536 ||
            embedding.some((value) => !Number.isFinite(value))
        ) {
            throw new BadRequestException('Embedding phải chứa đúng 1536 giá trị số hợp lệ');
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
