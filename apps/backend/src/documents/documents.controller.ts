import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    Req,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { DocumentsService } from './documents.service.js';
import { InitUploadDto } from './dto/init-upload.dto.js';
import { CompleteUploadDto } from './dto/complete-upload.dto.js';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
    constructor(private readonly documentsService: DocumentsService) { }

    private getUserId(req: Request): string {
        if (!req.user) {
            throw new UnauthorizedException('Người dùng chưa được xác thực');
        }
        return (req.user as { userId: string; email: string }).userId;
    }

    @Post('init-upload')
    async initUpload(
        @Req() req: Request,
        @Body() dto: InitUploadDto
    ) {
        return this.documentsService.initUpload(this.getUserId(req), dto);
    }

    @Post(':id/complete')
    async completeUpload(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: CompleteUploadDto
    ) {
        return this.documentsService.completeUpload(this.getUserId(req), id, dto);
    }

    @Get('conversation/:conversationId')
    async getDocumentsByConversation(
        @Req() req: Request,
        @Param('conversationId', new ParseUUIDPipe()) conversationId: string
    ) {
        return this.documentsService.getDocumentsByConversation(this.getUserId(req), conversationId);
    }

    @Get(':id')
    async getDocumentById(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string
    ) {
        return this.documentsService.getDocumentById(this.getUserId(req), id);
    }

    @Get(':id/download')
    async getDownloadUrl(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Query('inline') inline?: string
    ) {
        return this.documentsService.getDownloadUrl(this.getUserId(req), id, inline === 'true');
    }

    @Delete(':id')
    async deleteDocument(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string
    ) {
        return this.documentsService.deleteDocument(this.getUserId(req), id);
    }
}
