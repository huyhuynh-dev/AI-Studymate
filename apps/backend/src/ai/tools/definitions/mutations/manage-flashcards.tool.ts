import { tool } from 'ai';
import { z } from 'zod';
import { requiresUserApproval } from '../../../utils/risk-gate.helper.js';
import type {
  ManageFlashcardsCallback,
  ManageFlashcardsToolInput,
  ManageFlashcardsToolOutput,
  ToolCallTracker,
} from '../../types.js';

export const manageFlashcardsInputSchema = z.object({
  action: z
    .enum([
      'create_deck',
      'rename_deck',
      'delete_deck',
      'add_cards',
      'update_card',
      'delete_cards',
      'move_cards',
      'merge_duplicates',
    ])
    .describe(
      'Thao tác trên Deck/Flashcard: create_deck | rename_deck | update_card | add_cards (<=5 thẻ) | move_cards (1 thẻ) chạy ngay (Tier 1); delete_deck | delete_cards | merge_duplicates | add_cards (>5 thẻ) | move_cards (>=2 thẻ) cần user phê duyệt (Tier 2).',
    ),
  deckId: z
    .string()
    .optional()
    .describe('UUID của Deck mục tiêu (nguồn hoặc đích tùy action).'),
  targetDeckId: z
    .string()
    .optional()
    .describe('UUID của Deck đích (bắt buộc cho move_cards).'),
  deckName: z
    .string()
    .max(255)
    .optional()
    .describe('Tên bộ thẻ (dùng cho create_deck hoặc rename_deck).'),
  deckDescription: z
    .string()
    .max(1000)
    .optional()
    .describe('Mô tả ngắn gọn của bộ thẻ (dùng cho create_deck hoặc rename_deck).'),
  cardId: z
    .string()
    .optional()
    .describe('UUID của thẻ cần sửa (dùng cho update_card).'),
  cardIds: z
    .array(z.string())
    .max(100)
    .optional()
    .describe('Danh sách UUID thẻ cần xóa hoặc di chuyển (dùng cho delete_cards, move_cards).'),
  cards: z
    .array(
      z.object({
        cardType: z.enum(['basic', 'cloze', 'type_in']).optional(),
        frontText: z.string().min(1).max(3000),
        backText: z.string().max(3000).optional(),
      }),
    )
    .max(30)
    .optional()
    .describe('Danh sách thẻ thủ công cần thêm (dùng cho add_cards).'),
  frontText: z
    .string()
    .max(3000)
    .optional()
    .describe('Nội dung mặt trước mới (dùng cho update_card).'),
  backText: z
    .string()
    .max(3000)
    .optional()
    .describe('Nội dung mặt sau mới (dùng cho update_card).'),
  cardType: z
    .enum(['basic', 'cloze', 'type_in'])
    .optional()
    .describe('Loại thẻ mới (dùng cho update_card).'),
  mergeGroups: z
    .array(
      z.object({
        keepCardId: z.string(),
        deleteCardIds: z.array(z.string()).min(1),
        updatedFrontText: z.string().max(3000).optional(),
        updatedBackText: z.string().max(3000).optional(),
      }),
    )
    .max(30)
    .optional()
    .describe('Các nhóm thẻ trùng lặp cần gộp lại (chỉ dùng cho merge_duplicates).'),
});

export function toManageFlashcardsLightweightOutput(
  output?: ManageFlashcardsToolOutput,
): Record<string, unknown> | undefined {
  if (!output) return undefined;
  return {
    ok: output.ok,
    action: output.action,
    riskTier: output.riskTier,
    deckId: output.deckId,
    deckName: output.deckName,
    affectedCount: output.affectedCount,
    affectedIds: output.affectedIds,
    actionLogId: output.actionLogId,
    undoable: output.undoable,
    message: output.message,
  };
}

export function createManageFlashcardsTool(
  callback: ManageFlashcardsCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'Create/rename/delete Flashcard Decks, manually add/edit/delete flashcards, move cards between decks, or merge duplicate flashcards. WHEN TO USE: Student explicitly specifies cards/edits, wants to organize decks, delete decks/cards, move cards, or merge duplicate cards found via getDeckCards. DO NOT USE to AI-generate large new card sets from PDF documents (use createFlashcards for <= 30 cards or manageWorkspaceAndJobs for > 30 cards) or to read cards (use getDeckCards). Never spoil hidden flashcard answers when study guard is active.',
    inputSchema: manageFlashcardsInputSchema,
    needsApproval: (input) => requiresUserApproval('manageFlashcards', input),
    execute: async (
      input: ManageFlashcardsToolInput,
      { toolCallId },
    ): Promise<ManageFlashcardsToolOutput> => {
      const output = await callback(input, toolCallId);
      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'manageFlashcards',
          output,
          toManageFlashcardsLightweightOutput(output),
        );
      }
      return output;
    },
    toModelOutput: ({ output }) => ({
      type: 'text',
      value: JSON.stringify(
        toManageFlashcardsLightweightOutput(output) ?? output,
      ),
    }),
  });
}
