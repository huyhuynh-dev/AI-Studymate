import { tool } from 'ai';
import { z } from 'zod';
import { requiresUserApproval } from '../../../utils/risk-gate.helper.js';
import type {
  ManageQuizCallback,
  ManageQuizToolInput,
  ManageQuizToolOutput,
  ToolCallTracker,
} from '../../types.js';

const quizQuestionInputSchema = z.object({
  questionId: z.string().optional(),
  questionType: z
    .enum([
      'single_choice',
      'multiple_choice',
      'true_false',
      'short_answer',
      'essay',
    ])
    .optional(),
  questionText: z.string().min(1).max(3000),
  points: z.number().min(0.25).max(100).optional(),
  options: z
    .array(
      z.object({
        id: z.string().optional(),
        text: z.string().min(1).max(1000),
        isCorrect: z.boolean(),
      }),
    )
    .max(8)
    .optional(),
  sampleAnswer: z.string().max(3000).optional(),
  explanation: z.string().max(3000).optional(),
});

export const manageQuizInputSchema = z.object({
  action: z
    .enum([
      'update_metadata',
      'add_question',
      'update_question',
      'delete_questions',
      'batch_update_questions',
      'delete_quiz',
    ])
    .describe(
      'Thao tác trên Quiz: update_metadata | add_question | update_question (Tier 1); delete_questions | batch_update_questions | delete_quiz (Tier 2 cần user phê duyệt).',
    ),
  quizId: z
    .string()
    .describe('UUID của bài kiểm tra Quiz cần thao tác.'),
  title: z
    .string()
    .max(255)
    .optional()
    .describe('Tiêu đề mới (cho update_metadata).'),
  description: z
    .string()
    .max(1000)
    .optional()
    .describe('Mô tả mới (cho update_metadata).'),
  timeLimitSec: z
    .number()
    .int()
    .min(60)
    .max(14400)
    .nullable()
    .optional()
    .describe('Giới hạn thời gian làm bài tính theo giây (hoặc null nếu bỏ giới hạn).'),
  questionId: z
    .string()
    .optional()
    .describe('UUID của câu hỏi cần cập nhật (cho update_question).'),
  questionIds: z
    .array(z.string())
    .max(50)
    .optional()
    .describe('Danh sách UUID câu hỏi cần xóa (cho delete_questions).'),
  question: quizQuestionInputSchema
    .optional()
    .describe('Thông tin câu hỏi mới hoặc cập nhật (cho add_question / update_question).'),
  questions: z
    .array(
      quizQuestionInputSchema.extend({
        questionId: z.string(),
      }),
    )
    .max(30)
    .optional()
    .describe('Danh sách nhiều câu hỏi cần cập nhật hàng loạt (cho batch_update_questions).'),
});

export function toManageQuizLightweightOutput(
  output?: ManageQuizToolOutput,
): Record<string, unknown> | undefined {
  if (!output) return undefined;
  return {
    ok: output.ok,
    action: output.action,
    riskTier: output.riskTier,
    quizId: output.quizId,
    title: output.title,
    affectedCount: output.affectedCount,
    affectedIds: output.affectedIds,
    blockedReason: output.blockedReason,
    actionLogId: output.actionLogId,
    undoable: output.undoable,
    message: output.message,
  };
}

export function createManageQuizTool(
  callback: ManageQuizCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'Edit Quiz metadata (title, description, time limit), add/update/delete Quiz questions, or delete a Quiz. WHEN TO USE: Student asks to modify an existing Quiz, add a specific question, update answers/points, remove questions, or delete a Quiz. DO NOT USE to generate a brand new Quiz from documents (use createQuiz) or to read Quiz questions (use getQuizContent). Exam Integrity Guard automatically blocks any edit/delete while a graded attempt is IN_PROGRESS.',
    inputSchema: manageQuizInputSchema,
    needsApproval: (input) => requiresUserApproval('manageQuiz', input),
    execute: async (
      input: ManageQuizToolInput,
      { toolCallId },
    ): Promise<ManageQuizToolOutput> => {
      const output = await callback(input, toolCallId);
      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'manageQuiz',
          output,
          toManageQuizLightweightOutput(output),
        );
      }
      return output;
    },
    toModelOutput: ({ output }) => ({
      type: 'text',
      value: JSON.stringify(toManageQuizLightweightOutput(output) ?? output),
    }),
  });
}
