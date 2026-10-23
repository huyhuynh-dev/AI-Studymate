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
    Res,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import { Logger } from '@nestjs/common';
import type { Request } from 'express';
import type { Response } from 'express';
import { pipeUIMessageStreamToResponse } from 'ai';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { SummariesService } from './summaries.service.js';
import { BlocknoteService } from '../ai/blocknote.service.js';
import { CreateSummaryDto } from './dto/create-summary.dto.js';
import { UpdateSummaryDto } from './dto/update-summary.dto.js';
import { RefineSummaryDto } from './dto/refine-summary.dto.js';
import { BlocknoteAiDto } from '../ai/dto/blocknote-ai.dto.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class SummariesController {
    private readonly logger = new Logger(SummariesController.name);

    constructor(
        private readonly summariesService: SummariesService,
        private readonly blocknoteService: BlocknoteService,
    ) { }

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
     * Stream BlockNote AI actions for a summary editor.
     */
    @Throttle({ default: { limit: 15, ttl: 60000 } })
    @Post('summaries/:id/ai-actions')
    async executeBlocknoteAiActions(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: BlocknoteAiDto,
        @Res() response: Response,
    ): Promise<void> {
        const requestInfo = {
            summaryId: id,
            messageCount: dto.messages?.length ?? 0,
            toolCount: Object.keys(dto.toolDefinitions ?? {}).length,
        };

        this.logger.log(`BlockNote AI request received: ${JSON.stringify(requestInfo)}`);

        const abortController = new AbortController();
        req.on('close', () => {
            if (!response.writableEnded) {
                this.logger.warn(`Client disconnected, aborting BlockNote AI stream (${id})`);
                abortController.abort();
            }
        });

        try {
            await this.summariesService.getSummaryById(this.getUserId(req), id);

            const result = await this.blocknoteService.executeAiActions(
                dto.messages,
                dto.toolDefinitions,
                abortController.signal,
            );

            await pipeUIMessageStreamToResponse({
                response,
                stream: result.toUIMessageStream({
                    onError: (error) => {
                        this.logger.error(
                            `BlockNote AI stream error (${JSON.stringify(requestInfo)}): ${String(error)}`,
                        );
                        return 'AI stream failed';
                    },
                }),
            });
        } catch (error) {
            this.logger.error(
                `BlockNote AI request failed (${JSON.stringify(requestInfo)}): ${
                    error instanceof Error ? error.stack ?? error.message : String(error)
                }`,
            );
            throw error;
        }
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
