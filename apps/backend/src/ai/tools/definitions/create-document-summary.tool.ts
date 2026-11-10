import { tool } from 'ai';
import { z } from 'zod';
import type {
  CreateDocumentSummaryCallback,
  CreateDocumentSummaryToolOutput,
  ToolCallTracker,
} from '../types.js';

export const createDocumentSummaryInputSchema = z.object({
  scope: z
    .enum(['conversation', 'document', 'section'])
    .describe(
      'Phạm vi tóm tắt: "conversation" (toàn bộ tài liệu trong cuộc trò chuyện), "document" (một hoặc một nhóm tài liệu cụ thể chỉ định qua documentIds), "section" (một khoảng trang cụ thể).',
    ),
  documentIds: z
    .array(z.string())
    .optional()
    .describe(
      'Danh sách UUID của các tài liệu cần tóm tắt (bắt buộc khi scope là "document" hoặc "section"). Nếu truyền nhiều documentIds, nội dung các tài liệu này sẽ được tổng hợp chung vào 1 bản tóm tắt.',
    ),
  mode: z
    .enum(['key_takeaways', 'study_guide', 'qa_style'])
    .optional()
    .default('study_guide')
    .describe(
      'Phong cách bản tóm tắt: "key_takeaways" (Dàn ý cốt lõi), "study_guide" (Hồ sơ ôn thi chi tiết), "qa_style" (Hỏi & Đáp).',
    ),
  length: z
    .enum(['short', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe(
      'Độ dài mong muốn: "short" (Ngắn gọn ~1 trang), "standard" (Tiêu chuẩn 2-3 trang), "detailed" (Chi tiết).',
    ),
  customInstruction: z
    .string()
    .optional()
    .describe(
      'Yêu cầu hoặc chỉ dẫn bổ sung từ người dùng (ví dụ: tập trung vào phần nào, trình bày ra sao...).',
    ),
  fromPage: z
    .number()
    .optional()
    .describe('Trang bắt đầu (chỉ dùng khi scope="section").'),
  toPage: z
    .number()
    .optional()
    .describe('Trang kết thúc (chỉ dùng khi scope="section").'),
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
      'Khởi tạo bản tóm tắt tài liệu học tập bằng AI và lưu trực tiếp vào Tab Tóm tắt của cuộc trò chuyện. Sử dụng công cụ này khi người dùng yêu cầu tóm tắt một tài liệu, một nhóm tài liệu hoặc toàn bộ tài liệu.',
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
