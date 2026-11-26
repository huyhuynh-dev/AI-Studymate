import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { WorkspaceL2ReadService } from './workspace-l2-read.service.js';
import type { ResolvedWorkspaceContext } from '../ai/prompts/workspace-context.types.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CONV_ID = '22222222-2222-4222-8222-222222222222';
const SUBJ_ID = '33333333-3333-4333-8333-333333333333';
const SUMMARY_ID = '44444444-4444-4444-8444-444444444444';
const QUIZ_ID = '55555555-5555-4555-8555-555555555555';
const ATTEMPT_ID = '66666666-6666-4666-8666-666666666666';
const DECK_ID = '77777777-7777-4777-8777-777777777777';
const CARD_1_ID = '88888888-8888-4888-8888-888888888881';
const CARD_2_ID = '88888888-8888-4888-8888-888888888882';

function makeBaseContext(
  overrides: Partial<ResolvedWorkspaceContext> = {},
): ResolvedWorkspaceContext {
  return {
    location: {
      pageType: 'conversation',
      subjectId: SUBJ_ID,
      conversationId: CONV_ID,
    },
    inventory: {
      documentsCount: 2,
      readyDocumentsCount: 2,
      notesCount: 1,
      decksCount: 1,
      quizzesCount: 1,
    },
    guards: {
      examIntegrityGuard: false,
      hideFlashcardAnswerGuard: false,
    },
    ...overrides,
  };
}

