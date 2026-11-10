import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class SubjectsRepoService {
    constructor(private readonly prisma: PrismaService) {}

    async createSubject(subject: Prisma.SubjectCreateInput): Promise<any> {
        return await this.prisma.subject.create({
            data: subject,
            select: {
                id: true,
                name: true,
                color: true,
                created_at: true,
                updated_at: true,
            },
        });
    }

    async getAllSubjectsByUserId(userId: string): Promise<any[]> {
        return await this.prisma.subject.findMany({
            where: {
                user_id: userId,
            },
            orderBy: {
                created_at: 'desc',
            },
            select: {
                id: true,
                name: true,
                color: true,
                created_at: true,
                updated_at: true,
            },
        });
    }

    async getSubjectById(subjectId: string, userId: string): Promise<any | null> {
        return await this.prisma.subject.findFirst({
            where: {
                id: subjectId,
                user_id: userId,
            },
            select: {
                id: true,
                name: true,
                color: true,
                created_at: true,
                updated_at: true,
            },
        });
    }

    async updateSubject(
        subjectId: string,
        data: { name?: string; color?: string },
        userId: string
    ): Promise<any> {
        try {
            const updatePayload: Prisma.SubjectUpdateInput = {};
            if (data.name !== undefined) {
                updatePayload.name = data.name;
            }
            if (data.color !== undefined) {
                updatePayload.color = data.color;
            }

            return await this.prisma.subject.update({
                where: { id: subjectId, user_id: userId },
                data: updatePayload,
                select: {
                    id: true,
                    name: true,
                    color: true,
                    created_at: true,
                    updated_at: true,
                },
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new NotFoundException('Không tìm thấy không gian học tập hoặc bạn không có quyền truy cập');
            }
            throw error;
        }
    }

    async deleteSubject(subjectId: string, userId: string): Promise<any> {
        try {
            return await this.prisma.subject.delete({
                where: { id: subjectId, user_id: userId },
                select: {
                    id: true,
                    name: true,
                    color: true,
                },
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new NotFoundException('Không tìm thấy không gian học tập hoặc bạn không có quyền truy cập');
            }
            throw error;
        }
    }
}
