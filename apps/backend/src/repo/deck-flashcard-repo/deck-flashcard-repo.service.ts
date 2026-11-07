import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
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
