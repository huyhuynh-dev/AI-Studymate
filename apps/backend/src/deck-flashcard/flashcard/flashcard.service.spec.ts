import { describe, expect, it } from 'vitest';
import { CardStateEnum } from '../../generated/prisma/client.js';
import {
    EASY_BONUS,
    EASY_INTERVAL,
    FlashcardService,
    FlashcardSrsState,
    GRADUATING_INTERVAL,
    LEARNING_STEPS,
    MIN_EASE_FACTOR,
    RELEARNING_STEPS,
    sanitizeFlashcardHtml,
} from './flashcard.service.js';

describe('FlashcardService - SM-2 Algorithm (calculateNextReview)', () => {
    // Khởi tạo instance FlashcardService với mock rỗng (chỉ test pure calculation)
    const service = new FlashcardService(null as any, null as any);
    const now = new Date('2026-11-06T10:00:00Z');

    const baseCard: FlashcardSrsState = {
        state: CardStateEnum.new,
        step_index: 0,
        interval: 0,
        ease_factor: 2.5,
        due_date: now,
        last_reviewed_at: null,
    };

    describe('Trường hợp 1: Thẻ NEW hoặc LEARNING (Học ngắn hạn)', () => {
        it('Rating AGAIN: Quay về bước 0, hẹn sau 1 phút', () => {
            const card: FlashcardSrsState = { ...baseCard, state: CardStateEnum.new };
            const result = service.calculateNextReview(card, 'again', now);

            expect(result.state).toBe(CardStateEnum.learning);
            expect(result.step_index).toBe(0);
            expect(result.due_date.getTime()).toBe(now.getTime() + LEARNING_STEPS[0] * 60 * 1000);
        });

        it('Rating HARD: Lặp lại bước hiện tại', () => {
            const card: FlashcardSrsState = { ...baseCard, state: CardStateEnum.learning, step_index: 0 };
            const result = service.calculateNextReview(card, 'hard', now);

            expect(result.state).toBe(CardStateEnum.learning);
            expect(result.step_index).toBe(0);
            expect(result.due_date.getTime()).toBe(now.getTime() + LEARNING_STEPS[0] * 60 * 1000);
        });

        it('Rating GOOD (bước đầu 0 -> 1): Chuyển lên bước 1 (10 phút)', () => {
            const card: FlashcardSrsState = { ...baseCard, state: CardStateEnum.new, step_index: 0 };
            const result = service.calculateNextReview(card, 'good', now);

            expect(result.state).toBe(CardStateEnum.learning);
            expect(result.step_index).toBe(1);
            expect(result.due_date.getTime()).toBe(now.getTime() + LEARNING_STEPS[1] * 60 * 1000);
        });

        it('Rating GOOD (bước cuối 1 -> hết): Tốt nghiệp sang REVIEW (1 ngày)', () => {
            const card: FlashcardSrsState = { ...baseCard, state: CardStateEnum.learning, step_index: 1 };
            const result = service.calculateNextReview(card, 'good', now);

            expect(result.state).toBe(CardStateEnum.review);
            expect(result.interval).toBe(GRADUATING_INTERVAL);
            const expectedDue = new Date(now);
            expectedDue.setDate(expectedDue.getDate() + GRADUATING_INTERVAL);
            expect(result.due_date.toISOString()).toBe(expectedDue.toISOString());
        });

        it('Rating EASY: Tốt nghiệp ngay lập tức sang REVIEW (4 ngày)', () => {
            const card: FlashcardSrsState = { ...baseCard, state: CardStateEnum.new };
            const result = service.calculateNextReview(card, 'easy', now);

            expect(result.state).toBe(CardStateEnum.review);
            expect(result.interval).toBe(EASY_INTERVAL);
            const expectedDue = new Date(now);
            expectedDue.setDate(expectedDue.getDate() + EASY_INTERVAL);
            expect(result.due_date.toISOString()).toBe(expectedDue.toISOString());
        });
    });

    describe('Trường hợp 2: Thẻ REVIEW (Ôn tập dài hạn)', () => {
        const reviewCard: FlashcardSrsState = {
            state: CardStateEnum.review,
            step_index: 0,
            interval: 10,
            ease_factor: 2.5,
            due_date: now,
            last_reviewed_at: new Date('2026-10-27T10:00:00Z'),
        };

        it('Rating AGAIN: Quên thẻ -> Rơi về RELEARNING, giảm 0.20 ease, interval = 1, hẹn sau 10 phút', () => {
            const result = service.calculateNextReview(reviewCard, 'again', now);

            expect(result.state).toBe(CardStateEnum.relearning);
            expect(result.step_index).toBe(0);
            expect(result.ease_factor).toBe(2.3);
            expect(result.interval).toBe(1);
            expect(result.due_date.getTime()).toBe(now.getTime() + RELEARNING_STEPS[0] * 60 * 1000);
        });

        it('Rating AGAIN không giảm ease_factor dưới 1.3', () => {
            const lowEaseCard: FlashcardSrsState = { ...reviewCard, ease_factor: 1.4 };
            const result = service.calculateNextReview(lowEaseCard, 'again', now);

            expect(result.ease_factor).toBe(MIN_EASE_FACTOR);
        });

        it('Rating HARD: Giảm 0.15 ease, interval * 1.2', () => {
            const result = service.calculateNextReview(reviewCard, 'hard', now);

            expect(result.state).toBe(CardStateEnum.review);
            expect(result.ease_factor).toBe(2.35);
            expect(result.interval).toBe(Math.round(10 * 1.2)); // 12
        });

        it('Rating GOOD: Giữ nguyên ease, interval * ease_factor', () => {
            const result = service.calculateNextReview(reviewCard, 'good', now);

            expect(result.state).toBe(CardStateEnum.review);
            expect(result.ease_factor).toBe(2.5);
            expect(result.interval).toBe(Math.round(10 * 2.5)); // 25
        });

        it('Rating GOOD với Late Review: Cộng nửa số ngày trễ vào interval trước khi nhân EF', () => {
            // Thẻ đến hạn từ 10 ngày trước (due_date = now - 10 ngày) -> delay = 10 ngày
            const lateDue = new Date(now);
            lateDue.setDate(lateDue.getDate() - 10);

            const lateCard: FlashcardSrsState = { ...reviewCard, due_date: lateDue, interval: 10, ease_factor: 2.0 };
            const result = service.calculateNextReview(lateCard, 'good', now);

            // delay = 10 ngày, delay / 2 = 5
            // effectiveInterval = 10 + 5 = 15
            // interval mới = 15 * 2.0 = 30
            expect(result.interval).toBe(30);
        });

        it('Rating EASY: Tăng 0.15 ease, interval * ease * EASY_BONUS', () => {
            const result = service.calculateNextReview(reviewCard, 'easy', now);

            expect(result.state).toBe(CardStateEnum.review);
            expect(result.ease_factor).toBe(2.65);
            // interval mới = round(10 * 2.65 * 1.3) = round(34.45) = 34
            expect(result.interval).toBe(Math.round(10 * 2.65 * EASY_BONUS));
        });
    });

    describe('Trường hợp 3: Thẻ RELEARNING (Học lại khi quên)', () => {
        const relearningCard: FlashcardSrsState = {
            state: CardStateEnum.relearning,
            step_index: 0,
            interval: 1,
            ease_factor: 2.3,
            due_date: now,
            last_reviewed_at: now,
        };

        it('Rating AGAIN: Đặt lại step 0, hẹn sau 10 phút', () => {
            const result = service.calculateNextReview(relearningCard, 'again', now);

            expect(result.state).toBe(CardStateEnum.relearning);
            expect(result.step_index).toBe(0);
            expect(result.due_date.getTime()).toBe(now.getTime() + RELEARNING_STEPS[0] * 60 * 1000);
        });

        it('Rating GOOD: Hoàn thành bước relearning -> Trở về REVIEW với interval 1 ngày', () => {
            const result = service.calculateNextReview(relearningCard, 'good', now);

            expect(result.state).toBe(CardStateEnum.review);
            const expectedDue = new Date(now);
            expectedDue.setDate(expectedDue.getDate() + 1);
            expect(result.due_date.toISOString()).toBe(expectedDue.toISOString());
        });

        it('Rating EASY: Trở về REVIEW và tăng interval thêm 1 ngày', () => {
            const result = service.calculateNextReview(relearningCard, 'easy', now);

            expect(result.state).toBe(CardStateEnum.review);
            expect(result.interval).toBe(2);
            const expectedDue = new Date(now);
            expectedDue.setDate(expectedDue.getDate() + 2);
            expect(result.due_date.toISOString()).toBe(expectedDue.toISOString());
        });
    });

    describe('HTML Sanitizer (sanitizeFlashcardHtml)', () => {
        it('Giữ nguyên các thẻ allowlist và loại bỏ script/onclick nguy hiểm', () => {
            const dirty =
                '<p onclick="evil()">Xin chào <strong>thế giới</strong><script>alert(1)</script></p>';
            expect(sanitizeFlashcardHtml(dirty, false)).toBe('<p>Xin chào <strong>thế giới</strong></p>');
        });

        it('Cho phép <span data-cloze="true"> khi allowCloze = true và loại bỏ các span khác', () => {
            const input =
                '<p>Năm <span data-cloze="true" class="hack"><strong>1945</strong></span>, <span style="color:red">Việt Nam</span> độc lập</p>';
            expect(sanitizeFlashcardHtml(input, true)).toBe(
                '<p>Năm <span data-cloze="true"><strong>1945</strong></span>, Việt Nam độc lập</p>'
            );
        });

        it('Gỡ thẻ <span data-cloze="true"> nhưng giữ nội dung bên trong khi allowCloze = false', () => {
            const input = '<p>Năm <span data-cloze="true">1945</span></p>';
            expect(sanitizeFlashcardHtml(input, false)).toBe('<p>Năm 1945</p>');
        });
    });
});
