import { Test, TestingModule } from '@nestjs/testing';
import { DeckFlashcardRepoService } from './deck-flashcard-repo.service.js';

describe('DeckFlashcardRepoService', () => {
  let service: DeckFlashcardRepoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeckFlashcardRepoService],
    }).compile();

    service = module.get<DeckFlashcardRepoService>(DeckFlashcardRepoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
