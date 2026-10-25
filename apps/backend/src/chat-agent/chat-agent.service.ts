import { Injectable, NotFoundException } from '@nestjs/common';
import { ChatAgentRepoService } from '../repo/chat-agent-repo/chat-agent-repo.service.js';
import { CreateChatSessionDto } from './dto/create-chat-session.dto.js';
import { UpdateChatSessionDto } from './dto/update-chat-session.dto.js';

@Injectable()
export class ChatAgentService {
    constructor(private readonly chatAgentRepo: ChatAgentRepoService) { }

    async createChatSession(
        userId: string,
        conversationId: string,
        data: CreateChatSessionDto
    ) {
        return this.chatAgentRepo.createChatSession(
            {
                conversation_id: conversationId,
                title: data.title,
            },
            userId
        );
    }

    async getChatSessionsByConversationId(
        userId: string,
        conversationId: string
    ) {
        return this.chatAgentRepo.getChatSessionsByConversationId(conversationId, userId);
    }

    async getChatSessionById(userId: string, chatSessionId: string) {
        const chatSession = await this.chatAgentRepo.getChatSessionById(chatSessionId, userId);
        if (!chatSession) {
            throw new NotFoundException(
                'Không tìm thấy phiên trò chuyện hoặc bạn không có quyền truy cập'
            );
        }
        return chatSession;
    }

    async updateChatSession(
        userId: string,
        chatSessionId: string,
        data: UpdateChatSessionDto
    ) {
        return this.chatAgentRepo.updateChatSession(chatSessionId, data.title, userId);
    }

    async deleteChatSession(userId: string, chatSessionId: string) {
        return this.chatAgentRepo.deleteChatSession(chatSessionId, userId);
    }
}
