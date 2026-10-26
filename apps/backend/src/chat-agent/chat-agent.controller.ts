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
import type { Request, Response as ExpressResponse } from 'express';
import { pipeUIMessageStreamToResponse } from 'ai';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateChatSessionDto } from './dto/create-chat-session.dto.js';
import { UpdateChatSessionDto } from './dto/update-chat-session.dto.js';
import { ChatStreamDto } from './dto/chat-stream.dto.js';
import { ChatAgentService } from './chat-agent.service.js';

@Controller('chat-agent')
@UseGuards(JwtAuthGuard)
export class ChatAgentController {
    constructor(private readonly chatAgentService: ChatAgentService) { }

    private getUserId(req: Request): string {
        if (!req.user) {
            throw new UnauthorizedException('Người dùng chưa được xác thực');
        }
        return (req.user as { userId: string }).userId;
    }

    @Post('conversations/:conversationId/sessions')
    async createChatSession(
        @Req() req: Request,
        @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
        @Body() data: CreateChatSessionDto
    ) {
        return this.chatAgentService.createChatSession(
            this.getUserId(req),
            conversationId,
            data
        );
    }

    @Get('conversations/:conversationId/sessions')
    async getChatSessionsByConversationId(
        @Req() req: Request,
        @Param('conversationId', new ParseUUIDPipe()) conversationId: string
    ) {
        return this.chatAgentService.getChatSessionsByConversationId(
            this.getUserId(req),
            conversationId
        );
    }

    @Get('sessions/:id')
    async getChatSessionById(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string
    ) {
        return this.chatAgentService.getChatSessionById(this.getUserId(req), id);
    }

    @Get('sessions/:id/messages')
    async getMessages(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string
    ) {
        return this.chatAgentService.getMessagesBySessionId(this.getUserId(req), id);
    }

    @Patch('sessions/:id')
    async updateChatSession(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() data: UpdateChatSessionDto
    ) {
        return this.chatAgentService.updateChatSession(this.getUserId(req), id, data);
    }

    @Delete('sessions/:id')
    async deleteChatSession(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string
    ) {
        return this.chatAgentService.deleteChatSession(this.getUserId(req), id);
    }

    @Post('sessions/:id/chat')
    async streamChat(
        @Req() req: Request,
        @Res() response: ExpressResponse,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() data: ChatStreamDto
    ) {
        const userId = this.getUserId(req);
        const abortController = new AbortController();

        req.on('close', () => {
            abortController.abort();
        });

        const result = await this.chatAgentService.handleChatStream(
            userId,
            id,
            data.messages,
            abortController.signal
        );

        await pipeUIMessageStreamToResponse({
            response,
            stream: result.toUIMessageStream({
                onError: () => {
                    return 'AI chat stream encountered an error';
                },
            }),
        });
    }
}
