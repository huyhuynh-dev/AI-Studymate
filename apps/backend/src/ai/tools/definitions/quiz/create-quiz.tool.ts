import { tool } from 'ai';
import { z } from 'zod';
import type {
  CreateQuizCallback,
  CreateQuizToolOutput,
  ToolCallTracker,
} from '../../types.js';

export const createQuizInputSchema = z.object({
  documentIds: z
    .array(z.string())
    .optional()
    .describe(
      'List of source document UUIDs from <workspace_documents> or <current_ui_context> to generate the quiz from. Omit if targeting the open/attached file.',
    ),
  questionCount: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .describe(
      'Optional number of questions to generate (1 to 30). Omit unless specified by the student (backend applies safe default: 10).',
    ),
  types: z
    .array(
      z.enum([
        'single_choice',
        'multiple_choice',
        'true_false',
        'short_answer',
        'essay',
      ]),
    )
    .min(1)
    .optional()
    .describe(
      'Optional allowed question types: "single_choice", "multiple_choice", "true_false", "short_answer", "essay". When converting a flashcard deck via deckId, only single_choice/true_false/short_answer are supported. Omit unless specified (backend defaults safely).',
    ),
  difficulty: z
    .enum(['basic', 'applied', 'advanced'])
    .optional()
    .describe(
      'Optional difficulty level: "basic", "applied", or "advanced". Omit unless specified by the student (backend defaults safely to "applied").',
    ),
  bloomPreset: z
    .enum(['familiarize', 'balanced', 'exam_prep'])
    .optional()
    .describe(
      'Optional Bloom cognitive distribution preset: "familiarize", "balanced", or "exam_prep". When omitted, inferred from difficulty.',
    ),
  deckId: z
    .string()
    .optional()
    .describe(
      'Optional flashcard deck UUID ONLY when converting an existing flashcard deck into a quiz (ignores documentIds and restricts types to single_choice/true_false/short_answer). Omit when generating from study documents.',
    ),
});

export function toQuizLightweightOutput(
  output?: CreateQuizToolOutput,
): Record<string, unknown> | undefined {
  if (!output) return undefined;
  return {
    quizId: output.quizId,
    title: output.title,
    description: output.description,
    source: output.source,
    questionCount: output.questionCount,
    requestedCount: output.requestedCount,
    types: output.types,
    difficulty: output.difficulty,
    documentNames: output.documentNames,
    createdAt: output.createdAt,
    ...(output.status && output.status !== 'created'
      ? { status: output.status }
      : {}),
    ...(output.appliedDefaults?.length
      ? { appliedDefaults: output.appliedDefaults }
      : {}),
    ...(output.message ? { message: output.message } : {}),
  };
}

export function createCreateQuizTool(
  callback: CreateQuizCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'CREATES and SAVES a NEW AI assessment quiz from workspace study documents (or from an existing flashcard deckId) into the Quiz tab. Use ONLY when the student explicitly requests creating/generating a new quiz, test, or practice exam. To READ existing quiz questions/attempts, call getQuizContent instead. Clarify via askUserQuestion ONLY when multiple documents exist and the source target is ambiguous; otherwise execute immediately and omit unspecified optional parameters so backend defaults apply.',
    inputSchema: createQuizInputSchema,
    execute: async (
      input,
      { toolCallId },
    ): Promise<CreateQuizToolOutput> => {
      const output = await callback(input);

      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'createQuiz',
          output,
          toQuizLightweightOutput(output),
        );
      }

      return output;
    },
    toModelOutput: ({ output }) => {
      if (output?.status === 'needs_clarification') {
        const candidateLines = (output.candidates || [])
          .map((c) => `- "${c.fileName}" (documentId: "${c.documentId}")`)
          .join('\n');
        return {
          type: 'text',
          value: `CẦN HỎI LÀM RÕ NGUỒN TÀI LIỆU (Chưa tạo đề kiểm tra): ${output.message || ''}\nDanh sách tài liệu khả dụng:\n${candidateLines}\nHãy gọi ngay tool \`askUserQuestion\` với 1 câu hỏi chọn nguồn (liệt kê các tài liệu trên + "Tất cả tài liệu trong phiên", allowMultiple: true, allowCustomInput: false) và KHÔNG khẳng định đã tạo.`,
        };
      }

      if (output?.status === 'empty_workspace') {
        return {
          type: 'text',
          value:
            output.message ||
            'Hiện chưa có tài liệu nào sẵn sàng trong phiên học. Hãy mời người dùng tải tài liệu lên trước.',
        };
      }

      if (!output?.quizId) {
        return {
          type: 'text',
          value: output?.message || 'Không thể khởi tạo bài kiểm tra (Quiz).',
        };
      }

      const defaultsLine =
        Array.isArray(output.appliedDefaults) && output.appliedDefaults.length > 0
          ? `\n- Tham số mặc định đã tự áp dụng (hãy nhắc ngắn 1 câu tự nhiên kèm lời mời điều chỉnh): ${output.appliedDefaults.join(', ')}`
          : '';

      return {
        type: 'text',
        value: `Đã tạo đề kiểm tra thành công!\n- Tên đề kiểm tra: "${output.title}"\n- Mã đề kiểm tra (quizId): "${output.quizId}"\n- Số lượng câu hỏi: ${output.questionCount}/${output.requestedCount} câu\n- Dạng câu hỏi: ${(output.types || []).join(', ')}\n- Độ khó: ${output.difficulty}\n- Nguồn: ${(output.documentNames || []).join(', ') || 'Toàn bộ tài liệu phiên học'}${defaultsLine}`,
      };
    },
  });
}
