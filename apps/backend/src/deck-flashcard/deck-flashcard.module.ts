import { Module } from '@nestjs/common';
import { DeckFlashcardController } from './deck-flashcard.controller.js';
import { DeckService } from './deck/deck.service.js';
import { FlashcardService } from './flashcard/flashcard.service.js';
import { FlashcardAiManageService } from './flashcard-ai-manage.service.js';
import { RepoModule } from '../repo/repo.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
    imports: [RepoModule, PrismaModule, AiModule],
    controllers: [DeckFlashcardController],
    providers: [DeckService, FlashcardService, FlashcardAiManageService],
    exports: [DeckService, FlashcardService, FlashcardAiManageService],
})
export class DeckFlashcardModule {}
