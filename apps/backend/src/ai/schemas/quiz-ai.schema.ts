/**
 * Zod schema để AI sinh câu hỏi Quiz (5 loại) — Vercel AI SDK v6 + Zod 4 + OpenAI-compatible endpoint.
 *
 * Kiến trúc 3 lớp:
 *  1) Schema gửi cho MODEL (buildQuestionsSchema / buildQuizSchema): chỉ chứa cấu trúc + .describe(),
 *     KHÔNG có min/max/regex/default/transform/optional để tương thích rộng với các endpoint structured-output.
 *  2) QuestionQualitySchema: kiểm định chất lượng phía SERVER sau khi model trả về (đếm, trùng lặp, đáp án hợp lệ...).
 *  3) toQuizQuestionInserts: chuyển sang dòng DB (gán id đáp án, xáo vị trí, đổi văn bản → HTML cho TipTap).
 */
import { z } from 'zod';

export const AI_QUESTION_TYPES = [
    'single_choice',
    'multiple_choice',
    'true_false',
    'short_answer',
    'essay',
] as const;
export type AIQuestionType = (typeof AI_QUESTION_TYPES)[number];

/* ------------------------------------------------------------------ */
/* 1) Schema cho MODEL                                                  */
/* ------------------------------------------------------------------ */

const questionText = z
    .string()
    .describe(
        'Nội dung câu hỏi, văn bản thuần. Có thể dùng **in đậm** cho thuật ngữ trọng tâm; xuống đoạn bằng ký tự \\n. ' +
            "Câu hỏi phải tự đứng được: không nhắc 'theo đoạn trên', 'trong tài liệu'."
    );

const explanation = z
    .string()
    .describe(
        'Giải thích 1–3 câu vì sao đáp án đúng (và vì sao phương án gây nhiễu sai nếu cần). Hiển thị cho người học sau khi nộp bài.'
    );

/** Trắc nghiệm 1 đáp án. Đáp án đúng và phương án sai tách riêng → không thể có 0 hoặc 2 đáp án đúng; server tự xáo vị trí. */
const SingleChoiceQuestion = z
    .strictObject({
        type: z.literal('single_choice'),
        text: questionText,
        correctAnswer: z.string().describe('Duy nhất 1 đáp án đúng, ngắn gọn.'),
        distractors: z
            .array(z.string())
            .describe(
                "Đúng 3 phương án SAI nhưng hợp lý (dựa trên lỗi hiểu nhầm phổ biến), độ dài tương đương đáp án đúng. Cấm 'Tất cả đều đúng/sai'."
            ),
        explanation,
    })
    .describe('Trắc nghiệm chọn 1 đáp án đúng');

/** Trắc nghiệm nhiều đáp án đúng. */
const MultipleChoiceQuestion = z
    .strictObject({
        type: z.literal('multiple_choice'),
        text: questionText,
        correctAnswers: z
            .array(z.string())
            .describe(
                '2–4 đáp án ĐÚNG, mỗi phần tử là một lựa chọn riêng biệt.'
            ),
        distractors: z
            .array(z.string())
            .describe(
                "2–3 phương án SAI nhưng hợp lý. Cấm 'Tất cả đều đúng/sai'."
            ),
        explanation,
    })
    .describe(
        "Trắc nghiệm chọn nhiều đáp án đúng. Câu hỏi nên gợi ý 'Chọn tất cả…'"
    );

/** Đúng / Sai: boolean thay vì danh sách lựa chọn. */
const TrueFalseQuestion = z
    .strictObject({
        type: z.literal('true_false'),
        text: z
            .string()
            .describe(
                'MỘT mệnh đề khẳng định rõ ràng để người học phán đoán Đúng/Sai. Không dùng câu hỏi, không phủ định kép.'
            ),
        correctAnswer: z
            .boolean()
            .describe('true nếu mệnh đề đúng, false nếu sai.'),
        explanation,
    })
    .describe('Câu Đúng / Sai');

/** Điền từ ngắn: so khớp chuỗi nên cần danh sách biến thể chấp nhận. */
const ShortAnswerQuestion = z
    .strictObject({
        type: z.literal('short_answer'),
        text: questionText,
        acceptedAnswers: z
            .array(z.string())
            .describe(
                'Các cách viết ĐÚNG của cùng một đáp án (phần tử đầu là chuẩn), mỗi cái tối đa 5 từ. ' +
                    "Gồm viết tắt/viết đầy đủ, có/không dấu gạch nối nếu phù hợp. Không chứa ký tự '|'."
            ),
        explanation,
    })
    .describe('Điền từ ngắn, chỉ có MỘT đáp án duy nhất, không mơ hồ');

