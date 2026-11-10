import { z } from 'zod';

export const followUpSuggestionsSchema = z.object({
  suggestions: z
    .array(z.string().max(90))
    .min(2)
    .max(3)
    .describe(
      'Danh sách từ 2 đến 3 câu hỏi tiếp theo ngắn gọn, tự nhiên và bám sát nội dung vừa trả lời',
    ),
});

export type FollowUpSuggestionsOutput = z.infer<
  typeof followUpSuggestionsSchema
>;
