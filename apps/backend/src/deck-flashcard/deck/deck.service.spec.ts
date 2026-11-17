import { Test, TestingModule } from '@nestjs/testing';
import { DeckFlashcardRepoService } from '../../repo/deck-flashcard-repo/deck-flashcard-repo.service.js';
import { DeckService } from './deck.service.js';

describe('DeckService', () => {
  let service: DeckService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeckService,
        { provide: DeckFlashcardRepoService, useValue: {} },
      ],
    }).compile();

    service = module.get<DeckService>(DeckService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
