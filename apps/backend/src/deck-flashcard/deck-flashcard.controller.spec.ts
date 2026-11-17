import { Test, TestingModule } from '@nestjs/testing';
import { FlashcardAiManageService } from './flashcard-ai-manage.service.js';
import { FlashcardService } from './flashcard/flashcard.service.js';
import { DeckService } from './deck/deck.service.js';
import { DeckFlashcardController } from './deck-flashcard.controller.js';

describe('DeckFlashcardController', () => {
  let controller: DeckFlashcardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeckFlashcardController],
      providers: [
        { provide: DeckService, useValue: {} },
        { provide: FlashcardService, useValue: {} },
        { provide: FlashcardAiManageService, useValue: {} },
      ],
    }).compile();

    controller = module.get<DeckFlashcardController>(DeckFlashcardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
