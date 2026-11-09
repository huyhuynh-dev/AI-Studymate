import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionTypeEnum } from '../generated/prisma/client.js';
import { QuizController } from './quiz.controller.js';
import { QuizService } from './quiz.service.js';

describe('QuizController', () => {
    let controller: QuizController;
    let mockQuizService: any;

    beforeEach(async () => {
        mockQuizService = {
            listQuizzes: vi.fn().mockResolvedValue([]),
            getQuizById: vi.fn().mockResolvedValue({ id: 'quiz-1' }),
            createQuiz: vi.fn().mockResolvedValue({ id: 'quiz-1' }),
            updateQuiz: vi.fn().mockResolvedValue({ id: 'quiz-1' }),
            deleteQuiz: vi
                .fn()
                .mockResolvedValue({ success: true, message: 'OK' }),
            generateWithAI: vi
                .fn()
                .mockResolvedValue({ id: 'quiz-ai-1', source: 'ai' }),
            listAttempts: vi.fn().mockResolvedValue([]),
            startAttempt: vi.fn().mockResolvedValue({ id: 'att-1' }),
            saveAnswer: vi.fn().mockResolvedValue({ success: true }),
            saveProgress: vi.fn().mockResolvedValue({ success: true }),
            submitAttempt: vi
                .fn()
                .mockResolvedValue({ id: 'att-1', status: 'submitted' }),
            overrideEvaluation: vi
                .fn()
                .mockResolvedValue({ id: 'att-1', score: 2 }),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [QuizController],
            providers: [
                {
                    provide: QuizService,
                    useValue: mockQuizService,
                },
            ],
        }).compile();

        controller = module.get<QuizController>(QuizController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('throws UnauthorizedException if req.user is missing', async () => {
        const fakeReq = { user: undefined } as any;
        await expect(controller.listQuizzes(fakeReq, 'conv-1')).rejects.toThrow(
            UnauthorizedException
        );
    });

    it('delegates listQuizzes, generateWithAI, startAttempt, submitAttempt, and overrideEvaluation to QuizService', async () => {
        const fakeReq = { user: { userId: 'user-123' } } as any;

        await controller.listQuizzes(fakeReq, 'conv-1');
        expect(mockQuizService.listQuizzes).toHaveBeenCalledWith(
            'user-123',
            'conv-1'
        );

        await controller.generateWithAI(fakeReq, 'conv-1', {
            questionCount: 10,
            types: [QuestionTypeEnum.single_choice, QuestionTypeEnum.essay],
            difficulty: 'applied',
        });
        expect(mockQuizService.generateWithAI).toHaveBeenCalledWith(
            'user-123',
            'conv-1',
            {
                questionCount: 10,
                types: [QuestionTypeEnum.single_choice, QuestionTypeEnum.essay],
                difficulty: 'applied',
            }
        );

        await controller.startAttempt(fakeReq, 'quiz-1', {
            config: {
                mode: 'practice',
                timeLimitSec: null,
                questionOrder: ['q-1'],
                optionOrder: {},
            },
        });
        expect(mockQuizService.startAttempt).toHaveBeenCalledWith(
            'user-123',
            'quiz-1',
            expect.any(Object)
        );

        await controller.submitAttempt(fakeReq, 'att-1', {
            timeSpentSec: 90,
            answers: [],
        });
        expect(mockQuizService.submitAttempt).toHaveBeenCalledWith(
            'user-123',
            'att-1',
            { timeSpentSec: 90, answers: [] }
        );

        await controller.overrideEvaluation(fakeReq, 'att-1', 'q-1', {
            status: 'partial',
        });
        expect(mockQuizService.overrideEvaluation).toHaveBeenCalledWith(
            'user-123',
            'att-1',
            'q-1',
            { status: 'partial' }
        );
    });
});
