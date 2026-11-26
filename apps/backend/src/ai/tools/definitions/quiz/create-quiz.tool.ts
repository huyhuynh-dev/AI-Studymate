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
      'List of source document UUIDs from <workspace_documents> to generate the quiz from. Omit or leave empty to use all ready documents (or currently attached documents) in the conversation.',
    ),
  questionCount: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .default(10)
    .describe(
      'Number of questions to generate (1 to 30, default: 10). Common presets: 5, 10, 15, 20.',
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
    .default(['single_choice', 'essay'])
    .describe(
      'Allowed question types: "single_choice" (1 correct answer + 3 distractors), "multiple_choice" (2-4 correct answers), "true_false" (declarative statement), "short_answer" (short exact phrase <= 5 words), "essay" (long-form with sample answer & grading rubric). Note: when converting a flashcard deck via deckId, only "single_choice", "true_false", and "short_answer" are supported. Default: ["single_choice", "essay"].',
    ),
  difficulty: z
    .enum(['basic', 'applied', 'advanced'])
    .optional()
    .default('applied')
    .describe(
      'Difficulty level: "basic" (recall & core definitions), "applied" (apply concepts to scenarios & analyze examples), or "advanced" (deep synthesis & evaluation). Default: "applied".',
    ),
  bloomPreset: z
    .enum(['familiarize', 'balanced', 'exam_prep'])
    .optional()
    .describe(
      'Optional Bloom cognitive distribution preset: "familiarize" (75% Remember/Understand), "balanced" (balanced across 4 Bloom levels), or "exam_prep" (70% Apply/Analyze). When omitted, inferred from difficulty.',
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
  };
}

export function createCreateQuizTool(
  callback: CreateQuizCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'CREATES and SAVES a NEW AI assessment quiz from workspace study documents (or from an existing flashcard deckId) into the Quiz tab. Use ONLY when the student explicitly requests creating/generating a new quiz, test, or practice exam. To READ questions or review attempt results of an existing quiz, call getQuizContent instead. If the request is generic or missing key preferences (e.g., which document among multiple files, question count, question types, or difficulty), call askUserQuestion first to clarify.',
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
      if (!output?.quizId) {
        return {
          type: 'text',
          value: 'Không thể khởi tạo bài kiểm tra (Quiz).',
        };
      }

      return {
        type: 'text',
        value: `Đã tạo đề kiểm tra thành công!\n- Tên đề kiểm tra: "${output.title}"\n- Mã đề kiểm tra (quizId): "${output.quizId}"\n- Số lượng câu hỏi: ${output.questionCount}/${output.requestedCount} câu\n- Dạng câu hỏi: ${(output.types || []).join(', ')}\n- Độ khó: ${output.difficulty}\n- Nguồn: ${(output.documentNames || []).join(', ') || 'Toàn bộ tài liệu phiên học'}`,
      };
    },
  });
}
