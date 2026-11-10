import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {
    CardTypeEnum,
    Prisma,
    QuestionTypeEnum,
} from '../generated/prisma/client.js';
import { DeckFlashcardRepoService } from '../repo/deck-flashcard-repo/deck-flashcard-repo.service.js';
import {
    QuestionCreatePayload,
    QuizRepoService,
} from '../repo/quiz-repo/quiz-repo.service.js';
import { GenerateQuizFromDeckDto } from './dto/quiz.dto.js';
import {
    mapQuizToResponse,
    sanitizeQuizHtml,
    stripHtml,
} from './quiz.helper.js';
import { QuizResponse } from './quiz.types.js';

export interface CardSourceItem {
    id: string;
    card_type: CardTypeEnum;
    front_text: string;
    back_text: string;
    image_url: string | null;
    audio_url: string | null;
}

const CLOZE_TAG_RE = /<span\b[^>]*\bdata-cloze="true"[^>]*>([\s\S]+?)<\/span>/i;
const CLOZE_LEGACY_RE = /\{\{(?:c\d+::)?([\s\S]+?)\}\}/i;
const ALL_CLOZE_TAGS_RE = /<span\b[^>]*\bdata-cloze="true"[^>]*>([\s\S]+?)<\/span>/gi;
const ALL_CLOZE_LEGACY_RE = /\{\{(?:c\d+::)?([\s\S]+?)\}\}/gi;