/** Tự luận: bài mẫu + rubric các ý cốt lõi để AI chấm theo ngữ nghĩa. */
const EssayQuestion = z
    .strictObject({
        type: z.literal('essay'),
        text: questionText,
        sampleAnswer: z
            .string()
            .describe(
                'Bài viết mẫu hoàn chỉnh 80–200 từ, văn bản thuần, các đoạn cách nhau bằng \\n.'
            ),
        gradingCriteria: z
            .array(z.string())
            .describe(
                '3–5 ý cốt lõi cần đạt. Mỗi ý là một mệnh đề độc lập, kiểm chứng được, bắt đầu bằng động từ ' +
                    "(vd 'Nêu đúng khái niệm X', 'Giải thích được vì sao Y'). Không trùng ý nhau."
            ),
        explanation,
    })
    .describe('Câu tự luận ngắn, có rubric chấm điểm');

const MEMBERS = {
    single_choice: SingleChoiceQuestion,
    multiple_choice: MultipleChoiceQuestion,
    true_false: TrueFalseQuestion,
    short_answer: ShortAnswerQuestion,
    essay: EssayQuestion,
} as const;

export type GeneratedQuestion =
    | {
          type: 'single_choice';
          text: string;
          correctAnswer: string;
          distractors: string[];
          explanation: string;
      }
    | {
          type: 'multiple_choice';
          text: string;
          correctAnswers: string[];
          distractors: string[];
          explanation: string;
      }
    | {
          type: 'true_false';
          text: string;
          correctAnswer: boolean;
          explanation: string;
      }
    | {
          type: 'short_answer';
          text: string;
          acceptedAnswers: string[];
          explanation: string;
      }
    | {
          type: 'essay';
          text: string;
          sampleAnswer: string;
          gradingCriteria: string[];
          explanation: string;
      };

/** Một câu hỏi thuộc bất kỳ loại nào (dùng cho kiểu TypeScript). */
export const GeneratedQuestionSchema = z.union([
    SingleChoiceQuestion,
    MultipleChoiceQuestion,
    TrueFalseQuestion,
    ShortAnswerQuestion,
    EssayQuestion,
]);

/**
 * Union chỉ gồm các loại được yêu cầu → model không thể sinh loại không mong muốn.
 * Dùng z.union (→ JSON Schema `anyOf`) thay vì discriminatedUnion để chắc chắn tránh `oneOf`, vốn nhiều endpoint từ chối.
 */
export function buildQuestionUnion(
    types: readonly AIQuestionType[] = AI_QUESTION_TYPES
) {
    const uniq = [...new Set(types)];
    if (uniq.length === 0) throw new Error('Cần ít nhất 1 loại câu hỏi');
    const members = uniq.map((t) => MEMBERS[t]);
    return (
        members.length === 1
            ? members[0]
            : z.union(
                  members as unknown as [z.ZodType, z.ZodType, ...z.ZodType[]]
              )
    ) as z.ZodType<GeneratedQuestion>;
}

/** Thêm câu hỏi vào đề có sẵn / chuyển từ Flashcard. Root PHẢI là object (không phải array). */
export function buildQuestionsSchema(types?: readonly AIQuestionType[]) {
    return z.strictObject({
        questions: z
            .array(buildQuestionUnion(types))
            .describe(
                'Danh sách câu hỏi. Nếu tài liệu không đủ nội dung cho số câu yêu cầu thì trả ÍT câu hơn, không bịa thêm.'
            ),
    });
}

/** Tạo cả đề: tiêu đề + mô tả + câu hỏi. */
export function buildQuizSchema(types?: readonly AIQuestionType[]) {
    return z.strictObject({
        title: z
            .string()
            .describe(
                'Tiêu đề đề kiểm tra, tối đa ~80 ký tự, nêu rõ chủ đề.'
            ),
        description: z
            .string()
            .describe('Mô tả 1 câu về phạm vi kiến thức đề kiểm tra.'),
        questions: buildQuestionsSchema(types).shape.questions,
    });
}

export interface GeneratedQuiz {
    title: string;
    description: string;
    questions: GeneratedQuestion[];
}

/* ------------------------------------------------------------------ */
/* 2) Kiểm định chất lượng phía server                                  */
/* ------------------------------------------------------------------ */

