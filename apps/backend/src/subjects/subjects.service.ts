import { Injectable, NotFoundException } from '@nestjs/common';
import { SubjectsRepoService } from '../repo/subjects-repo/subjects-repo.service.js';
import { CreateSubjectDto } from './dto/create-subject.dto.js';
import { UpdateSubjectDto } from './dto/update-subject.dto.js';

export { CreateSubjectDto } from './dto/create-subject.dto.js';
export { UpdateSubjectDto } from './dto/update-subject.dto.js';

@Injectable()
export class SubjectsService {
    constructor(private readonly subjectsRepo: SubjectsRepoService) {}

    async createSubject(userId: string, subject: CreateSubjectDto): Promise<any> {
        return this.subjectsRepo.createSubject({
            name: subject.name,
            color: subject.color,
            user: {
                connect: { id: userId },
            },
        });
    }

    async getAllSubjectsByUserId(userId: string): Promise<any[]> {
        return this.subjectsRepo.getAllSubjectsByUserId(userId);
    }

    async getSubjectById(subjectId: string, userId: string): Promise<any> {
        const subject = await this.subjectsRepo.getSubjectById(subjectId, userId);
        if (!subject) {
            throw new NotFoundException('Không tìm thấy không gian học tập hoặc bạn không có quyền truy cập');
        }
        return subject;
    }

    async updateSubject(
        subjectId: string,
        subject: UpdateSubjectDto,
        userId: string
    ): Promise<any> {
        return this.subjectsRepo.updateSubject(subjectId, subject, userId);
    }

    async deleteSubject(subjectId: string, userId: string): Promise<any> {
        return this.subjectsRepo.deleteSubject(subjectId, userId);
    }
}
