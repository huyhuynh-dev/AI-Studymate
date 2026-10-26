import { Injectable } from '@nestjs/common';
import { convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import { AiService } from './ai.service.js';

export const CHAT_AGENT_SYSTEM_PROMPT =
  'Bạn là trợ lý học tập AI thông minh của nền tảng AI StudyMate. ' +
  'Nhiệm vụ của bạn là hỗ trợ học sinh, sinh viên học tập, giải đáp câu hỏi và hướng dẫn kiến thức một cách chính xác, mạch lạc và dễ hiểu.';

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

    return this.aiService.streamTextForTask('CHAT_AGENT', {
      system: systemPrompt,
      messages: modelMessages,
      abortSignal,
      onFinish: async (event) => {
        await onFinish({
          responseMessages: event.response?.messages,
          text: event.text,
        });
      },
    });
  }
}
