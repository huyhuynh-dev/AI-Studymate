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
      'Hiển thị widget hỏi đáp tương tác (1–3 câu hỏi gợi ý chọn nhanh) khi cần làm rõ yêu cầu phức tạp, nhiều lựa chọn hoặc thiếu tham số quy trình (ví dụ: chọn tài liệu nào trong nhiều file, chọn phạm vi/phong cách tóm tắt, chọn hướng giải thích cơ bản hay chuyên sâu). Nếu chỉ cần hỏi 1 câu ngắn đơn giản (như hỏi số trang hay xin đoạn code), hãy hỏi tự nhiên bằng văn bản thay vì gọi tool này.',
    inputSchema: askUserQuestionInputSchema,
  });
}
