import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WorkspaceContextHydratorService,
  extractBlockNoteHeadings,
} from './workspace-context-hydrator.service.js';
import { renderEphemeralUiContextBlock } from '../ai/prompts/templates/workspace-context.formatter.js';
import type { AvailableDocumentItem } from '../documents/services/retrieval.service.js';

describe('WorkspaceContextHydratorService', () => {
  let conversationsRepo: { getConversationById: ReturnType<typeof vi.fn> };
  let subjectsRepo: { getSubjectById: ReturnType<typeof vi.fn> };
  let summariesRepo: {
    countSummariesByConversationId: ReturnType<typeof vi.fn>;
    getSummaryListL1ByConversationId: ReturnType<typeof vi.fn>;
    getSummaryByIdInConversation: ReturnType<typeof vi.fn>;
  };
  let deckFlashcardRepo: { getDecksWithStats: ReturnType<typeof vi.fn> };
  let quizRepo: {
    countQuizzesByConversation: ReturnType<typeof vi.fn>;
    getQuizListL1ByConversation: ReturnType<typeof vi.fn>;
    getQuizL1ByIdInConversation: ReturnType<typeof vi.fn>;
    getAttemptL1Summary: ReturnType<typeof vi.fn>;
  };
  let service: WorkspaceContextHydratorService;

  const docs: AvailableDocumentItem[] = [
    {
      documentId: '11111111-1111-4111-8111-111111111111',
      fileName: 'Chuong2.pdf',
      uploadedAt: new Date('2026-11-20T00:00:00Z'),
      pageCount: 30,
      toc: [
        { text: 'Giới thiệu', level: 1, pageNo: 1 },
        { text: 'Cây nhị phân', level: 1, pageNo: 10 },
        { text: 'Cây AVL', level: 2, pageNo: 12 },
      ],
    },
  ];

  beforeEach(() => {
    conversationsRepo = {
      getConversationById: vi.fn().mockResolvedValue({
        id: 'conv-1',
        subject_id: 'sub-1',
        user_id: 'user-1',
        title: 'Tuần 2 - Cây',
      }),
    };
    subjectsRepo = {
      getSubjectById: vi.fn().mockResolvedValue({
        id: 'sub-1',
        name: 'Cấu trúc dữ liệu',
      }),
    };
    summariesRepo = {
      countSummariesByConversationId: vi.fn().mockResolvedValue(2),
      getSummaryListL1ByConversationId: vi.fn().mockResolvedValue([
        {
          id: 'sum-1',
          title: 'Ghi chú Cây AVL',
          document_id: null,
          updated_at: new Date(),
        },
      ]),
      getSummaryByIdInConversation: vi.fn().mockResolvedValue({
        id: 'sum-1',
        title: 'Ghi chú Cây AVL',
        document_id: null,
        content_json: [
          {
            type: 'heading',
            props: { level: 1 },
            content: [{ type: 'text', text: 'Khái niệm' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Nội dung dài...' }],
          },
          {
            type: 'heading',
            props: { level: 2 },
            content: [{ type: 'text', text: 'Xoay đơn & xoay kép' }],
          },
        ],
      }),
    };
    deckFlashcardRepo = {
      getDecksWithStats: vi.fn().mockResolvedValue([
        {
          id: 'deck-1',
          name: 'Bộ thẻ AVL',
          flashcards: [
            { id: 'c1', state: 'new', due_date: new Date('2026-01-01T00:00:00Z') },
            { id: 'c2', state: 'review', due_date: new Date('2099-01-01T00:00:00Z') },
          ],
        },
      ]),
    };
    quizRepo = {
      countQuizzesByConversation: vi.fn().mockResolvedValue(1),
      getQuizListL1ByConversation: vi.fn().mockResolvedValue([
        {
          id: 'quiz-1',
          title: 'Quiz Chương 2',
          source: 'ai',
          _count: { questions: 10, attempts: 1 },
        },
      ]),
      getQuizL1ByIdInConversation: vi.fn().mockResolvedValue({
        id: 'quiz-1',
        title: 'Quiz Chương 2',
        source: 'ai',
        time_limit_sec: 600,
        _count: { questions: 10, attempts: 1 },
      }),
      getAttemptL1Summary: vi.fn().mockResolvedValue({
        id: 'att-1',
        quiz_id: 'quiz-1',
        status: 'in_progress',
        score: 0,
        max_score: 10,
        time_spent_sec: 120,
        config: { mode: 'exam' },
        quiz: { id: 'quiz-1', title: 'Quiz Chương 2', _count: { questions: 10 } },
        answers: [],
      }),
    };

    service = new WorkspaceContextHydratorService(
      conversationsRepo as any,
      subjectsRepo as any,
      summariesRepo as any,
      deckFlashcardRepo as any,
      quizRepo as any,
    );
  });

  it('drops foreign/unowned documentId and sidePanel documentId (Zero-Trust)', async () => {
    const res = await service.hydrate({
      userId: 'user-1',
      conversationId: 'conv-1',
      availableDocuments: docs,
      uiContext: {
        schemaVersion: 1,
        location: { pageType: 'conversation', activeTab: 'documents' },
        documents: {
          viewMode: 'viewer',
          filterType: 'all',
          totalCount: 1,
          visibleCount: 1,
          viewingDocument: {
            documentId: '99999999-9999-4999-8999-999999999999',
            fileName: 'Fake.pdf',
            viewerKind: 'pdf',
            currentPage: 5,
          },
        },
        sidePanel: {
          documentId: '99999999-9999-4999-8999-999999999999',
          fileName: 'FakeSide.pdf',
          pageNo: 1,
        },
      },
    });

    expect(res?.documentsView?.viewMode).toBe('list');
    expect(res?.documentsView?.viewingDocument).toBeUndefined();
    expect(res?.sidePanel).toBeUndefined();
  });

  it('hydrates verified PDF document with nearby TOC headings', async () => {
    const res = await service.hydrate({
      userId: 'user-1',
      conversationId: 'conv-1',
      availableDocuments: docs,
      uiContext: {
        schemaVersion: 1,
        location: { pageType: 'conversation', activeTab: 'documents' },
        documents: {
          viewMode: 'viewer',
          filterType: 'all',
          totalCount: 1,
          visibleCount: 1,
          viewingDocument: {
            documentId: '11111111-1111-4111-8111-111111111111',
            fileName: 'Chuong2.pdf',
            viewerKind: 'pdf',
            currentPage: 12,
            totalPages: 30,
          },
        },
      },
    });

    expect(res?.location.subjectName).toBe('Cấu trúc dữ liệu');
    expect(res?.location.conversationTitle).toBe('Tuần 2 - Cây');
    expect(res?.documentsView?.viewingDocument?.currentPage).toBe(12);
    expect(res?.documentsView?.viewingDocument?.nearbyTocHeadings).toContain(
      'Cây AVL (p.12)',
    );
  });

  it('extracts BlockNote headings safely for active summary and drops foreign summary', async () => {
    expect(extractBlockNoteHeadings('invalid')).toEqual([]);

    const res = await service.hydrate({
      userId: 'user-1',
      conversationId: 'conv-1',
      availableDocuments: docs,
      uiContext: {
        schemaVersion: 1,
        location: { pageType: 'conversation', activeTab: 'summary' },
        summary: {
          viewMode: 'detail',
          totalCount: 1,
          activeSummary: {
            summaryId: 'sum-1',
            title: 'Client Title',
          },
        },
      },
    });

    expect(res?.summaryView?.viewMode).toBe('detail');
    expect(res?.summaryView?.activeNote?.headings).toEqual([
      'H1: Khái niệm',
      'H2: Xoay đơn & xoay kép',
    ]);

    summariesRepo.getSummaryByIdInConversation.mockResolvedValueOnce(null);
    const foreignRes = await service.hydrate({
      userId: 'user-1',
      conversationId: 'conv-1',
      availableDocuments: docs,
      uiContext: {
        schemaVersion: 1,
        location: { pageType: 'conversation', activeTab: 'summary' },
        summary: {
          viewMode: 'detail',
          totalCount: 1,
          activeSummary: {
            summaryId: 'foreign-sum',
            title: 'Hack',
          },
        },
      },
    });
    expect(foreignRes?.summaryView?.viewMode).toBe('list');
    expect(foreignRes?.summaryView?.activeNote).toBeUndefined();
  });

  it('activates hideFlashcardAnswerGuard only when studying unrevealed card', async () => {
    const hiddenRes = await service.hydrate({
      userId: 'user-1',
      conversationId: 'conv-1',
      availableDocuments: docs,
      uiContext: {
        schemaVersion: 1,
        location: { pageType: 'conversation', activeTab: 'flashcard' },
        flashcard: {
          viewMode: 'study',
          totalDecksCount: 1,
          activeDeck: { deckId: 'deck-1', deckName: 'Bộ thẻ AVL' },
          studyState: {
            mode: 'due',
            progress: 0,
            remaining: 2,
            currentCardId: 'c1',
            isCardRevealed: false,
          },
        },
      },
    });
    expect(hiddenRes?.guards.hideFlashcardAnswerGuard).toBe(true);

    const revealedRes = await service.hydrate({
      userId: 'user-1',
      conversationId: 'conv-1',
      availableDocuments: docs,
      uiContext: {
        schemaVersion: 1,
        location: { pageType: 'conversation', activeTab: 'flashcard' },
        flashcard: {
          viewMode: 'study',
          totalDecksCount: 1,
          activeDeck: { deckId: 'deck-1', deckName: 'Bộ thẻ AVL' },
          studyState: {
            mode: 'due',
            progress: 0,
            remaining: 2,
            currentCardId: 'c1',
            isCardRevealed: true,
          },
        },
      },
    });
    expect(revealedRes?.guards.hideFlashcardAnswerGuard).toBe(false);
  });

  it('activates examIntegrityGuard on taking+exam (and fail-safe) and keeps it off on practice/result', async () => {
    const examRes = await service.hydrate({
      userId: 'user-1',
      conversationId: 'conv-1',
      availableDocuments: docs,
      uiContext: {
        schemaVersion: 1,
        location: { pageType: 'conversation', activeTab: 'quiz' },
        quiz: {
          viewMode: 'taking',
          totalQuizzesCount: 1,
          activeQuiz: { quizId: 'quiz-1', title: 'Quiz Chương 2' },
          activeAttempt: {
            attemptId: 'att-1',
            mode: 'exam',
            currentQuestionIndex: 2,
            totalQuestions: 10,
            answeredCount: 1,
          },
        },
      },
    });
    expect(examRes?.guards.examIntegrityGuard).toBe(true);

    const practiceRes = await service.hydrate({
      userId: 'user-1',
      conversationId: 'conv-1',
      availableDocuments: docs,
      uiContext: {
        schemaVersion: 1,
        location: { pageType: 'conversation', activeTab: 'quiz' },
        quiz: {
          viewMode: 'taking',
          totalQuizzesCount: 1,
          activeQuiz: { quizId: 'quiz-1', title: 'Quiz Chương 2' },
          activeAttempt: { attemptId: 'att-1', mode: 'practice' },
        },
      },
    });
    expect(practiceRes?.guards.examIntegrityGuard).toBe(false);

    const resultRes = await service.hydrate({
      userId: 'user-1',
      conversationId: 'conv-1',
      availableDocuments: docs,
      uiContext: {
        schemaVersion: 1,
        location: { pageType: 'conversation', activeTab: 'quiz' },
        quiz: {
          viewMode: 'result',
          totalQuizzesCount: 1,
          activeQuiz: { quizId: 'quiz-1', title: 'Quiz Chương 2' },
          activeAttempt: { attemptId: 'att-1', resultFilter: 'incorrect' },
        },
      },
    });
    expect(resultRes?.guards.examIntegrityGuard).toBe(false);
  });

  it('degrades gracefully when a repository rejects', async () => {
    summariesRepo.countSummariesByConversationId.mockRejectedValueOnce(
      new Error('DB timeout'),
    );
    deckFlashcardRepo.getDecksWithStats.mockRejectedValueOnce(
      new Error('DB error'),
    );

    const res = await service.hydrate({
      userId: 'user-1',
      conversationId: 'conv-1',
      availableDocuments: docs,
      uiContext: {
        schemaVersion: 1,
        location: { pageType: 'conversation', activeTab: 'analytics' },
        analytics: { windowDays: 30 },
      },
    });

    expect(res).toBeDefined();
    expect(res?.location.conversationId).toBe('conv-1');
    expect(res?.analyticsView?.windowDays).toBe(30);
    expect(res?.inventory.notesCount).toBe(0);
  });

  it('preserves Word currentPage/totalPages and omits Page info for PlainText documents', async () => {
    const wordDocId = '22222222-2222-4222-8222-222222222222';
    const textDocId = '33333333-3333-4333-8333-333333333333';
    const multiDocs: AvailableDocumentItem[] = [
      ...docs,
      {
        documentId: wordDocId,
        fileName: 'DeCuong.docx',
        uploadedAt: new Date('2026-11-21T00:00:00Z'),
        pageCount: null,
        toc: [],
      },
      {
        documentId: textDocId,
        fileName: 'notes.md',
        uploadedAt: new Date('2026-11-22T00:00:00Z'),
        pageCount: null,
        toc: [],
      },
    ];

    const wordRes = await service.hydrate({
      userId: 'user-1',
      conversationId: 'conv-1',
      availableDocuments: multiDocs,
      uiContext: {
        schemaVersion: 1,
        location: { pageType: 'conversation', activeTab: 'documents' },
        documents: {
          viewMode: 'viewer',
          filterType: 'all',
          totalCount: 3,
          visibleCount: 3,
          viewingDocument: {
            documentId: wordDocId,
            fileName: 'DeCuong.docx',
            viewerKind: 'word',
            currentPage: 3,
            totalPages: 7,
          },
        },
      },
    });

    expect(wordRes?.documentsView?.viewingDocument?.currentPage).toBe(3);
    expect(wordRes?.documentsView?.viewingDocument?.totalPages).toBe(7);
    const wordRendered = renderEphemeralUiContextBlock(wordRes!);
    expect(wordRendered).toContain('Viewing WORD "DeCuong.docx"');
    expect(wordRendered).toContain('| Page 3 of 7');

    const textRes = await service.hydrate({
      userId: 'user-1',
      conversationId: 'conv-1',
      availableDocuments: multiDocs,
      uiContext: {
        schemaVersion: 1,
        location: { pageType: 'conversation', activeTab: 'documents' },
        documents: {
          viewMode: 'viewer',
          filterType: 'all',
          totalCount: 3,
          visibleCount: 3,
          viewingDocument: {
            documentId: textDocId,
            fileName: 'notes.md',
            viewerKind: 'text',
          },
        },
      },
    });

    expect(textRes?.documentsView?.viewingDocument?.currentPage).toBeUndefined();
    expect(textRes?.documentsView?.viewingDocument?.totalPages).toBeUndefined();
    const textRendered = renderEphemeralUiContextBlock(textRes!);
    expect(textRendered).toContain('Viewing TEXT "notes.md"');
    expect(textRendered).not.toMatch(/\| Page \d/);
  });
});
