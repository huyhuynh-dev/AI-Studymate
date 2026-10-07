import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, Subject, User } from '../../generated/prisma/client.js';
@Injectable()

export class SubjectsRepoService {
    constructor(private readonly prisma: PrismaService) { };

    async createSubject(subject: Prisma.SubjectCreateInput): Promise<any> {
        return await this.prisma.subject.create({
            data: subject,
            select: {
                id: true,
                name: true,
                color: true
            }
        });
    }

    async getAllSubjectsByUserId(userId: string): Promise<any[]> {
        return await this.prisma.subject.findMany({
            where: {
                user_id: userId
            },
            select: {
                id: true,
                name: true,
                color: true
            }
        })
    }

    async updateSubject(
        subjectId: string,
        subject: Prisma.SubjectUpdateInput,
        userId: string
    ): Promise<any> {
        return await this.prisma.subject.update({
            where: { id: subjectId, user_id: userId },
            data: subject,
            select: {
                id: true,
                name: true,
                color: true
            }
        });
    }

    async deleteSubject(subjectId: string, userId: string): Promise<any> {
        return await this.prisma.subject.delete({
            where: { id: subjectId, user_id: userId },
            select: {
                id: true,
                name: true,
                color: true
            }
        });
    }
}
