import { Module } from '@nestjs/common';
import { DeckFlashcardController } from './deck-flashcard.controller.js';
import { DeckService } from './deck/deck.service.js';
import { FlashcardService } from './flashcard/flashcard.service.js';

@Module({
  controllers: [DeckFlashcardController],
  providers: [DeckService, FlashcardService]
})
export class DeckFlashcardModule {}
