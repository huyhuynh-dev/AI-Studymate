import { tool } from 'ai';
import { z } from 'zod';
import { requiresUserApproval } from '../../../utils/risk-gate.helper.js';
import type {
  ManageNotesCallback,
  ManageNotesToolInput,
  ManageNotesToolOutput,
  ToolCallTracker,
} from '../../types.js';

export const manageNotesInputSchema = z.object({
  action: z
    .enum([
      'create_manual',
      'rename',
      'append_section',
      'update_section',
      'replace_content',
      'refine_note',
      'delete_note',
      'batch_reorganize',
    ])
    .describe(
      'Thao tác cần thực hiện trên Notes/Summaries: create_manual | rename | append_section | update_section (Tier 1 chạy ngay + Undo) hoặc replace_content | refine_note | delete_note | batch_reorganize (Tier 2 cần user phê duyệt).',
    ),
  summaryId: z
    .string()
    .optional()
    .describe('UUID của Note mục tiêu (bắt buộc cho rename, append_section, update_section, replace_content, refine_note, delete_note).'),
  title: z
    .string()
    .max(255)
    .optional()
    .describe('Tiêu đề mới của Note (dùng cho create_manual hoặc rename).'),
  sectionHeading: z
    .string()
    .max(200)
    .optional()
    .describe('Tên heading của section cần sửa/chèn sau đó (dùng cho update_section hoặc append_section).'),
  markdownContent: z
    .string()
    .max(50_000)
    .optional()
    .describe('Nội dung Markdown chuẩn để chuyển thành BlockNote JSON (dùng cho create_manual, append_section, update_section, replace_content).'),
  instruction: z
    .string()
    .max(2000)
    .optional()
    .describe('Chỉ dẫn tinh chỉnh nội dung bằng AI (dùng cho refine_note).'),
  batchItems: z
    .array(
      z.object({
        summaryId: z.string(),
        newTitle: z.string().max(255).optional(),
        newMarkdownContent: z.string().max(30_000).optional(),
      }),
    )
    .max(20)
    .optional()
    .describe('Danh sách các Notes cần sắp xếp/cập nhật hàng loạt (chỉ dùng cho batch_reorganize).'),
});

export function toManageNotesLightweightOutput(
  output?: ManageNotesToolOutput,
): Record<string, unknown> | undefined {
  if (!output) return undefined;
  return {
    ok: output.ok,
    action: output.action,
    riskTier: output.riskTier,
    summaryId: output.summaryId,
    title: output.title,
    affectedIds: output.affectedIds,
    actionLogId: output.actionLogId,
    undoable: output.undoable,
    message: output.message,
  };
}

export function createManageNotesTool(
  callback: ManageNotesCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'Create, rename, edit sections, refine, delete, or batch-reorganize Notes/Summaries in the Summaries tab (BlockNote format). WHEN TO USE: Student asks to write a new manual Note from chat/knowledge, rename a Note, append or edit a specific section inside a Note, rewrite/refine a Note, delete a Note, or reorganize multiple Notes. DO NOT USE when student wants to generate an AI summary directly from PDF/Word documents (use createDocumentSummary) or read an existing Note (use getNoteContent). Destructive/bulk actions (replace_content, refine_note, delete_note, batch_reorganize) automatically pause for student approval.',
    inputSchema: manageNotesInputSchema,
    needsApproval: (input) => requiresUserApproval('manageNotes', input),
    execute: async (
      input: ManageNotesToolInput,
      { toolCallId },
    ): Promise<ManageNotesToolOutput> => {
      const output = await callback(input, toolCallId);
      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'manageNotes',
          output,
          toManageNotesLightweightOutput(output),
        );
      }
      return output;
    },
    toModelOutput: ({ output }) => ({
      type: 'text',
      value: JSON.stringify(toManageNotesLightweightOutput(output) ?? output),
    }),
  });
}
