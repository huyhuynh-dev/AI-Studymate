import { Injectable, NotFoundException } from '@nestjs/common';
import type { UIMessage } from 'ai';
import { ChatAgentRepoService } from '../repo/chat-agent-repo/chat-agent-repo.service.js';
import { ChatAgentAiService } from '../ai/chat-agent-ai.service.js';
import { CreateChatSessionDto } from './dto/create-chat-session.dto.js';
import { UpdateChatSessionDto } from './dto/update-chat-session.dto.js';

@Injectable()
export class ChatAgentService {
    constructor(
        private readonly chatAgentRepo: ChatAgentRepoService,
        private readonly chatAgentAiService: ChatAgentAiService,
    ) { }

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

    async getMessagesBySessionId(userId: string, chatSessionId: string): Promise<UIMessage[]> {
        await this.getChatSessionById(userId, chatSessionId);
        const rawMessages = await this.chatAgentRepo.getMessagesBySessionId(chatSessionId, userId);

        return rawMessages.map((msg) => {
            let parts: UIMessage['parts'] = [];
            try {
                const parsed = JSON.parse(msg.content);
                parts = Array.isArray(parsed) ? parsed : [{ type: 'text', text: msg.content }];
            } catch {
                parts = [{ type: 'text', text: msg.content }];
            }

            return {
                id: msg.id,
                role: msg.role as 'user' | 'assistant',
                parts,
            };
        });
    }

    // ── 1. Lưu tin nhắn vào Database ──
    async saveMessage(
        chatSessionId: string,
        role: 'user' | 'assistant',
        content: string,
        sourceChunks?: string[]
    ) {
        return this.chatAgentRepo.createMessage({
            chat_session_id: chatSessionId,
            role,
            content,
            source_chunks: sourceChunks,
        });
    }

    // ── 2. Kích hoạt luồng Stream AI qua ChatAgentAiService ──
    async executeAiChatStream(
        chatSessionId: string,
        messages: UIMessage[],
        abortSignal?: AbortSignal
    ) {
        return this.chatAgentAiService.executeChatStream(
            messages,
            async ({ responseMessages, text }) => {
                const assistantContent =
                    responseMessages && responseMessages.length > 0
                        ? JSON.stringify(responseMessages)
                        : text;

                await this.saveMessage(chatSessionId, 'assistant', assistantContent);
            },
            abortSignal
        );
    }

    // ── 3. Function tổng hợp điều phối toàn bộ chu trình Chat ──
    async handleChatStream(
        userId: string,
        chatSessionId: string,
        messages: UIMessage[],
        abortSignal?: AbortSignal
    ) {
        // a. Xác thực quyền truy cập phiên của người dùng
        await this.getChatSessionById(userId, chatSessionId);

        // b. Lưu tin nhắn mới nhất của user vào Database
        const lastUserMessage = messages[messages.length - 1];
        if (lastUserMessage && lastUserMessage.role === 'user') {
            const userContent = lastUserMessage.parts
                ? JSON.stringify(lastUserMessage.parts)
                : '';

            await this.saveMessage(chatSessionId, 'user', userContent);
        }

        // c. Khởi tạo luồng sinh văn bản từ AI
        return this.executeAiChatStream(chatSessionId, messages, abortSignal);
    }
}
