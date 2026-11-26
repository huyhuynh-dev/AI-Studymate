import { tool } from 'ai';
import { z } from 'zod';
import type {
  CreateDocumentSummaryCallback,
  CreateDocumentSummaryToolOutput,
  ToolCallTracker,
} from '../../types.js';

export const createDocumentSummaryInputSchema = z.object({
  scope: z
    .enum(['conversation', 'document', 'section'])
    .describe(
      'Summary scope: "conversation" (all documents in the conversation), "document" (one or more specific documents via documentIds), or "section" (a specific page range).',
    ),
  documentIds: z
    .array(z.string())
    .optional()
    .describe(
      'List of document UUIDs to summarize (required when scope is "document" or "section"). Multiple IDs are synthesized into one combined summary.',
    ),
  mode: z
    .enum(['key_takeaways', 'study_guide', 'qa_style'])
    .optional()
    .default('study_guide')
    .describe(
      'Summary format: "key_takeaways" (concise core outline), "study_guide" (detailed exam-prep guide), or "qa_style" (Q&A format).',
    ),
  length: z
    .enum(['short', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe(
      'Target length: "short" (~1 page), "standard" (2–3 pages), or "detailed" (comprehensive).',
    ),
  customInstruction: z
    .string()
    .optional()
    .describe(
      'Optional additional instructions from the user (e.g., focus areas, formatting preferences).',
    ),
  fromPage: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Start page number >= 1 (only when scope="section").'),
  toPage: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('End page number >= 1 (only when scope="section").'),
});

export function toSummaryLightweightOutput(
  output?: CreateDocumentSummaryToolOutput,
): Record<string, unknown> | undefined {
  if (!output) return undefined;
  return {
    summaryId: output.summaryId,
    title: output.title,
    scope: output.scope,
    mode: output.mode,
    length: output.length,
    documentNames: output.documentNames,
    createdAt: output.createdAt,
  };
}

export function createCreateDocumentSummaryTool(
  callback: CreateDocumentSummaryCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'CREATES and SAVES a NEW AI study summary into the Summaries tab. Use ONLY when the student explicitly wants to generate and save a new formal summary (not for regular chat Q&A). To READ or explain an existing Note/Summary, call getNoteContent instead. If multiple documents exist and the target document or style is ambiguous, clarify first using askUserQuestion (unless only one document exists, one is attached, or one is actively open in <current_ui_context>).',
    inputSchema: createDocumentSummaryInputSchema,
    execute: async (
      input,
      { toolCallId },
    ): Promise<CreateDocumentSummaryToolOutput> => {
      const output = await callback(input);

      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'createDocumentSummary',
          output,
          toSummaryLightweightOutput(output),
        );
      }

      return output;
    },
    toModelOutput: ({ output }) => {
      if (!output?.summaryId) {
        return {
          type: 'text',
          value: 'Không thể khởi tạo bản tóm tắt.',
        };
      }

      return {
        type: 'text',
        value: `Đã tạo bản tóm tắt thành công!\n- Tên bản tóm tắt: "${output.title}"\n- Mã bản tóm tắt (summaryId): "${output.summaryId}"\n- Phạm vi: ${output.scope} (${(output.documentNames || []).join(', ') || 'Toàn bộ tài liệu'})\n- Phong cách: ${output.mode} | Độ dài: ${output.length}`,
      };
    },
  });
}
