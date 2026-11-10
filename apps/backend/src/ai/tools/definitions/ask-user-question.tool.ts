import { tool } from 'ai';
import { z } from 'zod';

export const askUserQuestionInputSchema = z.object({
  contextMessage: z
    .string()
    .optional()
    .describe(
      'Lời dẫn ngắn gọn, thân thiện giải thích vì sao bạn cần hỏi thêm thông tin từ người dùng.',
    ),
  questions: z
    .array(
      z.object({
        id: z
          .string()
          .describe(
            'Mã định danh ngắn gọn của câu hỏi (ví dụ: "target_docs", "merge_strategy", "summary_style").',
          ),
        question: z
          .string()
          .describe('Nội dung câu hỏi rõ ràng bằng tiếng Việt dành cho người dùng.'),
        options: z
          .array(z.string())
          .optional()
          .describe(
            'Danh sách các phương án gợi ý sẵn để người dùng bấm chọn nhanh trên giao diện.',
          ),
        allowMultiple: z
          .boolean()
          .optional()
          .describe(
            'Đặt là true nếu cho phép người dùng chọn nhiều phương án cùng lúc (mặc định: false).',
          ),
        allowCustomInput: z
          .boolean()
          .optional()
          .describe(
            'Đặt là true để cho phép người dùng nhập câu trả lời tự do ngoài các phương án gợi ý (mặc định: true).',
          ),
      }),
    )
    .min(1)
    .max(5)
    .describe('Danh sách từ 1 đến tối đa 5 câu hỏi cần người dùng phản hồi.'),
});

export function createAskUserQuestionTool() {
  return tool({
    description:
      'Đặt từ 1 đến tối đa 5 câu hỏi cho người dùng để làm rõ yêu cầu (ví dụ: chọn tài liệu cần tóm tắt, chọn gộp chung hay tách riêng các tài liệu khác chủ đề, chọn phong cách/độ dài hoặc định hướng tóm tắt) và chờ người dùng trả lời trên giao diện trước khi xử lý tiếp.',
    inputSchema: askUserQuestionInputSchema,
  });
}
