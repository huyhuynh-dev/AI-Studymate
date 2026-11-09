import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {
    CardStateEnum,
    CardTypeEnum,
    QuestionTypeEnum,
} from '../generated/prisma/client.js';
import { DeckFlashcardRepoService } from '../repo/deck-flashcard-repo/deck-flashcard-repo.service.js';
import { QuizRepoService } from '../repo/quiz-repo/quiz-repo.service.js';
import { ConvertToFlashcardsDto } from './dto/quiz.dto.js';
import {
    parseGradingCriteria,
    parseQuizOptions,
    stripHtml,
} from './quiz.helper.js';

export interface ConvertedFlashcardItem {
    card_type: CardTypeEnum;
    front_text: string;
    back_text: string;
    image_url: string | null;
    audio_url: string | null;
    state: CardStateEnum;
}

@Injectable()
export class QuizToFlashcardService {
    private readonly logger = new Logger(QuizToFlashcardService.name);

    constructor(
        private readonly quizRepo: QuizRepoService,
        private readonly deckRepo: DeckFlashcardRepoService
    ) {}

    /**
     * Chuyển đổi các câu hỏi trong một lượt làm bài (QuizAttempt) thành thẻ Flashcard
     * theo chiến lược Rule-based (không dùng LLM) để ôn tập ngắt quãng.
     */
    async convertToFlashcards(
        userId: string,
        attemptId: string,
        dto: ConvertToFlashcardsDto
    ): Promise<{ deckId: string; created: number }> {
        const startTime = Date.now();
        this.logger.log(
            `[convertToFlashcards] User ${userId} yêu cầu chuyển ${dto.questionIds?.length || 0} câu hỏi từ attempt ${attemptId} sang Flashcard`
        );

        if (!dto.questionIds || dto.questionIds.length === 0) {
            throw new BadRequestException(
                'Cần chọn ít nhất 1 câu hỏi để chuyển thành Flashcard'
            );
        }

        const attempt = await this.quizRepo.getAttemptByIdWithDetails(
            attemptId,
            userId
        );

        const targetQuestions = attempt.quiz.questions.filter((q) =>
            dto.questionIds.includes(q.id)
        );

        if (targetQuestions.length === 0) {
            throw new BadRequestException(
                'Không tìm thấy câu hỏi hợp lệ nào trong đề kiểm tra để chuyển đổi'
            );
        }

        // Xác định bộ thẻ đích (có sẵn hoặc tạo mới)
        let targetDeckId: string;

        if (dto.target.deckId) {
            const existingDeck = await this.deckRepo.getDeckById(
                dto.target.deckId,
                userId
            );
            if (!existingDeck) {
                throw new NotFoundException(
                    'Không tìm thấy bộ thẻ được chọn hoặc bạn không có quyền truy cập'
                );
            }
            targetDeckId = existingDeck.id;
            this.logger.log(
                `[convertToFlashcards] Sử dụng bộ thẻ có sẵn: "${existingDeck.name}" (${targetDeckId})`
            );
        } else if (dto.target.newDeckName && dto.target.newDeckName.trim()) {
            const newDeck = await this.deckRepo.createDeck({
                user_id: userId,
                conversation_id: attempt.quiz.conversation_id,
                name: dto.target.newDeckName.trim(),
                description: `Được tạo tự động từ bài kiểm tra: ${attempt.quiz.title}`,
            });
            targetDeckId = newDeck.id;
            this.logger.log(
                `[convertToFlashcards] Đã tạo bộ thẻ mới: "${newDeck.name}" (${targetDeckId}) cho cuộc hội thoại ${attempt.quiz.conversation_id}`
            );
        } else {
            throw new BadRequestException(
                'Vui lòng chọn một bộ thẻ có sẵn hoặc nhập tên cho bộ thẻ mới'
            );
        }

        // Ánh xạ từng câu hỏi sang Flashcard theo quy tắc Rule-based
        const flashcards: ConvertedFlashcardItem[] = targetQuestions.map((q) =>
            this.mapQuestionToFlashcard(q)
        );

        // Lưu hàng loạt vào CSDL
        const createdCount = await this.deckRepo.createManyFlashcards(
            targetDeckId,
            flashcards
        );

        const duration = Date.now() - startTime;
        this.logger.log(
            `[convertToFlashcards] Đã chuyển đổi và lưu thành công ${createdCount} thẻ Flashcard vào bộ thẻ ${targetDeckId} trong ${duration}ms`
        );

        return {
            deckId: targetDeckId,
            created: createdCount,
        };
    }

