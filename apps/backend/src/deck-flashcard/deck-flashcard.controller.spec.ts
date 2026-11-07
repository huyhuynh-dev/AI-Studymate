import { Test, TestingModule } from '@nestjs/testing';
import { DeckFlashcardController } from './deck-flashcard.controller.js';

describe('DeckFlashcardController', () => {
  let controller: DeckFlashcardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeckFlashcardController],
    }).compile();

    controller = module.get<DeckFlashcardController>(DeckFlashcardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
