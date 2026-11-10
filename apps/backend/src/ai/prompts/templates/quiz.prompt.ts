import type { AIQuestionType } from '../../schemas/quiz-ai.schema.js';
import type { PromptPayloadMap, PromptTemplate, QuizDifficulty } from '../types.js';

export type { QuizDifficulty };

export const QUIZ_DIFFICULTY = {
  basic: 'Cơ bản: nhớ và hiểu định nghĩa, khái niệm.',
  applied: 'Vận dụng: áp dụng vào tình huống, so sánh, phân tích ví dụ.',
  advanced: 'Nâng cao: phân tích, đánh giá, tổng hợp nhiều khái niệm.',
} as const;

export const TYPE_RULES: Record<AIQuestionType, string> = {
  single_choice:
    "single_choice: 1 correctAnswer + 3 distractors hợp lý, cùng độ dài; cấm 'Tất cả đều đúng/sai'.",
  multiple_choice:
    "multiple_choice: 2–4 correctAnswers + 2–3 distractors; câu hỏi mở đầu bằng 'Chọn tất cả…'.",
  true_false:
    'true_false: một mệnh đề khẳng định rõ ràng; cân bằng số câu đúng/sai; không phủ định kép.',
  short_answer:
    'short_answer: đáp án duy nhất, ≤ 5 từ; acceptedAnswers liệt kê mọi cách viết đúng.',
  essay:
    'essay: sampleAnswer 80–200 từ; gradingCriteria 3–5 ý độc lập, kiểm chứng được, bắt đầu bằng động từ.',
};

export function buildQuizSystemPrompt(o: {
  types: AIQuestionType[];
  count: number;
  difficulty: QuizDifficulty;
}): string {
  return [
    'Bạn là giảng viên chuyên soạn đề kiểm tra. Chỉ dựa vào TÀI LIỆU được cung cấp; tuyệt đối không bịa kiến thức ngoài tài liệu.',
    `Soạn tối đa ${o.count} câu hỏi. Nếu tài liệu không đủ nội dung, trả ít câu hơn thay vì bịa thêm.`,
    `Mức độ — ${QUIZ_DIFFICULTY[o.difficulty]}`,
    'Viết bằng ngôn ngữ của tài liệu. Các câu phải bao quát nhiều phần khác nhau, không trùng ý, mỗi câu tự đứng được.',
    'Phân bổ đều giữa các loại câu hỏi được cho phép:',
    ...o.types.map((t) => `- ${TYPE_RULES[t]}`),
    "Định dạng văn bản: văn bản thuần, có thể dùng **in đậm** và dòng bắt đầu bằng '- ' cho danh sách; không dùng HTML/Markdown khác.",
    'Không cần sắp xếp vị trí đáp án đúng: hệ thống sẽ tự xáo trộn.',
  ].join('\n');
}

export const quizGeneratePrompt: PromptTemplate<
  PromptPayloadMap['QUIZ_GENERATE']
> = {
  system: (payload) => buildQuizSystemPrompt(payload),
  renderUser: ({ context }) => `TÀI LIỆU:\n"""\n${context}\n"""`,
};

export const essayGradePrompt: PromptTemplate<PromptPayloadMap['ESSAY_GRADE']> =
  {
    system:
      'Bạn là trợ lý học tập AI chuyên chấm điểm câu hỏi tự luận cho sinh viên. ' +
      'Hãy chấm điểm công bằng, khách quan dựa trên đáp án mẫu và tiêu chí chấm điểm được cung cấp. ' +
      'Phân loại chính xác các ý người học đã đạt được vào matchedPoints và các ý còn thiếu vào missingPoints. ' +
      'Đưa ra nhận xét ngắn gọn, mang tính xây dựng bằng tiếng Việt trong aiFeedback.',
    renderUser: ({
      questionPlain,
      points,
      samplePlain,
      criteria,
      plainAnswer,
    }) =>
      [
        `CÂU HỎI (${points} điểm):`,
        questionPlain,
        '',
        `ĐÁP ÁN MẪU:`,
        samplePlain || '(Không có đáp án mẫu cụ thể)',
        '',
        `CÁC TIÊU CHÍ CHẤM ĐIỂM (${criteria.length} ý):`,
        criteria.length > 0
          ? criteria.map((c, idx) => `${idx + 1}. ${c}`).join('\n')
          : '(Đánh giá dựa theo mức độ khớp ý với đáp án mẫu)',
        '',
        `BÀI LÀM CỦA NGƯỜI HỌC:`,
        plainAnswer,
        '',
        `YÊU CẦU ĐẦU RA:`,
        `- evaluationStatus: 'correct' (đạt >= 80% yêu cầu), 'partial' (đạt một phần từ 25% đến dưới 80%), hoặc 'incorrect' (sai hoặc lạc đề).`,
        `- pointsEarned: Điểm đạt được trong khoảng từ 0 đến ${points} (làm tròn tối đa 2 chữ số thập phân).`,
        `- matchedPoints: Danh sách các ý/tiêu chí người học đã trình bày đúng.`,
        `- missingPoints: Danh sách các ý/tiêu chí người học còn thiếu hoặc trình bày sai.`,
        `- aiFeedback: Nhận xét súc tích (1-3 câu) bằng tiếng Việt chỉ rõ điểm tốt và điểm cần bổ sung.`,
      ].join('\n'),
  };
