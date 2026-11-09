import { Test, TestingModule } from '@nestjs/testing';
import { QuizRepoService } from './quiz-repo.service.js';

describe('QuizRepoService', () => {
  let service: QuizRepoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QuizRepoService],
    }).compile();

    service = module.get<QuizRepoService>(QuizRepoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
