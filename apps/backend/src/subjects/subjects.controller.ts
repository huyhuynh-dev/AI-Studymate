import { Body, Controller, Delete, Get, Param, Post, Put, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateSubjectDto, SubjectsService } from './subjects.service.js';

@Controller('subjects')
@UseGuards(JwtAuthGuard)
export class SubjectsController {
    constructor(private readonly subjectsService: SubjectsService) { };

    @Get()
    async getAllSubjectsByUserId(@Req() req: Request): Promise<any[]> {
        if (!req.user) {
            throw new UnauthorizedException();
        }
        const user = req.user as { userId: string; email: string };
        return this.subjectsService.getAllSubjectsByUserId(user.userId);
    }

    @Post()
    async createSubject(@Req() req: Request, @Body() subjectData: CreateSubjectDto): Promise<any> {
        if (!req.user) {
            throw new UnauthorizedException();
        }
        const user = req.user as { userId: string; email: string };
        return this.subjectsService.createSubject(user.userId, subjectData);
    }

    @Put(':subjectId')
    async updateSubject(
        @Req() req: Request, @Body() subjectData: Partial<CreateSubjectDto>,
        @Param('subjectId') subjectId: string
    ): Promise<any> {
        if (!req.user) {
            throw new UnauthorizedException();
        }
        const user = req.user as { userId: string; email: string };
        return this.subjectsService.updateSubject(subjectId, subjectData, user.userId);
    }

    @Delete(':subjectId')
    async deleteSubject(@Req() req: Request, @Param('subjectId') subjectId: string): Promise<any> {
        if (!req.user) {
            throw new UnauthorizedException();
        }
        const user = req.user as { userId: string; email: string };
        return this.subjectsService.deleteSubject(subjectId, user.userId);
    }
}
