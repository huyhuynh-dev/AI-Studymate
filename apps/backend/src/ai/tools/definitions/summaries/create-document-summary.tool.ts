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
    .optional()
    .describe(
      'Summary scope: omit or pass "document" when targeting specific/open files; pass "section" for a page range; pass "conversation" ONLY when the student explicitly asks to summarize ALL documents together.',
    ),
  documentIds: z
    .array(z.string())
    .optional()
    .describe(
      'List of document UUIDs to summarize (copy from <workspace_documents> or <current_ui_context>). Omit if using the open/attached file.',
    ),
  mode: z
    .enum(['key_takeaways', 'study_guide', 'qa_style'])
    .optional()
    .describe(
      'Optional summary format: "key_takeaways", "study_guide", or "qa_style". Omit unless specified (backend defaults safely to "study_guide").',
    ),
  length: z
    .enum(['short', 'standard', 'detailed'])
    .optional()
    .describe(
      'Optional target length: "short", "standard", or "detailed". Omit unless specified (backend defaults safely to "standard").',
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
    ...(output.status && output.status !== 'created'
      ? { status: output.status }
      : {}),
    ...(output.appliedDefaults?.length
      ? { appliedDefaults: output.appliedDefaults }
      : {}),
    ...(output.message ? { message: output.message } : {}),
  };
}

export function createCreateDocumentSummaryTool(
  callback: CreateDocumentSummaryCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'CREATES and SAVES a NEW AI study summary into the Summaries tab. Use ONLY when the student explicitly wants to generate and save a new formal summary (not for regular chat Q&A). To READ or explain an existing Note/Summary, call getNoteContent instead. Clarify via askUserQuestion ONLY when multiple documents exist and the source target is ambiguous; otherwise call immediately and omit unspecified optional parameters so backend defaults apply.',
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
      if (output?.status === 'needs_clarification') {
        const candidateLines = (output.candidates || [])
          .map((c) => `- "${c.fileName}" (documentId: "${c.documentId}")`)
          .join('\n');
        return {
          type: 'text',
          value: `CẦN HỎI LÀM RÕ NGUỒN TÀI LIỆU (Chưa tạo bản tóm tắt): ${output.message || ''}\nDanh sách tài liệu khả dụng:\n${candidateLines}\nHãy gọi ngay tool \`askUserQuestion\` với 1 câu hỏi chọn nguồn (liệt kê các tài liệu trên + "Tất cả tài liệu trong phiên", allowMultiple: true, allowCustomInput: false) và KHÔNG khẳng định đã tạo.`,
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

      if (!output?.summaryId) {
        return {
          type: 'text',
          value: output?.message || 'Không thể khởi tạo bản tóm tắt.',
        };
      }

      const defaultsLine =
        Array.isArray(output.appliedDefaults) && output.appliedDefaults.length > 0
          ? `\n- Tham số mặc định đã tự áp dụng (hãy nhắc ngắn 1 câu tự nhiên kèm lời mời điều chỉnh): ${output.appliedDefaults.join(', ')}`
          : '';

      return {
        type: 'text',
        value: `Đã tạo bản tóm tắt thành công!\n- Tên bản tóm tắt: "${output.title}"\n- Mã bản tóm tắt (summaryId): "${output.summaryId}"\n- Phạm vi: ${output.scope} (${(output.documentNames || []).join(', ') || 'Toàn bộ tài liệu'})\n- Phong cách: ${output.mode} | Độ dài: ${output.length}${defaultsLine}`,
      };
    },
  });
}
