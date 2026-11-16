import { tool } from 'ai';
import { z } from 'zod';

export const askUserQuestionInputSchema = z.object({
  contextMessage: z
    .string()
    .optional()
    .describe(
      'A brief, friendly lead-in explaining why you need more information from the user (written in the user’s language, default Vietnamese).',
    ),
  questions: z
    .array(
      z.object({
        id: z
          .string()
          .describe(
            'Short identifier for the question (e.g., "target_docs", "merge_strategy", "summary_style").',
          ),
        question: z
          .string()
          .describe(
            'Clear question text for the user (written in the user’s language, default Vietnamese).',
          ),
        options: z
          .array(z.string())
          .optional()
          .describe(
            'Suggested quick-select options displayed on the UI (written in the user’s language, default Vietnamese).',
          ),
        allowMultiple: z
          .boolean()
          .optional()
          .describe(
            'Set to true to allow selecting multiple options at once (default: false).',
          ),
        allowCustomInput: z
          .boolean()
          .optional()
          .default(true)
          .describe(
            'Whether to show a free-text input box below the options. Set to false for strictly closed/fixed choices where no other valid option exists (e.g., choosing among the exact documents in the session, or Yes/No). Keep true (default) for open-ended or customizable preferences (e.g., summary style/focus, explanation depth, study goal).',
          ),
      }),
    )
    .min(1)
    .max(5)
    .describe('List of 1 to 5 targeted questions for the user to answer.'),
});

export function createAskUserQuestionTool() {
  return tool({
    description:
      'Render an interactive question widget (1–3 quick-select questions) when clarifying complex, multi-choice, or parameter-missing requests (e.g., choosing which documents to process, summary scope/style, or depth of explanation). For a single, short, simple clarification (like asking for a page number or missing code snippet), ask naturally in plain text instead of calling this tool. Always write user-facing questions and options in the user’s language (default Vietnamese).',
    inputSchema: askUserQuestionInputSchema,
  });
}
