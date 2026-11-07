import { Module } from '@nestjs/common';
import { DeckFlashcardController } from './deck-flashcard.controller.js';
import { DeckService } from './deck/deck.service.js';
import { FlashcardService } from './flashcard/flashcard.service.js';
import { RepoModule } from '../repo/repo.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [RepoModule, PrismaModule],
  controllers: [DeckFlashcardController],
  providers: [DeckService, FlashcardService],
  exports: [DeckService, FlashcardService],
})
export class DeckFlashcardModule {}
