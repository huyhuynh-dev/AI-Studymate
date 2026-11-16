import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CardTypeEnum,
    Prisma,
    QuestionTypeEnum,
} from '../generated/prisma/client.js';
import { DeckToQuizService } from './deck-to-quiz.service.js';

describe('DeckToQuizService (0% LLM Conversion + source_refs preservation)', () => {
    let service: DeckToQuizService;
    let mockDeckRepo: any;
    let mockQuizRepo: any;

    const sampleRef = [
        {
            documentId: 'doc-1',
            fileName: 'GiaiTich.pdf',
            chunkId: 'chunk-9',
            chunkIndex: 9,
            pageNumbers: [14],
            bboxes: [{ page_no: 14, l: 20, t: 500, r: 400, b: 420 }],
            headings: ['Chương 2', 'Đạo hàm'],
            snippet: 'Đạo hàm biểu diễn tốc độ biến thiên tức thời.',
        },
    ];

    beforeEach(() => {
        mockDeckRepo = {
            getDeckInConversation: vi.fn(),
            getAllFlashcardsByDeckId: vi.fn(),
        };
        mockQuizRepo = {
            assertConversationOwnership: vi.fn(),
            createQuizWithQuestions: vi.fn(),
        };
        service = new DeckToQuizService(mockDeckRepo, mockQuizRepo);
    });

    it('preserves source_refs across type_in, cloze, single_choice, and true_false conversions', () => {
        const cards = [
            {
                id: 'c1',
                card_type: CardTypeEnum.type_in,
                front_text: '<p>Thuật toán lập lịch của Anki?</p>',
                back_text: '<p>SM-2</p>',
                image_url: null,
                audio_url: null,
                source_refs: sampleRef,
            },
            {
                id: 'c2',
                card_type: CardTypeEnum.cloze,
                front_text: '<p><span data-cloze="true">Đạo hàm</span> đo tốc độ biến thiên.</p>',
                back_text: '<p>Giải tích 1</p>',
                image_url: null,
                audio_url: null,
                source_refs: sampleRef,
            },
            {
                id: 'c3',
                card_type: CardTypeEnum.basic,
                front_text: '<p>Khái niệm A</p>',
                back_text: '<p>Định nghĩa A</p>',
                image_url: null,
                audio_url: null,
                source_refs: sampleRef,
            },
            {
                id: 'c4',
                card_type: CardTypeEnum.basic,
                front_text: '<p>Khái niệm B</p>',
                back_text: '<p>Định nghĩa B</p>',
                image_url: null,
                audio_url: null,
                source_refs: null,
            },
        ];

        const singleAndShort = service.convertCardsToQuestions(
            cards,
            4,
            [QuestionTypeEnum.short_answer, QuestionTypeEnum.true_false],
            () => 0.1
        );

        expect(singleAndShort).toHaveLength(4);
        const withRef = singleAndShort.filter((q) => q.source_refs !== Prisma.DbNull);
        const withoutRef = singleAndShort.filter((q) => q.source_refs === Prisma.DbNull);
        expect(withRef).toHaveLength(3);
        expect(withoutRef).toHaveLength(1);
        expect(withRef[0].source_refs).toEqual(sampleRef);
    });

    it('generateQuizFromDeck persists preserved source_refs and maps sourceRefs in QuizResponse', async () => {
        const now = new Date();
        mockDeckRepo.getDeckInConversation.mockResolvedValue({
            id: 'deck-1',
            name: 'Giải tích 1',
        });
        mockDeckRepo.getAllFlashcardsByDeckId.mockResolvedValue([
            {
                id: 'c1',
                card_type: CardTypeEnum.type_in,
                front_text: '<p>Ký hiệu đạo hàm?</p>',
                back_text: '<p>dy/dx</p>',
                image_url: null,
                audio_url: null,
                source_refs: sampleRef,
            },
        ]);

        mockQuizRepo.createQuizWithQuestions.mockImplementation(
            async (_u: string, _c: string, quizData: any, questions: any[]) => ({
                id: 'quiz-from-deck',
                conversation_id: 'conv-1',
                title: quizData.title,
                description: quizData.description,
                time_limit_sec: null,
                source: 'flashcard',
                source_deck_id: 'deck-1',
                source_deck: { name: 'Giải tích 1' },
                created_at: now,
                updated_at: now,
                questions: questions.map((q, idx) => ({
                    id: `qq-${idx}`,
                    quiz_id: 'quiz-from-deck',
                    ...q,
                })),
            })
        );

        const res = await service.generateQuizFromDeck('user-1', 'conv-1', {
            deckId: 'deck-1',
            questionCount: 1,
            types: [QuestionTypeEnum.short_answer],
        });

        expect(res.questions[0].sourceRefs).toEqual(sampleRef);
    });
});
