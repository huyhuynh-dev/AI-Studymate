import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsService } from '../conversations/conversations.service.js';
import { SubjectsController } from './subjects.controller.js';
import { SubjectsService } from './subjects.service.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request } from 'express';

describe('SubjectsController', () => {
  let controller: SubjectsController;
  let service: Partial<Record<keyof SubjectsService, ReturnType<typeof vi.fn>>>;

  beforeEach(async () => {
    service = {
      createSubject: vi.fn(),
      getAllSubjectsByUserId: vi.fn(),
      getSubjectById: vi.fn(),
      updateSubject: vi.fn(),
      deleteSubject: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubjectsController],
      providers: [
        {
          provide: SubjectsService,
          useValue: service,
        },
        {
          provide: ConversationsService,
          useValue: { findBySubjectId: vi.fn() },
        },
      ],
    }).compile();

    controller = module.get<SubjectsController>(SubjectsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get all subjects for authenticated user', async () => {
    const mockSubjects = [{ id: '1', name: 'Folder A', color: '#ffffff' }];
    service.getAllSubjectsByUserId?.mockResolvedValue(mockSubjects);

    const mockReq = {
      user: { userId: 'user-1', email: 'test@example.com' },
    } as unknown as Request;

    const result = await controller.getAllSubjectsByUserId(mockReq);
    expect(result).toEqual(mockSubjects);
    expect(service.getAllSubjectsByUserId).toHaveBeenCalledWith('user-1');
  });
});
