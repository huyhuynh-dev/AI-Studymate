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
            source_refs?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
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
            source_refs: c.source_refs ?? Prisma.DbNull,
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
            source_refs?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
        }>;
    }): Promise<{ deckId: string; cards: Prisma.FlashcardModel[] }> {
        const deck = await this.prisma.flashcardDeck.create({
            data: {
                conversation_id: params.conversationId,
                user_id: params.userId,
                name: params.name,
                description: params.description,
                flashcards: {
                    create: params.rows.map((r) => ({
                        card_type: r.card_type,
                        front_text: r.front_text,
                        back_text: r.back_text,
                        source_refs: r.source_refs ?? Prisma.DbNull,
                    })),
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
            source_refs?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
        }>
    ): Promise<Prisma.FlashcardModel[]> {
        return await this.prisma.$transaction(async (tx) => {
            const created = await tx.flashcard.createManyAndReturn({
                data: rows.map((r) => ({
                    deck_id: deckId,
                    card_type: r.card_type,
                    front_text: r.front_text,
                    back_text: r.back_text,
                    source_refs: r.source_refs ?? Prisma.DbNull,
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

    async getDeckCardsPaginated(params: {
        deckId?: string;
        cardId?: string;
        userId: string;
        stateFilter?: 'all' | 'due' | 'new' | 'learning' | 'review' | 'relearning';
        searchKeyword?: string;
        excludeBackTextForCardId?: string;
        offset?: number;
        limit?: number;
    }) {
        let deckRecord: {
            id: string;
            name: string;
            description: string | null;
            conversation_id: string;
        } | null = null;

        if (params.deckId) {
            deckRecord = await this.prisma.flashcardDeck.findFirst({
                where: {
                    id: params.deckId,
                    user_id: params.userId,
                },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    conversation_id: true,
                },
            });
        } else if (params.cardId) {
            const cardWithDeck = await this.prisma.flashcard.findFirst({
                where: {
                    id: params.cardId,
                    deck: {
                        user_id: params.userId,
                    },
                },
                select: {
                    deck: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            conversation_id: true,
                        },
                    },
                },
            });
            deckRecord = cardWithDeck?.deck ?? null;
        }

        if (!deckRecord) {
            return null;
        }

        const allCards = await this.prisma.flashcard.findMany({
            where: { deck_id: deckRecord.id },
            orderBy: { created_at: 'asc' },
            select: {
                id: true,
                card_type: true,
                front_text: true,
                back_text: true,
                state: true,
                interval: true,
                due_date: true,
            },
        });

        const now = new Date();
        const totalCards = allCards.length;
        const dueCount = allCards.filter((c) => !c.due_date || c.due_date <= now).length;

        const keyword = params.searchKeyword?.trim().toLowerCase() ?? '';
        const stateFilter = params.stateFilter ?? 'all';

        const filtered = allCards.filter((card) => {
            if (params.cardId && card.id !== params.cardId) {
                return false;
            }
            if (stateFilter === 'due') {
                if (card.due_date && card.due_date > now) return false;
            } else if (stateFilter !== 'all') {
                if (card.state !== stateFilter) return false;
            }
            if (keyword) {
                const frontMatches = (card.front_text || '').toLowerCase().includes(keyword);
                const canSearchBack = card.id !== params.excludeBackTextForCardId;
                const backMatches = canSearchBack
                    ? (card.back_text || '').toLowerCase().includes(keyword)
                    : false;
                if (!frontMatches && !backMatches) return false;
            }
            return true;
        });

        const safeOffset = Math.max(0, Math.floor(params.offset ?? 0));
        const safeLimit = Math.min(25, Math.max(1, Math.floor(params.limit ?? 15)));
        const paged = filtered.slice(safeOffset, safeOffset + safeLimit);

        return {
            deck: deckRecord,
            totalCards,
            dueCount,
            filteredCount: filtered.length,
            cards: paged,
        };
    }

    async searchDecksForUser(params: {
        userId: string;
        conversationId?: string;
        subjectId?: string;
        query?: string;
        limit?: number;
    }) {
        const keyword = params.query?.trim();
        return await this.prisma.flashcardDeck.findMany({
            where: {
                user_id: params.userId,
                ...(params.conversationId ? { conversation_id: params.conversationId } : {}),
                ...(params.subjectId
                    ? {
                          conversation: {
                              subject_id: params.subjectId,
                          },
                      }
                    : {}),
                ...(keyword
                    ? {
                          OR: [
                              { name: { contains: keyword, mode: 'insensitive' } },
                              { description: { contains: keyword, mode: 'insensitive' } },
                          ],
                      }
                    : {}),
            },
            orderBy: [{ updated_at: 'desc' }, { created_at: 'desc' }],
            take: params.limit ?? 5,
            select: {
                id: true,
                name: true,
                description: true,
                conversation_id: true,
                updated_at: true,
                _count: {
                    select: {
                        flashcards: true,
                    },
                },
                conversation: {
                    select: {
                        id: true,
                        title: true,
                        subject: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
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

    async moveFlashcardsToDeck(
        cardIds: string[],
        targetDeckId: string,
        userId: string
    ): Promise<Prisma.FlashcardModel[]> {
        await this.assertDeckOwnership(targetDeckId, userId);
        const uniqueIds = Array.from(new Set(cardIds.filter(Boolean)));
        if (uniqueIds.length === 0) return [];

        return await this.prisma.$transaction(async (tx) => {
            const ownedCards = await tx.flashcard.findMany({
                where: {
                    id: { in: uniqueIds },
                    deck: { user_id: userId },
                },
            });

            if (ownedCards.length !== uniqueIds.length) {
                throw new NotFoundException(
                    'Một hoặc nhiều thẻ ghi nhớ không tồn tại hoặc không thuộc quyền sở hữu của bạn'
                );
            }

            await tx.flashcard.updateMany({
                where: { id: { in: uniqueIds } },
                data: {
                    deck_id: targetDeckId,
                    updated_at: new Date(),
                },
            });

            await tx.flashcardDeck.update({
                where: { id: targetDeckId },
                data: { updated_at: new Date() },
            });

            return ownedCards;
        });
    }

    async deleteManyFlashcards(
        cardIds: string[],
        userId: string
    ): Promise<Prisma.FlashcardModel[]> {
        const uniqueIds = Array.from(new Set(cardIds.filter(Boolean)));
        if (uniqueIds.length === 0) return [];

        return await this.prisma.$transaction(async (tx) => {
            const ownedCards = await tx.flashcard.findMany({
                where: {
                    id: { in: uniqueIds },
                    deck: { user_id: userId },
                },
            });

            if (ownedCards.length !== uniqueIds.length) {
                throw new NotFoundException(
                    'Một hoặc nhiều thẻ ghi nhớ không tồn tại hoặc không thuộc quyền sở hữu của bạn'
                );
            }

            await tx.flashcard.deleteMany({
                where: { id: { in: uniqueIds } },
            });

            return ownedCards;
        });
    }

    /**
     * Lấy các thẻ khó nhớ (ease_factor < 2.1, đang relearning hoặc từng bị bấm Again rating=1)
     * trong một phiên học để phục vụ chẩn đoán và sinh đề đặc trị vùng yếu.
     */
    async getWeakFlashcardSignalsByConversation(
        conversationId: string,
        userId: string
    ) {
        return await this.prisma.flashcard.findMany({
            where: {
                deck: {
                    conversation_id: conversationId,
                    user_id: userId,
                },
                OR: [
                    { ease_factor: { lt: 2.1 } },
                    { state: 'relearning' },
                    { reviews: { some: { rating: 1 } } },
                ],
            },
            select: {
                id: true,
                front_text: true,
                ease_factor: true,
                state: true,
                source_refs: true,
                reviews: {
                    where: { rating: 1 },
                    select: { id: true },
                },
            },
            orderBy: { ease_factor: 'asc' },
            take: 150,
        });
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
