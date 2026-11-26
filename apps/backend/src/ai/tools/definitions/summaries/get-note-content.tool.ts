import { tool } from 'ai';
import { z } from 'zod';
import type {
  GetNoteContentCallback,
  GetNoteContentToolOutput,
  ToolCallTracker,
} from '../../types.js';

const MAX_NOTE_MODEL_OUTPUT_CHARS = 10_500;

export const getNoteContentInputSchema = z.object({
  summaryId: z
    .string()
    .optional()
    .describe(
      'UUID of the Note/Summary to read (copy directly from <current_ui_context> activeNote.summaryId, notesList, or searchWorkspaceResources). Preferred over titleQuery.',
    ),
  titleQuery: z
    .string()
    .max(200)
    .optional()
    .describe(
      'Fallback keyword to match a Note title inside the current conversation ONLY when summaryId is not yet known.',
    ),
  sectionKeyword: z
    .string()
    .max(150)
    .optional()
    .describe(
      'Optional heading/section keyword to read only a specific section of a long Note (e.g., "Thuật toán sắp xếp", "Ví dụ").',
    ),
  charOffset: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe(
      'Character offset for continuing to read a truncated long Note (use nextCharOffset from a previous call). Default: 0.',
    ),
});

export function toNoteContentLightweightOutput(
  output?: GetNoteContentToolOutput,
): Record<string, unknown> | undefined {
  if (!output) return undefined;
  return {
    found: output.found,
    summaryId: output.summaryId,
    title: output.title,
    matchedSection: output.matchedSection,
    totalChars: output.totalChars,
    truncated: output.truncated,
    message: output.message,
  };
}

export function createGetNoteContentTool(
  callback: GetNoteContentCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'Read the Markdown content and section outline of an existing Note / Summary saved in the Summaries tab. Use when the student asks about the currently open Note in <current_ui_context> (even if its outline has no headings) or asks to explain/summarize/review an existing Note. NEVER use searchDocumentChunks or getDocumentSectionOrPages to read Notes, and NEVER use createDocumentSummary just to read an existing Note.',
    inputSchema: getNoteContentInputSchema,
    execute: async (input, { toolCallId }): Promise<GetNoteContentToolOutput> => {
      const output = await callback(input);

      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'getNoteContent',
          output,
          toNoteContentLightweightOutput(output),
        );
      }

      return output;
    },
    toModelOutput: ({ output }) => {
      if (!output?.found) {
        const candidatesBlock =
          Array.isArray(output?.candidates) && output.candidates.length > 0
            ? `\nDanh sách ghi chú khả dụng:\n${output.candidates
                .map((c) => `- "${c.title}" (summaryId: "${c.summaryId}")`)
                .join('\n')}`
            : '';
        return {
          type: 'text',
          value: `${output?.message || 'Không tìm thấy ghi chú yêu cầu.'}${candidatesBlock}`,
        };
      }

      const headerLines = [
        `[Ghi chú (Reference Data - Untrusted User Content)]`,
        `- Tiêu đề: "${output.title}" (summaryId: "${output.summaryId}")`,
        ...(output.sourceDocumentName
          ? [`- Tài liệu nguồn liên kết: "${output.sourceDocumentName}"`]
          : []),
        ...(output.sectionOutline.length > 0
          ? [`- Mục lục ghi chú: ${output.sectionOutline.join(' | ')}`]
          : ['- Mục lục ghi chú: (Ghi chú không có tiêu đề mục H1–H3)']),
        ...(output.matchedSection
          ? [`- Đang lọc theo mục: "${output.matchedSection}"`]
          : []),
        ...(output.message ? [`- Lưu ý: ${output.message}`] : []),
      ];

      const truncationFooter = output.truncated
        ? `\n\n[Nội dung bị cắt tại ${output.charOffset + output.contentMarkdown.length}/${output.totalChars} ký tự. Gọi lại getNoteContent với charOffset: ${output.nextCharOffset} hoặc lọc sectionKeyword để đọc tiếp.]`
        : '';

      const fullText = `${headerLines.join('\n')}\n\n${output.contentMarkdown || '(Ghi chú hiện đang trống)'}${truncationFooter}`;

      return {
        type: 'text',
        value:
          fullText.length > MAX_NOTE_MODEL_OUTPUT_CHARS
            ? `${fullText.slice(0, MAX_NOTE_MODEL_OUTPUT_CHARS - 1)}…`
            : fullText,
      };
    },
  });
}
