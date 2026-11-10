import {
  convertCardsToQuestions,
  extractClozeGap,
  unwrapAllCloze,
  shuffleArray,
  CardSourceItem,
} from '../apps/backend/src/quiz/deck-to-quiz.service.js';
import { CardTypeEnum, QuestionTypeEnum } from '../apps/backend/src/generated/prisma/client.js';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`PASS: ${msg}`);
  }
}

async function runTests() {
  console.log('=== BẮT ĐẦU TEST CHUYỂN ĐỔI RULE-BASED FLASHCARD -> QUIZ ===');

  // Test 1: extractClozeGap với HTML span data-cloze
  const clozeHtml = '<p>Thủ đô của Việt Nam là <span data-cloze="true">Hà Nội</span>, một thành phố ngàn năm văn hiến.</p>';
  const resHtml = extractClozeGap(clozeHtml);
  assert(resHtml.extractedKeywords.includes('Hà Nội'), 'Cloze trích xuất đúng từ khóa Hà Nội');
  assert(resHtml.questionText.includes('[......]'), 'Cloze thay thế chỗ trống bằng [......]');
  assert(!resHtml.questionText.includes('data-cloze'), 'Cloze làm sạch thẻ HTML span');

  // Test 2: extractClozeGap với định dạng {{c1::keyword}}
  const clozeLegacy = 'Quang hợp diễn ra tại {{c1::lục lạp}} trong tế bào thực vật.';
  const resLegacy = extractClozeGap(clozeLegacy);
  assert(resLegacy.extractedKeywords.includes('lục lạp'), 'Cloze trích xuất đúng {{c1::lục lạp}}');
  assert(resLegacy.questionText.includes('[......]'), 'Cloze thay thế {{...}} bằng [......]');

  // Test 3: Thẻ type_in -> short_answer
  const typeInCard: CardSourceItem = {
    id: 'c1',
    card_type: CardTypeEnum.type_in,
    front_text: 'HTTP là viết tắt của từ gì?',
    back_text: 'Hypertext Transfer Protocol',
    image_url: null,
    audio_url: null,
  };

  const sampleDeck: CardSourceItem[] = [
    typeInCard,
    {
      id: 'c2',
      card_type: CardTypeEnum.cloze,
      front_text: '<p>Tế bào động vật không có <span data-cloze="true">thành tế bào</span>.</p>',
      back_text: 'Thành tế bào chỉ có ở thực vật và nấm.',
      image_url: null,
      audio_url: null,
    },
    {
      id: 'c3',
      card_type: CardTypeEnum.basic,
      front_text: 'Khái niệm Đa hình (Polymorphism)',
      back_text: 'Khả năng cho phép các đối tượng thuộc các lớp khác nhau phản hồi cùng một thông điệp theo các cách khác nhau.',
      image_url: null,
      audio_url: null,
    },
    {
      id: 'c4',
      card_type: CardTypeEnum.basic,
      front_text: 'Khái niệm Kế thừa (Inheritance)',
      back_text: 'Cơ chế cho phép một lớp con tái sử dụng các thuộc tính và phương thức của lớp cha.',
      image_url: null,
      audio_url: null,
    },
    {
      id: 'c5',
      card_type: CardTypeEnum.basic,
      front_text: 'Khái niệm Đóng gói (Encapsulation)',
      back_text: 'Che giấu trạng thái nội bộ của đối tượng và chỉ cho phép tương tác qua các phương thức công khai.',
      image_url: null,
      audio_url: null,
    },
    {
      id: 'c6',
      card_type: CardTypeEnum.basic,
      front_text: 'Khái niệm Trừu tượng (Abstraction)',
      back_text: 'Tập trung vào các đặc tính cốt lõi của đối tượng, bỏ qua các chi tiết triển khai cụ thể.',
      image_url: null,
      audio_url: null,
    },
  ];

  // Test 4: Chuyển đổi toàn bộ deck (6 thẻ)
  const convertedAll = convertCardsToQuestions(sampleDeck, {
    questionCount: 6,
    types: [QuestionTypeEnum.single_choice, QuestionTypeEnum.true_false, QuestionTypeEnum.short_answer],
  });

  assert(convertedAll.length === 6, `Đã chuyển đổi đủ ${convertedAll.length}/6 câu hỏi`);

  // Kiểm tra câu hỏi type_in
  const qTypeIn = convertedAll.find(q => q.text.includes('HTTP là viết tắt'));
  assert(!!qTypeIn, 'Tìm thấy câu hỏi type_in');
  assert(qTypeIn?.type === QuestionTypeEnum.short_answer, 'type_in chuyển thành short_answer');
  assert(qTypeIn?.sampleAnswer === 'Hypertext Transfer Protocol', 'sampleAnswer của type_in chính xác');

  // Kiểm tra câu hỏi cloze
  const qCloze = convertedAll.find(q => q.text.includes('Tế bào động vật'));
  assert(!!qCloze, 'Tìm thấy câu hỏi cloze');
  assert(qCloze?.type === QuestionTypeEnum.short_answer, 'cloze chuyển thành short_answer');
  assert(qCloze?.sampleAnswer === 'thành tế bào', 'sampleAnswer của cloze chính xác');
  assert(qCloze?.text.includes('[......]'), 'text của cloze có chứa chỗ trống');

  // Kiểm tra câu hỏi basic (vì có 4 thẻ basic c3, c4, c5, c6 nên có câu single_choice với 4 phương án)
  const qSingleChoice = convertedAll.find(q => q.type === QuestionTypeEnum.single_choice);
  assert(!!qSingleChoice, 'Sinh thành công câu hỏi single_choice từ thẻ basic khi N_basic >= 4');
  assert(qSingleChoice?.options?.length === 4, 'single_choice có đúng 4 phương án lựa chọn');
  const correctOptions = qSingleChoice?.options?.filter(o => o.isCorrect);
  assert(correctOptions?.length === 1, 'single_choice có chính xác 1 phương án đúng');

  // Test 5: Khi N_basic < 4 (chỉ có 2 thẻ basic)
  const smallDeck: CardSourceItem[] = [
    {
      id: 'b1',
      card_type: CardTypeEnum.basic,
      front_text: 'Ngôn ngữ TypeScript',
      back_text: 'Tập cha có kiểu tĩnh nghiêm ngặt của JavaScript.',
      image_url: null,
      audio_url: null,
    },
    {
      id: 'b2',
      card_type: CardTypeEnum.basic,
      front_text: 'Ngôn ngữ Rust',
      back_text: 'Ngôn ngữ lập trình hệ thống an toàn bộ nhớ không cần GC.',
      image_url: null,
      audio_url: null,
    },
  ];

  const convertedSmall = convertCardsToQuestions(smallDeck, {
    questionCount: 2,
    types: [QuestionTypeEnum.single_choice, QuestionTypeEnum.true_false],
  });

  assert(convertedSmall.length === 2, 'Deck 2 thẻ basic chuyển đổi thành công 2 câu hỏi');
  assert(
    convertedSmall.every(q => q.type === QuestionTypeEnum.true_false),
    'Khi N_basic < 4, tự động fallback an toàn 100% sang true_false'
  );
  assert(
    convertedSmall.every(q => q.options?.length === 2),
    'Mỗi câu true_false có 2 options Đúng / Sai'
  );

  console.log('=== TẤT CẢ TEST ĐÃ HOÀN THÀNH XUẤT SẮC ===');
}

runTests().catch(err => {
  console.error('Lỗi khi chạy test:', err);
  process.exit(1);
});
