import { tool } from 'ai';
import { z } from 'zod';
import { requiresUserApproval } from '../../../utils/risk-gate.helper.js';
import type {
  ManageEditableDocumentCallback,
  ManageEditableDocumentToolInput,
  ManageEditableDocumentToolOutput,
  ToolCallTracker,
} from '../../types.js';

export const manageEditableDocumentInputSchema = z.object({
  action: z
    .enum([
      'read_content',
      'update_content',
      'save_as_new_document',
      'convert_note_to_markdown',
      'convert_markdown_to_note',
    ])
    .describe(
      'Thao tác trên tài liệu văn bản thuần (.md, .txt, .html, .json, .yaml, .csv): read_content (Tier 0 đọc toàn văn + version), update_content (Tier 2 ghi đè kèm Diff Preview cần duyệt), save_as_new_document | convert_note_to_markdown | convert_markdown_to_note (Tier 1 tạo mới + Undo).',
    ),
  documentId: z
    .string()
    .optional()
    .describe('UUID của tài liệu văn bản mục tiêu (cho read_content, update_content, convert_markdown_to_note).'),
  summaryId: z
    .string()
    .optional()
    .describe('UUID của Note/Summary nguồn (cho convert_note_to_markdown).'),
  charOffset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Vị trí bắt đầu đọc tiếp khi file dài (cho read_content).'),
  expectedVersion: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Version hiện tại đọc được từ read_content (khuyến nghị truyền cho update_content để tránh xung đột).'),
  replaceSnippet: z
    .object({
      oldSnippet: z.string().min(1),
      newSnippet: z.string(),
    })
    .optional()
    .describe('Thay thế một đoạn văn bản cụ thể trong file mà giữ nguyên phần còn lại (dùng cho update_content).'),
  newContent: z
    .string()
    .max(200_000)
    .optional()
    .describe('Toàn bộ nội dung mới của file (dùng cho update_content nếu không dùng replaceSnippet, hoặc dùng cho save_as_new_document).'),
  newFileName: z
    .string()
    .max(200)
    .optional()
    .describe('Tên file mới bao gồm đuôi (.md, .txt...) cho save_as_new_document hoặc convert_note_to_markdown.'),
  noteTitle: z
    .string()
    .max(255)
    .optional()
    .describe('Tiêu đề Note mới (cho convert_markdown_to_note).'),
});

export function toManageEditableDocLightweightOutput(
  output?: ManageEditableDocumentToolOutput,
): Record<string, unknown> | undefined {
  if (!output) return undefined;
  return {
    ok: output.ok,
    action: output.action,
    riskTier: output.riskTier,
    documentId: output.documentId,
    summaryId: output.summaryId,
    fileName: output.fileName,
    version: output.version,
    diffPreview: output.diffPreview,
    actionLogId: output.actionLogId,
    undoable: output.undoable,
    message: output.message,
  };
}

export function createManageEditableDocumentTool(
  callback: ManageEditableDocumentCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'Read, edit (with optimistic lock & Diff Preview), save as a new file, or convert plain-text/markup documents (.md, .txt, .html, .json, .yaml, .csv) and convert Notes <-> Markdown. WHEN TO USE: Student asks to inspect/proofread/rewrite/expand a .md/.txt workspace file, save an edited copy, or convert a Note into a .md file (or vice versa). DO NOT USE for .docx Word documents when SuperDoc tools are active (use superdoc_* tools) or for PDF files (read-only via getDocumentSectionOrPages). Always call read_content first before update_content.',
    inputSchema: manageEditableDocumentInputSchema,
    needsApproval: (input) =>
      requiresUserApproval('manageEditableDocument', input),
    execute: async (
      input: ManageEditableDocumentToolInput,
      { toolCallId },
    ): Promise<ManageEditableDocumentToolOutput> => {
      const output = await callback(input, toolCallId);
      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'manageEditableDocument',
          output,
          toManageEditableDocLightweightOutput(output),
        );
      }
      return output;
    },
    toModelOutput: ({ output }) => {
      if (output?.action === 'read_content' && output.ok) {
        const truncationFooter = output.truncated
          ? `\n\n[Nội dung bị cắt tại ${output.returnedChars ?? 0}/${output.totalChars ?? 0} ký tự. Gọi lại read_content với charOffset=${output.nextCharOffset} để đọc tiếp.]`
          : '';
        return {
          type: 'text',
          value: `[Tài liệu văn bản "${output.fileName}" (documentId: "${output.documentId}", version: ${output.version ?? 1})]\n\n${output.content ?? ''}${truncationFooter}`,
        };
      }
      return {
        type: 'text',
        value: JSON.stringify(
          toManageEditableDocLightweightOutput(output) ?? output,
        ),
      };
    },
  });
}
