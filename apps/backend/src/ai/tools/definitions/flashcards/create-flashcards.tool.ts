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
      'List of source document UUIDs from <workspace_documents> or <current_ui_context> to generate flashcards from. Omit if targeting the open/attached file.',
    ),
  count: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe(
      'Optional number of flashcards to generate (1 to 50). Omit unless specified by the student (backend applies safe default: 10).',
    ),
  types: z
    .array(z.enum(['basic', 'cloze', 'type_in']))
    .min(1)
    .optional()
    .describe(
      'Optional allowed flashcard types: "basic", "cloze", "type_in". Omit unless specified by the student (backend applies safe default: ["basic", "cloze"]).',
    ),
  deckName: z
    .string()
    .max(255)
    .optional()
    .describe(
      'Optional custom title for a NEW flashcard deck (ignored when deckId is provided).',
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
    ...(output.status && output.status !== 'created'
      ? { status: output.status }
      : {}),
    ...(output.appliedDefaults?.length
      ? { appliedDefaults: output.appliedDefaults }
      : {}),
    ...(output.message ? { message: output.message } : {}),
  };
}

export function createCreateFlashcardsTool(
  callback: CreateFlashcardsCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'CREATES and SAVES new AI spaced-repetition flashcards into the Flashcards tab (new deck or appended to deckId). Use ONLY when the student explicitly requests creating/adding flashcards (not for regular explanations). To READ existing cards, call getDeckCards instead. Clarify via askUserQuestion ONLY when multiple documents exist and the source target is ambiguous; otherwise execute immediately and omit unspecified optional parameters so backend defaults apply.',
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
      if (output?.status === 'needs_clarification') {
        const candidateLines = (output.candidates || [])
          .map((c) => `- "${c.fileName}" (documentId: "${c.documentId}")`)
          .join('\n');
        return {
          type: 'text',
          value: `CẦN HỎI LÀM RÕ NGUỒN TÀI LIỆU (Chưa tạo bộ thẻ): ${output.message || ''}\nDanh sách tài liệu khả dụng:\n${candidateLines}\nHãy gọi ngay tool \`askUserQuestion\` với 1 câu hỏi chọn nguồn (liệt kê các tài liệu trên + "Tất cả tài liệu trong phiên", allowMultiple: true, allowCustomInput: false) và KHÔNG khẳng định đã tạo.`,
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

      if (!output?.deckId) {
        return {
          type: 'text',
          value:
            output?.message ||
            'Không thể khởi tạo bộ thẻ ghi nhớ (Flashcard).',
        };
      }

      const defaultsLine =
        Array.isArray(output.appliedDefaults) && output.appliedDefaults.length > 0
          ? `\n- Tham số mặc định đã tự áp dụng (hãy nhắc ngắn 1 câu tự nhiên kèm lời mời điều chỉnh): ${output.appliedDefaults.join(', ')}`
          : '';

      return {
        type: 'text',
        value: `Đã tạo bộ thẻ Flashcard thành công!\n- Tên bộ thẻ: "${output.deckName}"\n- Mã bộ thẻ (deckId): "${output.deckId}"\n- Số lượng thẻ đã lưu: ${output.savedCount}/${output.requestedCount} thẻ\n- Loại thẻ: ${(output.types || []).join(', ')}\n- Tài liệu nguồn: ${(output.documentNames || []).join(', ') || 'Toàn bộ tài liệu phiên học'}${defaultsLine}`,
      };
    },
  });
}
