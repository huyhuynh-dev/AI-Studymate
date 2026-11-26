import { tool } from 'ai';
import { z } from 'zod';
import type {
  CreateFlashcardsCallback,
  CreateFlashcardsToolOutput,
  ToolCallTracker,
} from '../../types.js';

export const createFlashcardsInputSchema = z.object({
  documentIds: z
    .array(z.string())
    .optional()
    .describe(
      'List of source document UUIDs from <workspace_documents> to generate flashcards from. Omit or leave empty to use all ready documents (or currently attached documents) in the conversation.',
    ),
  count: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe(
      'Number of flashcards to generate (1 to 50, default: 10). Common presets: 10, 20, 30.',
    ),
  types: z
    .array(z.enum(['basic', 'cloze', 'type_in']))
    .min(1)
    .optional()
    .default(['basic', 'cloze'])
    .describe(
      'Allowed flashcard types: "basic" (front question/term, back answer), "cloze" (fill-in-the-blank sentence), "type_in" (short exact typed answer). Default: ["basic", "cloze"].',
    ),
  deckName: z
    .string()
    .max(255)
    .optional()
    .describe(
      'Optional custom title for a NEW flashcard deck (ignored when deckId is provided). If omitted, an appropriate title is generated automatically based on the documents.',
    ),
  instructions: z
    .string()
    .max(1000)
    .optional()
    .describe(
      'Optional additional instructions from the student (e.g., specific chapters, topics, formulas, or difficulty focus).',
    ),
  deckId: z
    .string()
    .optional()
    .describe(
      'Optional existing deck UUID ONLY when appending cards into an existing deck (takes precedence over deckName). Omit when creating a new deck.',
    ),
});

export function toFlashcardLightweightOutput(
  output?: CreateFlashcardsToolOutput,
): Record<string, unknown> | undefined {
  if (!output) return undefined;
  return {
    deckId: output.deckId,
    deckName: output.deckName,
    deckDescription: output.deckDescription,
    targetKind: output.targetKind,
    savedCount: output.savedCount,
    requestedCount: output.requestedCount,
    droppedCount: output.droppedCount,
    types: output.types,
    documentNames: output.documentNames,
    createdAt: output.createdAt,
  };
}

export function createCreateFlashcardsTool(
  callback: CreateFlashcardsCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'CREATES and SAVES new AI spaced-repetition flashcards into the Flashcards tab (new deck or appended to deckId). Use ONLY when the student explicitly requests creating/adding flashcards (not for regular explanations). To READ or inspect existing flashcards in a deck, call getDeckCards instead. If the request is generic or missing key preferences (e.g., which document among multiple files, card count, or card types), call askUserQuestion first to clarify.',
    inputSchema: createFlashcardsInputSchema,
    execute: async (
      input,
      { toolCallId },
    ): Promise<CreateFlashcardsToolOutput> => {
      const output = await callback(input);

      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'createFlashcards',
          output,
          toFlashcardLightweightOutput(output),
        );
      }

      return output;
    },
    toModelOutput: ({ output }) => {
      if (!output?.deckId) {
        return {
          type: 'text',
          value: 'Không thể khởi tạo bộ thẻ ghi nhớ (Flashcard).',
        };
      }

      return {
        type: 'text',
        value: `Đã tạo bộ thẻ Flashcard thành công!\n- Tên bộ thẻ: "${output.deckName}"\n- Mã bộ thẻ (deckId): "${output.deckId}"\n- Số lượng thẻ đã lưu: ${output.savedCount}/${output.requestedCount} thẻ\n- Loại thẻ: ${(output.types || []).join(', ')}\n- Tài liệu nguồn: ${(output.documentNames || []).join(', ') || 'Toàn bộ tài liệu phiên học'}`,
      };
    },
  });
}
