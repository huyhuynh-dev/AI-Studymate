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
            orderBy: { created_at: 'desc' },
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
