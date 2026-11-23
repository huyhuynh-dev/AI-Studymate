import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Put,
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
import { UpdateDocumentContentDto } from './dto/update-document-content.dto.js';
import { OverwriteVersionDto } from './dto/complete-overwrite.dto.js';
import { ImportGoogleDocDto } from './dto/import-google-doc.dto.js';
import { StageAgentSnapshotDto } from './dto/stage-agent-snapshot.dto.js';

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

    @Post('import-google-doc')
    async importGoogleDoc(
        @Req() req: Request,
        @Body() dto: ImportGoogleDocDto
    ) {
        return this.documentsService.importGoogleDoc(this.getUserId(req), dto);
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

    @Get(':id/content')
    async getDocumentContent(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string
    ) {
        return this.documentsService.getDocumentContent(this.getUserId(req), id);
    }

    @Get(':id/preview')
    async getDocumentPreview(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string
    ) {
        return this.documentsService.getDocumentPreview(this.getUserId(req), id);
    }

    @Put(':id/content')
    async updateDocumentContent(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateDocumentContentDto
    ) {
        return this.documentsService.updateDocumentContent(this.getUserId(req), id, dto);
    }

    @Get(':id/download')
    async getDownloadUrl(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Query('inline') inline?: string
    ) {
        return this.documentsService.getDownloadUrl(this.getUserId(req), id, inline === 'true');
    }

    @Post(':id/overwrite-url')
    async getOverwriteUrl(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto?: OverwriteVersionDto
    ) {
        return this.documentsService.getOverwriteUrl(this.getUserId(req), id, dto);
    }

    @Post(':id/overwrite-complete')
    async completeOverwrite(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto?: OverwriteVersionDto
    ) {
        return this.documentsService.completeOverwrite(this.getUserId(req), id, dto);
    }

    @Put(':id/agent-snapshot')
    async stageAgentSnapshot(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: StageAgentSnapshotDto
    ) {
        return this.documentsService.stageAgentWorkingSnapshot(
            this.getUserId(req),
            id,
            dto.base64,
        );
    }

    @Get(':id/agent-snapshot')
    async getAgentSnapshot(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string
    ) {
        return this.documentsService.getAgentWorkingSnapshot(this.getUserId(req), id);
    }

    @Delete(':id/agent-snapshot')
    async clearAgentSnapshot(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string
    ) {
        return this.documentsService.clearAgentWorkingSnapshot(this.getUserId(req), id);
    }

    @Post(':id/collaboration-session')
    async createCollaborationSession(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string
    ) {
        const forwardedHost = req.headers['x-forwarded-host'];
        const rawHost = Array.isArray(forwardedHost)
            ? forwardedHost[0]
            : forwardedHost ?? req.headers.host;
        const forwardedProto = req.headers['x-forwarded-proto'];
        const rawProto = Array.isArray(forwardedProto)
            ? forwardedProto[0]
            : forwardedProto ?? req.protocol;
        return this.documentsService.createCollaborationSession(
            this.getUserId(req),
            id,
            {
                requestHost: typeof rawHost === 'string' ? rawHost : undefined,
                requestProto: typeof rawProto === 'string' ? rawProto : undefined,
            },
        );
    }

    @Post(':id/collaboration-token')
    async refreshCollaborationToken(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string
    ) {
        return this.documentsService.refreshCollaborationToken(
            this.getUserId(req),
            id,
        );
    }

    @Delete(':id')
    async deleteDocument(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string
    ) {
        return this.documentsService.deleteDocument(this.getUserId(req), id);
    }
}
