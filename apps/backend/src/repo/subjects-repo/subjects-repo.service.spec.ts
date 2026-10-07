import { Test, TestingModule } from '@nestjs/testing';
import { SubjectsRepoService } from './subjects-repo.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('SubjectsRepoService', () => {
  let service: SubjectsRepoService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      subject: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubjectsRepoService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<SubjectsRepoService>(SubjectsRepoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
