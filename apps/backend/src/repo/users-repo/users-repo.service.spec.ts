import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UsersRepoService } from './users-repo.service.js';

describe('UsersRepoService', () => {
  let service: UsersRepoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepoService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<UsersRepoService>(UsersRepoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