const BANNED_OPTIONS =
    /(tất cả (các )?(đáp án |phương án |ý )?(trên|đều|đã nêu)|không (có )?(đáp án|phương án|ý) nào|all of the above|none of the above)/i;
const norm = (s: string) =>
    s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const dupes = (arr: string[]) => new Set(arr.map(norm)).size !== arr.length;

export function checkQuestionQuality(q: GeneratedQuestion): string[] {
    const p: string[] = [];
    if (q.text.trim().length < 10) p.push('Nội dung câu hỏi quá ngắn.');
    if (q.explanation.trim().length < 10) p.push('Thiếu phần giải thích.');

    switch (q.type) {
        case 'single_choice': {
            const all = [q.correctAnswer, ...q.distractors];
            if (!q.correctAnswer.trim()) p.push('Thiếu đáp án đúng.');
            if (q.distractors.length < 2 || q.distractors.length > 5)
                p.push('Cần 2–5 phương án sai (khuyến nghị 3).');
            if (all.some((o) => !o.trim())) p.push('Có phương án rỗng.');
            if (dupes(all)) p.push('Có phương án trùng nhau.');
            if (all.some((o) => BANNED_OPTIONS.test(o)))
                p.push("Không được dùng 'Tất cả/Không có đáp án nào…'.");
            break;
        }
        case 'multiple_choice': {
            const all = [...q.correctAnswers, ...q.distractors];
            if (q.correctAnswers.length < 2 || q.correctAnswers.length > 4)
                p.push('Cần 2–4 đáp án đúng.');
            if (q.distractors.length < 1 || all.length > 8)
                p.push('Cần ít nhất 1 phương án sai và tối đa 8 lựa chọn.');
            if (all.some((o) => !o.trim())) p.push('Có phương án rỗng.');
            if (dupes(all)) p.push('Có phương án trùng nhau.');
            if (all.some((o) => BANNED_OPTIONS.test(o)))
                p.push("Không được dùng 'Tất cả/Không có đáp án nào…'.");
            break;
        }
        case 'true_false':
            if (/\?\s*$/.test(q.text.trim()))
                p.push(
                    'Câu Đúng/Sai phải là mệnh đề khẳng định, không phải câu hỏi.'
                );
            break;
        case 'short_answer': {
            const a = q.acceptedAnswers.map((x) => x.trim());
            if (a.length < 1 || a.some((x) => !x))
                p.push('Thiếu đáp án chấp nhận.');
            if (a.some((x) => x.includes('|')))
                p.push("Đáp án không được chứa ký tự '|'.");
            if (a.some((x) => words(x) > 6))
                p.push('Đáp án điền từ phải ngắn (≤ 6 từ).');
            break;
        }
        case 'essay': {
            const c = q.gradingCriteria.map((x) => x.trim());
            if (q.sampleAnswer.trim().length < 40)
                p.push('Bài mẫu quá ngắn.');
            if (c.length < 2 || c.length > 6 || c.some((x) => !x))
                p.push('Cần 2–6 ý chính, không rỗng.');
            if (dupes(c)) p.push('Các ý chính bị trùng.');
            break;
        }
    }
    return p;
}

/** Parse + kiểm định chất lượng trong một bước (dùng safeParse). */
export const QuestionQualitySchema = GeneratedQuestionSchema.superRefine(
    (q, ctx) => {
        for (const message of checkQuestionQuality(q as GeneratedQuestion))
            ctx.addIssue({ code: 'custom', message });
    }
);

/** Tách câu hợp lệ / bị loại để có thể sinh bù phần thiếu. */
export function partitionQuestions(raw: unknown[]) {
    const valid: GeneratedQuestion[] = [];
    const rejected: { index: number; problems: string[] }[] = [];
    raw.forEach((item, index) => {
        const r = QuestionQualitySchema.safeParse(item);
        if (r.success) valid.push(r.data as GeneratedQuestion);
        else
            rejected.push({
                index,
                problems: r.error.issues.map((i) => i.message),
            });
    });
    return { valid, rejected };
}

/* ------------------------------------------------------------------ */
/* 3) Chuyển sang dòng DB (bảng quiz_questions)                         */
/* ------------------------------------------------------------------ */

export interface QuizQuestionInsert {
    quiz_id?: string;
    question_type: AIQuestionType;
    order_index: number;
    question_text: string; // HTML (TipTap)
    points: number;
    options?: { id: string; text: string; isCorrect: boolean }[]; // bỏ qua khi không áp dụng → DB null
    sample_answer?: string; // short_answer: "a|b"; essay: HTML
    grading_criteria: string[];
    explanation: string; // HTML
}

