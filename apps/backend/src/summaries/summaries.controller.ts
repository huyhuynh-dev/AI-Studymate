import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Req,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { SummariesService } from './summaries.service.js';
import { CreateSummaryDto } from './dto/create-summary.dto.js';
import { UpdateSummaryDto } from './dto/update-summary.dto.js';
import { RefineSummaryDto } from './dto/refine-summary.dto.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class SummariesController {
    constructor(private readonly summariesService: SummariesService) { }

    private getUserId(req: Request): string {
        if (!req.user) {
            throw new UnauthorizedException('Người dùng chưa được xác thực');
        }
        return (req.user as { userId: string; email: string }).userId;
    }

    /**
     * Tạo tóm tắt mới cho cuộc trò chuyện
     */
    @Post('conversations/:conversationId/summaries')
    async createSummary(
        @Req() req: Request,
        @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
        @Body() dto: CreateSummaryDto,
    ) {
        return this.summariesService.createSummary(this.getUserId(req), conversationId, dto);
    }

    /**
     * Lấy danh sách tóm tắt của một cuộc trò chuyện
     */
    @Get('conversations/:conversationId/summaries')
    async getSummariesByConversation(
        @Req() req: Request,
        @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    ) {
        return this.summariesService.getSummariesByConversation(this.getUserId(req), conversationId);
    }

    /**
     * Lấy chi tiết một bản tóm tắt
     */
    @Get('summaries/:id')
    async getSummaryById(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string,
    ) {
        return this.summariesService.getSummaryById(this.getUserId(req), id);
    }

    /**
     * Cập nhật bản tóm tắt (Auto-save)
     */
    @Patch('summaries/:id')
    async updateSummary(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateSummaryDto,
    ) {
        return this.summariesService.updateSummary(this.getUserId(req), id, dto);
    }

    /**
     * Tinh chỉnh tóm tắt qua AI theo chỉ dẫn người học
     */
    @Post('summaries/:id/refine')
    async refineSummary(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: RefineSummaryDto,
    ) {
        return this.summariesService.refineSummary(this.getUserId(req), id, dto);
    }

    /**
     * Xuất tóm tắt ra PDF và lấy link tải
     */
    @Post('summaries/:id/export-pdf')
    async exportPdf(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string,
    ) {
        return this.summariesService.exportPdf(this.getUserId(req), id);
    }

    /**
     * Xóa một bản tóm tắt
     */
    @Delete('summaries/:id')
    async deleteSummary(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string,
    ) {
        return this.summariesService.deleteSummary(this.getUserId(req), id);
    }
}
