import { Injectable } from '@nestjs/common';
import { convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import { AiService } from './ai.service.js';

export const CHAT_AGENT_SYSTEM_PROMPT =
  'Bạn là trợ lý học tập AI thông minh của nền tảng AI StudyMate. ' +
  'Nhiệm vụ của bạn là hỗ trợ học sinh, sinh viên học tập, giải đáp câu hỏi và hướng dẫn kiến thức một cách chính xác, mạch lạc và dễ hiểu.\n\n' +
  'QUY TẮC ĐỊNH DẠNG NỘI DUNG:\n' +
  '1. Công thức toán học (LaTeX):\n' +
  '   - Dùng cú pháp `$ ... $` cho các ký hiệu hoặc công thức nội dòng (inline math). Ví dụ: `$O(1)$`, `$O(n \\log n)$`, `$x \\in \\mathbb{R}$`.\n' +
  '   - Dùng cú pháp `$$ ... $$` nằm trên các dòng riêng cho công thức dạng khối (block math).\n' +
  '   - Tuyệt đối KHÔNG sử dụng cú pháp `\\( ... \\)` hoặc `\\[ ... \\]`.\n' +
  '2. Khối mã lập trình (Code Blocks):\n' +
  '   - Luôn sử dụng 3 dấu backticks kèm theo định danh ngôn ngữ chuẩn (ví dụ: ```cpp, ```python, ```typescript, ```javascript, ```sql, ```json, ```html, v.v.).\n' +
  '   - Luôn viết code sạch, có chú thích ngắn gọn, súc tích.';

@Injectable()
export class ChatAgentAiService {
  constructor(private readonly aiService: AiService) {}

  async executeChatStream(
    messages: UIMessage[],
    onFinish: (result: { responseMessages: any; text: string }) => Promise<void>,
    abortSignal?: AbortSignal,
    systemPrompt: string = CHAT_AGENT_SYSTEM_PROMPT,
  ) {
    const modelMessages = await convertToModelMessages(messages);
    console.log(`[ChatAgentAiService] convertToModelMessages: input count=${messages.length}, output count=${modelMessages.length}`);

    return this.aiService.streamTextForTask('CHAT_AGENT', {
      system: systemPrompt,
      messages: modelMessages,
      abortSignal,
      onFinish: async (event) => {
        console.log(`[ChatAgentAiService] onFinish: text="${event.text?.slice(0, 50)}...", finishReason=${event.finishReason}`);
        await onFinish({
          responseMessages: event.response?.messages,
          text: event.text,
        });
      },
    });
  }
}
