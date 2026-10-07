import { Test, TestingModule } from '@nestjs/testing';
import { SubjectsService } from './subjects.service.js';
import { SubjectsRepoService } from '../repo/subjects-repo/subjects-repo.service.js';
import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('SubjectsService', () => {
  let service: SubjectsService;
  let repo: Partial<Record<keyof SubjectsRepoService, any>>;

  beforeEach(async () => {
    repo = {
      createSubject: vi.fn(),
      getAllSubjectsByUserId: vi.fn(),
      getSubjectById: vi.fn(),
      updateSubject: vi.fn(),
      deleteSubject: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubjectsService,
        {
          provide: SubjectsRepoService,
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<SubjectsService>(SubjectsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSubjectById', () => {
    it('should return subject when found', async () => {
      const mockSubject = { id: 'uuid-1', name: 'AI Study', color: '#ffffff' };
      repo.getSubjectById.mockResolvedValue(mockSubject);

      const result = await service.getSubjectById('uuid-1', 'user-1');
      expect(result).toEqual(mockSubject);
      expect(repo.getSubjectById).toHaveBeenCalledWith('uuid-1', 'user-1');
    });

    it('should throw NotFoundException when subject does not exist', async () => {
      repo.getSubjectById.mockResolvedValue(null);

      await expect(service.getSubjectById('uuid-999', 'user-1')).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
