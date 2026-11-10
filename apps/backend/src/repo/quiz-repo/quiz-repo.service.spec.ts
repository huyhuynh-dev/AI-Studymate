import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AttemptStatusEnum,
    EvaluationStatusEnum,
    QuestionTypeEnum,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuizRepoService } from './quiz-repo.service.js';

describe('QuizRepoService', () => {
    let service: QuizRepoService;
    let mockPrisma: any;

    beforeEach(async () => {
        mockPrisma = {
            conversation: {
                findFirst: vi.fn(),
            },
            quiz: {
                findFirst: vi.fn(),
                findMany: vi.fn(),
                findUniqueOrThrow: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
                delete: vi.fn(),
            },
            quizQuestion: {
                createMany: vi.fn(),
                deleteMany: vi.fn(),
                update: vi.fn(),
                create: vi.fn(),
            },
            quizAttempt: {
                findFirst: vi.fn(),
                findMany: vi.fn(),
                findUniqueOrThrow: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
            },
            quizAttemptAnswer: {
                createMany: vi.fn(),
                upsert: vi.fn(),
                findMany: vi.fn(),
            },
            $transaction: vi.fn((cb) => cb(mockPrisma)),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                QuizRepoService,
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
            ],
        }).compile();

        service = module.get<QuizRepoService>(QuizRepoService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('throws NotFoundException when conversation is not owned by user', async () => {
        mockPrisma.conversation.findFirst.mockResolvedValue(null);
        await expect(
            service.getQuizzesByConversation('conv-1', 'user-1')
        ).rejects.toThrow(NotFoundException);
    });

    it('creates a quiz with questions inside a transaction', async () => {
        mockPrisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1' });
        mockPrisma.quiz.create.mockResolvedValue({ id: 'quiz-1' });
        mockPrisma.quiz.findUniqueOrThrow.mockResolvedValue({
            id: 'quiz-1',
            title: 'Đề 1',
            questions: [],
        });

        const res = await service.createQuizWithQuestions(
            'user-1',
            'conv-1',
            { title: 'Đề 1', description: null, time_limit_sec: 600 },
            [
                {
                    question_type: QuestionTypeEnum.single_choice,
                    order_index: 0,
                    question_text: '<p>Câu 1</p>',
                    points: 1,
                    options: [{ id: 'o1', text: 'A', isCorrect: true }],
                    grading_criteria: [],
                },
            ]
        );

        expect(mockPrisma.quiz.create).toHaveBeenCalledOnce();
        expect(mockPrisma.quizQuestion.createMany).toHaveBeenCalledOnce();
        expect(res.id).toBe('quiz-1');
    });

    it('creates an attempt with empty answers', async () => {
        mockPrisma.quizAttempt.create.mockResolvedValue({ id: 'att-1' });
        mockPrisma.quizAttempt.findUniqueOrThrow.mockResolvedValue({
            id: 'att-1',
            status: AttemptStatusEnum.in_progress,
            answers: [],
        });

        const res = await service.createAttemptWithEmptyAnswers(
            'user-1',
            'quiz-1',
            5,
            { mode: 'exam', questionOrder: ['q-1'] },
            ['q-1']
        );

        expect(mockPrisma.quizAttempt.create).toHaveBeenCalledOnce();
        expect(mockPrisma.quizAttemptAnswer.createMany).toHaveBeenCalledOnce();
        expect(res.id).toBe('att-1');
    });

    it('recalculates attempt score on updateAnswerEvaluationAndScore', async () => {
        mockPrisma.quizAttemptAnswer.upsert.mockResolvedValue({});
        mockPrisma.quizAttemptAnswer.findMany.mockResolvedValue([
            { points_earned: 1.5 },
            { points_earned: 2.0 },
        ]);
        mockPrisma.quizAttempt.update.mockResolvedValue({
            id: 'att-1',
            score: 3.5,
            answers: [],
        });

        const res = await service.updateAnswerEvaluationAndScore(
            'att-1',
            'q-1',
            EvaluationStatusEnum.partial,
            1.5
        );

        expect(mockPrisma.quizAttempt.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'att-1' },
                data: { score: 3.5 },
            })
        );
        expect(res.score).toBe(3.5);
    });
});
