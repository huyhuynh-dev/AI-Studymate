import { describe, it, expect } from 'vitest';
import {
  DeckToQuizService,
  extractClozeGap,
  CardSourceItem,
} from '../apps/backend/src/quiz/deck-to-quiz.service.js';
import { CardTypeEnum, QuestionTypeEnum } from '../apps/backend/src/generated/prisma/enums.js';

describe('Chuyển đổi Rule-based Flashcard sang Quiz (FromFlashcard2Deck)', () => {
  const service = new DeckToQuizService(null as any, null as any);

  it('Cloze HTML <span data-cloze="true"> trích xuất chính xác từ khóa và tạo chỗ trống [......]', () => {
    const clozeHtml = '<p>Thủ đô của Việt Nam là <span data-cloze="true">Hà Nội</span>, thành phố ngàn năm văn hiến.</p>';
    const res = extractClozeGap(clozeHtml);
    expect(res.answerText).toBe('Hà Nội');
    expect(res.questionText).toContain('[......]');
    expect(res.questionText).not.toContain('data-cloze');
  });

  it('Cloze legacy {{c1::keyword}} trích xuất chính xác từ khóa', () => {
    const clozeLegacy = 'Quang hợp diễn ra tại {{c1::lục lạp}} trong tế bào thực vật.';
    const res = extractClozeGap(clozeLegacy);
    expect(res.answerText).toBe('lục lạp');
    expect(res.questionText).toContain('[......]');
  });

  it('Chuyển đổi thẻ type_in sang short_answer nguyên vẹn 1-1', () => {
    const cards: CardSourceItem[] = [
      {
        id: 'c1',
        card_type: CardTypeEnum.type_in,
        front_text: 'HTTP là viết tắt của từ gì?',
        back_text: 'Hypertext Transfer Protocol',
        image_url: null,
        audio_url: null,
      },
    ];
    const questions = service.convertCardsToQuestions(cards, 1, [QuestionTypeEnum.short_answer]);
    expect(questions.length).toBe(1);
    expect(questions[0].question_type).toBe(QuestionTypeEnum.short_answer);
    expect(questions[0].question_text).toBe('HTTP là viết tắt của từ gì?');
    expect(questions[0].sample_answer).toBe('Hypertext Transfer Protocol');
    expect(questions[0].points).toBe(1.0);
  });

  it('Chuyển đổi thẻ cloze sang short_answer với từ khóa làm sample_answer', () => {
    const cards: CardSourceItem[] = [
      {
        id: 'c2',
        card_type: CardTypeEnum.cloze,
        front_text: '<p>Tế bào động vật không có <span data-cloze="true">thành tế bào</span>.</p>',
        back_text: 'Thành tế bào chỉ có ở thực vật và nấm.',
        image_url: null,
        audio_url: null,
      },
    ];
    const questions = service.convertCardsToQuestions(cards, 1, [QuestionTypeEnum.short_answer]);
    expect(questions.length).toBe(1);
    expect(questions[0].question_type).toBe(QuestionTypeEnum.short_answer);
    expect(questions[0].question_text).toContain('[......]');
    expect(questions[0].sample_answer).toBe('thành tế bào');
    expect(questions[0].explanation).toBe('Thành tế bào chỉ có ở thực vật và nấm.');
  });

  it('Chuyển đổi thẻ basic khi N_basic >= 4 tạo single_choice với 4 lựa chọn (1 đúng + 3 sai)', () => {
    const cards: CardSourceItem[] = [
      { id: 'b1', card_type: CardTypeEnum.basic, front_text: 'Đa hình (Polymorphism)', back_text: 'Nhiều hình thái', image_url: null, audio_url: null },
      { id: 'b2', card_type: CardTypeEnum.basic, front_text: 'Kế thừa (Inheritance)', back_text: 'Tái sử dụng lớp cha', image_url: null, audio_url: null },
      { id: 'b3', card_type: CardTypeEnum.basic, front_text: 'Đóng gói (Encapsulation)', back_text: 'Che giấu trạng thái', image_url: null, audio_url: null },
      { id: 'b4', card_type: CardTypeEnum.basic, front_text: 'Trừu tượng (Abstraction)', back_text: 'Ẩn chi tiết phức tạp', image_url: null, audio_url: null },
    ];
    const questions = service.convertCardsToQuestions(cards, 4, [QuestionTypeEnum.single_choice]);
    expect(questions.length).toBe(4);
    for (const q of questions) {
      expect(q.question_type).toBe(QuestionTypeEnum.single_choice);
      const opts = q.options as any[];
      expect(opts?.length).toBe(4);
      const correct = opts?.filter(o => o.isCorrect);
      expect(correct?.length).toBe(1);
    }
  });

  it('Chuyển đổi thẻ basic khi N_basic < 4 fallback an toàn sang true_false', () => {
    const cards: CardSourceItem[] = [
      { id: 'b1', card_type: CardTypeEnum.basic, front_text: 'TypeScript', back_text: 'Ngôn ngữ có kiểu tĩnh của JS', image_url: null, audio_url: null },
      { id: 'b2', card_type: CardTypeEnum.basic, front_text: 'Rust', back_text: 'Ngôn ngữ an toàn bộ nhớ', image_url: null, audio_url: null },
    ];
    const questions = service.convertCardsToQuestions(cards, 2, [
      QuestionTypeEnum.single_choice,
      QuestionTypeEnum.true_false,
    ]);
    expect(questions.length).toBe(2);
    for (const q of questions) {
      expect(q.question_type).toBe(QuestionTypeEnum.true_false);
      const opts = q.options as any[];
      expect(opts?.length).toBe(2);
      const correct = opts?.filter(o => o.isCorrect);
      expect(correct?.length).toBe(1);
    }
  });
});
