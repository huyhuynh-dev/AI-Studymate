import { Injectable, NotFoundException } from '@nestjs/common';
import { DeckFlashcardRepoService } from '../../repo/deck-flashcard-repo/deck-flashcard-repo.service.js';
import { CreateDeckDto, GetDecksQueryDto, UpdateDeckDto } from '../dto/deck.dto.js';

export interface DeckStatsResponse {
    total: number;
    new: number;
    learning: number;
    relearning: number;
    inProgress: number;
    review: number;
    dueToday: number;
}

export interface DeckItemResponse {
    id: string;
    name: string;
    description: string;
    conversationId: string;
    createdAt: Date;
    updatedAt: Date;
    stats: DeckStatsResponse;
}

@Injectable()
export class DeckService {
    constructor(private readonly deckRepo: DeckFlashcardRepoService) {}

    async getDecks(userId: string, query: GetDecksQueryDto): Promise<DeckItemResponse[]> {
        const decks = await this.deckRepo.getDecksWithStats(userId, {
            conversationId: query.conversationId,
            search: query.search,
        });

        return decks.map((deck) => this.mapDeckWithStats(deck));
    }

    async getDeckById(deckId: string, userId: string): Promise<DeckItemResponse> {
        const deck = await this.deckRepo.getDeckByIdWithStats(deckId, userId);
        if (!deck) {
            throw new NotFoundException('Không tìm thấy bộ thẻ hoặc bạn không có quyền truy cập');
        }

        return this.mapDeckWithStats(deck);
    }

    async createDeck(userId: string, data: CreateDeckDto): Promise<DeckItemResponse> {
        const created = await this.deckRepo.createDeck({
            user_id: userId,
            conversation_id: data.conversationId,
            name: data.name.trim(),
            description: data.description?.trim() || null,
        });

        return {
            id: created.id,
            name: created.name,
            description: created.description || '',
            conversationId: created.conversation_id,
            createdAt: created.created_at,
            updatedAt: created.updated_at,
            stats: {
                total: 0,
                new: 0,
                learning: 0,
                relearning: 0,
                inProgress: 0,
                review: 0,
                dueToday: 0,
            },
        };
    }

    async updateDeck(deckId: string, userId: string, data: UpdateDeckDto): Promise<DeckItemResponse> {
        await this.deckRepo.updateDeck(deckId, userId, {
            ...(data.name !== undefined && { name: data.name.trim() }),
            ...(data.description !== undefined && { description: data.description.trim() || null }),
        });

        return this.getDeckById(deckId, userId);
    }

    async deleteDeck(deckId: string, userId: string): Promise<{ success: boolean; message: string }> {
        await this.deckRepo.deleteDeck(deckId, userId);
        return {
            success: true,
            message: 'Xóa bộ thẻ thành công',
        };
    }

    private mapDeckWithStats(deck: any): DeckItemResponse {
        const now = new Date();
        const flashcards = deck.flashcards || [];

        const newCount = flashcards.filter((c: any) => c.state === 'new').length;
        const learningCount = flashcards.filter((c: any) => c.state === 'learning').length;
        const relearningCount = flashcards.filter((c: any) => c.state === 'relearning').length;
        const learningTotal = learningCount + relearningCount;
        const reviewCount = flashcards.filter((c: any) => c.state === 'review').length;

        // Các thẻ cần học/ôn hôm nay: bao gồm thẻ mới (cần học) và các thẻ đã đến hạn ôn tập
        const dueTodayCount = flashcards.filter(
            (c: any) => c.state === 'new' || new Date(c.due_date) <= now
        ).length;

        return {
            id: deck.id,
            name: deck.name,
            description: deck.description || '',
            conversationId: deck.conversation_id,
            createdAt: deck.created_at,
            updatedAt: deck.updated_at,
            stats: {
                total: flashcards.length,
                new: newCount,
                learning: learningTotal,
                relearning: relearningCount,
                inProgress: learningTotal,
                review: reviewCount,
                dueToday: dueTodayCount,
            },
        };
    }
}
