import { Test, TestingModule } from '@nestjs/testing';
import { UsersRepoService } from './users-repo.service.js';

describe('UsersRepoService', () => {
  let service: UsersRepoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersRepoService],
    }).compile();

    service = module.get<UsersRepoService>(UsersRepoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
