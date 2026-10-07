import { Test, TestingModule } from '@nestjs/testing';
import { SubjectsRepoService } from './subjects-repo.service.js';

describe('SubjectsRepoService', () => {
  let service: SubjectsRepoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubjectsRepoService],
    }).compile();

    service = module.get<SubjectsRepoService>(SubjectsRepoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
