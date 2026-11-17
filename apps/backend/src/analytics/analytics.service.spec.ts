import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CardStateEnum,
  EvaluationStatusEnum,
} from '../generated/prisma/client.js';
import { AnalyticsRepoService } from '../repo/analytics-repo/analytics-repo.service.js';
import { AnalyticsService } from './analytics.service.js';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockRepo: {
    assertConversationAccess: ReturnType<typeof vi.fn>;
    assertDocumentAccess: ReturnType<typeof vi.fn>;
    assertSubjectAccessWithConversations: ReturnType<typeof vi.fn>;
    getSrsFlashcardsByConversations: ReturnType<typeof vi.fn>;
    getReviewLogsByConversations: ReturnType<typeof vi.fn>;
    getSubmittedQuizAnalyticsByConversations: ReturnType<typeof vi.fn>;
    getDocumentsSummaryAndChunkIndex: ReturnType<typeof vi.fn>;
    getChunkIndexByDocumentId: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockRepo = {
      assertConversationAccess: vi.fn().mockResolvedValue({
        id: 'conv-1',
        title: 'Buổi 1',
        subjectId: 'subj-1',
        subjectName: 'Hệ điều hành',
      }),
      assertDocumentAccess: vi.fn().mockResolvedValue({
        id: 'doc-1',
        conversationId: 'conv-1',
        fileName: 'OS.pdf',
        mimeType: 'application/pdf',
        pageCount: 20,
        ocrStatus: 'done',
        docMetadata: { toc: [{ text: 'Deadlock', level: 1, page_no: 5 }] },
      }),
      assertSubjectAccessWithConversations: vi.fn().mockResolvedValue({
        id: 'subj-1',
        name: 'Hệ điều hành',
        color: '#2563eb',
        conversations: [
          { id: 'conv-1', title: 'Buổi 1', updatedAt: new Date('2026-11-16T00:00:00Z') },
          { id: 'conv-2', title: 'Buổi 2', updatedAt: new Date('2026-11-15T00:00:00Z') },
        ],
      }),
      getSrsFlashcardsByConversations: vi.fn().mockResolvedValue([
        {
          id: 'card-1',
          deckId: 'deck-1',
          deckName: 'Deck OS',
          conversationId: 'conv-1',
          frontText: '<p>Deadlock?</p>',
          state: CardStateEnum.relearning,
          interval: 1,
          easeFactor: 1.5,
          dueDate: new Date('2026-11-15T00:00:00Z'),
          lastReviewedAt: new Date('2026-11-15T00:00:00Z'),
          sourceRefs: [
            { documentId: 'doc-1', fileName: 'OS.pdf', chunkId: 'chk-1', pageNumbers: [5] },
          ],
          againCount: 3,
        },
      ]),
      getReviewLogsByConversations: vi.fn().mockResolvedValue([
        {
          flashcardId: 'card-1',
          rating: 1,
          stateBefore: CardStateEnum.review,
          timeTakenMs: 6000,
          reviewedAt: new Date(),
        },
        {
          flashcardId: 'card-1',
          rating: 3,
          stateBefore: CardStateEnum.relearning,
          timeTakenMs: 4000,
          reviewedAt: new Date(),
        },
      ]),
      getSubmittedQuizAnalyticsByConversations: vi.fn().mockResolvedValue([
        {
          id: 'att-1',
          quizId: 'quiz-1',
          quizTitle: 'Quiz Deadlock',
          conversationId: 'conv-1',
          score: 1,
          maxScore: 2,
          completedAt: new Date(),
          answers: [
            {
              questionId: 'q-1',
              evaluationStatus: EvaluationStatusEnum.partial,
              pointsEarned: 1,
              missingPoints: ['Thiếu Hold and Wait'],
              answeredAt: new Date(),
              question: {
                id: 'q-1',
                questionText: '<p>Nêu điều kiện Deadlock?</p>',
                points: 2,
                bloomLevel: 'understand',
                sourceRefs: [
                  { documentId: 'doc-1', fileName: 'OS.pdf', chunkId: 'chk-1', pageNumbers: [5] },
                ],
              },
            },
          ],
        },
      ]),
      getDocumentsSummaryAndChunkIndex: vi.fn().mockResolvedValue({
        documents: [
          {
            id: 'doc-1',
            conversationId: 'conv-1',
            fileName: 'OS.pdf',
            pageCount: 20,
            ocrStatus: 'done',
            docMetadata: { toc: [{ text: 'Deadlock', level: 1, page_no: 5 }] },
          },
        ],
        chunks: [
          {
            id: 'chk-1',
            documentId: 'doc-1',
            chunkIndex: 0,
            headings: ['Deadlock'],
            pageNumbers: [5],
          },
        ],
      }),
      getChunkIndexByDocumentId: vi.fn().mockResolvedValue([
        {
          id: 'chk-1',
          documentId: 'doc-1',
          chunkIndex: 0,
          headings: ['Deadlock'],
          pageNumbers: [5],
        },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: AnalyticsRepoService,
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('getConversationAnalytics returns unified SRS, Bloom, Knowledge Gap, and Recommendations', async () => {
    const res = await service.getConversationAnalytics('user-1', 'conv-1', {
      tzOffsetMinutes: 420,
      windowDays: 30,
    });

    expect(res.conversationId).toBe('conv-1');
    expect(res.srsOverview.totalCards).toBe(1);
    expect(res.srsOverview.retentionRate).toBe(50);
    expect(res.srsOverview.avgResponseTimeMs).toBe(5000);
    expect(res.leechCards).toHaveLength(1);
    expect(res.workloadForecast7Days).toHaveLength(7);
    expect(res.missingPointsClusters[0].point).toBe('Thiếu Hold and Wait');
    expect(res.documentMasterySummaries[0].weakSectionsCount).toBe(1);
    expect(res.recommendations.length).toBeGreaterThanOrEqual(2);
  });

  it('getDocumentMastery maps TOC heatmap and propagates NotFoundException on invalid access', async () => {
    const docMastery = await service.getDocumentMastery('user-1', 'doc-1');
    expect(docMastery.documentId).toBe('doc-1');
    expect(docMastery.sections).toHaveLength(1);
    expect(docMastery.sections[0].status).toBe('weak');
    expect(docMastery.sections[0].chunkIds).toEqual(['chk-1']);

    mockRepo.assertDocumentAccess.mockRejectedValueOnce(new NotFoundException());
    await expect(service.getDocumentMastery('user-2', 'doc-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getSubjectAnalytics aggregates multiple conversations and handles empty subjects gracefully', async () => {
    const subjectRes = await service.getSubjectAnalytics('user-1', 'subj-1', {});
    expect(subjectRes.subjectId).toBe('subj-1');
    expect(subjectRes.conversationSummaries).toHaveLength(2);
    expect(subjectRes.conversationSummaries[0].dueNowCount).toBe(1);
    expect(subjectRes.conversationSummaries[1].totalCards).toBe(0);
    expect(subjectRes.topWeakTopics[0].conversationTitle).toBe('Buổi 1');

    mockRepo.assertSubjectAccessWithConversations.mockResolvedValueOnce({
      id: 'subj-empty',
      name: 'Môn trống',
      color: null,
      conversations: [],
    });
    mockRepo.getSrsFlashcardsByConversations.mockResolvedValueOnce([]);
    mockRepo.getReviewLogsByConversations.mockResolvedValueOnce([]);
    mockRepo.getSubmittedQuizAnalyticsByConversations.mockResolvedValueOnce([]);
    mockRepo.getDocumentsSummaryAndChunkIndex.mockResolvedValueOnce({
      documents: [],
      chunks: [],
    });

    const emptyRes = await service.getSubjectAnalytics('user-1', 'subj-empty', {});
    expect(emptyRes.srsOverview.retentionRate).toBeNull();
    expect(emptyRes.conversationSummaries).toEqual([]);
    expect(emptyRes.recommendations).toEqual([]);
  });
});
