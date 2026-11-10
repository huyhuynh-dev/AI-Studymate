import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CardStateEnum,
    CardTypeEnum,
    QuestionTypeEnum,
} from '../generated/prisma/client.js';
import { DeckFlashcardRepoService } from '../repo/deck-flashcard-repo/deck-flashcard-repo.service.js';
import { QuizRepoService } from '../repo/quiz-repo/quiz-repo.service.js';
import { QuizToFlashcardService } from './quiz-to-flashcard.service.js';

describe('QuizToFlashcardService', () => {
    let service: QuizToFlashcardService;
    let mockQuizRepo: any;
    let mockDeckRepo: any;

    beforeEach(async () => {
        mockQuizRepo = {
            getAttemptByIdWithDetails: vi.fn(),
        };

        mockDeckRepo = {
            getDeckById: vi.fn(),
            createDeck: vi.fn(),
            createManyFlashcards: vi.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                QuizToFlashcardService,
                {
                    provide: QuizRepoService,
                    useValue: mockQuizRepo,
                },
                {
                    provide: DeckFlashcardRepoService,
                    useValue: mockDeckRepo,
                },
            ],
        }).compile();

        service = module.get<QuizToFlashcardService>(QuizToFlashcardService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('mapQuestionToFlashcard (Rule-based mapping)', () => {
        it('maps single_choice to basic card with correct option and explanation', () => {
            const card = service.mapQuestionToFlashcard({
                question_type: QuestionTypeEnum.single_choice,
                question_text: '<p>Thủ đô của Việt Nam là gì?</p>',
                options: [
                    { id: 'opt_1', text: 'Hà Nội', isCorrect: true },
                    { id: 'opt_2', text: 'TP.HCM', isCorrect: false },
                ],
                sample_answer: null,
                grading_criteria: [],
                explanation: 'Hà Nội là thủ đô từ năm 1976',
                image_url: 'https://example.com/hanoi.jpg',
                audio_url: null,
            });

            expect(card.card_type).toBe(CardTypeEnum.basic);
            expect(card.front_text).toBe('<p>Thủ đô của Việt Nam là gì?</p>');
            expect(card.back_text).toContain('<strong>Đáp án đúng:</strong> Hà Nội');
            expect(card.back_text).toContain('<strong>Giải thích:</strong> Hà Nội là thủ đô');
            expect(card.image_url).toBe('https://example.com/hanoi.jpg');
            expect(card.state).toBe(CardStateEnum.new);
        });

        it('maps true_false to basic card with ĐÚNG/SAI', () => {
            const card = service.mapQuestionToFlashcard({
                question_type: QuestionTypeEnum.true_false,
                question_text: '<p>Mặt trời mọc ở hướng Đông.</p>',
                options: [
                    { id: 'true', text: 'Đúng', isCorrect: true },
                    { id: 'false', text: 'Sai', isCorrect: false },
                ],
                sample_answer: null,
                grading_criteria: [],
                explanation: 'Hiện tượng tự nhiên theo chuyển động quay của Trái Đất',
                image_url: null,
                audio_url: null,
            });

            expect(card.card_type).toBe(CardTypeEnum.basic);
            expect(card.front_text).toBe('<p>Mặt trời mọc ở hướng Đông.</p>');
            expect(card.back_text).toContain('<strong>Đáp án:</strong> ĐÚNG');
            expect(card.back_text).toContain('chuyển động quay');
        });

        it('maps multiple_choice to basic card with list of correct options', () => {
            const card = service.mapQuestionToFlashcard({
                question_type: QuestionTypeEnum.multiple_choice,
                question_text: '<p>Các ngôn ngữ lập trình hướng đối tượng?</p>',
                options: [
                    { id: '1', text: 'Java', isCorrect: true },
                    { id: '2', text: 'HTML', isCorrect: false },
                    { id: '3', text: 'C++', isCorrect: true },
                ],
                sample_answer: null,
                grading_criteria: [],
                explanation: 'HTML là ngôn ngữ đánh dấu siêu văn bản',
                image_url: null,
                audio_url: null,
            });

            expect(card.card_type).toBe(CardTypeEnum.basic);
            expect(card.back_text).toContain('<li><p>Java</p></li>');
            expect(card.back_text).toContain('<li><p>C++</p></li>');
            expect(card.back_text).not.toContain('HTML</p></li>');
        });

        it('maps short_answer without gap to type_in card with first accepted synonym', () => {
            const card = service.mapQuestionToFlashcard({
                question_type: QuestionTypeEnum.short_answer,
                question_text: '<p>Tên thuật toán ôn tập ngắt quãng nổi tiếng?</p>',
                options: null,
                sample_answer: 'SM-2 | SuperMemo 2 | SM2',
                grading_criteria: [],
                explanation: 'Phát triển bởi Piotr Wozniak',
                image_url: null,
                audio_url: null,
            });

            expect(card.card_type).toBe(CardTypeEnum.type_in);
            expect(card.front_text).toBe('<p>Tên thuật toán ôn tập ngắt quãng nổi tiếng?</p>');
            expect(card.back_text).toContain('<p>SM-2</p>');
            expect(card.back_text).toContain('Piotr Wozniak');
        });

        it('maps short_answer with gap [......] to cloze card with span data-cloze', () => {
            const card = service.mapQuestionToFlashcard({
                question_type: QuestionTypeEnum.short_answer,
                question_text: '<p>Thuật toán [......] là thuật toán SRS phổ biến.</p>',
                options: null,
                sample_answer: 'SM-2 | SM2',
                grading_criteria: [],
                explanation: 'Được Anki sử dụng',
                image_url: null,
                audio_url: null,
            });

            expect(card.card_type).toBe(CardTypeEnum.cloze);
            expect(card.front_text).toBe(
                '<p>Thuật toán <span data-cloze="true">SM-2</span> là thuật toán SRS phổ biến.</p>'
            );
        });

        it('maps essay to basic card with sample answer and grading criteria', () => {
            const card = service.mapQuestionToFlashcard({
                question_type: QuestionTypeEnum.essay,
                question_text: '<p>Trình bày nguyên lý của Active Recall.</p>',
                options: null,
                sample_answer: '<p>Chủ động gợi nhớ thông tin từ não bộ thay vì đọc thụ động.</p>',
                grading_criteria: ['Nêu đúng định nghĩa', 'Phân biệt với passive review', 'Có ví dụ minh họa'],
                explanation: 'Phương pháp học tập khoa học',
                image_url: null,
                audio_url: null,
            });

            expect(card.card_type).toBe(CardTypeEnum.basic);
            expect(card.back_text).toContain('Bài làm mẫu:');
            expect(card.back_text).toContain('Chủ động gợi nhớ thông tin');
            expect(card.back_text).toContain('Tiêu chí đánh giá:');
            expect(card.back_text).toContain('<li><p>Nêu đúng định nghĩa</p></li>');
            expect(card.back_text).toContain('<li><p>Có ví dụ minh họa</p></li>');
        });
    });

    describe('convertToFlashcards (Execution)', () => {
        const mockAttempt = {
            id: 'attempt-1',
            user_id: 'user-1',
            quiz: {
                id: 'quiz-1',
                conversation_id: 'conv-1',
                title: 'Bài kiểm tra Kiến trúc Máy tính',
                questions: [
                    {
                        id: 'q-1',
                        question_type: QuestionTypeEnum.single_choice,
                        question_text: '<p>CPU là gì?</p>',
                        options: [{ id: 'opt_1', text: 'Central Processing Unit', isCorrect: true }],
                        sample_answer: null,
                        grading_criteria: [],
                        explanation: 'Bộ xử lý trung tâm',
                    },
                    {
                        id: 'q-2',
                        question_type: QuestionTypeEnum.short_answer,
                        question_text: '<p>Bộ nhớ tạm thời gọi là gì?</p>',
                        options: null,
                        sample_answer: 'RAM',
                        grading_criteria: [],
                        explanation: null,
                    },
                ],
            },
        };

        it('throws BadRequestException if questionIds is empty', async () => {
            await expect(
                service.convertToFlashcards('user-1', 'attempt-1', {
                    questionIds: [],
                    target: { deckId: 'deck-1' },
                })
            ).rejects.toThrow(BadRequestException);
        });

        it('throws BadRequestException if no matching questions found', async () => {
            mockQuizRepo.getAttemptByIdWithDetails.mockResolvedValue(mockAttempt);

            await expect(
                service.convertToFlashcards('user-1', 'attempt-1', {
                    questionIds: ['non-existent-id'],
                    target: { deckId: 'deck-1' },
                })
            ).rejects.toThrow(BadRequestException);
        });

        it('saves to existing deck when deckId is provided', async () => {
            mockQuizRepo.getAttemptByIdWithDetails.mockResolvedValue(mockAttempt);
            mockDeckRepo.getDeckById.mockResolvedValue({
                id: 'deck-1',
                name: 'Bộ thẻ Máy tính',
            });
            mockDeckRepo.createManyFlashcards.mockResolvedValue(1);

            const result = await service.convertToFlashcards('user-1', 'attempt-1', {
                questionIds: ['q-1'],
                target: { deckId: 'deck-1' },
            });

            expect(mockDeckRepo.getDeckById).toHaveBeenCalledWith('deck-1', 'user-1');
            expect(mockDeckRepo.createManyFlashcards).toHaveBeenCalledWith(
                'deck-1',
                expect.arrayContaining([
                    expect.objectContaining({
                        card_type: CardTypeEnum.basic,
                        front_text: '<p>CPU là gì?</p>',
                    }),
                ])
            );
            expect(result).toEqual({ deckId: 'deck-1', created: 1 });
        });

        it('throws NotFoundException if existing deck does not exist or does not belong to user', async () => {
            mockQuizRepo.getAttemptByIdWithDetails.mockResolvedValue(mockAttempt);
            mockDeckRepo.getDeckById.mockResolvedValue(null);

            await expect(
                service.convertToFlashcards('user-1', 'attempt-1', {
                    questionIds: ['q-1'],
                    target: { deckId: 'deck-unknown' },
                })
            ).rejects.toThrow(NotFoundException);
        });

        it('creates a new deck under current conversation when newDeckName is provided', async () => {
            mockQuizRepo.getAttemptByIdWithDetails.mockResolvedValue(mockAttempt);
            mockDeckRepo.createDeck.mockResolvedValue({
                id: 'new-deck-1',
                name: 'Bộ thẻ ôn thi',
            });
            mockDeckRepo.createManyFlashcards.mockResolvedValue(2);

            const result = await service.convertToFlashcards('user-1', 'attempt-1', {
                questionIds: ['q-1', 'q-2'],
                target: { newDeckName: 'Bộ thẻ ôn thi' },
            });

            expect(mockDeckRepo.createDeck).toHaveBeenCalledWith({
                user_id: 'user-1',
                conversation_id: 'conv-1',
                name: 'Bộ thẻ ôn thi',
                description: expect.stringContaining('Bài kiểm tra Kiến trúc Máy tính'),
            });
            expect(mockDeckRepo.createManyFlashcards).toHaveBeenCalledWith(
                'new-deck-1',
                expect.any(Array)
            );
            expect(result).toEqual({ deckId: 'new-deck-1', created: 2 });
        });

        it('throws BadRequestException if neither deckId nor newDeckName is provided', async () => {
            mockQuizRepo.getAttemptByIdWithDetails.mockResolvedValue(mockAttempt);

            await expect(
                service.convertToFlashcards('user-1', 'attempt-1', {
                    questionIds: ['q-1'],
                    target: {},
                })
            ).rejects.toThrow(BadRequestException);
        });
    });
});
