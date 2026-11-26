import { tool } from 'ai';
import { z } from 'zod';
import type {
  GetDeckCardsCallback,
  GetDeckCardsToolOutput,
  ToolCallTracker,
} from '../../types.js';

const MAX_DECK_MODEL_OUTPUT_CHARS = 10_000;

export const getDeckCardsInputSchema = z.object({
  deckId: z
    .string()
    .optional()
    .describe(
      'UUID of the Flashcard Deck (from <current_ui_context> activeDeck.deckId, decksList, or searchWorkspaceResources). If omitted while viewing a deck in Flashcards tab, defaults to the currently open deck.',
    ),
  cardId: z
    .string()
    .optional()
    .describe(
      'Optional specific Flashcard UUID (e.g., currentCardId from <current_ui_context> studyState) to inspect only that single card.',
    ),
  stateFilter: z
    .enum(['all', 'due', 'new', 'learning', 'review', 'relearning'])
    .optional()
    .default('all')
    .describe(
      'Filter cards by SRS study state or "due" (cards due for review now). Default: "all".',
    ),
  searchKeyword: z
    .string()
    .max(150)
    .optional()
    .describe(
      'Optional keyword to filter cards matching front or back text (case-insensitive).',
    ),
  allowRevealCurrentCard: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Set to true ONLY when [GUARD: FLASHCARD_ANSWER_HIDDEN] is active AND the student explicitly asks to reveal the answer of the currently hidden study card. Keep false (default) when giving hints or browsing.',
    ),
  offset: z.number().int().min(0).optional().default(0),
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .optional()
    .default(15)
    .describe(
      'Maximum number of cards returned per call (1 to 25, default: 15).',
    ),
});

export function toDeckCardsLightweightOutput(
  output?: GetDeckCardsToolOutput,
): Record<string, unknown> | undefined {
  if (!output) return undefined;
  return {
    found: output.found,
    deckId: output.deckId,
    deckName: output.deckName,
    totalCards: output.totalCards,
    dueCount: output.dueCount,
    filteredCount: output.filteredCount,
    returnedCount: output.returnedCount,
    hasMore: output.hasMore,
    answerHidden: output.cards.some((c) => c.answerHidden),
    message: output.message,
  };
}

export function createGetDeckCardsTool(
  callback: GetDeckCardsCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'Read flashcards (front, back, card type, SRS state, due date) inside a Flashcard Deck, with optional filtering and pagination. Use when the student asks to inspect cards in a deck, find duplicate cards, or get a hint/explanation for a card they are studying. Respects [GUARD: FLASHCARD_ANSWER_HIDDEN] by hiding backText of unflipped study cards unless allowRevealCurrentCard=true is explicitly requested. NEVER use searchDocumentChunks to inspect flashcards, and NEVER use createFlashcards just to read existing cards.',
    inputSchema: getDeckCardsInputSchema,
    execute: async (input, { toolCallId }): Promise<GetDeckCardsToolOutput> => {
      const output = await callback(input);

      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'getDeckCards',
          output,
          toDeckCardsLightweightOutput(output),
        );
      }

      return output;
    },
    toModelOutput: ({ output }) => {
      if (!output?.found) {
        return {
          type: 'text',
          value: output?.message || 'Không tìm thấy bộ thẻ Flashcard.',
        };
      }

      const lines: string[] = [
        `[Bộ thẻ Flashcard: "${output.deckName}" | deckId: "${output.deckId}"]`,
        `- Tổng số thẻ: ${output.totalCards} (Đến hạn ôn: ${output.dueCount}) | Đang hiển thị: ${output.returnedCount}/${output.filteredCount} thẻ khớp.`,
      ];

      if (output.deckDescription) {
        lines.push(`- Mô tả: ${output.deckDescription}`);
      }

      if (output.cards.length === 0) {
        lines.push('\nKhông có thẻ nào khớp với điều kiện lọc.');
      }

      output.cards.forEach((card, idx) => {
        const cardNum = output.offset + idx + 1;
        lines.push(
          `\nThẻ #${cardNum} [${card.cardType} | state: ${card.state} | interval: ${card.intervalDays}d | cardId: "${card.cardId}"]`,
        );
        lines.push(`  Mặt trước: ${card.frontText}`);
        if (card.answerHidden) {
          lines.push(
            `  Mặt sau: [ĐÃ ẨN BỞI STUDY GUARD — Chỉ đưa gợi ý cho mặt trước, không tiết lộ đáp án trừ khi người dùng yêu cầu mở]`,
          );
        } else {
          lines.push(`  Mặt sau: ${card.backText}`);
        }
      });

      if (output.hasMore && output.nextOffset !== undefined) {
        lines.push(
          `\n[Còn thẻ tiếp theo. Gọi lại getDeckCards với offset: ${output.nextOffset} để đọc tiếp.]`,
        );
      }

      const fullText = lines.join('\n');
      return {
        type: 'text',
        value:
          fullText.length > MAX_DECK_MODEL_OUTPUT_CHARS
            ? `${fullText.slice(0, MAX_DECK_MODEL_OUTPUT_CHARS - 1)}…`
            : fullText,
      };
    },
  });
}
