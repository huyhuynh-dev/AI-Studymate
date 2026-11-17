import { z } from 'zod';

export const subQueryItemSchema = z.strictObject({
  semanticQuery: z
    .string()
    .describe(
      'Câu truy vấn ngữ nghĩa độc lập, rõ ràng cho một ý hoặc chủ đề con để tìm kiếm vector.',
    ),
  keywords: z
    .array(z.string())
    .describe(
      'Danh sách 2 đến 5 từ khóa hoặc thuật ngữ chuyên ngành (gồm cả từ đồng nghĩa Việt-Anh hoặc viết tắt nếu có) phục vụ tìm kiếm toàn văn PGRoonga.',
    ),
});

export const queryDecomposeSchema = z.strictObject({
  isComplex: z
    .boolean()
    .describe(
      'true nếu truy vấn gốc chứa nhiều ý, so sánh nhiều đối tượng hoặc nhiều chương cần tách nhánh; false nếu chỉ hỏi một ý đơn lẻ.',
    ),
  subQueries: z
    .array(subQueryItemSchema)
    .describe(
      'Danh sách từ 1 đến 3 truy vấn con độc lập bao phủ đầy đủ truy vấn gốc.',
    ),
});

export type SubQueryItem = z.infer<typeof subQueryItemSchema>;
export type QueryDecomposeOutput = z.infer<typeof queryDecomposeSchema>;
