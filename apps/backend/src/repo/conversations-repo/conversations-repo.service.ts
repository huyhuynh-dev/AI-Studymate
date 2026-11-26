import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class ConversationsRepoService {
    constructor(private readonly prisma: PrismaService) { }

    async createConversation(data: Prisma.ConversationUncheckedCreateInput): Promise<any> {
        return await this.prisma.conversation.create({
            data,
            select: {
                id: true,
                subject_id: true,
                user_id: true,
                title: true,
                created_at: true,
                updated_at: true,
            },
        });
    }

    async getConversationById(conversationId: string, userId: string) {
        return await this.prisma.conversation.findFirst({
            where: {
                id: conversationId,
                user_id: userId,
            },
            select: {
                id: true,
                subject_id: true,
                user_id: true,
                title: true,
                created_at: true,
                updated_at: true,
            },
        });
    }

    async searchConversationsForUser(params: {
        userId: string;
        subjectId?: string;
        query?: string;
        limit?: number;
    }) {
        const keyword = params.query?.trim();
        return await this.prisma.conversation.findMany({
            where: {
                user_id: params.userId,
                ...(params.subjectId ? { subject_id: params.subjectId } : {}),
                ...(keyword
                    ? {
                          title: {
                              contains: keyword,
                              mode: 'insensitive',
                          },
                      }
                    : {}),
            },
            orderBy: { updated_at: 'desc' },
            take: params.limit ?? 5,
            select: {
                id: true,
                title: true,
                subject_id: true,
                updated_at: true,
                subject: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                _count: {
                    select: {
                        documents: true,
                        summaries: true,
                        flashcard_decks: true,
                        quizzes: true,
                    },
                },
            },
        });
    }

    async updateConversationTitle(
        conversationId: string,
        title: string,
        userId: string
    ): Promise<any> {
        try {
            return await this.prisma.conversation.update({
                where: { id: conversationId, user_id: userId },
                data: { title },
                select: {
                    id: true,
                    subject_id: true,
                    user_id: true,
                    title: true,
                    created_at: true,
                    updated_at: true,
                },
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new NotFoundException('Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền truy cập');
            }
            throw error;
        }
    }

    async deleteConversation(conversationId: string, userId: string): Promise<any> {
        try {
            return await this.prisma.conversation.delete({
                where: { id: conversationId, user_id: userId },
                select: {
                    id: true,
                    title: true,
                },
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new NotFoundException('Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền truy cập');
            }
            throw error;
        }
    }

    async findBySubjectId(subjectId: string): Promise<any[]> {
        try {
            const conversations = await this.prisma.conversation.findMany({
                where: { subject_id: subjectId },
                orderBy: { created_at: 'desc' },
                select: {
                    id: true,
                    subject_id: true,
                    user_id: true,
                    title: true,
                    created_at: true,
                    updated_at: true,
                },
            });

            if (conversations.length === 0) {
                throw new NotFoundException('Không tìm thấy cuộc trò chuyện nào trong không gian học tập này');
            }

            return conversations;
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new NotFoundException('Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền truy cập');
            }
            throw error;
        }
    }
}
