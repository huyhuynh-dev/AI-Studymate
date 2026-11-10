import { Injectable, NotFoundException } from '@nestjs/common';
import { CardTypeEnum, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class DeckFlashcardRepoService {
    constructor(private readonly prisma: PrismaService) {}

    async createDeck(data: Prisma.FlashcardDeckUncheckedCreateInput): Promise<Prisma.FlashcardDeckModel> {
        return await this.prisma.flashcardDeck.create({ data });
    }

    async getAllDecksByUserId(userId: string): Promise<Prisma.FlashcardDeckModel[]> {
        return await this.prisma.flashcardDeck.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
        });
    }

    async getDecksWithStats(
        userId: string,
        filter: { conversationId?: string; search?: string } = {}
    ) {
        const where: Prisma.FlashcardDeckWhereInput = {
            user_id: userId,
        };

        if (filter.conversationId) {
            where.conversation_id = filter.conversationId;
        }

        if (filter.search && filter.search.trim()) {
            const keyword = filter.search.trim();
            where.OR = [
                { name: { contains: keyword, mode: 'insensitive' } },
                { description: { contains: keyword, mode: 'insensitive' } },
            ];
        }

        return await this.prisma.flashcardDeck.findMany({
            where,
            orderBy: { created_at: 'desc' },
            include: {
                flashcards: {
                    select: {
                        id: true,
                        state: true,
                        due_date: true,
                    },
                },
            },
        });
    }

    async getDeckById(deckId: string, userId: string): Promise<Prisma.FlashcardDeckModel | null> {
        return await this.prisma.flashcardDeck.findFirst({
            where: {
                id: deckId,
                user_id: userId,
            },
        });
    }

    async getDeckByIdWithStats(deckId: string, userId: string) {
        return await this.prisma.flashcardDeck.findFirst({
            where: {
                id: deckId,
                user_id: userId,
            },
            include: {
                flashcards: {
                    select: {
                        id: true,
                        state: true,
                        due_date: true,
                    },
                },
            },
        });
    }

    async updateDeck(
        deckId: string,
        userId: string,
        data: Prisma.FlashcardDeckUpdateInput
    ): Promise<Prisma.FlashcardDeckModel> {
        try {
            return await this.prisma.flashcardDeck.update({
                where: {
                    id: deckId,
                    user_id: userId,
                },
                data,
            });
        } catch (error) {
            this.throwIfNotFound(error, 'Không tìm thấy bộ thẻ hoặc bạn không có quyền truy cập');
            throw error;
        }
    }

    async deleteDeck(deckId: string, userId: string): Promise<Prisma.FlashcardDeckModel> {
        try {
            return await this.prisma.flashcardDeck.delete({
                where: {
                    id: deckId,
                    user_id: userId,
                },
            });
        } catch (error) {
            this.throwIfNotFound(error, 'Không tìm thấy bộ thẻ hoặc bạn không có quyền truy cập');
            throw error;
        }
    }

    async createFlashcard(
        data: Prisma.FlashcardUncheckedCreateInput,
        userId: string
    ): Promise<Prisma.FlashcardModel> {
        await this.assertDeckOwnership(data.deck_id, userId);
        return await this.prisma.flashcard.create({ data });
    }

    async createManyFlashcards(
        deckId: string,
        cards: Array<{
            card_type: any;
            front_text: string;
            back_text: string;
            image_url?: string | null;
            audio_url?: string | null;
            state?: any;
        }>,
        userId?: string
    ): Promise<number> {
        if (userId) {
            await this.assertDeckOwnership(deckId, userId);
        }
        if (cards.length === 0) return 0;
        const records = cards.map((c) => ({
            deck_id: deckId,
            card_type: c.card_type,
            front_text: c.front_text,
            back_text: c.back_text,
            image_url: c.image_url ?? null,
            audio_url: c.audio_url ?? null,
            state: c.state ?? 'new',
        }));
        const res = await this.prisma.flashcard.createMany({ data: records });
        return res.count;
    }

    /**
     * Kiểm tra phiên học (Conversation) có thuộc về người dùng hay không.
     */
    async verifyConversationOwnership(
        conversationId: string,
        userId: string
    ): Promise<boolean> {
        const conv = await this.prisma.conversation.findFirst({
            where: {
                id: conversationId,
                user_id: userId,
            },
            select: { id: true },
        });
        return Boolean(conv);
    }

    /**
     * Lấy thông tin cơ bản của Deck thuộc đúng người dùng VÀ đúng phiên học.
     */
    async getDeckInConversation(
        deckId: string,
        conversationId: string,
        userId: string
    ): Promise<{ id: string; name: string } | null> {
        return await this.prisma.flashcardDeck.findFirst({
            where: {
                id: deckId,
                conversation_id: conversationId,
                user_id: userId,
            },
            select: {
                id: true,
                name: true,
            },
        });
    }

    /**
     * Lấy mặt trước của các thẻ gần nhất trong bộ thẻ để phục vụ khử trùng lặp khi tạo bằng AI.
     */
    async getRecentFlashcardFronts(
        deckId: string,
        limit: number
    ): Promise<string[]> {
        const cards = await this.prisma.flashcard.findMany({
            where: { deck_id: deckId },
            select: { front_text: true },
            orderBy: { created_at: 'desc' },
            take: limit,
        });
        return cards.map((c) => c.front_text);
    }

    /**
     * Tạo mới một bộ thẻ (Deck) kèm danh sách thẻ (Flashcards) một cách nguyên tử (nested create).
     */
    async createDeckWithFlashcards(params: {
        conversationId: string;
        userId: string;
        name: string;
        description: string | null;
        rows: Array<{
            card_type: CardTypeEnum;
            front_text: string;
            back_text: string;
        }>;
    }): Promise<{ deckId: string; cards: Prisma.FlashcardModel[] }> {
        const deck = await this.prisma.flashcardDeck.create({
            data: {
                conversation_id: params.conversationId,
                user_id: params.userId,
                name: params.name,
                description: params.description,
                flashcards: {
                    create: params.rows,
                },
            },
            include: {
                flashcards: true,
            },
        });

        return {
            deckId: deck.id,
            cards: deck.flashcards,
        };
    }

    /**
     * Thêm hàng loạt thẻ vào một bộ thẻ có sẵn và cập nhật updated_at của bộ thẻ trong cùng 1 transaction.
     */
    async addFlashcardsToDeckAtomic(
        deckId: string,
        rows: Array<{
            card_type: CardTypeEnum;
            front_text: string;
            back_text: string;
        }>
    ): Promise<Prisma.FlashcardModel[]> {
        return await this.prisma.$transaction(async (tx) => {
            const created = await tx.flashcard.createManyAndReturn({
                data: rows.map((r) => ({
                    deck_id: deckId,
                    card_type: r.card_type,
                    front_text: r.front_text,
                    back_text: r.back_text,
                })),
            });

            await tx.flashcardDeck.update({
                where: { id: deckId },
                data: { updated_at: new Date() },
            });

            return created;
        });
    }

    async getAllFlashcardsByDeckId(
        deckId: string,
        userId: string
    ): Promise<Prisma.FlashcardModel[]> {
        await this.assertDeckOwnership(deckId, userId);
        return await this.prisma.flashcard.findMany({
            where: { deck_id: deckId },
            orderBy: { created_at: 'desc' },
        });
    }

    async getFlashcardById(
        flashcardId: string,
        userId: string
    ): Promise<Prisma.FlashcardModel | null> {
        return await this.prisma.flashcard.findFirst({
            where: {
                id: flashcardId,
                deck: {
                    user_id: userId,
                },
            },
        });
    }

    async updateFlashcard(
        flashcardId: string,
        userId: string,
        data: Prisma.FlashcardUpdateInput
    ): Promise<Prisma.FlashcardModel> {
        await this.assertFlashcardOwnership(flashcardId, userId);

        try {
            return await this.prisma.flashcard.update({
                where: { id: flashcardId },
                data,
            });
        } catch (error) {
            this.throwIfNotFound(error, 'Không tìm thấy thẻ ghi nhớ hoặc bạn không có quyền truy cập');
            throw error;
        }
    }

    async deleteFlashcard(
        flashcardId: string,
        userId: string
    ): Promise<Prisma.FlashcardModel> {
        await this.assertFlashcardOwnership(flashcardId, userId);

        try {
            return await this.prisma.flashcard.delete({
                where: { id: flashcardId },
            });
        } catch (error) {
            this.throwIfNotFound(error, 'Không tìm thấy thẻ ghi nhớ hoặc bạn không có quyền truy cập');
            throw error;
        }
    }

    private async assertDeckOwnership(deckId: string, userId: string): Promise<void> {
        const deck = await this.prisma.flashcardDeck.findFirst({
            where: {
                id: deckId,
                user_id: userId,
            },
            select: { id: true },
        });

        if (!deck) {
            throw new NotFoundException('Không tìm thấy bộ thẻ hoặc bạn không có quyền truy cập');
        }
    }

    private async assertFlashcardOwnership(
        flashcardId: string,
        userId: string
    ): Promise<void> {
        const flashcard = await this.prisma.flashcard.findFirst({
            where: {
                id: flashcardId,
                deck: {
                    user_id: userId,
                },
            },
            select: { id: true },
        });

        if (!flashcard) {
            throw new NotFoundException('Không tìm thấy thẻ ghi nhớ hoặc bạn không có quyền truy cập');
        }
    }

    private throwIfNotFound(error: unknown, message: string): void {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025'
        ) {
            throw new NotFoundException(message);
        }
    }
}
