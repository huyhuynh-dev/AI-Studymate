import { tool } from 'ai';
import { z } from 'zod';
import type {
  SearchWorkspaceResourcesCallback,
  SearchWorkspaceResourcesToolOutput,
  ToolCallTracker,
} from '../../types.js';

const MAX_WORKSPACE_SEARCH_MODEL_OUTPUT_CHARS = 6_000;

export const searchWorkspaceResourcesInputSchema = z.object({
  query: z
    .string()
    .max(200)
    .optional()
    .describe(
      'Search keyword matching titles, filenames, or descriptions (case-insensitive). Omit to list recent resources in the selected scope.',
    ),
  resourceTypes: z
    .array(z.enum(['document', 'note', 'deck', 'quiz', 'conversation']))
    .min(1)
    .max(5)
    .optional()
    .default(['document', 'note', 'deck', 'quiz'])
    .describe(
      'Which resource types to search. Include "conversation" when the student looks for past study sessions/topics across subjects.',
    ),
  scope: z
    .enum(['conversation', 'subject', 'all'])
    .optional()
    .default('conversation')
    .describe(
      'Search scope: "conversation" (current study session — default), "subject" (all sessions in the current subject), or "all" (entire personal workspace across all subjects).',
    ),
  limitPerType: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(5)
    .describe(
      'Maximum items returned per resource type (1 to 10, default: 5).',
    ),
});

export function toWorkspaceResourcesLightweightOutput(
  output?: SearchWorkspaceResourcesToolOutput,
): Record<string, unknown> | undefined {
  if (!output) return undefined;
  return {
    scope: output.scope,
    query: output.query,
    totalResults: output.totalResults,
    items: output.items.slice(0, 10).map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      conversationTitle: item.conversationTitle,
    })),
    message: output.message,
  };
}

export function createSearchWorkspaceResourcesTool(
  callback: SearchWorkspaceResourcesCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'Search or list StudyMate workspace resources (documents, notes, flashcard decks, quizzes, and past conversations) across the current session, current subject, or entire personal workspace. Use to find resource IDs/titles before reading them with getNoteContent, getQuizContent, getDeckCards, or getDocumentSectionOrPages. NEVER use searchInternet for personal StudyMate resources.',
    inputSchema: searchWorkspaceResourcesInputSchema,
    execute: async (
      input,
      { toolCallId },
    ): Promise<SearchWorkspaceResourcesToolOutput> => {
      const output = await callback(input);

      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'searchWorkspaceResources',
          output,
          toWorkspaceResourcesLightweightOutput(output),
        );
      }

      return output;
    },
    toModelOutput: ({ output }) => {
      if (!output || output.items.length === 0) {
        return {
          type: 'text',
          value:
            output?.message ||
            'Không tìm thấy tài nguyên nào khớp yêu cầu trong workspace.',
        };
      }

      const lines = [
        `[Tìm kiếm Workspace | Phạm vi: ${output.scope}${output.query ? ` | Từ khóa: "${output.query}"` : ''} | Tổng kết quả: ${output.totalResults}]`,
      ];

      for (const item of output.items) {
        const locationParts = [
          item.subjectName ? `Môn: "${item.subjectName}"` : null,
          item.conversationTitle && item.type !== 'conversation'
            ? `Phiên: "${item.conversationTitle}"`
            : null,
          item.meta || null,
        ].filter(Boolean);

        lines.push(
          `- [${item.type.toUpperCase()}] "${item.title}" | id: "${item.id}"${locationParts.length > 0 ? ` | ${locationParts.join(' | ')}` : ''}`,
        );
      }

      const fullText = lines.join('\n');
      return {
        type: 'text',
        value:
          fullText.length > MAX_WORKSPACE_SEARCH_MODEL_OUTPUT_CHARS
            ? `${fullText.slice(0, MAX_WORKSPACE_SEARCH_MODEL_OUTPUT_CHARS - 1)}…`
            : fullText,
      };
    },
  });
}
