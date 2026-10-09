import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Document, Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class DocumentsRepoService {
    constructor(private readonly prisma: PrismaService) { }

    async createDocument(data: Prisma.DocumentUncheckedCreateInput): Promise<Document> {
        return await this.prisma.document.create({
            data,
        });
    }

    async getAllDocumentsByConversationId(
        conversationId: string,
        userId: string
    ): Promise<Document[]> {
        return await this.prisma.document.findMany({
            where: {
                conversation_id: conversationId,
                user_id: userId,
            },
            orderBy: {
                created_at: 'desc',
            },
        });
    }

    async getDocumentById(documentId: string, userId: string): Promise<Document | null> {
        return await this.prisma.document.findFirst({
            where: {
                id: documentId,
                user_id: userId,
            },
        });
    }

    async updateDocument(
        documentId: string,
        userId: string,
        data: Prisma.DocumentUpdateInput
    ): Promise<Document> {
        try {
            return await this.prisma.document.update({
                where: {
                    id: documentId,
                    user_id: userId,
                },
                data,
            });
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

    async deleteDocument(documentId: string, userId: string): Promise<Document> {
        try {
            return await this.prisma.document.delete({
                where: {
                    id: documentId,
                    user_id: userId,
                },
            });
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
