import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EvaluationStatusEnum } from '../generated/prisma/client.js';
import { AiService } from './ai.service.js';
import {
    QuizAiService,
    buildQuizSystemPrompt,
    stripHtml,
} from './quiz-ai.service.js';
import {
    buildQuestionsSchema,
    buildQuizSchema,
    partitionQuestions,
    textToHtml,
    toQuizQuestionInserts,
} from './schemas/quiz-ai.schema.js';

describe('QuizAiService & QuizAiSchema', () => {
    let service: QuizAiService;
    let mockAiService: any;

    beforeEach(async () => {
        mockAiService = {
            generateObjectForFeature: vi.fn(),
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

    describe('3-Layer Quiz AI Schema (quiz-ai.schema.ts)', () => {
        it('buildQuestionsSchema & buildQuizSchema restrict allowed question types', () => {
            const schema = buildQuestionsSchema(['single_choice', 'true_false']);
            const ok = schema.safeParse({
                questions: [
                    {
                        type: 'true_false',
                        text: 'Spaced repetition giúp ghi nhớ dài hạn tốt hơn học dồn.',
                        correctAnswer: true,
                        explanation: 'Vì khoảng cách ôn tập tăng dần giúp củng cố trí nhớ.',
                    },
                ],
            });
            expect(ok.success).toBe(true);

            const disallowedType = schema.safeParse({
                questions: [
                    {
                        type: 'essay',
                        text: 'Giải thích cơ chế của Spaced Repetition.',
                        sampleAnswer: 'Bài viết mẫu dài trên 40 ký tự giải thích rõ ràng cơ chế.',
                        gradingCriteria: ['Nêu khái niệm', 'Nêu ví dụ'],
                        explanation: 'Giải thích chi tiết.',
                    },
                ],
            });
            expect(disallowedType.success).toBe(false);

            const quizSchema = buildQuizSchema(['single_choice']);
            expect(quizSchema).toBeDefined();
        });

        it('partitionQuestions filters valid questions and catches quality violations', () => {
            const raw = [
                // Hợp lệ: single_choice
                {
                    type: 'single_choice',
                    text: 'Đường cong nào mô tả tốc độ quên theo thời gian?',
                    correctAnswer: 'Đường cong Ebbinghaus',
                    distractors: [
                        'Đường cong Gauss',
                        'Đường cong Lorenz',
                        'Đường cong Phillips',
                    ],
                    explanation:
                        'Hermann Ebbinghaus phát hiện trí nhớ suy giảm theo hàm mũ.',
                },
                // Bị loại: dùng "Tất cả các đáp án trên"
                {
                    type: 'single_choice',
                    text: 'Phương pháp nào dưới đây giúp học tập hiệu quả?',
                    correctAnswer: 'Active Recall',
                    distractors: [
                        'Spaced Repetition',
                        'Feynman Technique',
                        'Tất cả các đáp án trên',
                    ],
                    explanation: 'Giải thích hợp lệ đủ độ dài.',
                },
                // Bị loại: câu true_false viết dạng câu hỏi có dấu ?
                {
                    type: 'true_false',
                    text: 'Học dồn có tốt hơn học giãn cách không?',
                    correctAnswer: false,
                    explanation: 'Học giãn cách tốt hơn cho trí nhớ dài hạn.',
                },
                // Bị loại: short_answer chứa ký tự '|'
                {
                    type: 'short_answer',
                    text: 'Thuật toán lập lịch của Anki tên là gì?',
                    acceptedAnswers: ['SM-2|SM2'],
                    explanation: 'Thuật toán SM-2 ra đời năm 1987.',
                },
                // Hợp lệ: essay
                {
                    type: 'essay',
                    text: 'Giải thích cách kết hợp **Active Recall** và **Spaced Repetition**.',
                    sampleAnswer:
                        'Active Recall buộc não tự truy xuất thông tin thay vì đọc thụ động.\nKhi kết hợp với Spaced Repetition, việc truy xuất diễn ra theo khoảng cách tăng dần.',
                    gradingCriteria: [
                        'Nêu đúng khái niệm Active Recall',
                        'Giải thích nguyên lý giãn cách thời gian',
                    ],
                    explanation: 'Hai phương pháp bổ trợ trực tiếp cho nhau.',
                },
            ];

            const { valid, rejected } = partitionQuestions(raw);
            expect(valid).toHaveLength(2);
            expect(rejected).toHaveLength(3);
            expect(rejected[0].index).toBe(1);
            expect(rejected[1].index).toBe(2);
            expect(rejected[2].index).toBe(3);
        });

        it('textToHtml and toQuizQuestionInserts convert plain text to TipTap HTML and format options with isCorrect', () => {
            expect(
                textToHtml(
                    'Khái niệm **quan trọng**:\n- Ý thứ nhất\n- Ý thứ hai'
                )
            ).toBe(
                '<p>Khái niệm <strong>quan trọng</strong>:</p><ul><li><p>Ý thứ nhất</p></li><li><p>Ý thứ hai</p></li></ul>'
            );

            const inserts = toQuizQuestionInserts(
                [
                    {
                        type: 'single_choice',
                        text: 'Câu hỏi **trắc nghiệm**?',
                        correctAnswer: 'Đáp án đúng',
                        distractors: ['Sai 1', 'Sai 2', 'Sai 3'],
                        explanation: 'Giải thích câu 1.',
                    },
                    {
                        type: 'true_false',
                        text: 'Mệnh đề khẳng định đúng.',
                        correctAnswer: true,
                        explanation: 'Giải thích câu 2.',
                    },
                    {
                        type: 'short_answer',
                        text: 'Điền tên thuật toán của Anki.',
                        acceptedAnswers: ['SM-2', 'SM2'],
                        explanation: 'Giải thích câu 3.',
                    },
                ],
                { quizId: 'quiz-1', random: () => 0.5 }
            );

            expect(inserts).toHaveLength(3);
            expect(inserts[0].options).toHaveLength(4);
            expect(inserts[0].options?.filter((o) => o.isCorrect)).toHaveLength(
                1
            );
            expect(inserts[1].options).toEqual([
                { id: 'true', text: 'Đúng', isCorrect: true },
                { id: 'false', text: 'Sai', isCorrect: false },
            ]);
            expect(inserts[2].sample_answer).toBe('SM-2|SM2');
        });
    });

    describe('generateQuizFromContext', () => {
        it('calls AiService with QUIZ_GENERATE and transforms valid questions into DB rows', async () => {
            mockAiService.generateObjectForFeature.mockResolvedValue({
                object: {
                    title: 'Đề ôn tập Trí nhớ',
                    description: 'Kiểm tra kiến thức về Spaced Repetition.',
                    questions: [
                        {
                            type: 'single_choice',
                            text: 'Ai là người phát hiện đường cong quên lãng?',
                            correctAnswer: 'Hermann Ebbinghaus',
                            distractors: [
                                'Piotr Wozniak',
                                'Ivan Pavlov',
                                'B.F. Skinner',
                            ],
                            explanation:
                                'Ebbinghaus công bố nghiên cứu về đường cong quên vào năm 1885.',
                        },
                    ],
                },
            });

            const res = await service.generateQuizFromContext({
                context: 'Tài liệu về đường cong quên lãng Ebbinghaus...',
                count: 5,
                types: ['single_choice'],
                difficulty: 'applied',
            });

            expect(mockAiService.generateObjectForFeature).toHaveBeenCalledWith(
                'QUIZ_GENERATE',
                expect.objectContaining({
                    count: 5,
                    difficulty: 'applied',
                }),
                expect.objectContaining({
                    schemaName: 'QuizGeneration',
                })
            );
            expect(res.title).toBe('Đề ôn tập Trí nhớ');
            expect(res.rows).toHaveLength(1);
            expect(res.rows[0].question_type).toBe('single_choice');
        });

        it('throws BadRequestException when all generated questions fail quality validation', async () => {
            mockAiService.generateObjectForFeature.mockResolvedValue({
                object: {
                    title: 'Đề lỗi',
                    description: 'Mô tả',
                    questions: [
                        {
                            type: 'true_false',
                            text: 'Câu hỏi có dấu chấm hỏi ở cuối?',
                            correctAnswer: true,
                            explanation: 'Giải thích đủ dài cho câu hỏi.',
                        },
                    ],
                },
            });

            await expect(
                service.generateQuizFromContext({
                    context: 'Nội dung ngắn',
                    count: 3,
                    types: ['true_false'],
                    difficulty: 'basic',
                })
            ).rejects.toThrow(BadRequestException);
        });

        it('builds system prompt with difficulty and selected question types', () => {
            const prompt = buildQuizSystemPrompt({
                types: ['single_choice', 'essay'],
                count: 10,
                difficulty: 'advanced',
            });
            expect(prompt).toContain('Soạn tối đa 10 câu hỏi');
            expect(prompt).toContain('Nâng cao');
            expect(prompt).toContain('single_choice:');
            expect(prompt).toContain('essay:');
        });
    });

    describe('stripHtml helper & gradeEssayQuestion', () => {
        it('removes tags and replaces html entities', () => {
            expect(stripHtml('<p>Câu <strong>hỏi</strong>&nbsp;1</p>')).toBe(
                'Câu hỏi 1'
            );
        });

        it('calls AiService with ESSAY_GRADE feature and returns parsed evaluation', async () => {
            mockAiService.generateObjectForFeature.mockResolvedValue({
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

            expect(mockAiService.generateObjectForFeature).toHaveBeenCalledWith(
                'ESSAY_GRADE',
                expect.objectContaining({
                    questionPlain: 'Giải thích Active Recall',
                    points: 3,
                }),
                expect.objectContaining({
                    schema: expect.any(Object),
                })
            );
            expect(res.evaluationStatus).toBe(EvaluationStatusEnum.partial);
            expect(res.pointsEarned).toBe(1.5);
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
        });
    });
});
