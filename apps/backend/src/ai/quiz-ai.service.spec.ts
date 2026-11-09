import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EvaluationStatusEnum } from '../generated/prisma/client.js';
import { AiService } from './ai.service.js';
import { QuizAiService, stripHtml } from './quiz-ai.service.js';

describe('QuizAiService', () => {
    let service: QuizAiService;
    let mockAiService: any;

    beforeEach(async () => {
        mockAiService = {
            generateObjectForTask: vi.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                QuizAiService,
                {
                    provide: AiService,
                    useValue: mockAiService,
                },
            ],
        }).compile();

        service = module.get<QuizAiService>(QuizAiService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('stripHtml helper', () => {
        it('removes tags and replaces html entities', () => {
            expect(stripHtml('<p>Câu <strong>hỏi</strong>&nbsp;1</p>')).toBe(
                'Câu hỏi 1'
            );
        });
    });

    describe('gradeEssayQuestion', () => {
        it('calls AiService with QUIZ_AGENT task and returns parsed evaluation', async () => {
            mockAiService.generateObjectForTask.mockResolvedValue({
                object: {
                    evaluationStatus: 'partial',
                    pointsEarned: 1.5,
                    matchedPoints: ['Ý 1'],
                    missingPoints: ['Ý 2'],
                    aiFeedback: 'Tốt nhưng thiếu ý 2.',
                },
            });

            const res = await service.gradeEssayQuestion(
                {
                    questionText: '<p>Giải thích Active Recall</p>',
                    points: 3,
                    sampleAnswer: '<p>Đáp án mẫu</p>',
                    gradingCriteria: ['Ý 1', 'Ý 2'],
                },
                '<p>Bài làm của sinh viên</p>'
            );

            expect(mockAiService.generateObjectForTask).toHaveBeenCalledWith(
                'QUIZ_AGENT',
                expect.objectContaining({
                    schema: expect.any(Object),
                    temperature: 0.2,
                })
            );
            expect(res.evaluationStatus).toBe(EvaluationStatusEnum.partial);
            expect(res.pointsEarned).toBe(1.5);
            expect(res.matchedPoints).toEqual(['Ý 1']);
            expect(res.missingPoints).toEqual(['Ý 2']);
            expect(res.aiFeedback).toBe('Tốt nhưng thiếu ý 2.');
        });

        it('returns incorrect with 0 points immediately if answer is empty without calling LLM', async () => {
            const res = await service.gradeEssayQuestion(
                {
                    questionText: '<p>Câu hỏi</p>',
                    points: 2,
                    sampleAnswer: '<p>Mẫu</p>',
                    gradingCriteria: ['Tiêu chí A'],
                },
                '<p>   </p>'
            );

            expect(mockAiService.generateObjectForTask).not.toHaveBeenCalled();
            expect(res.evaluationStatus).toBe(EvaluationStatusEnum.incorrect);
            expect(res.pointsEarned).toBe(0);
            expect(res.missingPoints).toEqual(['Tiêu chí A']);
        });

        it('falls back to keyword-based evaluation if LLM call fails', async () => {
            mockAiService.generateObjectForTask.mockRejectedValue(
                new Error('LLM Service Unavailable')
            );

            const res = await service.gradeEssayQuestion(
                {
                    questionText: '<p>Giải thích</p>',
                    points: 2,
                    sampleAnswer: '<p>Mẫu</p>',
                    gradingCriteria: ['khái niệm cốt lõi', 'liên hệ thực tế'],
                },
                '<p>Đây là khái niệm cốt lõi của vấn đề</p>'
            );

            expect(res.evaluationStatus).toBe(EvaluationStatusEnum.partial);
            expect(res.pointsEarned).toBeGreaterThan(0);
            expect(res.matchedPoints).toContain('khái niệm cốt lõi');
            expect(res.missingPoints).toContain('liên hệ thực tế');
        });
    });
});
