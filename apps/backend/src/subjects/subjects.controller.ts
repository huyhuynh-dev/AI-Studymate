import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Put,
    Req,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { SubjectsService } from './subjects.service.js';
import { CreateSubjectDto } from './dto/create-subject.dto.js';
import { UpdateSubjectDto } from './dto/update-subject.dto.js';
import { ConversationsService } from '../conversations/conversations.service.js';

@Controller('subjects')
@UseGuards(JwtAuthGuard)
export class SubjectsController {
    constructor(
        private readonly subjectsService: SubjectsService,
        private readonly conversationService: ConversationsService
    ) { }

    private getUserId(req: Request): string {
        if (!req.user) {
            throw new UnauthorizedException('Người dùng chưa được xác thực');
        }
        return (req.user as { userId: string; email: string }).userId;
    }

    @Get()
    async getAllSubjectsByUserId(@Req() req: Request): Promise<any[]> {
        return this.subjectsService.getAllSubjectsByUserId(this.getUserId(req));
    }

    @Get(':subjectId')
    async getSubjectById(
        @Req() req: Request,
        @Param('subjectId', new ParseUUIDPipe()) subjectId: string
    ): Promise<any> {
        return this.subjectsService.getSubjectById(subjectId, this.getUserId(req));
    }

    @Post()
    async createSubject(
        @Req() req: Request,
        @Body() subjectData: CreateSubjectDto
    ): Promise<any> {
        return this.subjectsService.createSubject(this.getUserId(req), subjectData);
    }

    @Patch(':subjectId')
    async updateSubject(
        @Req() req: Request,
        @Param('subjectId', new ParseUUIDPipe()) subjectId: string,
        @Body() subjectData: UpdateSubjectDto
    ): Promise<any> {
        return this.subjectsService.updateSubject(subjectId, subjectData, this.getUserId(req));
    }

    @Put(':subjectId')
    async putSubject(
        @Req() req: Request,
        @Param('subjectId', new ParseUUIDPipe()) subjectId: string,
        @Body() subjectData: UpdateSubjectDto
    ): Promise<any> {
        return this.subjectsService.updateSubject(subjectId, subjectData, this.getUserId(req));
    }

    @Delete(':subjectId')
    async deleteSubject(
        @Req() req: Request,
        @Param('subjectId', new ParseUUIDPipe()) subjectId: string
    ): Promise<any> {
        return this.subjectsService.deleteSubject(subjectId, this.getUserId(req));
    }

    @Get(':subjectId/conversations')
    async getConversationsBySubjectId(
        @Req() req: Request,
        @Param('subjectId', new ParseUUIDPipe()) subjectId: string
    ): Promise<any[]> {
        const userId = this.getUserId(req);
        // Ensure the subject belongs to the user
        await this.subjectsService.getSubjectById(subjectId, userId);
        return this.conversationService.findBySubjectId(subjectId);
    }
}
