import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let mockAnalyticsService: {
    getConversationAnalytics: ReturnType<typeof vi.fn>;
    getDocumentMastery: ReturnType<typeof vi.fn>;
    getSubjectAnalytics: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockAnalyticsService = {
      getConversationAnalytics: vi.fn().mockResolvedValue({ conversationId: 'conv-1' }),
      getDocumentMastery: vi.fn().mockResolvedValue({ documentId: 'doc-1' }),
      getSubjectAnalytics: vi.fn().mockResolvedValue({ subjectId: 'subj-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  it('throws UnauthorizedException if req.user is missing', async () => {
    const fakeReq = { user: undefined } as unknown as Request;
    await expect(
      controller.getConversationAnalytics(fakeReq, 'conv-1', {}),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('delegates conversation, document mastery, and subject analytics to AnalyticsService', async () => {
    const fakeReq = { user: { userId: 'user-123' } } as unknown as Request;
    const query = { tzOffsetMinutes: 420, windowDays: 30 };

    await controller.getConversationAnalytics(fakeReq, 'conv-1', query);
    expect(mockAnalyticsService.getConversationAnalytics).toHaveBeenCalledWith(
      'user-123',
      'conv-1',
      query,
    );

    await controller.getDocumentMastery(fakeReq, 'doc-1');
    expect(mockAnalyticsService.getDocumentMastery).toHaveBeenCalledWith(
      'user-123',
      'doc-1',
    );

    await controller.getSubjectAnalytics(fakeReq, 'subj-1', query);
    expect(mockAnalyticsService.getSubjectAnalytics).toHaveBeenCalledWith(
      'user-123',
      'subj-1',
      query,
    );
  });
});
