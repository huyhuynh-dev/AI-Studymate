import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationsRepoService } from '../repo/conversations-repo/conversations-repo.service.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { UpdateConversationDto } from './dto/update-conversation.dto.js';

@Injectable()
export class ConversationsService {
    constructor(private readonly conversationsRepo: ConversationsRepoService) {}

    async createConversation(userId: string, data: CreateConversationDto): Promise<any> {
        return this.conversationsRepo.createConversation({
            ...data,
            user_id: userId,
        });
    }

    async getConversationById(conversationId: string, userId: string): Promise<any> {
        const conversation = await this.conversationsRepo.getConversationById(conversationId, userId);
        if (!conversation) {
            throw new NotFoundException('Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền truy cập');
        }
        return conversation;
    }

    async updateConversation(conversationId: string, data: UpdateConversationDto, userId: string): Promise<any> {
        return this.conversationsRepo.updateConversationTitle(conversationId, data.title, userId);
    }

    async deleteConversation(conversationId: string, userId: string): Promise<any> {
        return this.conversationsRepo.deleteConversation(conversationId, userId);
    }
}
