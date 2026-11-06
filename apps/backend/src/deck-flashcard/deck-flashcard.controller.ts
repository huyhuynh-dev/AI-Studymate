import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Put,
    Query,
    Req,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { DeckService, DeckItemResponse } from './deck/deck.service.js';
import { FlashcardService } from './flashcard/flashcard.service.js';
import { CreateDeckDto, GetDecksQueryDto, UpdateDeckDto } from './dto/deck.dto.js';
import {
    CreateFlashcardDto,
    ReviewFlashcardDto,
    UpdateFlashcardDto,
} from './dto/flashcard.dto.js';
import { Prisma } from '../generated/prisma/client.js';

@Controller('deck-flashcard')
@UseGuards(JwtAuthGuard)
export class DeckFlashcardController {
    constructor(
        private readonly deckService: DeckService,
        private readonly flashcardService: FlashcardService
    ) {}

    private getUserId(req: Request): string {
        const user = req.user as { userId?: string; sub?: string } | undefined;
        const userId = user?.userId || user?.sub;
        if (!userId) {
            throw new UnauthorizedException('Người dùng chưa được xác thực');
        }
        return userId;
    }

    /* ==========================================================
     * ENDPOINTS BỘ THẺ (FLASHCARD DECKS)
     * ========================================================== */

    @Get('decks')
    async getDecks(
        @Req() req: Request,
        @Query() query: GetDecksQueryDto
    ): Promise<DeckItemResponse[]> {
        return this.deckService.getDecks(this.getUserId(req), query);
    }

    @Get('decks/:id')
    async getDeckById(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string
    ): Promise<DeckItemResponse> {
        return this.deckService.getDeckById(id, this.getUserId(req));
    }

    @Post('decks')
    async createDeck(
        @Req() req: Request,
        @Body() data: CreateDeckDto
    ): Promise<DeckItemResponse> {
        return this.deckService.createDeck(this.getUserId(req), data);
    }

    @Put('decks/:id')
    async updateDeck(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() data: UpdateDeckDto
    ): Promise<DeckItemResponse> {
        return this.deckService.updateDeck(id, this.getUserId(req), data);
    }

    @Delete('decks/:id')
    async deleteDeck(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string
    ): Promise<{ success: boolean; message: string }> {
        return this.deckService.deleteDeck(id, this.getUserId(req));
    }

    /* ==========================================================
     * ENDPOINTS THẺ GHI NHỚ (FLASHCARDS) & THUẬT TOÁN SM-2
     * ========================================================== */

    @Post('flashcards')
    async createFlashcard(
        @Req() req: Request,
        @Body() data: CreateFlashcardDto
    ): Promise<Prisma.FlashcardModel> {
        return this.flashcardService.createFlashcard(this.getUserId(req), data);
    }

    @Get('decks/:deckId/flashcards')
    async getFlashcardsByDeckId(
        @Req() req: Request,
        @Param('deckId', new ParseUUIDPipe()) deckId: string
    ): Promise<Prisma.FlashcardModel[]> {
        return this.flashcardService.getFlashcardsByDeckId(deckId, this.getUserId(req));
    }

    @Get('flashcards/:id')
    async getFlashcardById(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string
    ): Promise<Prisma.FlashcardModel> {
        return this.flashcardService.getFlashcardById(id, this.getUserId(req));
    }

    @Put('flashcards/:id')
    async updateFlashcard(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() data: UpdateFlashcardDto
    ): Promise<Prisma.FlashcardModel> {
        return this.flashcardService.updateFlashcard(id, this.getUserId(req), data);
    }

    @Delete('flashcards/:id')
    async deleteFlashcard(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string
    ): Promise<{ success: boolean; message: string }> {
        return this.flashcardService.deleteFlashcard(id, this.getUserId(req));
    }

    @Post('flashcards/:id/review')
    async reviewFlashcard(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() data: ReviewFlashcardDto
    ): Promise<Prisma.FlashcardModel> {
        return this.flashcardService.reviewFlashcard(id, this.getUserId(req), data.rating);
    }
}
