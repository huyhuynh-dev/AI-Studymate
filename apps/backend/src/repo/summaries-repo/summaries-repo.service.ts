import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, Summary } from '../../generated/prisma/client.js';

@Injectable()
export class SummariesRepoService {
    constructor(private readonly prisma: PrismaService) { }

    async createSummary(data: Prisma.SummaryUncheckedCreateInput): Promise<Summary> {
        return await this.prisma.summary.create({
            data,
        });
    }

    async getSummariesByConversationId(conversationId: string): Promise<Summary[]> {
        return await this.prisma.summary.findMany({
            where: { conversation_id: conversationId },
            orderBy: [{ updated_at: 'desc' }, { created_at: 'desc' }],
        });
    }

    async countSummariesByConversationId(conversationId: string): Promise<number> {
        return await this.prisma.summary.count({
            where: { conversation_id: conversationId },
        });
    }

    async getSummaryListL1ByConversationId(
        conversationId: string,
        limit = 15,
    ): Promise<Array<{ id: string; title: string; document_id: string | null; updated_at: Date }>> {
        return await this.prisma.summary.findMany({
            where: { conversation_id: conversationId },
            orderBy: [{ updated_at: 'desc' }, { created_at: 'desc' }],
            take: limit,
            select: {
                id: true,
                title: true,
                document_id: true,
                updated_at: true,
            },
        });
    }

    async getSummaryByIdInConversation(id: string, conversationId: string) {
        return await this.prisma.summary.findFirst({
            where: {
                id,
                conversation_id: conversationId,
            },
            select: {
                id: true,
                title: true,
                document_id: true,
                content_json: true,
                updated_at: true,
            },
        });
    }

    async getSummaryByIdForUser(summaryId: string, userId: string) {
        return await this.prisma.summary.findFirst({
            where: {
                id: summaryId,
                conversation: {
                    user_id: userId,
                },
            },
            select: {
                id: true,
                title: true,
                conversation_id: true,
                document_id: true,
                content_json: true,
                updated_at: true,
                document: {
                    select: {
                        id: true,
                        file_name: true,
                    },
                },
                conversation: {
                    select: {
                        id: true,
                        title: true,
                        subject_id: true,
                        subject: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        });
    }

    async searchSummariesForUser(params: {
        userId: string;
        conversationId?: string;
        subjectId?: string;
        query?: string;
        limit?: number;
    }) {
        const keyword = params.query?.trim();
        return await this.prisma.summary.findMany({
            where: {
                conversation: {
                    user_id: params.userId,
                    ...(params.subjectId ? { subject_id: params.subjectId } : {}),
                },
                ...(params.conversationId ? { conversation_id: params.conversationId } : {}),
                ...(keyword
                    ? {
                          title: {
                              contains: keyword,
                              mode: 'insensitive',
                          },
                      }
                    : {}),
            },
            orderBy: [{ updated_at: 'desc' }, { created_at: 'desc' }],
            take: params.limit ?? 5,
            select: {
                id: true,
                title: true,
                conversation_id: true,
                updated_at: true,
                document: {
                    select: {
                        file_name: true,
                    },
                },
                conversation: {
                    select: {
                        id: true,
                        title: true,
                        subject: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        });
    }

    async getSummaryById(id: string): Promise<Summary | null> {
        return await this.prisma.summary.findUnique({
            where: { id },
            include: {
                document: {
                    select: {
                        id: true,
                        file_name: true,
                        mime_type: true,
                    },
                },
            },
        });
    }

    async updateSummary(id: string, data: Prisma.SummaryUpdateInput): Promise<Summary> {
        try {
            return await this.prisma.summary.update({
                where: { id },
                data,
                include: {
                    document: {
                        select: {
                            id: true,
                            file_name: true,
                            mime_type: true,
                        },
                    },
                },
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new NotFoundException('Không tìm thấy bản tóm tắt hoặc bạn không có quyền truy cập');
            }
            throw error;
        }
    }

    async deleteSummary(id: string): Promise<Summary> {
        try {
            return await this.prisma.summary.delete({
                where: { id },
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new NotFoundException('Không tìm thấy bản tóm tắt');
            }
            throw error;
        }
    }
}