    /**
     * Quy tắc Rule-based ánh xạ 5 dạng câu hỏi Quiz sang Flashcard
     */
    mapQuestionToFlashcard(question: {
        question_type: QuestionTypeEnum;
        question_text: string;
        options: any;
        sample_answer: string | null;
        grading_criteria: any;
        explanation: string | null;
        image_url: string | null;
        audio_url: string | null;
    }): ConvertedFlashcardItem {
        const imageUrl = question.image_url ?? null;
        const audioUrl = question.audio_url ?? null;
        const explanationHtml =
            question.explanation && stripHtml(question.explanation)
                ? `<p><strong>Giải thích:</strong> ${question.explanation}</p>`
                : '';

        switch (question.question_type) {
            case QuestionTypeEnum.single_choice: {
                const options = parseQuizOptions(question.options) ?? [];
                const correct = options.find((o) => o.isCorrect);
                const answerText = correct ? correct.text : '';
                const backText = `<p><strong>Đáp án đúng:</strong> ${answerText}</p>${explanationHtml}`;

                return {
                    card_type: CardTypeEnum.basic,
                    front_text: question.question_text,
                    back_text: backText,
                    image_url: imageUrl,
                    audio_url: audioUrl,
                    state: CardStateEnum.new,
                };
            }

            case QuestionTypeEnum.true_false: {
                const options = parseQuizOptions(question.options) ?? [];
                const correct = options.find((o) => o.isCorrect);
                const isTrue =
                    correct?.id === 'true' ||
                    correct?.text.toLowerCase().includes('đúng') ||
                    correct?.text.toLowerCase() === 'true';
                const resultText = isTrue ? 'ĐÚNG' : 'SAI';
                const backText = `<p><strong>Đáp án:</strong> ${resultText}</p>${explanationHtml}`;

                return {
                    card_type: CardTypeEnum.basic,
                    front_text: question.question_text,
                    back_text: backText,
                    image_url: imageUrl,
                    audio_url: audioUrl,
                    state: CardStateEnum.new,
                };
            }

            case QuestionTypeEnum.multiple_choice: {
                const options = parseQuizOptions(question.options) ?? [];
                const correctOptions = options.filter((o) => o.isCorrect);
                const listItems =
                    correctOptions.length > 0
                        ? `<ul>${correctOptions.map((o) => `<li><p>${o.text}</p></li>`).join('')}</ul>`
                        : '<p>Không có đáp án</p>';
                const backText = `<p><strong>Các đáp án đúng:</strong></p>${listItems}${explanationHtml}`;

                return {
                    card_type: CardTypeEnum.basic,
                    front_text: question.question_text,
                    back_text: backText,
                    image_url: imageUrl,
                    audio_url: audioUrl,
                    state: CardStateEnum.new,
                };
            }

            case QuestionTypeEnum.short_answer: {
                const primaryAnswer = (question.sample_answer ?? '')
                    .split('|')[0]
                    .trim();

                // Kiểm tra xem câu hỏi có chứa định dạng chỗ trống [......], [...], hoặc ____ không
                const gapRegex =
                    /\[\s*\.{3,}\s*\]|\[\s*_{3,}\s*\]|_{3,}|\[\s*\.\.\.\s*\]/;

                if (gapRegex.test(question.question_text)) {
                    // Chuyển thành thẻ cloze
                    const frontWithCloze = question.question_text.replace(
                        gapRegex,
                        `<span data-cloze="true">${primaryAnswer}</span>`
                    );
                    const backText = explanationHtml || `<p>Từ khóa: <strong>${primaryAnswer}</strong></p>`;

                    return {
                        card_type: CardTypeEnum.cloze,
                        front_text: frontWithCloze,
                        back_text: backText,
                        image_url: imageUrl,
                        audio_url: audioUrl,
                        state: CardStateEnum.new,
                    };
                }

                // Mặc định chuyển thành thẻ type_in
                const backText = `<p>${primaryAnswer}</p>${explanationHtml}`;
                return {
                    card_type: CardTypeEnum.type_in,
                    front_text: question.question_text,
                    back_text: backText,
                    image_url: imageUrl,
                    audio_url: audioUrl,
                    state: CardStateEnum.new,
                };
            }

            case QuestionTypeEnum.essay: {
                const criteria = parseGradingCriteria(
                    question.grading_criteria
                );
                let backContent = '';

                if (
                    question.sample_answer &&
                    stripHtml(question.sample_answer)
                ) {
                    backContent += `<p><strong>Bài làm mẫu:</strong></p>${question.sample_answer}`;
                }

                if (criteria.length > 0) {
                    backContent += `<p><strong>Tiêu chí đánh giá:</strong></p><ul>${criteria
                        .map((c) => `<li><p>${c}</p></li>`)
                        .join('')}</ul>`;
                }

                if (explanationHtml) {
                    backContent += explanationHtml;
                }

                if (!backContent) {
                    backContent = '<p>Tự luận</p>';
                }

                return {
                    card_type: CardTypeEnum.basic,
                    front_text: question.question_text,
                    back_text: backContent,
                    image_url: imageUrl,
                    audio_url: audioUrl,
                    state: CardStateEnum.new,
                };
            }

            default:
                return {
                    card_type: CardTypeEnum.basic,
                    front_text: question.question_text,
                    back_text: explanationHtml || '<p>Đáp án</p>',
                    image_url: imageUrl,
                    audio_url: audioUrl,
                    state: CardStateEnum.new,
                };
        }
    }
}