/** Xáo trộn mảng ngẫu nhiên (Fisher-Yates Shuffle) */
export function shuffleArray<T>(array: T[], random = Math.random): T[] {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** Gỡ bỏ toàn bộ cloze markers, giữ lại chữ thuần */
export function unwrapAllCloze(text: string): string {
    return text
        .replace(ALL_CLOZE_TAGS_RE, '$1')
        .replace(ALL_CLOZE_LEGACY_RE, '$1');
}

/**
 * Trích xuất từ khóa chỗ trống và biến đổi câu thành dạng [......]
 */
export function extractClozeGap(frontHtml: string): {
    questionText: string;
    answerText: string;
} {
    // 1. Thử khớp với <span data-cloze="true">
    const spanMatch = frontHtml.match(CLOZE_TAG_RE);
    if (spanMatch) {
        const answerText = stripHtml(spanMatch[1]).trim();
        // Thay thế chỗ trống đầu tiên bằng [......], các chỗ trống khác unwrap thành chữ
        let firstReplaced = false;
        const replaced = frontHtml.replace(ALL_CLOZE_TAGS_RE, (_m, body) => {
            if (!firstReplaced) {
                firstReplaced = true;
                return '<strong>[......]</strong>';
            }
            return body;
        });
        return {
            questionText: unwrapAllCloze(replaced),
            answerText,
        };
    }

    // 2. Thử khớp với cú pháp legacy {{...}}
    const legacyMatch = frontHtml.match(CLOZE_LEGACY_RE);
    if (legacyMatch) {
        const answerText = stripHtml(legacyMatch[1]).trim();
        let firstReplaced = false;
        const replaced = frontHtml.replace(ALL_CLOZE_LEGACY_RE, (_m, body) => {
            if (!firstReplaced) {
                firstReplaced = true;
                return '<strong>[......]</strong>';
            }
            return body;
        });
        return {
            questionText: unwrapAllCloze(replaced),
            answerText,
        };
    }

    // Không tìm thấy chỗ trống -> fallback giữ nguyên
    return {
        questionText: frontHtml,
        answerText: '',
    };
}

@Injectable()
export class DeckToQuizService {
    private readonly logger = new Logger(DeckToQuizService.name);

    constructor(
        private readonly deckRepo: DeckFlashcardRepoService,
        private readonly quizRepo: QuizRepoService
    ) {}

    /**
     * Chuyển đổi Flashcard trong bộ thẻ thành Đề thi Quiz bằng thuật toán Rule-based thuần (0% LLM).
     */
    async generateQuizFromDeck(
        userId: string,
        conversationId: string,
        dto: GenerateQuizFromDeckDto
    ): Promise<QuizResponse> {
        const startTime = Date.now();
        this.logger.log(
            `[generateQuizFromDeck] User ${userId} yêu cầu tạo Quiz từ Deck ${dto.deckId} trong Conversation ${conversationId} | count: ${dto.questionCount}`
        );

        // 1. Kiểm tra phiên học & bộ thẻ
        await this.quizRepo.assertConversationOwnership(conversationId, userId);
        const deck = await this.deckRepo.getDeckInConversation(
            dto.deckId,
            conversationId,
            userId
        );
        if (!deck) {
            throw new NotFoundException(
                'Không tìm thấy bộ thẻ hoặc bạn không có quyền truy cập.'
            );
        }

        // 2. Lấy toàn bộ thẻ Flashcard của Deck
        const cards = await this.deckRepo.getAllFlashcardsByDeckId(
            dto.deckId,
            userId
        );
        if (cards.length === 0) {
            throw new BadRequestException(
                'Bộ thẻ chưa có thẻ ghi nhớ nào để tạo bài kiểm tra.'
            );
        }

        // 3. Phân loại và chuẩn bị dữ liệu thẻ
        const cardItems: CardSourceItem[] = cards.map((c) => ({
            id: c.id,
            card_type: c.card_type,
            front_text: c.front_text,
            back_text: c.back_text,
            image_url: c.image_url,
            audio_url: c.audio_url,
        }));

        // 4. Áp dụng thuật toán Rule-based chuyển đổi
        const allowedTypes =
            dto.types && dto.types.length > 0
                ? dto.types.filter(
                      (t) =>
                          t === QuestionTypeEnum.single_choice ||
                          t === QuestionTypeEnum.true_false ||
                          t === QuestionTypeEnum.short_answer
                  )
                : [
                      QuestionTypeEnum.single_choice,
                      QuestionTypeEnum.true_false,
                      QuestionTypeEnum.short_answer,
                  ];

        const targetCount = Math.max(
            1,
            Math.min(cardItems.length, Number(dto.questionCount) || 10)
        );

        const questionsPayload = this.convertCardsToQuestions(
            cardItems,
            targetCount,
            allowedTypes
        );

        this.logger.log(
            `[generateQuizFromDeck] Đã chuyển đổi thành công ${questionsPayload.length} câu hỏi từ ${cardItems.length} thẻ trong Deck "${deck.name}"`
        );

        // 5. Lưu nguyên tử vào CSDL qua QuizRepoService
        const created = await this.quizRepo.createQuizWithQuestions(
            userId,
            conversationId,
            {
                title: `Bài kiểm tra: ${deck.name}`,
                description: `Tạo tự động từ bộ thẻ Flashcard: ${deck.name} (${questionsPayload.length} câu hỏi).`,
                time_limit_sec: null,
                source: 'flashcard',
                source_deck_id: deck.id,
            },
            questionsPayload
        );

        const duration = Date.now() - startTime;
        this.logger.log(
            `[generateQuizFromDeck] Tạo đề Quiz thành công trong ${duration}ms | Quiz ID: ${created.id}`
        );

        return mapQuizToResponse(created);
    }

    /**
     * Thuật toán Rule-based chuyển đổi danh sách Flashcard thành Quiz questions
     */
    convertCardsToQuestions(
        cards: CardSourceItem[],
        targetCount: number,
        allowedTypes: QuestionTypeEnum[],
        random = Math.random
    ): QuestionCreatePayload[] {
        // Nhóm thẻ theo loại
        const basicCards = cards.filter(
            (c) => c.card_type === CardTypeEnum.basic
        );
        const clozeCards = cards.filter(
            (c) => c.card_type === CardTypeEnum.cloze
        );
        const typeInCards = cards.filter(
            (c) => c.card_type === CardTypeEnum.type_in
        );

        const allowSingle = allowedTypes.includes(
            QuestionTypeEnum.single_choice
        );
        const allowTrueFalse = allowedTypes.includes(
            QuestionTypeEnum.true_false
        );
        const allowShortAnswer = allowedTypes.includes(
            QuestionTypeEnum.short_answer
        );

        // Xáo trộn thứ tự thẻ trước khi chọn
        const shuffledAll = shuffleArray(cards, random);

        // Danh sách thẻ được chọn cho bài thi (tối đa targetCount)
        const selectedCards = shuffledAll.slice(0, targetCount);

        const questions: QuestionCreatePayload[] = [];

        selectedCards.forEach((card, index) => {
            switch (card.card_type) {
                // =======================================================
                // 1. THẺ TYPE_IN -> SHORT_ANSWER (1-1 Mapping)
                // =======================================================
                case CardTypeEnum.type_in: {
                    if (allowShortAnswer || (!allowSingle && !allowTrueFalse)) {
                        questions.push(
                            this.convertTypeInToShortAnswer(card, index)
                        );
                    } else if (allowTrueFalse) {
                        questions.push(
                            this.convertBasicToTrueFalse(
                                card,
                                index,
                                cards,
                                random
                            )
                        );
                    } else if (allowSingle && cards.length >= 4) {
                        questions.push(
                            this.convertBasicToSingleChoice(
                                card,
                                index,
                                cards,
                                random
                            )
                        );
                    } else {
                        questions.push(
                            this.convertTypeInToShortAnswer(card, index)
                        );
                    }
                    break;
                }

                // =======================================================
                // 2. THẺ CLOZE -> SHORT_ANSWER (Gap Extraction)
                // =======================================================
                case CardTypeEnum.cloze: {
                    if (allowShortAnswer || (!allowSingle && !allowTrueFalse)) {
                        questions.push(
                            this.convertClozeToShortAnswer(card, index)
                        );
                    } else if (allowTrueFalse) {
                        questions.push(
                            this.convertBasicToTrueFalse(
                                card,
                                index,
                                cards,
                                random
                            )
                        );
                    } else if (allowSingle && cards.length >= 4) {
                        questions.push(
                            this.convertBasicToSingleChoice(
                                card,
                                index,
                                cards,
                                random
                            )
                        );
                    } else {
                        questions.push(
                            this.convertClozeToShortAnswer(card, index)
                        );
                    }
                    break;
                }

                // =======================================================
                // 3. THẺ BASIC -> SINGLE_CHOICE hoặc TRUE_FALSE
                // =======================================================
                case CardTypeEnum.basic:
                default: {
                    const nBasic = basicCards.length;

                    // Nếu người dùng chỉ chọn short_answer
                    if (allowShortAnswer && !allowSingle && !allowTrueFalse) {
                        questions.push(
                            this.convertTypeInToShortAnswer(card, index)
                        );
                        break;
                    }

                    // Trường hợp 1: N_basic >= 4 (Đủ distractor)
                    if (nBasic >= 4 && allowSingle) {
                        // Phân bổ 50% single_choice / 50% true_false nếu cả 2 đều được bật
                        if (allowTrueFalse && random() < 0.5) {
                            questions.push(
                                this.convertBasicToTrueFalse(
                                    card,
                                    index,
                                    basicCards,
                                    random
                                )
                            );
                        } else {
                            questions.push(
                                this.convertBasicToSingleChoice(
                                    card,
                                    index,
                                    basicCards,
                                    random
                                )
                            );
                        }
                    }
                    // Trường hợp 2: N_basic < 4 (Tự động chuyển về true_false an toàn)
                    else if (allowTrueFalse || !allowSingle) {
                        questions.push(
                            this.convertBasicToTrueFalse(
                                card,
                                index,
                                basicCards.length >= 2 ? basicCards : cards,
                                random
                            )
                        );
                    }
                    // Nếu người dùng bắt buộc single_choice nhưng N_basic < 4, mượn distractor từ toàn bộ cards
                    else if (cards.length >= 4) {
                        questions.push(
                            this.convertBasicToSingleChoice(
                                card,
                                index,
                                cards,
                                random
                            )
                        );
                    } else {
                        // Fallback về true_false
                        questions.push(
                            this.convertBasicToTrueFalse(
                                card,
                                index,
                                cards,
                                random
                            )
                        );
                    }
                    break;
                }
            }
        });

        return questions;
    }

    /**
     * Chuyển đổi thẻ type_in -> câu hỏi short_answer
     */
    private convertTypeInToShortAnswer(
        card: CardSourceItem,
        orderIndex: number
    ): QuestionCreatePayload {
        const rawAnswer = stripHtml(card.back_text).replace(/\|/g, '').trim();

        return {
            question_type: QuestionTypeEnum.short_answer,
            order_index: orderIndex,
            question_text: sanitizeQuizHtml(card.front_text),
            image_url: card.image_url,
            audio_url: card.audio_url,
            points: 1.0,
            options: Prisma.DbNull,
            sample_answer: rawAnswer,
            grading_criteria: [] as unknown as Prisma.InputJsonValue,
            explanation: card.back_text ? sanitizeQuizHtml(card.back_text) : null,
        };
    }

    /**
     * Chuyển đổi thẻ cloze -> câu hỏi short_answer (trích xuất chỗ trống)
     */
    private convertClozeToShortAnswer(
        card: CardSourceItem,
        orderIndex: number
    ): QuestionCreatePayload {
        const { questionText, answerText } = extractClozeGap(card.front_text);

        return {
            question_type: QuestionTypeEnum.short_answer,
            order_index: orderIndex,
            question_text: sanitizeQuizHtml(questionText),
            image_url: card.image_url,
            audio_url: card.audio_url,
            points: 1.0,
            options: Prisma.DbNull,
            sample_answer: answerText || stripHtml(card.back_text).trim(),
            grading_criteria: [] as unknown as Prisma.InputJsonValue,
            explanation: card.back_text ? sanitizeQuizHtml(card.back_text) : null,
        };
    }

    /**
     * Chuyển đổi thẻ basic -> câu hỏi trắc nghiệm single_choice (1 đúng + 3 sai)
     */
    private convertBasicToSingleChoice(
        card: CardSourceItem,
        orderIndex: number,
        cardPool: CardSourceItem[],
        random = Math.random
    ): QuestionCreatePayload {
        const correctAnswer = stripHtml(card.back_text).trim();

        // Lấy các thẻ khác làm phương án nhiễu
        const otherCards = cardPool.filter(
            (c) =>
                c.id !== card.id &&
                stripHtml(c.back_text).trim() !== correctAnswer
        );

        const shuffledOthers = shuffleArray(otherCards, random);
        const distractors = shuffledOthers
            .slice(0, 3)
            .map((c) => stripHtml(c.back_text).trim());

        // Nếu vẫn không đủ 3 phương án nhiễu khác nhau (do nội dung trùng lặp), bổ sung fallback
        while (distractors.length < 3) {
            distractors.push(`Phương án ${distractors.length + 1}`);
        }

        const rawOptions = [
            { text: correctAnswer, isCorrect: true },
            ...distractors.map((d) => ({ text: d, isCorrect: false })),
        ];

        const shuffledOptions = shuffleArray(rawOptions, random);
        const options = shuffledOptions.map((opt, k) => ({
            id: `opt_${k + 1}`,
            text: opt.text,
            isCorrect: opt.isCorrect,
        }));

        return {
            question_type: QuestionTypeEnum.single_choice,
            order_index: orderIndex,
            question_text: sanitizeQuizHtml(card.front_text),
            image_url: card.image_url,
            audio_url: card.audio_url,
            points: 1.0,
            options: options as unknown as Prisma.InputJsonValue,
            sample_answer: null,
            grading_criteria: [] as unknown as Prisma.InputJsonValue,
            explanation: sanitizeQuizHtml(card.back_text),
        };
    }

    /**
     * Chuyển đổi thẻ basic -> câu hỏi đúng/sai true_false
     */
    private convertBasicToTrueFalse(
        card: CardSourceItem,
        orderIndex: number,
        cardPool: CardSourceItem[],
        random = Math.random
    ): QuestionCreatePayload {
        const isTrueBranch = random() < 0.5;
        const frontClean = stripHtml(card.front_text).trim();
        const backClean = stripHtml(card.back_text).trim();

        const otherCards = cardPool.filter((c) => c.id !== card.id);

        if (isTrueBranch || otherCards.length === 0) {
            // Nhánh Đúng: ghép front + back của chính thẻ này
            const statement = `<p><strong>${frontClean}</strong>: ${backClean}</p>`;
            return {
                question_type: QuestionTypeEnum.true_false,
                order_index: orderIndex,
                question_text: sanitizeQuizHtml(statement),
                image_url: card.image_url,
                audio_url: card.audio_url,
                points: 1.0,
                options: [
                    { id: 'true', text: 'Đúng', isCorrect: true },
                    { id: 'false', text: 'Sai', isCorrect: false },
                ] as unknown as Prisma.InputJsonValue,
                sample_answer: null,
                grading_criteria: [] as unknown as Prisma.InputJsonValue,
                explanation: sanitizeQuizHtml(card.back_text),
            };
        }

        // Nhánh Sai: ghép front của thẻ này với back của 1 thẻ khác
        const randomOther = otherCards[Math.floor(random() * otherCards.length)];
        const otherBackClean = stripHtml(randomOther.back_text).trim();
        const statement = `<p><strong>${frontClean}</strong>: ${otherBackClean}</p>`;

        return {
            question_type: QuestionTypeEnum.true_false,
            order_index: orderIndex,
            question_text: sanitizeQuizHtml(statement),
            image_url: card.image_url,
            audio_url: card.audio_url,
            points: 1.0,
            options: [
                { id: 'true', text: 'Đúng', isCorrect: false },
                { id: 'false', text: 'Sai', isCorrect: true },
            ] as unknown as Prisma.InputJsonValue,
            sample_answer: null,
            grading_criteria: [] as unknown as Prisma.InputJsonValue,
            explanation: `<p>Sai. Định nghĩa chính xác là: ${backClean}</p>`,
        };
    }
}
