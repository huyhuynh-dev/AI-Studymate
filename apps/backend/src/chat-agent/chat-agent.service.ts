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
                if (Array.isArray(parsed)) {
                    // Xử lý nếu dữ liệu bị lồng trong ResponseMessage: [{ role: 'assistant', content: [...] }]
                    if (parsed.length > 0 && parsed[0]?.role && Array.isArray(parsed[0]?.content)) {
                        parts = parsed[0].content;
                    } else {
                        parts = parsed;
                    }
                } else if (typeof parsed === 'string') {
                    parts = [{ type: 'text', text: parsed }];
                } else {
                    parts = [{ type: 'text', text: msg.content }];
                }
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
        console.log(`[ChatAgentService] saveMessage: sessionId=${chatSessionId}, role=${role}, length=${content?.length}`);
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
        console.log(`[ChatAgentService] executeAiChatStream: starting AI stream for session ${chatSessionId}...`);
        return this.chatAgentAiService.executeChatStream(
            messages,
            async ({ responseMessages, text }) => {
                console.log(`[ChatAgentService] executeAiChatStream onFinish: text length=${text?.length}, responseMessages count=${responseMessages?.length}`);
                
                // Trích xuất đúng mảng UIMessagePart để lưu vào DB
                let assistantParts: any[] = [];
                if (responseMessages && responseMessages.length > 0) {
                    const firstMsg = responseMessages[0];
                    if (Array.isArray(firstMsg?.content)) {
                        assistantParts = firstMsg.content;
                    }
                }
                if (assistantParts.length === 0 && text) {
                    assistantParts = [{ type: 'text', text }];
                }

                await this.saveMessage(chatSessionId, 'assistant', JSON.stringify(assistantParts));
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
        console.log(`[ChatAgentService] handleChatStream: verifying session ${chatSessionId} for user ${userId}...`);
        // a. Xác thực quyền truy cập phiên của người dùng
        await this.getChatSessionById(userId, chatSessionId);

        // b. Lưu tin nhắn mới nhất của user vào Database
        const lastUserMessage = messages[messages.length - 1];
        console.log(`[ChatAgentService] lastUserMessage role=${lastUserMessage?.role}`);
        if (lastUserMessage && lastUserMessage.role === 'user') {
            const userContent = lastUserMessage.parts
                ? JSON.stringify(lastUserMessage.parts)
                : '';

            console.log(`[ChatAgentService] Saving user message for session ${chatSessionId}...`);
            await this.saveMessage(chatSessionId, 'user', userContent);
        }

        // c. Tự động sinh tiêu đề ngầm (Fire-and-forget Asynchronous Fast LLM)
        this.triggerAutoHeaderAsync(userId, chatSessionId, messages);

        // d. Khởi tạo luồng sinh văn bản từ AI
        return this.executeAiChatStream(chatSessionId, messages, abortSignal);
    }

    private triggerAutoHeaderAsync(
        userId: string,
        chatSessionId: string,
        messages: UIMessage[]
    ) {
        const userMessages = messages.filter((m) => m.role === 'user');
        // Chỉ kích hoạt tự động đặt tiêu đề cho 1-2 tin nhắn đầu tiên của cuộc trò chuyện
        if (userMessages.length > 2) return;

        setImmediate(async () => {
            try {
                const title = await this.chatAgentAiService.generateSessionTitle(userMessages);
                if (title && title.length >= 2) {
                    await this.chatAgentRepo.updateChatSession(chatSessionId, title, userId);
                    console.log(`[ChatAgentService] Auto-header updated: session=${chatSessionId}, title="${title}"`);
                }
            } catch (err: any) {
                console.warn(`[ChatAgentService] Auto-header error for session ${chatSessionId}: ${err?.message}`);
            }
        });
    }
}