describe('WorkspaceL2ReadService', () => {
  let summariesRepoMock: any;
  let quizRepoMock: any;
  let deckRepoMock: any;
  let docsRepoMock: any;
  let convRepoMock: any;
  let service: WorkspaceL2ReadService;

  beforeEach(() => {
    summariesRepoMock = {
      getSummaryByIdForUser: vi.fn(),
      searchSummariesForUser: vi.fn().mockResolvedValue([]),
    };
    quizRepoMock = {
      getQuizById: vi.fn(),
      getAttemptByIdWithDetails: vi.fn(),
      findActiveInProgressExamAttempt: vi.fn().mockResolvedValue(null),
      getLatestSubmittedAttemptByQuizId: vi.fn().mockResolvedValue(null),
      searchQuizzesForUser: vi.fn().mockResolvedValue([]),
    };
    deckRepoMock = {
      getDeckCardsPaginated: vi.fn(),
      searchDecksForUser: vi.fn().mockResolvedValue([]),
    };
    docsRepoMock = {
      searchDocumentsForUser: vi.fn().mockResolvedValue([]),
    };
    convRepoMock = {
      getConversationById: vi.fn().mockResolvedValue({
        id: CONV_ID,
        subject_id: SUBJ_ID,
      }),
      searchConversationsForUser: vi.fn().mockResolvedValue([]),
    };

    service = new WorkspaceL2ReadService(
      summariesRepoMock,
      quizRepoMock,
      deckRepoMock,
      docsRepoMock,
      convRepoMock,
    );
  });

  describe('readNoteContent (Vấn đề 2 - Notes)', () => {
    it('đọc đúng nội dung Note không có Heading bằng activeNote.summaryId fallback', async () => {
      summariesRepoMock.getSummaryByIdForUser.mockResolvedValue({
        id: SUMMARY_ID,
        title: 'Ghi chú ôn nhanh',
        conversation_id: CONV_ID,
        document_id: null,
        content_json: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Cây nhị phân tìm kiếm có tính chất trái < gốc < phải.', styles: null }],
          },
        ],
        updated_at: new Date('2026-11-20T10:00:00Z'),
        document: null,
      });

      const res = await service.readNoteContent(
        {
          userId: USER_ID,
          conversationId: CONV_ID,
          workspaceContext: makeBaseContext({
            summaryView: {
              viewMode: 'detail',
              totalCount: 1,
              activeNote: {
                summaryId: SUMMARY_ID,
                title: 'Ghi chú ôn nhanh',
                headings: [],
              },
            },
          }),
        },
        {},
      );

      expect(summariesRepoMock.getSummaryByIdForUser).toHaveBeenCalledWith(
        SUMMARY_ID,
        USER_ID,
      );
      expect(res.found).toBe(true);
      expect(res.contentMarkdown).toContain('trái < gốc < phải');
      expect(res.sectionOutline).toEqual([]);
    });

    it('trả về danh sách candidates khi titleQuery khớp nhiều Note mơ hồ', async () => {
      summariesRepoMock.searchSummariesForUser.mockResolvedValue([
        { id: SUMMARY_ID, title: 'Sắp xếp nhanh (Quicksort)' },
        {
          id: '44444444-4444-4444-8444-444444444445',
          title: 'Sắp xếp trộn (Mergesort)',
        },
      ]);

      const res = await service.readNoteContent(
        { userId: USER_ID, conversationId: CONV_ID },
        { titleQuery: 'Sắp xếp' },
      );

      expect(res.found).toBe(false);
      expect(res.candidates).toHaveLength(2);
      expect(summariesRepoMock.getSummaryByIdForUser).not.toHaveBeenCalled();
    });

    it('từ chối an toàn khi summaryId thuộc user khác (ownership check trả null)', async () => {
      summariesRepoMock.getSummaryByIdForUser.mockResolvedValue(null);

      const res = await service.readNoteContent(
        { userId: USER_ID, conversationId: CONV_ID },
        { summaryId: SUMMARY_ID },
      );

      expect(res.found).toBe(false);
      expect(res.contentMarkdown).toBe('');
    });
  });

  describe('readQuizContent (Vấn đề 3 - Quiz & Exam Guard 2 lớp)', () => {
    const mockQuizQuestions = [
      {
        id: 'q-1',
        question_type: 'single_choice',
        order_index: 0,
        question_text: '<p>Câu gốc 1?</p>',
        points: 1,
        options: [
          { id: 'o1', text: 'Đáp án đúng Q1', isCorrect: true },
          { id: 'o2', text: 'Nhiễu Q1', isCorrect: false },
        ],
        sample_answer: null,
        grading_criteria: [],
        explanation: '<p>Giải thích bí mật Q1</p>',
        bloom_level: 'remember',
      },
      {
        id: 'q-2',
        question_type: 'single_choice',
        order_index: 1,
        question_text: '<p>Câu gốc 2 (được đảo lên vị trí #1)?</p>',
        points: 1,
        options: [
          { id: 'o3', text: 'Đáp án A sai', isCorrect: false },
          { id: 'o4', text: 'Đáp án B đúng', isCorrect: true },
        ],
        sample_answer: null,
        grading_criteria: ['Tiêu chí bí mật'],
        explanation: '<p>Giải thích bí mật Q2</p>',
        bloom_level: 'apply',
      },
    ];

    it('khớp 100% thứ tự xáo trộn questionOrder/optionOrder và xóa sạch đáp án khi Exam Guard lớp 1 bật', async () => {
      quizRepoMock.getAttemptByIdWithDetails.mockResolvedValue({
        id: ATTEMPT_ID,
        quiz_id: QUIZ_ID,
        status: 'in_progress',
        score: 0,
        max_score: 2,
        config: {
          mode: 'exam',
          questionOrder: ['q-2', 'q-1'],
          optionOrder: {
            'q-2': ['o4', 'o3'],
          },
        },
        quiz: {
          id: QUIZ_ID,
          title: 'Kiểm tra giữa kỳ',
          time_limit_sec: 900,
          questions: mockQuizQuestions,
        },
        answers: [
          {
            question_id: 'q-2',
            selected_option_ids: ['o3'],
            text_answer: null,
            is_flagged: true,
            evaluation_status: 'incorrect',
            points_earned: 0,
            matched_points: [],
            missing_points: [],
            ai_feedback: 'Chưa đúng',
          },
        ],
      });

      const res = await service.readQuizContent(
        {
          userId: USER_ID,
          conversationId: CONV_ID,
          workspaceContext: makeBaseContext({
            guards: { examIntegrityGuard: true, hideFlashcardAnswerGuard: false },
          }),
        },
        {
          attemptId: ATTEMPT_ID,
          mode: 'attempt_review',
          evaluationFilter: 'incorrect',
          questionNumbers: [1],
        },
      );

      expect(res.found).toBe(true);
      expect(res.examIntegrityEnforced).toBe(true);
      expect(res.score).toBeUndefined();
      expect(res.questions).toHaveLength(1);
      // Câu 1 trên màn hình phải là q-2 do questionOrder: ['q-2', 'q-1']
      expect(res.questions[0].questionId).toBe('q-2');
      expect(res.questions[0].displayNumber).toBe(1);
      // Option A phải là o4, Option B phải là o3 do optionOrder['q-2']: ['o4', 'o3']
      expect(res.questions[0].options).toEqual([
        { label: 'A', id: 'o4', text: 'Đáp án B đúng' },
        { label: 'B', id: 'o3', text: 'Đáp án A sai' },
      ]);
      // Sinh viên chọn o3 => nhãn B
      expect(res.questions[0].studentSelectedLabels).toEqual(['B']);
      // Tuyệt đối không có bất kỳ đáp án/giải thích nào bị lọt
      const serialized = JSON.stringify(res);
      expect(serialized).not.toContain('isCorrect');
      expect(serialized).not.toContain('Giải thích bí mật');
      expect(serialized).not.toContain('Tiêu chí bí mật');
      expect(serialized).not.toContain('Chưa đúng');
    });

    it('Anti-bypass Lớp 2: vẫn khóa đáp án ngay cả khi user tắt Context Pill (workspaceContext=undefined) nếu DB có exam đang in_progress', async () => {
      quizRepoMock.getQuizById.mockResolvedValue({
        id: QUIZ_ID,
        title: 'Kiểm tra giữa kỳ',
        time_limit_sec: 900,
        questions: mockQuizQuestions,
      });
      quizRepoMock.findActiveInProgressExamAttempt.mockResolvedValue({
        id: ATTEMPT_ID,
        status: 'in_progress',
        config: { mode: 'exam' },
      });

      const res = await service.readQuizContent(
        { userId: USER_ID, conversationId: CONV_ID, workspaceContext: undefined },
        { quizId: QUIZ_ID },
      );

      expect(res.found).toBe(true);
      expect(res.examIntegrityEnforced).toBe(true);
      const serialized = JSON.stringify(res);
      expect(serialized).not.toContain('isCorrect');
      expect(serialized).not.toContain('Giải thích bí mật');
    });

    it('trả đầy đủ đáp án, giải thích và lọc đúng evaluationFilter=incorrect ở chế độ kết quả (submitted)', async () => {
      quizRepoMock.getAttemptByIdWithDetails.mockResolvedValue({
        id: ATTEMPT_ID,
        quiz_id: QUIZ_ID,
        status: 'submitted',
        score: 1,
        max_score: 2,
        config: {
          mode: 'exam',
          questionOrder: ['q-1', 'q-2'],
          optionOrder: {},
        },
        quiz: {
          id: QUIZ_ID,
          title: 'Kiểm tra giữa kỳ',
          time_limit_sec: 900,
          questions: mockQuizQuestions,
        },
        answers: [
          {
            question_id: 'q-1',
            selected_option_ids: ['o1'],
            text_answer: null,
            is_flagged: false,
            evaluation_status: 'correct',
            points_earned: 1,
            matched_points: [],
            missing_points: [],
            ai_feedback: null,
          },
          {
            question_id: 'q-2',
            selected_option_ids: ['o3'],
            text_answer: null,
            is_flagged: false,
            evaluation_status: 'incorrect',
            points_earned: 0,
            matched_points: [],
            missing_points: ['Thiếu ý chính'],
            ai_feedback: 'Cần xem lại khái niệm.',
          },
        ],
      });

      const res = await service.readQuizContent(
        { userId: USER_ID, conversationId: CONV_ID },
        {
          attemptId: ATTEMPT_ID,
          mode: 'attempt_review',
          evaluationFilter: 'incorrect',
        },
      );

      expect(res.found).toBe(true);
      expect(res.examIntegrityEnforced).toBe(false);
      expect(res.score).toBe(1);
      expect(res.filteredCount).toBe(1);
      expect(res.questions[0].questionId).toBe('q-2');
      expect(res.questions[0].displayNumber).toBe(2);
      expect(res.questions[0].explanation).toBe('Giải thích bí mật Q2');
      expect(res.questions[0].options?.find((o) => o.id === 'o4')?.isCorrect).toBe(
        true,
      );
      expect(res.questions[0].aiFeedback).toBe('Cần xem lại khái niệm.');
    });

    it('xử lý an toàn khi Quiz không thuộc user (NotFoundException)', async () => {
      quizRepoMock.getQuizById.mockRejectedValue(new NotFoundException('Denied'));

      const res = await service.readQuizContent(
        { userId: USER_ID, conversationId: CONV_ID },
        { quizId: QUIZ_ID },
      );

      expect(res.found).toBe(false);
      expect(res.questions).toEqual([]);
    });
  });

  describe('readDeckCards (Flashcard + hideFlashcardAnswerGuard)', () => {
    it('che backText của currentCardId khi hideFlashcardAnswerGuard=true và chặn tìm kiếm theo back_text', async () => {
      deckRepoMock.getDeckCardsPaginated.mockResolvedValue({
        deck: {
          id: DECK_ID,
          name: 'Cấu trúc dữ liệu',
          description: null,
          conversation_id: CONV_ID,
        },
        totalCards: 2,
        dueCount: 2,
        filteredCount: 2,
        cards: [
          {
            id: CARD_1_ID,
            card_type: 'basic',
            front_text: '<p>Độ phức tạp tìm kiếm cây AVL?</p>',
            back_text: '<p>O(log n)</p>',
            state: 'learning',
            interval: 1,
            due_date: new Date('2026-11-26T00:00:00Z'),
          },
          {
            id: CARD_2_ID,
            card_type: 'basic',
            front_text: '<p>Độ phức tạp chèn đầu LinkedList?</p>',
            back_text: '<p>O(1)</p>',
            state: 'new',
            interval: 0,
            due_date: new Date('2026-11-26T00:00:00Z'),
          },
        ],
      });

      const res = await service.readDeckCards(
        {
          userId: USER_ID,
          conversationId: CONV_ID,
          workspaceContext: makeBaseContext({
            guards: { examIntegrityGuard: false, hideFlashcardAnswerGuard: true },
            flashcardView: {
              viewMode: 'study',
              totalDecksCount: 1,
              activeDeck: {
                deckId: DECK_ID,
                name: 'Cấu trúc dữ liệu',
                totalCards: 2,
                newCount: 1,
                learningCount: 1,
                reviewCount: 0,
                dueToday: 2,
              },
              studyState: {
                mode: 'due',
                progress: 1,
                remaining: 2,
                currentCardId: CARD_1_ID,
                isCardRevealed: false,
              },
            },
          }),
        },
        { allowRevealCurrentCard: false },
      );

      expect(deckRepoMock.getDeckCardsPaginated).toHaveBeenCalledWith(
        expect.objectContaining({
          deckId: DECK_ID,
          excludeBackTextForCardId: CARD_1_ID,
        }),
      );
      expect(res.found).toBe(true);
      expect(res.cards[0].answerHidden).toBe(true);
      expect(res.cards[0].backText).toBe('[ANSWER_HIDDEN_BY_STUDY_GUARD]');
      expect(res.cards[1].answerHidden).toBe(false);
      expect(res.cards[1].backText).toBe('O(1)');
    });

    it('mở khóa backText khi allowRevealCurrentCard=true theo yêu cầu người dùng', async () => {
      deckRepoMock.getDeckCardsPaginated.mockResolvedValue({
        deck: {
          id: DECK_ID,
          name: 'Cấu trúc dữ liệu',
          description: null,
          conversation_id: CONV_ID,
        },
        totalCards: 1,
        dueCount: 1,
        filteredCount: 1,
        cards: [
          {
            id: CARD_1_ID,
            card_type: 'basic',
            front_text: '<p>Độ phức tạp tìm kiếm cây AVL?</p>',
            back_text: '<p>O(log n)</p>',
            state: 'learning',
            interval: 1,
            due_date: new Date('2026-11-26T00:00:00Z'),
          },
        ],
      });

      const res = await service.readDeckCards(
        {
          userId: USER_ID,
          conversationId: CONV_ID,
          workspaceContext: makeBaseContext({
            guards: { examIntegrityGuard: false, hideFlashcardAnswerGuard: true },
            flashcardView: {
              viewMode: 'study',
              totalDecksCount: 1,
              activeDeck: {
                deckId: DECK_ID,
                name: 'Cấu trúc dữ liệu',
                totalCards: 1,
                newCount: 0,
                learningCount: 1,
                reviewCount: 0,
                dueToday: 1,
              },
              studyState: {
                mode: 'due',
                progress: 1,
                remaining: 1,
                currentCardId: CARD_1_ID,
                isCardRevealed: false,
              },
            },
          }),
        },
        { cardId: CARD_1_ID, allowRevealCurrentCard: true },
      );

      expect(res.cards[0].answerHidden).toBe(false);
      expect(res.cards[0].answerRevealedOnRequest).toBe(true);
      expect(res.cards[0].backText).toBe('O(log n)');
    });
  });

  describe('searchWorkspaceResources (KB5)', () => {
    it('tìm kiếm song song trên phạm vi subject và suy giảm an toàn nếu 1 repo gặp lỗi', async () => {
      summariesRepoMock.searchSummariesForUser.mockResolvedValue([
        {
          id: SUMMARY_ID,
          title: 'Tổng hợp Sắp xếp',
          conversation_id: CONV_ID,
          updated_at: new Date('2026-11-20T10:00:00Z'),
          document: { file_name: 'Chuong3.pdf' },
          conversation: {
            id: CONV_ID,
            title: 'Tuần 3',
            subject: { name: 'CTDL & GT' },
          },
        },
      ]);
      quizRepoMock.searchQuizzesForUser.mockRejectedValue(
        new Error('Temporary DB timeout'),
      );

      const res = await service.searchWorkspaceResources(
        {
          userId: USER_ID,
          conversationId: CONV_ID,
          subjectId: SUBJ_ID,
        },
        {
          query: 'Sắp xếp',
          resourceTypes: ['note', 'quiz'],
          scope: 'subject',
          limitPerType: 5,
        },
      );

      expect(summariesRepoMock.searchSummariesForUser).toHaveBeenCalledWith({
        userId: USER_ID,
        conversationId: undefined,
        subjectId: SUBJ_ID,
        query: 'Sắp xếp',
        limit: 5,
      });
      expect(res.totalResults).toBe(1);
      expect(res.items[0]).toMatchObject({
        id: SUMMARY_ID,
        type: 'note',
        title: 'Tổng hợp Sắp xếp',
        subjectName: 'CTDL & GT',
      });
    });
  });
});
