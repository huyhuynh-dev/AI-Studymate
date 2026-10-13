import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Document, Prisma } from '../../generated/prisma/client.js';

export type DocumentResponse = Omit<Document, 'file_size'> & { file_size: number };

export function serializeDocument(doc: Document): DocumentResponse {
    return {
        ...doc,
        file_size: Number(doc.file_size),
    };
}

@Injectable()
export class DocumentsRepoService {
    constructor(private readonly prisma: PrismaService) { }

    async createDocument(data: Prisma.DocumentUncheckedCreateInput): Promise<DocumentResponse> {
        const created = await this.prisma.document.create({
            data,
        });
        return serializeDocument(created);
    }

    async getAllDocumentsByConversationId(
        conversationId: string,
        userId: string
    ): Promise<DocumentResponse[]> {
        const list = await this.prisma.document.findMany({
            where: {
                conversation_id: conversationId,
                user_id: userId,
            },
            orderBy: {
                created_at: 'desc',
            },
        });
        return list.map(serializeDocument);
    }

    async getDocumentById(documentId: string, userId: string): Promise<DocumentResponse | null> {
        const doc = await this.prisma.document.findFirst({
            where: {
                id: documentId,
                user_id: userId,
            },
        });
        return doc ? serializeDocument(doc) : null;
    }

    async findRawDocumentById(documentId: string): Promise<Document | null> {
        return await this.prisma.document.findUnique({
            where: { id: documentId },
        });
    }

    async updateDocument(
        documentId: string,
        userId: string,
        data: Prisma.DocumentUpdateInput
    ): Promise<DocumentResponse> {
        try {
            const updated = await this.prisma.document.update({
                where: {
                    id: documentId,
                    user_id: userId,
                },
                data,
            });
            return serializeDocument(updated);
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new NotFoundException('Không tìm thấy tài liệu hoặc bạn không có quyền truy cập');
            }
            throw error;
        }
    }

    async updateDocumentById(
        documentId: string,
        data: Prisma.DocumentUpdateInput
    ): Promise<DocumentResponse> {
        try {
            const updated = await this.prisma.document.update({
                where: { id: documentId },
                data,
            });
            return serializeDocument(updated);
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new NotFoundException('Không tìm thấy tài liệu');
            }
            throw error;
        }
    }

    async deleteDocument(documentId: string, userId: string): Promise<DocumentResponse> {
        try {
            const deleted = await this.prisma.document.delete({
                where: {
                    id: documentId,
                    user_id: userId,
                },
            });
            return serializeDocument(deleted);
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new NotFoundException('Không tìm thấy tài liệu hoặc bạn không có quyền truy cập');
            }
            throw error;
        }
    }
}
