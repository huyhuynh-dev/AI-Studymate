import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AttemptStatusEnum,
  CardStateEnum,
  EvaluationStatusEnum,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AnalyticsRepoService } from './analytics-repo.service.js';

describe('AnalyticsRepoService', () => {
  let service: AnalyticsRepoService;
  let prismaMock: {
    conversation: { findFirst: ReturnType<typeof vi.fn> };
    document: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    subject: { findFirst: ReturnType<typeof vi.fn> };
    flashcard: { findMany: ReturnType<typeof vi.fn> };
    flashcardReview: {
      groupBy: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    quizAttempt: { findMany: ReturnType<typeof vi.fn> };
    documentChunk: { findMany: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    prismaMock = {
      conversation: { findFirst: vi.fn() },
      document: { findFirst: vi.fn(), findMany: vi.fn() },
      subject: { findFirst: vi.fn() },
      flashcard: { findMany: vi.fn() },
      flashcardReview: { groupBy: vi.fn(), findMany: vi.fn() },
      quizAttempt: { findMany: vi.fn() },
      documentChunk: { findMany: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsRepoService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AnalyticsRepoService>(AnalyticsRepoService);
  });

  it('throws NotFoundException on assertConversationAccess, assertDocumentAccess, and assertSubjectAccessWithConversations when ownership mismatches', async () => {
    prismaMock.conversation.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.assertConversationAccess('conv-1', 'wrong-user'),
    ).rejects.toThrow(NotFoundException);

    prismaMock.document.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.assertDocumentAccess('doc-1', 'wrong-user'),
    ).rejects.toThrow(NotFoundException);

    prismaMock.subject.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.assertSubjectAccessWithConversations('subj-1', 'wrong-user'),
    ).rejects.toThrow(NotFoundException);
  });

  it('short-circuits immediately without hitting DB when conversationIds is empty', async () => {
    expect(await service.getSrsFlashcardsByConversations([], 'u1')).toEqual([]);
    expect(
      await service.getReviewLogsByConversations([], 'u1', new Date()),
    ).toEqual([]);
    expect(
      await service.getSubmittedQuizAnalyticsByConversations([], 'u1'),
    ).toEqual([]);
    expect(
      await service.getDocumentsSummaryAndChunkIndex([], 'u1'),
    ).toEqual({ documents: [], chunks: [] });

    expect(prismaMock.flashcard.findMany).not.toHaveBeenCalled();
    expect(prismaMock.flashcardReview.findMany).not.toHaveBeenCalled();
    expect(prismaMock.quizAttempt.findMany).not.toHaveBeenCalled();
    expect(prismaMock.document.findMany).not.toHaveBeenCalled();
  });

  it('joins grouped againCount from flashcardReview.groupBy onto each flashcard', async () => {
    const due = new Date('2026-11-16T10:00:00.000Z');
    prismaMock.flashcard.findMany.mockResolvedValueOnce([
      {
        id: 'fc-1',
        deck_id: 'deck-1',
        front_text: 'B+ Tree',
        state: CardStateEnum.relearning,
        interval: 1,
        ease_factor: 1.7,
        due_date: due,
        last_reviewed_at: due,
        source_refs: null,
        deck: { id: 'deck-1', name: 'DBMS', conversation_id: 'conv-1' },
      },
      {
        id: 'fc-2',
        deck_id: 'deck-1',
        front_text: 'AVL Tree',
        state: CardStateEnum.review,
        interval: 12,
        ease_factor: 2.5,
        due_date: due,
        last_reviewed_at: due,
        source_refs: null,
        deck: { id: 'deck-1', name: 'DBMS', conversation_id: 'conv-1' },
      },
    ]);
    prismaMock.flashcardReview.groupBy.mockResolvedValueOnce([
      { flashcard_id: 'fc-1', _count: { _all: 4 } },
    ]);

    const res = await service.getSrsFlashcardsByConversations(['conv-1'], 'u1');

    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ id: 'fc-1', againCount: 4 });
    expect(res[1]).toMatchObject({ id: 'fc-2', againCount: 0 });
  });

  it('selects lightweight document/chunk fields without heavy embedding or raw_text columns and scopes submitted quizzes', async () => {
    prismaMock.document.findMany.mockResolvedValueOnce([
      {
        id: 'doc-1',
        conversation_id: 'conv-1',
        file_name: 'Alg.pdf',
        page_count: 10,
        ocr_status: 'done',
        doc_metadata: { toc: [] },
      },
    ]);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([
      {
        id: 'chk-1',
        document_id: 'doc-1',
        chunk_index: 0,
        headings: ['Intro'],
        page_numbers: [1],
      },
    ]);
    prismaMock.quizAttempt.findMany.mockResolvedValueOnce([
      {
        id: 'att-1',
        quiz_id: 'quiz-1',
        score: 8,
        max_score: 10,
        completed_at: new Date('2026-11-16T08:00:00.000Z'),
        quiz: { id: 'quiz-1', title: 'Quiz 1', conversation_id: 'conv-1' },
        answers: [
          {
            question_id: 'q-1',
            evaluation_status: EvaluationStatusEnum.correct,
            points_earned: 1,
            missing_points: [],
            answered_at: null,
            question: {
              id: 'q-1',
              question_text: '<p>Q1</p>',
              points: 1,
              bloom_level: 'remember',
              source_refs: null,
            },
          },
        ],
      },
    ]);

    const docRes = await service.getDocumentsSummaryAndChunkIndex(
      ['conv-1'],
      'u1',
    );
    expect(docRes.documents).toHaveLength(1);
    expect(docRes.chunks[0]).toEqual({
      id: 'chk-1',
      documentId: 'doc-1',
      chunkIndex: 0,
      headings: ['Intro'],
      pageNumbers: [1],
    });

    const docSelectCall = prismaMock.document.findMany.mock.calls[0][0] as {
      select: Record<string, boolean>;
    };
    expect(docSelectCall.select.raw_text).toBeUndefined();

    const chunkSelectCall = prismaMock.documentChunk.findMany.mock
      .calls[0][0] as { select: Record<string, boolean> };
    expect(chunkSelectCall.select.embedding).toBeUndefined();
    expect(chunkSelectCall.select.content).toBeUndefined();

    const quizzes = await service.getSubmittedQuizAnalyticsByConversations(
      ['conv-1'],
      'u1',
    );
    expect(quizzes).toHaveLength(1);
    expect(prismaMock.quizAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: 'u1',
          status: AttemptStatusEnum.submitted,
        }),
      }),
    );
  });
});