const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s: string) =>
    esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

/** Văn bản thuần của AI → HTML an toàn cho TipTap (đoạn, **đậm**, danh sách gạch đầu dòng). */
export function textToHtml(raw: string): string {
    const out: string[] = [];
    let list: string[] = [];
    const flush = () => {
        if (list.length)
            out.push(
                `<ul>${list.map((i) => `<li><p>${i}</p></li>`).join('')}</ul>`
            );
        list = [];
    };
    for (const line of raw
        .replace(/\r/g, '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)) {
        const m = line.match(/^[-•]\s+(.*)$/);
        if (m) list.push(inline(m[1]));
        else {
            flush();
            out.push(`<p>${inline(line)}</p>`);
        }
    }
    flush();
    return out.join('');
}

const DEFAULT_POINTS: Record<AIQuestionType, number> = {
    single_choice: 1,
    true_false: 1,
    short_answer: 1,
    multiple_choice: 2,
    essay: 3,
};

function shuffled<T>(arr: T[], random: () => number): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function toQuizQuestionInserts(
    questions: GeneratedQuestion[],
    opts: {
        quizId?: string;
        startIndex?: number;
        points?: Partial<Record<AIQuestionType, number>>;
        random?: () => number;
    } = {}
): QuizQuestionInsert[] {
    const { quizId, startIndex = 0, random = Math.random } = opts;
    const pts = { ...DEFAULT_POINTS, ...opts.points };

    return questions.map((q, i): QuizQuestionInsert => {
        const base = {
            quiz_id: quizId,
            question_type: q.type,
            order_index: startIndex + i,
            question_text: textToHtml(q.text),
            points: pts[q.type],
            explanation: textToHtml(q.explanation),
            grading_criteria: [] as string[],
        };

        switch (q.type) {
            case 'single_choice':
            case 'multiple_choice': {
                const correct =
                    q.type === 'single_choice'
                        ? [q.correctAnswer]
                        : q.correctAnswers;
                const mixed = shuffled(
                    [
                        ...correct.map((t) => ({
                            text: t.trim(),
                            isCorrect: true,
                        })),
                        ...q.distractors.map((t) => ({
                            text: t.trim(),
                            isCorrect: false,
                        })),
                    ],
                    random
                );
                return {
                    ...base,
                    options: mixed.map((o, k) => ({ id: `opt_${k + 1}`, ...o })),
                };
            }
            case 'true_false':
                return {
                    ...base,
                    options: [
                        { id: 'true', text: 'Đúng', isCorrect: q.correctAnswer },
                        {
                            id: 'false',
                            text: 'Sai',
                            isCorrect: !q.correctAnswer,
                        },
                    ],
                };
            case 'short_answer':
                return {
                    ...base,
                    sample_answer: q.acceptedAnswers
                        .map((a) => a.trim())
                        .filter(Boolean)
                        .join('|'),
                };
            case 'essay':
                return {
                    ...base,
                    sample_answer: textToHtml(q.sampleAnswer),
                    grading_criteria: q.gradingCriteria
                        .map((c) => c.trim())
                        .filter(Boolean),
                };
        }
    });
}

/* ------------------------------------------------------------------ */
/* 4) Schema chấm điểm câu hỏi tự luận (Essay Grading)                 */
/* ------------------------------------------------------------------ */

export const essayGradingSchema = z.object({
    evaluationStatus: z
        .enum(['correct', 'partial', 'incorrect'])
        .describe(
            "Trạng thái đánh giá: 'correct' (đạt >= 80%), 'partial' (đạt 25% đến dưới 80%), 'incorrect' (sai hoặc lạc đề)",
        ),
    pointsEarned: z.number().describe('Điểm số đạt được của câu trả lời'),
    matchedPoints: z
        .array(z.string())
        .describe('Danh sách các ý/tiêu chí người học đã trình bày đúng'),
    missingPoints: z
        .array(z.string())
        .describe('Danh sách các ý/tiêu chí người học còn thiếu hoặc làm sai'),
    aiFeedback: z
        .string()
        .describe('Nhận xét ngắn gọn (1-3 câu) mang tính xây dựng bằng tiếng Việt'),
});

export type EssayGradingOutput = z.infer<typeof essayGradingSchema>;

