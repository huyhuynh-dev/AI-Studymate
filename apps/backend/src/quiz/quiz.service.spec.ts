import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiService } from '../ai/ai.service.js';
import {
    AttemptStatusEnum,
    EvaluationStatusEnum,
    QuestionTypeEnum,
} from '../generated/prisma/client.js';
import { QuizRepoService } from '../repo/quiz-repo/quiz-repo.service.js';
import {
    QuizService,
    sanitizeQuizHtml,
    stripHtml,
} from './quiz.service.js';

describe('QuizService', () => {
    let service: QuizService;
    let mockQuizRepo: any;
    let mockAiService: any;

    beforeEach(async () => {
        mockQuizRepo = {
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
        };

        mockAiService = {
            generateObjectForTask: vi.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                QuizService,
                {
                    provide: QuizRepoService,
                    useValue: mockQuizRepo,
                },
                {
                    provide: AiService,
                    useValue: mockAiService,
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

            expect(
                service.evaluateObjectiveQuestion(q, {
                    selectedOptionIds: ['b'],
                    textAnswer: '',
                })
            ).toEqual({
                status: EvaluationStatusEnum.incorrect,
                earned: 0,
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

            // Chọn đúng 1/2 câu và không chọn sai -> partial 1 điểm
            expect(
                service.evaluateObjectiveQuestion(q, {
                    selectedOptionIds: ['a'],
                    textAnswer: '',
                })
            ).toEqual({
                status: EvaluationStatusEnum.partial,
                earned: 1,
            });

            // Chọn cả 2 đáp án đúng -> correct 2 điểm
            expect(
                service.evaluateObjectiveQuestion(q, {
                    selectedOptionIds: ['a', 'b'],
                    textAnswer: '',
                })
            ).toEqual({
                status: EvaluationStatusEnum.correct,
                earned: 2,
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

    describe('Essay Grading with LLM & Fallback', () => {
        it('uses AiService structured output to grade essay question', async () => {
            mockAiService.generateObjectForTask.mockResolvedValue({
                object: {
                    evaluationStatus: 'partial',
                    pointsEarned: 1.5,
                    matchedPoints: ['Ý 1'],
                    missingPoints: ['Ý 2'],
                    aiFeedback: 'Nêu được ý 1 nhưng thiếu ý 2.',
                },
            });

            const res = await service.gradeEssayQuestion(
                {
                    question_text: '<p>Giải thích Active Recall</p>',
                    points: 3,
                    sample_answer: '<p>Đáp án mẫu</p>',
                    grading_criteria: ['Ý 1', 'Ý 2'],
                },
                '<p>Bài làm của sinh viên</p>'
            );

            expect(mockAiService.generateObjectForTask).toHaveBeenCalledOnce();
            expect(res.evaluationStatus).toBe(EvaluationStatusEnum.partial);
            expect(res.pointsEarned).toBe(1.5);
            expect(res.matchedPoints).toEqual(['Ý 1']);
            expect(res.missingPoints).toEqual(['Ý 2']);
        });

        it('returns 0 immediately without calling LLM if essay answer is empty', async () => {
            const res = await service.gradeEssayQuestion(
                {
                    question_text: '<p>Giải thích</p>',
                    points: 2,
                    sample_answer: '<p>Mẫu</p>',
                    grading_criteria: ['Tiêu chí 1'],
                },
                '<p>   </p>'
            );

            expect(mockAiService.generateObjectForTask).not.toHaveBeenCalled();
            expect(res.evaluationStatus).toBe(EvaluationStatusEnum.incorrect);
            expect(res.pointsEarned).toBe(0);
            expect(res.missingPoints).toEqual(['Tiêu chí 1']);
        });
    });

    describe('submitAttempt & overrideEvaluation', () => {
        it('grades both objective and essay questions on submitAttempt', async () => {
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

            mockAiService.generateObjectForTask.mockResolvedValue({
                object: {
                    evaluationStatus: 'correct',
                    pointsEarned: 2,
                    matchedPoints: ['Ý chính'],
                    missingPoints: [],
                    aiFeedback: 'Tốt!',
                },
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
            expect(result.answers['q-2'].aiFeedback).toBe('Tốt!');
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
});
