import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CardStateEnum, CardTypeEnum, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { DeckFlashcardRepoService } from '../../repo/deck-flashcard-repo/deck-flashcard-repo.service.js';
import { CreateFlashcardDto, ReviewRating, UpdateFlashcardDto } from '../dto/flashcard.dto.js';

export const LEARNING_STEPS = [1, 10]; // Bước học thẻ mới (phút)
export const RELEARNING_STEPS = [10]; // Bước học lại khi quên (phút)
export const GRADUATING_INTERVAL = 1; // Ngày tốt nghiệp sang REVIEW
export const EASY_INTERVAL = 4; // Ngày hẹn khi bấm Easy lúc mới học
export const MIN_EASE_FACTOR = 1.3; // Hệ số dễ tối thiểu
export const EASY_BONUS = 1.3; // Hệ số thưởng Easy

export type NormalizedRating = 'again' | 'hard' | 'good' | 'easy';

export interface FlashcardSrsState {
    state: CardStateEnum;
    step_index: number;
    interval: number;
    ease_factor: number;
    due_date: Date;
    last_reviewed_at?: Date | null;
}

export interface CalculatedSrsResult {
    state: CardStateEnum;
    step_index: number;
    interval: number;
    ease_factor: number;
    due_date: Date;
    last_reviewed_at: Date;
}

const addMinutes = (date: Date, minutes: number): Date => {
    return new Date(date.getTime() + minutes * 60 * 1000);
};

const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

const differenceInDays = (d1: Date, d2: Date): number => {
    const ms = d1.getTime() - d2.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
};

