import { Injectable } from '@nestjs/common';
import { SubjectsRepoService } from '../repo/subjects-repo/subjects-repo.service.js';
import { IsHexColor, IsNotEmpty, IsOptional } from 'class-validator';


export class CreateSubjectDto {
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsHexColor()
    color?: string;
}

@Injectable()
export class SubjectsService {
    constructor(private readonly subjectsRepo: SubjectsRepoService) { };

    async createSubject(userId: string, subject: CreateSubjectDto): Promise<any> {
        return this.subjectsRepo.createSubject({
            name: subject.name,
            color: subject.color,
            user: {
                connect: { id: userId }
            },
        });
    }

    async getAllSubjectsByUserId(userId: string): Promise<any[]> {
        return this.subjectsRepo.getAllSubjectsByUserId(userId);
    }

    async deleteSubject(subjectId: string, userId: string): Promise<any> {
        return this.subjectsRepo.deleteSubject(subjectId, userId);
    }

    async updateSubject(
        subjectId: string,
        subject: Partial<CreateSubjectDto>,
        userId: string
    ): Promise<any> {
        return this.subjectsRepo.updateSubject(subjectId, subject, userId);
    }
}
