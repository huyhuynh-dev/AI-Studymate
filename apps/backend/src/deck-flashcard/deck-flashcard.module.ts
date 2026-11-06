import { Module } from '@nestjs/common';
import { DeckFlashcardController } from './deck-flashcard.controller.js';
import { DeckService } from './deck/deck.service.js';
import { FlashcardService } from './flashcard/flashcard.service.js';
import { RepoModule } from '../repo/repo.module.js';

@Module({
  imports: [RepoModule],
  controllers: [DeckFlashcardController],
  providers: [DeckService, FlashcardService],
  exports: [DeckService, FlashcardService],
})
export class DeckFlashcardModule {}
