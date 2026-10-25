import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ChatSession, Prisma } from '../../generated/prisma/client.js';

type ChatSessionData = Pick<
    Prisma.ChatSessionUncheckedCreateInput,
    'conversation_id' | 'title'
>;

const chatSessionSelect = {
    id: true,
    conversation_id: true,
    title: true,
    created_at: true,
} satisfies Prisma.ChatSessionSelect;

export type ChatSessionResponse = Pick<
    ChatSession,
    'id' | 'conversation_id' | 'title' | 'created_at'
>;

@Injectable()
export class ChatAgentRepoService {
    constructor(private readonly prisma: PrismaService) { }

    async createChatSession(
        data: ChatSessionData,
        userId: string
    ): Promise<ChatSessionResponse> {
        return this.prisma.$transaction(async (tx) => {
            const conversation = await tx.conversation.findFirst({
                where: {
                    id: data.conversation_id,
                    user_id: userId,
                },
                select: { id: true },
            });

            if (!conversation) {
                throw this.notFound();
            }

            return tx.chatSession.create({
                data: {
                    conversation_id: conversation.id,
                    title: data.title,
                },
                select: chatSessionSelect,
            });
        });
    }

    async getChatSessionById(
        chatSessionId: string,
        userId: string
    ): Promise<ChatSessionResponse | null> {
        return this.prisma.chatSession.findFirst({
            where: {
                id: chatSessionId,
                conversation: {
                    is: { user_id: userId },
                },
            },
            select: chatSessionSelect,
        });
    }

    async getChatSessionsByConversationId(
        conversationId: string,
        userId: string
    ): Promise<ChatSessionResponse[]> {
        return this.prisma.chatSession.findMany({
            where: {
                conversation_id: conversationId,
                conversation: {
                    is: { user_id: userId },
                },
            },
            orderBy: { created_at: 'desc' },
            select: chatSessionSelect,
        });
    }

    async updateChatSession(
        chatSessionId: string,
        title: string,
        userId: string
    ): Promise<ChatSessionResponse> {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const session = await tx.chatSession.findFirst({
                    where: {
                        id: chatSessionId,
                        conversation: {
                            is: { user_id: userId },
                        },
                    },
                    select: { id: true },
                });

                if (!session) {
                    throw this.notFound();
                }

                return tx.chatSession.update({
                    where: { id: session.id },
                    data: { title },
                    select: chatSessionSelect,
                });
            });
        } catch (error) {
            this.rethrowNotFound(error);
        }
    }

    async deleteChatSession(
        chatSessionId: string,
        userId: string
    ): Promise<ChatSessionResponse> {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const session = await tx.chatSession.findFirst({
                    where: {
                        id: chatSessionId,
                        conversation: {
                            is: { user_id: userId },
                        },
                    },
                    select: { id: true },
                });

                if (!session) {
                    throw this.notFound();
                }

                return tx.chatSession.delete({
                    where: { id: session.id },
                    select: chatSessionSelect,
                });
            });
        } catch (error) {
            this.rethrowNotFound(error);
        }
    }

    private notFound(): NotFoundException {
        return new NotFoundException(
            'Không tìm thấy phiên trò chuyện hoặc bạn không có quyền truy cập'
        );
    }

    private rethrowNotFound(error: unknown): never {
        if (
            error instanceof NotFoundException ||
            (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')
        ) {
            throw this.notFound();
        }
        throw error;
    }
}
