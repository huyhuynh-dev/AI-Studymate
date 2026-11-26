import { tool } from 'ai';
import { z } from 'zod';
import type {
  GetQuizContentCallback,
  GetQuizContentToolOutput,
  ToolCallTracker,
} from '../../types.js';

const MAX_QUIZ_MODEL_OUTPUT_CHARS = 12_000;

export const getQuizContentInputSchema = z.object({
  quizId: z
    .string()
    .optional()
    .describe(
      'UUID of the Quiz (from <current_ui_context> activeQuiz.quizId, quizzesList, or searchWorkspaceResources). Required if attemptId is not provided.',
    ),
  attemptId: z
    .string()
    .optional()
    .describe(
      'UUID of a specific QuizAttempt (from <current_ui_context> activeAttempt.attemptId). Always pass attemptId when the student is taking a quiz or reviewing attempt results so question numbers and option letters match their screen.',
    ),
  mode: z
    .enum(['questions_only', 'attempt_review'])
    .optional()
    .describe(
      'Use "attempt_review" to include the student\'s selected answers, evaluation status, score, and AI feedback (uses attemptId or the latest submitted attempt of quizId). Use "questions_only" to inspect quiz questions without attempt answers.',
    ),
  evaluationFilter: z
    .enum([
      'all',
      'incorrect',
      'partial',
      'correct',
      'flagged',
      'unanswered',
      'essay',
    ])
    .optional()
    .default('all')
    .describe(
      'Filter questions in attempt_review mode (e.g., "incorrect" when the student asks "giải thích mấy câu mình làm sai"). In exam integrity mode, correctness filters are ignored and treated as "all".',
    ),
  questionNumbers: z
    .array(z.number().int().min(1))
    .max(15)
    .optional()
    .describe(
      'Specific 1-based question numbers as displayed on screen (e.g., [3] for "câu 3" or [1, 2, 5]). Automatically aligned with attempt questionOrder when attemptId is present.',
    ),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe(
      'Pagination start offset (0-based) for reading quizzes with many questions. Default: 0.',
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(15)
    .optional()
    .default(10)
    .describe(
      'Maximum number of questions returned per call (1 to 15, default: 10).',
    ),
});

export function toQuizContentLightweightOutput(
  output?: GetQuizContentToolOutput,
): Record<string, unknown> | undefined {
  if (!output) return undefined;
  return {
    found: output.found,
    quizId: output.quizId,
    quizTitle: output.quizTitle,
    attemptId: output.attemptId,
    attemptMode: output.attemptMode,
    examIntegrityEnforced: output.examIntegrityEnforced,
    totalQuestions: output.totalQuestions,
    filteredCount: output.filteredCount,
    returnedCount: output.returnedCount,
    hasMore: output.hasMore,
    message: output.message,
  };
}

export function createGetQuizContentTool(
  callback: GetQuizContentCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'Read Quiz questions, options, and (when allowed) the student\'s attempt answers, grading feedback, and explanations. Always pass attemptId when the student is taking a quiz or reviewing results so question numbers and option letters match their screen. Automatically enforces Exam Integrity Guard on the backend (answers/explanations are stripped during live exams). NEVER use searchDocumentChunks for Quiz questions, and NEVER use createQuiz to read an existing Quiz.',
    inputSchema: getQuizContentInputSchema,
    execute: async (input, { toolCallId }): Promise<GetQuizContentToolOutput> => {
      const output = await callback(input);

      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'getQuizContent',
          output,
          toQuizContentLightweightOutput(output),
        );
      }

      return output;
    },
    toModelOutput: ({ output }) => {
      if (!output?.found) {
        return {
          type: 'text',
          value: output?.message || 'Không tìm thấy bài kiểm tra hoặc lượt làm bài.',
        };
      }

      const lines: string[] = [];
      if (output.examIntegrityEnforced) {
        lines.push(
          '[GUARD: EXAM_INTEGRITY_MODE_ACTIVE — Đáp án và giải thích đã bị server ẩn cứng. Chỉ hướng dẫn phương pháp/kiến thức nền, tuyệt đối không tiết lộ hoặc suy đoán đáp án đúng.]',
        );
      }

      lines.push(
        `[Bài kiểm tra: "${output.quizTitle}" | quizId: "${output.quizId}"${output.attemptId ? ` | attemptId: "${output.attemptId}" (${output.attemptMode ?? 'exam'}, ${output.attemptStatus ?? ''})` : ''}]`,
      );
      if (
        !output.examIntegrityEnforced &&
        typeof output.score === 'number' &&
        typeof output.maxScore === 'number'
      ) {
        lines.push(`- Điểm số: ${output.score}/${output.maxScore}`);
      }
      lines.push(
        `- Hiển thị ${output.returnedCount}/${output.filteredCount} câu khớp (Tổng đề: ${output.totalQuestions} câu).`,
      );

      if (output.questions.length === 0) {
        lines.push('\nKhông có câu hỏi nào khớp với bộ lọc hiện tại.');
      }

      for (const q of output.questions) {
        const qLines: string[] = [
          `\nCâu ${q.displayNumber} [${q.questionType}, ${q.points}đ${q.bloomLevel ? `, Bloom: ${q.bloomLevel}` : ''}${q.isFlagged ? ', ĐÃ ĐÁNH DẤU' : ''}]: ${q.questionText}`,
        ];

        if (Array.isArray(q.options) && q.options.length > 0) {
          for (const opt of q.options) {
            const correctTag =
              !output.examIntegrityEnforced && opt.isCorrect === true
                ? ' [ĐÁP ÁN ĐÚNG]'
                : '';
            qLines.push(`  ${opt.label}. ${opt.text}${correctTag}`);
          }
        }

        if (q.studentSelectedLabels && q.studentSelectedLabels.length > 0) {
          qLines.push(
            `  - Sinh viên chọn: ${q.studentSelectedLabels.join(', ')}`,
          );
        }
        if (q.studentTextAnswer) {
          qLines.push(`  - Bài trả lời tự luận/ngắn: ${q.studentTextAnswer}`);
        }

        if (!output.examIntegrityEnforced) {
          if (q.evaluationStatus) {
            qLines.push(
              `  - Kết quả chấm: ${q.evaluationStatus} (${q.pointsEarned ?? 0}/${q.points}đ)`,
            );
          }
          if (q.sampleAnswer) {
            qLines.push(`  - Đáp án mẫu: ${q.sampleAnswer}`);
          }
          if (q.gradingCriteria && q.gradingCriteria.length > 0) {
            qLines.push(
              `  - Tiêu chí chấm: ${q.gradingCriteria.join(' ; ')}`,
            );
          }
          if (q.matchedPoints && q.matchedPoints.length > 0) {
            qLines.push(`  - Ý đã đạt: ${q.matchedPoints.join(' ; ')}`);
          }
          if (q.missingPoints && q.missingPoints.length > 0) {
            qLines.push(`  - Ý còn thiếu: ${q.missingPoints.join(' ; ')}`);
          }
          if (q.aiFeedback) {
            qLines.push(`  - Nhận xét chấm: ${q.aiFeedback}`);
          }
          if (q.explanation) {
            qLines.push(`  - Giải thích: ${q.explanation}`);
          }
        }

        lines.push(qLines.join('\n'));
      }

      if (output.hasMore && output.nextOffset !== undefined) {
        lines.push(
          `\n[Còn câu hỏi tiếp theo. Gọi lại getQuizContent với offset: ${output.nextOffset} để xem tiếp.]`,
        );
      }

      const fullText = lines.join('\n');
      return {
        type: 'text',
        value:
          fullText.length > MAX_QUIZ_MODEL_OUTPUT_CHARS
            ? `${fullText.slice(0, MAX_QUIZ_MODEL_OUTPUT_CHARS - 1)}…`
            : fullText,
      };
    },
  });
}
