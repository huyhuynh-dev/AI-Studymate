import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizAiService } from '../ai/quiz-ai.service.js';
import {
    AttemptStatusEnum,
    EvaluationStatusEnum,
    QuestionTypeEnum,
} from '../generated/prisma/client.js';
import { DocumentChunksRepoService } from '../repo/document-chunks-repo/document-chunks-repo.service.js';
import { DocumentsRepoService } from '../repo/documents-repo/documents-repo.service.js';
import { QuizRepoService } from '../repo/quiz-repo/quiz-repo.service.js';
import { QuizManageService } from './quiz-manage.service.js';
import { QuizAttemptService } from './quiz-attempt.service.js';
import { QuizGradingService } from './quiz-grading.service.js';
import { QuizToFlashcardService } from './quiz-to-flashcard.service.js';
import { DeckToQuizService } from './deck-to-quiz.service.js';
import { DeckFlashcardRepoService } from '../repo/deck-flashcard-repo/deck-flashcard-repo.service.js';
import {
    QuizService,
    sanitizeQuizHtml,
    stripHtml,
} from './quiz.service.js';

describe('QuizService', () => {
    let service: QuizService;
    let mockQuizRepo: any;
    let mockQuizAiService: any;
    let mockDocumentsRepo: any;
    let mockDocumentChunksRepo: any;
    let mockDeckFlashcardRepo: any;

    beforeEach(async () => {
        mockQuizRepo = {
            assertConversationOwnership: vi.fn().mockResolvedValue(undefined),
            getQuizzesByConversation: vi.fn(),
            getQuizById: vi.fn(),
            createQuizWithQuestions: vi.fn(),
            updateQuizWithQuestions: vi.fn(),
            deleteQuiz: vi.fn(),
            getAttemptsByQuizId: vi.fn(),
            getAttemptByIdWithDetails: vi.fn(),
            createAttemptWithEmptyAnswers: vi.fn(),
            upsertAttemptAnswer: vi.fn(),
            updateAttemptProgress: vi.fn(),
            saveSubmittedAttempt: vi.fn(),
            updateAnswerEvaluationAndScore: vi.fn(),
            getWeakQuestionSignalsByConversation: vi.fn().mockResolvedValue([]),
        };

        mockQuizAiService = {
            gradeEssayQuestion: vi.fn(),
            generateQuizFromContext: vi.fn(),
        };

        mockDocumentsRepo = {
            getAllDocumentsByConversationId: vi.fn(),
        };

        mockDocumentChunksRepo = {
            findChunksByDocumentIds: vi.fn().mockResolvedValue([]),
            findChunksWithNeighborsByIds: vi.fn().mockResolvedValue([]),
        };

        mockDeckFlashcardRepo = {
            getDeckById: vi.fn(),
            createDeck: vi.fn(),
            createManyFlashcards: vi.fn(),
            getWeakFlashcardSignalsByConversation: vi.fn().mockResolvedValue([]),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                QuizService,
                QuizManageService,
                QuizAttemptService,
                QuizGradingService,
                QuizToFlashcardService,
                DeckToQuizService,
                {
                    provide: QuizRepoService,
                    useValue: mockQuizRepo,
                },
                {
                    provide: DeckFlashcardRepoService,
                    useValue: mockDeckFlashcardRepo,
                },
                {
                    provide: QuizAiService,
                    useValue: mockQuizAiService,
                },
                {
                    provide: DocumentsRepoService,
                    useValue: mockDocumentsRepo,
                },
                {
                    provide: DocumentChunksRepoService,
                    useValue: mockDocumentChunksRepo,
                },
            ],
        }).compile();

        service = module.get<QuizService>(QuizService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('HTML Sanitizer & Strip', () => {
        it('keeps allowed TipTap tags and text-align while removing script tags', () => {
            const dirty =
                '<p style="text-align: center; color: red">Xin <strong>chào</strong></p><script>alert(1)</script>';
            expect(sanitizeQuizHtml(dirty)).toBe(
                '<p style="text-align: center">Xin <strong>chào</strong></p>'
            );
            expect(stripHtml(dirty)).toBe('Xin chào alert(1)');
        });
    });

    describe('generateWithAI', () => {
        it('throws BadRequestException when conversation has no OCR-ready documents', async () => {
            mockDocumentsRepo.getAllDocumentsByConversationId.mockResolvedValue([
                { id: 'doc-1', ocr_status: 'pending', raw_text: null },
            ]);

            await expect(
                service.generateWithAI('user-1', 'conv-1', {
                    documentIds: [],
                    questionCount: 5,
                    types: [QuestionTypeEnum.single_choice],
                    difficulty: 'applied',
                })
            ).rejects.toThrow(BadRequestException);
        });

        it('extracts document texts, calls QuizAiService.generateQuizFromContext, and saves quiz with source="ai"', async () => {
            const now = new Date();
            mockDocumentsRepo.getAllDocumentsByConversationId.mockResolvedValue([
                {
                    id: 'doc-1',
                    file_name: 'Chuong1.pdf',
                    ocr_status: 'done',
                    raw_text: 'Nội dung chương 1 về Spaced Repetition.',
                },
                {
                    id: 'doc-2',
                    file_name: 'Chuong2.pdf',
                    ocr_status: 'done',
                    raw_text: 'Nội dung chương 2 không được chọn.',
                },
            ]);

            mockDocumentChunksRepo.findChunksByDocumentIds.mockResolvedValue([
                {
                    id: 'chk-1',
                    document_id: 'doc-1',
                    chunk_index: 0,
                    content: 'Nội dung chương 1 về Spaced Repetition.',
                    raw_content: null,
                    page_numbers: [3],
                    headings: ['Chương 1'],
                    bboxes: [{ page_no: 3, l: 10, t: 100, r: 200, b: 80 }],
                },
            ]);

            const sourceRefItem = {
                documentId: 'doc-1',
                fileName: 'Chuong1.pdf',
                chunkId: 'chk-1',
                chunkIndex: 0,
                pageNumbers: [3],
                bboxes: [{ page_no: 3, l: 10, t: 100, r: 200, b: 80 }],
                headings: ['Chương 1'],
                snippet: 'Nội dung chương 1 về Spaced Repetition.',
            };

            mockQuizAiService.generateQuizFromContext.mockResolvedValue({
                title: 'Đề AI Chương 1',
                description: 'Ôn tập chương 1',
                rows: [
                    {
                        question_type: 'single_choice',
                        order_index: 0,
                        question_text: '<p>Câu hỏi 1</p>',
                        points: 1,
                        options: [
                            { id: 'opt_1', text: 'Đúng', isCorrect: true },
                            { id: 'opt_2', text: 'Sai', isCorrect: false },
                        ],
                        grading_criteria: [],
                        explanation: '<p>Giải thích</p>',
                        source_refs: [sourceRefItem],
                    },
                ],
                rejected: [],
            });

            mockQuizRepo.createQuizWithQuestions.mockResolvedValue({
                id: 'quiz-ai-1',
                conversation_id: 'conv-1',
                title: 'Đề AI Chương 1',
                description: 'Ôn tập chương 1',
                time_limit_sec: null,
                source: 'ai',
                source_deck_id: null,
                created_at: now,
                updated_at: now,
                questions: [
                    {
                        id: 'q-1',
                        quiz_id: 'quiz-ai-1',
                        question_type: QuestionTypeEnum.single_choice,
                        order_index: 0,
                        question_text: '<p>Câu hỏi 1</p>',
                        points: 1,
                        options: [
                            { id: 'opt_1', text: 'Đúng', isCorrect: true },
                            { id: 'opt_2', text: 'Sai', isCorrect: false },
                        ],
                        sample_answer: null,
                        grading_criteria: [],
                        explanation: '<p>Giải thích</p>',
                        source_refs: [sourceRefItem],
                    },
                ],
            });

            const res = await service.generateWithAI('user-1', 'conv-1', {
                documentIds: ['doc-1'],
                questionCount: 5,
                types: [QuestionTypeEnum.single_choice],
                difficulty: 'applied',
            });

            expect(mockDocumentChunksRepo.findChunksByDocumentIds).toHaveBeenCalledWith(
                ['doc-1'],
                'user-1'
            );
            expect(
                mockQuizAiService.generateQuizFromContext
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    context: expect.stringContaining('[CHUNK #1 | Trang 3 | Mục: Chương 1]'),
                    count: 5,
                    types: [QuestionTypeEnum.single_choice],
                    difficulty: 'applied',
                    sourceChunkMap: expect.any(Map),
                })
            );
            expect(
                mockQuizAiService.generateQuizFromContext.mock.calls[0][0].context
            ).not.toContain('Nội dung chương 2');
            expect(mockQuizRepo.createQuizWithQuestions).toHaveBeenCalledWith(
                'user-1',
                'conv-1',
                expect.objectContaining({
                    title: 'Đề AI Chương 1',
                    source: 'ai',
                }),
                expect.arrayContaining([
                    expect.objectContaining({
                        source_refs: [sourceRefItem],
                    }),
                ])
            );
            expect(res.source).toBe('ai');
            expect(res.questions).toHaveLength(1);
            expect(res.questions[0].sourceRefs).toEqual([sourceRefItem]);
        });
    });

    describe('Objective Grading (evaluateObjectiveQuestion)', () => {
        it('grades single_choice correctly', () => {
            const q = {
                question_type: QuestionTypeEnum.single_choice,
                points: 2,
                options: [
                    { id: 'a', text: 'A', isCorrect: true },
                    { id: 'b', text: 'B', isCorrect: false },
                ],
                sample_answer: null,
            };

            expect(
                service.evaluateObjectiveQuestion(q, {
                    selectedOptionIds: ['a'],
                    textAnswer: '',
                })
            ).toEqual({
                status: EvaluationStatusEnum.correct,
                earned: 2,
            });
        });

        it('grades multiple_choice with partial credit formula: points * (right - wrong) / totalCorrect', () => {
            const q = {
                question_type: QuestionTypeEnum.multiple_choice,
                points: 2,
                options: [
                    { id: 'a', text: 'A', isCorrect: true },
                    { id: 'b', text: 'B', isCorrect: true },
                    { id: 'c', text: 'C', isCorrect: false },
                ],
                sample_answer: null,
            };

            expect(
                service.evaluateObjectiveQuestion(q, {
                    selectedOptionIds: ['a'],
                    textAnswer: '',
                })
            ).toEqual({
                status: EvaluationStatusEnum.partial,
                earned: 1,
            });
        });

        it('grades short_answer case-insensitively and ignores punctuation across pipe-delimited variants', () => {
            const q = {
                question_type: QuestionTypeEnum.short_answer,
                points: 1.5,
                options: null,
                sample_answer: 'SM-2 | SM2',
            };

            expect(
                service.evaluateObjectiveQuestion(q, {
                    selectedOptionIds: [],
                    textAnswer: '  sm2! ',
                })
            ).toEqual({
                status: EvaluationStatusEnum.correct,
                earned: 1.5,
            });
        });
    });

    describe('submitAttempt & overrideEvaluation', () => {
        it('delegates essay grading to QuizAiService and grades objective questions on submitAttempt', async () => {
            const now = new Date();
            mockQuizRepo.getAttemptByIdWithDetails.mockResolvedValue({
                id: 'att-1',
                quiz_id: 'quiz-1',
                status: AttemptStatusEnum.in_progress,
                config: {
                    mode: 'exam',
                    timeLimitSec: 600,
                    questionOrder: ['q-1', 'q-2'],
                    optionOrder: {},
                },
                answers: [],
                quiz: {
                    id: 'quiz-1',
                    time_limit_sec: 600,
                    questions: [
                        {
                            id: 'q-1',
                            question_type: QuestionTypeEnum.true_false,
                            points: 1,
                            options: [
                                { id: 'true', text: 'Đúng', isCorrect: true },
                                { id: 'false', text: 'Sai', isCorrect: false },
                            ],
                            sample_answer: null,
                            grading_criteria: [],
                        },
                        {
                            id: 'q-2',
                            question_type: QuestionTypeEnum.essay,
                            question_text: '<p>Tự luận</p>',
                            points: 2,
                            options: null,
                            sample_answer: '<p>Mẫu</p>',
                            grading_criteria: ['Ý chính'],
                        },
                    ],
                },
            });

            mockQuizAiService.gradeEssayQuestion.mockResolvedValue({
                evaluationStatus: EvaluationStatusEnum.correct,
                pointsEarned: 2,
                matchedPoints: ['Ý chính'],
                missingPoints: [],
                aiFeedback: 'Tốt!',
            });

            mockQuizRepo.saveSubmittedAttempt.mockResolvedValue({
                id: 'att-1',
                quiz_id: 'quiz-1',
                status: AttemptStatusEnum.submitted,
                score: 3,
                max_score: 3,
                time_spent_sec: 120,
                started_at: now,
                completed_at: now,
                config: {
                    mode: 'exam',
                    timeLimitSec: 600,
                    questionOrder: ['q-1', 'q-2'],
                    optionOrder: {},
                },
                answers: [
                    {
                        question_id: 'q-1',
                        selected_option_ids: ['true'],
                        text_answer: '',
                        is_flagged: false,
                        evaluation_status: EvaluationStatusEnum.correct,
                        points_earned: 1,
                        matched_points: [],
                        missing_points: [],
                        ai_feedback: null,
                    },
                    {
                        question_id: 'q-2',
                        selected_option_ids: [],
                        text_answer: '<p>Trả lời</p>',
                        is_flagged: false,
                        evaluation_status: EvaluationStatusEnum.correct,
                        points_earned: 2,
                        matched_points: ['Ý chính'],
                        missing_points: [],
                        ai_feedback: 'Tốt!',
                    },
                ],
            });

            const result = await service.submitAttempt('user-1', 'att-1', {
                timeSpentSec: 120,
                answers: [
                    {
                        questionId: 'q-1',
                        selectedOptionIds: ['true'],
                        textAnswer: '',
                        isFlagged: false,
                    },
                    {
                        questionId: 'q-2',
                        selectedOptionIds: [],
                        textAnswer: '<p>Trả lời</p>',
                        isFlagged: false,
                    },
                ],
            });

            expect(result.status).toBe('submitted');
            expect(result.score).toBe(3);
        });

        it('rejects createQuiz when a choice question has no correct option', async () => {
            await expect(
                service.createQuiz('user-1', 'conv-1', {
                    title: 'Đề lỗi',
                    questions: [
                        {
                            type: QuestionTypeEnum.single_choice,
                            text: '<p>Câu hỏi 1</p>',
                            points: 1,
                            options: [
                                { id: '1', text: 'A', isCorrect: false },
                                { id: '2', text: 'B', isCorrect: false },
                            ],
                        },
                    ],
                })
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('Bloom Quota & Targeted Weak-Chunk Quiz', () => {
        it('forwards bloomQuota when generating AI quiz with bloomPreset', async () => {
            const now = new Date();
            mockDocumentsRepo.getAllDocumentsByConversationId.mockResolvedValue([
                {
                    id: 'doc-1',
                    file_name: 'Algo.pdf',
                    ocr_status: 'done',
                    raw_text: 'Binary search tree properties.',
                },
            ]);
            mockDocumentChunksRepo.findChunksByDocumentIds.mockResolvedValue([
                {
                    id: 'chk-1',
                    document_id: 'doc-1',
                    chunk_index: 0,
                    content: 'Binary search tree properties.',
                    raw_content: null,
                    page_numbers: [1],
                    headings: ['BST'],
                    bboxes: null,
                },
            ]);
            mockQuizAiService.generateQuizFromContext.mockResolvedValue({
                title: 'BST Bloom Test',
                description: 'Desc',
                rows: [
                    {
                        question_type: 'single_choice',
                        order_index: 0,
                        question_text: '<p>BST?</p>',
                        points: 1,
                        options: [
                            { id: '1', text: 'A', isCorrect: true },
                            { id: '2', text: 'B', isCorrect: false },
                        ],
                        grading_criteria: [],
                        explanation: '<p>Explain</p>',
                        bloom_level: 'analyze',
                    },
                ],
                rejected: [],
            });
            mockQuizRepo.createQuizWithQuestions.mockResolvedValue({
                id: 'quiz-bloom-1',
                conversation_id: 'conv-1',
                title: 'BST Bloom Test',
                description: 'Desc',
                time_limit_sec: null,
                source: 'ai',
                source_deck_id: null,
                created_at: now,
                updated_at: now,
                questions: [
                    {
                        id: 'q-1',
                        quiz_id: 'quiz-bloom-1',
                        question_type: QuestionTypeEnum.single_choice,
                        order_index: 0,
                        question_text: '<p>BST?</p>',
                        points: 1,
                        options: [
                            { id: '1', text: 'A', isCorrect: true },
                            { id: '2', text: 'B', isCorrect: false },
                        ],
                        sample_answer: null,
                        grading_criteria: [],
                        explanation: '<p>Explain</p>',
                        bloom_level: 'analyze',
                        source_refs: null,
                    },
                ],
            });

            const res = await service.generateWithAI('user-1', 'conv-1', {
                documentIds: ['doc-1'],
                questionCount: 10,
                types: [QuestionTypeEnum.single_choice],
                difficulty: 'applied',
                bloomPreset: 'exam_prep',
            });

            expect(
                mockQuizAiService.generateQuizFromContext
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    bloomQuota: { remember: 1, understand: 2, apply: 4, analyze: 3 },
                })
            );
            expect(res.questions[0].bloomLevel).toBe('analyze');
        });

        it('getWeakAreasSummary returns aggregated signals from wrong quiz answers and leech cards', async () => {
            mockQuizRepo.getWeakQuestionSignalsByConversation.mockResolvedValue([
                {
                    question_id: 'q-1',
                    evaluation_status: 'incorrect',
                    missing_points: ['Thiếu điều kiện dừng'],
                    question: {
                        id: 'q-1',
                        question_text: '<p>Đệ quy là gì?</p>',
                        source_refs: [
                            {
                                documentId: 'doc-1',
                                fileName: 'Algo.pdf',
                                chunkId: 'chk-1',
                                headings: ['Đệ quy'],
                            },
                        ],
                    },
                },
            ]);
            mockDeckFlashcardRepo.getWeakFlashcardSignalsByConversation.mockResolvedValue([
                {
                    id: 'card-1',
                    front_text: 'Base case?',
                    ease_factor: 1.7,
                    state: 'relearning',
                    source_refs: [
                        {
                            documentId: 'doc-1',
                            fileName: 'Algo.pdf',
                            chunkId: 'chk-2',
                            headings: ['Base case'],
                        },
                    ],
                    reviews: [{ id: 'rev-1' }],
                },
            ]);

            const summary = await service.getWeakAreasSummary('user-1', 'conv-1');

            expect(mockQuizRepo.assertConversationOwnership).toHaveBeenCalledWith(
                'conv-1',
                'user-1'
            );
            expect(summary.hasWeakAreas).toBe(true);
            expect(summary.weakChunkCount).toBe(2);
            expect(summary.incorrectQuizCount).toBe(1);
            expect(summary.leechCardCount).toBe(1);
            expect(summary.topMissingPoints).toContain('Thiếu điều kiện dừng');
        });

        it('generateTargetedQuiz throws BadRequestException when no weak areas exist', async () => {
            mockQuizRepo.getWeakQuestionSignalsByConversation.mockResolvedValue([]);
            mockDeckFlashcardRepo.getWeakFlashcardSignalsByConversation.mockResolvedValue([]);

            await expect(
                service.generateTargetedQuiz('user-1', 'conv-1', {
                    questionCount: 5,
                    types: [QuestionTypeEnum.single_choice],
                })
            ).rejects.toThrow(BadRequestException);
        });

        it('generateTargetedQuiz expands neighbor chunks, applies remediationFocus, and prefixes quiz title', async () => {
            const now = new Date();
            mockQuizRepo.getWeakQuestionSignalsByConversation.mockResolvedValue([
                {
                    question_id: 'q-old-1',
                    evaluation_status: 'incorrect',
                    missing_points: ['Quên nêu Big-O'],
                    question: {
                        id: 'q-old-1',
                        question_text: '<p>Độ phức tạp Binary Search?</p>',
                        source_refs: [
                            {
                                documentId: 'doc-1',
                                fileName: 'DSA.pdf',
                                chunkId: 'chk-2',
                                headings: ['Binary Search'],
                            },
                        ],
                    },
                },
            ]);

            mockDocumentChunksRepo.findChunksWithNeighborsByIds.mockResolvedValue([
                {
                    documentId: 'doc-1',
                    fileName: 'DSA.pdf',
                    chunks: [
                        {
                            id: 'chk-1',
                            chunk_index: 0,
                            content: 'Context liền trước.',
                            raw_content: null,
                            page_numbers: [5],
                            headings: ['Binary Search'],
                            bboxes: null,
                        },
                        {
                            id: 'chk-2',
                            chunk_index: 1,
                            content: 'Độ phức tạp tìm kiếm nhị phân là O(log n).',
                            raw_content: null,
                            page_numbers: [5],
                            headings: ['Binary Search'],
                            bboxes: null,
                        },
                    ],
                },
            ]);

            mockQuizAiService.generateQuizFromContext.mockResolvedValue({
                title: 'Ôn tập Tìm kiếm nhị phân',
                description: 'Luyện lại',
                rows: [
                    {
                        question_type: 'essay',
                        order_index: 0,
                        question_text: '<p>Tình huống áp dụng Binary Search?</p>',
                        points: 2,
                        sample_answer: '<p>Mẫu</p>',
                        grading_criteria: ['Nêu O(log n)'],
                        explanation: '<p>Giải thích</p>',
                        bloom_level: 'apply',
                    },
                ],
                rejected: [],
            });

            mockQuizRepo.createQuizWithQuestions.mockResolvedValue({
                id: 'quiz-targeted-1',
                conversation_id: 'conv-1',
                title: '[Luyện vùng yếu] Ôn tập Tìm kiếm nhị phân',
                description: 'Luyện lại',
                time_limit_sec: null,
                source: 'ai',
                source_deck_id: null,
                created_at: now,
                updated_at: now,
                questions: [
                    {
                        id: 'q-new-1',
                        quiz_id: 'quiz-targeted-1',
                        question_type: QuestionTypeEnum.essay,
                        order_index: 0,
                        question_text: '<p>Tình huống áp dụng Binary Search?</p>',
                        points: 2,
                        options: null,
                        sample_answer: '<p>Mẫu</p>',
                        grading_criteria: ['Nêu O(log n)'],
                        explanation: '<p>Giải thích</p>',
                        bloom_level: 'apply',
                        source_refs: null,
                    },
                ],
            });

            const res = await service.generateTargetedQuiz('user-1', 'conv-1', {
                questionCount: 5,
                types: [QuestionTypeEnum.essay],
                bloomPreset: 'exam_prep',
            });

            expect(
                mockDocumentChunksRepo.findChunksWithNeighborsByIds
            ).toHaveBeenCalledWith(['chk-2'], 'user-1', 'conv-1');
            expect(
                mockQuizAiService.generateQuizFromContext
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    remediationFocus: expect.objectContaining({
                        weakTopics: ['Binary Search'],
                        missingPoints: ['Quên nêu Big-O'],
                        priorFailedQuestions: ['Độ phức tạp Binary Search?'],
                    }),
                })
            );
            expect(res.title).toContain('[Luyện vùng yếu]');
            expect(res.questions[0].bloomLevel).toBe('apply');
        });
    });
});
