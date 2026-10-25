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
import { CreateChatSessionDto } from './dto/create-chat-session.dto.js';
import { UpdateChatSessionDto } from './dto/update-chat-session.dto.js';
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
}