@Injectable()
export class FlashcardService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly deckRepo: DeckFlashcardRepoService
    ) {}

    /* ==========================================================
     * CÁC THAO TÁC CRUD FLASHCARD
     * ========================================================== */

    async createFlashcard(
        userId: string,
        dto: CreateFlashcardDto
    ): Promise<Prisma.FlashcardModel> {
        return await this.deckRepo.createFlashcard(
            {
                deck_id: dto.deckId,
                front_text: dto.frontText.trim(),
                back_text: dto.backText.trim(),
                card_type: dto.cardType || CardTypeEnum.basic,
                image_url: dto.imageUrl?.trim() || null,
                audio_url: dto.audioUrl?.trim() || null,
                state: CardStateEnum.new,
                step_index: 0,
                interval: 0,
                ease_factor: 2.5,
                due_date: new Date(),
            },
            userId
        );
    }

    async getFlashcardsByDeckId(
        deckId: string,
        userId: string
    ): Promise<Prisma.FlashcardModel[]> {
        return await this.deckRepo.getAllFlashcardsByDeckId(deckId, userId);
    }

    async getFlashcardById(
        flashcardId: string,
        userId: string
    ): Promise<Prisma.FlashcardModel> {
        const card = await this.deckRepo.getFlashcardById(flashcardId, userId);
        if (!card) {
            throw new NotFoundException('Không tìm thấy thẻ ghi nhớ hoặc bạn không có quyền truy cập');
        }
        return card;
    }

    async updateFlashcard(
        flashcardId: string,
        userId: string,
        dto: UpdateFlashcardDto
    ): Promise<Prisma.FlashcardModel> {
        return await this.deckRepo.updateFlashcard(flashcardId, userId, {
            ...(dto.frontText !== undefined && { front_text: dto.frontText.trim() }),
            ...(dto.backText !== undefined && { back_text: dto.backText.trim() }),
            ...(dto.cardType !== undefined && { card_type: dto.cardType }),
            ...(dto.imageUrl !== undefined && { image_url: dto.imageUrl?.trim() || null }),
            ...(dto.audioUrl !== undefined && { audio_url: dto.audioUrl?.trim() || null }),
        });
    }

    async deleteFlashcard(
        flashcardId: string,
        userId: string
    ): Promise<{ success: boolean; message: string }> {
        await this.deckRepo.deleteFlashcard(flashcardId, userId);
        return {
            success: true,
            message: 'Xóa thẻ ghi nhớ thành công',
        };
    }

    /* ==========================================================
     * THUẬT TOÁN SM-2 (SUPERMEMO 2 - BIẾN THỂ ANKI) - 3 HÀM
     * ========================================================== */

    /**
     * HÀM 1: HÀM ĐIỀU PHỐI (ORCHESTRATOR)
     * Xác thực người dùng, trích xuất trạng thái thẻ, điều phối tính toán và lưu DB.
     */
    async reviewFlashcard(
        cardId: string,
        userId: string,
        ratingInput: ReviewRating | string | number
    ): Promise<Prisma.FlashcardModel> {
        const rating = this.normalizeRating(ratingInput);

        // Lấy thẻ và đảm bảo quyền sở hữu của user đối với deck
        const card = await this.prisma.flashcard.findFirst({
            where: {
                id: cardId,
                deck: {
                    user_id: userId,
                },
            },
        });

        if (!card) {
            throw new NotFoundException('Không tìm thấy thẻ ghi nhớ hoặc bạn không có quyền truy cập');
        }

        const now = new Date();

        // Bước 1: Tính toán thông số SRS mới thông qua Hàm 2
        const calculated = this.calculateNextReview(
            {
                state: card.state,
                step_index: card.step_index,
                interval: card.interval,
                ease_factor: card.ease_factor,
                due_date: card.due_date,
                last_reviewed_at: card.last_reviewed_at,
            },
            rating,
            now
        );

        // Bước 2: Lưu kết quả xuống Database thông qua Hàm 3
        return await this.saveSrsReview(cardId, calculated);
    }

    /**
     * HÀM 2: HÀM TÍNH TOÁN THUẦN TÚY (PURE CALCULATION)
     * Nhận vào trạng thái hiện tại, đánh giá của người dùng và thời điểm hiện tại.
     * Tính toán khoảng cách ngày/phút, hệ số dễ và ngày ôn tập tiếp theo theo SM-2 Anki.
     */
    calculateNextReview(
        card: FlashcardSrsState,
        rating: NormalizedRating,
        now: Date
    ): CalculatedSrsResult {
        let state = card.state;
        let step_index = card.step_index;
        let interval = card.interval;
        let ease_factor = card.ease_factor;
        let due_date = new Date(now);

        // TRƯỜNG HỢP 1: THẺ MỚI (NEW) HOẶC ĐANG HỌC NGẮN HẠN (LEARNING)
        if (state === CardStateEnum.new || state === CardStateEnum.learning) {
            state = CardStateEnum.learning;

            if (rating === 'again') {
                step_index = 0;
                due_date = addMinutes(now, LEARNING_STEPS[0]);
            } else if (rating === 'hard') {
                const step = Math.min(step_index, LEARNING_STEPS.length - 1);
                due_date = addMinutes(now, LEARNING_STEPS[step]);
            } else if (rating === 'good') {
                step_index = step_index + 1;
                if (step_index < LEARNING_STEPS.length) {
                    due_date = addMinutes(now, LEARNING_STEPS[step_index]);
                } else {
                    // Đã hoàn thành hết các bước -> Tốt nghiệp sang REVIEW
                    state = CardStateEnum.review;
                    interval = GRADUATING_INTERVAL;
                    due_date = addDays(now, interval);
                }
            } else if (rating === 'easy') {
                // Tốt nghiệp ngay lập tức với khoảng cách xa
                state = CardStateEnum.review;
                interval = EASY_INTERVAL;
                due_date = addDays(now, interval);
            }
        }
        // TRƯỜNG HỢP 2: THẺ ĐANG ÔN TẬP DÀI HẠN (REVIEW)
        else if (state === CardStateEnum.review) {
            const delayDays = Math.max(0, differenceInDays(now, card.due_date));

            if (rating === 'again') {
                state = CardStateEnum.relearning;
                step_index = 0;
                ease_factor = Math.max(MIN_EASE_FACTOR, Number((ease_factor - 0.20).toFixed(2)));
                interval = 1;
                due_date = addMinutes(now, RELEARNING_STEPS[0]);
            } else if (rating === 'hard') {
                ease_factor = Math.max(MIN_EASE_FACTOR, Number((ease_factor - 0.15).toFixed(2)));
                interval = Math.max(interval + 1, Math.round(interval * 1.2));
                due_date = addDays(now, interval);
            } else if (rating === 'good') {
                const effectiveInterval = interval + Math.floor(delayDays / 2);
                interval = Math.max(interval + 1, Math.round(effectiveInterval * ease_factor));
                due_date = addDays(now, interval);
            } else if (rating === 'easy') {
                ease_factor = Number((ease_factor + 0.15).toFixed(2));
                interval = Math.max(interval + 1, Math.round(interval * ease_factor * EASY_BONUS));
                due_date = addDays(now, interval);
            }
        }
        // TRƯỜNG HỢP 3: THẺ ĐANG HỌC LẠI DO QUÊN (RELEARNING)
        else if (state === CardStateEnum.relearning) {
            if (rating === 'again') {
                step_index = 0;
                due_date = addMinutes(now, RELEARNING_STEPS[0]);
            } else if (rating === 'hard') {
                const step = Math.min(step_index, RELEARNING_STEPS.length - 1);
                due_date = addMinutes(now, RELEARNING_STEPS[step]);
            } else if (rating === 'good') {
                step_index = step_index + 1;
                if (step_index < RELEARNING_STEPS.length) {
                    due_date = addMinutes(now, RELEARNING_STEPS[step_index]);
                } else {
                    // Hoàn thành relearning -> Quay về REVIEW
                    state = CardStateEnum.review;
                    due_date = addDays(now, interval);
                }
            } else if (rating === 'easy') {
                state = CardStateEnum.review;
                interval = interval + 1;
                due_date = addDays(now, interval);
            }
        }

        return {
            state,
            step_index,
            interval,
            ease_factor,
            due_date,
            last_reviewed_at: now,
        };
    }

    /**
     * HÀM 3: HÀM CẬP NHẬT DATABASE QUA PRISMA (DB PERSISTENCE)
     * Lưu trữ trực tiếp kết quả tính toán SRS vào cơ sở dữ liệu.
     */
    async saveSrsReview(
        cardId: string,
        result: CalculatedSrsResult
    ): Promise<Prisma.FlashcardModel> {
        return await this.prisma.flashcard.update({
            where: { id: cardId },
            data: {
                state: result.state,
                step_index: result.step_index,
                interval: result.interval,
                ease_factor: result.ease_factor,
                due_date: result.due_date,
                last_reviewed_at: result.last_reviewed_at,
            },
        });
    }

    private normalizeRating(ratingInput: ReviewRating | string | number): NormalizedRating {
        const val = typeof ratingInput === 'string' ? ratingInput.toLowerCase().trim() : ratingInput;

        if (val === 1 || val === '1' || val === 'again') return 'again';
        if (val === 2 || val === '2' || val === 'hard') return 'hard';
        if (val === 3 || val === '3' || val === 'good') return 'good';
        if (val === 4 || val === '4' || val === 'easy') return 'easy';

        throw new BadRequestException(
            `Đánh giá (rating) không hợp lệ: "${ratingInput}". Hợp lệ: 1 (again), 2 (hard), 3 (good), 4 (easy)`
        );
    }
}
