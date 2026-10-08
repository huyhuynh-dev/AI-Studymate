import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Put,
    Req,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ConversationsService } from './conversations.service.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { UpdateConversationDto } from './dto/update-conversation.dto.js';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
    constructor(private readonly conversationsService: ConversationsService) {}

    private getUserId(req: Request): string {
        if (!req.user) {
            throw new UnauthorizedException('Người dùng chưa được xác thực');
        }
        return (req.user as { userId: string; email: string }).userId;
    }

    @Post()
    async createConversation(
        @Req() req: Request,
        @Body() data: CreateConversationDto
    ): Promise<any> {
        return this.conversationsService.createConversation(this.getUserId(req), data);
    }

    @Get(':id')
    async getConversationById(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string
    ): Promise<any> {
        return this.conversationsService.getConversationById(id, this.getUserId(req));
    }

    @Put(':id')
    async updateConversation(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() data: UpdateConversationDto
    ): Promise<any> {
        return this.conversationsService.updateConversation(id, data, this.getUserId(req));
    }

    @Delete(':id')
    async deleteConversation(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string
    ): Promise<any> {
        return this.conversationsService.deleteConversation(id, this.getUserId(req));
    }
}
