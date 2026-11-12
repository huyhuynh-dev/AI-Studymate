import { Injectable, Logger } from '@nestjs/common';
import {
  convertToModelMessages,
  generateId,
  stepCountIs,
  validateUIMessages,
  TypeValidationError,
} from 'ai';
import type { UIMessage } from 'ai';
import { AiService } from './ai.service.js';
import type {
  AvailableDocumentItem,
} from '../documents/services/retrieval.service.js';
import {
  CHAT_AGENT_SYSTEM_PROMPT,
  AUTO_HEADER_SYSTEM_PROMPT,
  FOLLOW_UP_SUGGESTIONS_SYSTEM_PROMPT,
  buildSystemPromptWithDocumentCatalog,
} from './prompts/templates/chat-agent.prompt.js';
import {
  ToolRegistryService,
  type SearchDocumentChunksToolInput,
  type SearchDocumentChunksSourceSummary,
  type SearchDocumentChunksToolOutput,
  type SearchDocumentChunksCallback,
  type GetDocumentSectionOrPagesToolInput,
  type GetDocumentSectionOrPagesToolOutput,
  type GetDocumentSectionOrPagesCallback,
  type GetDocumentsFullContentToolInput,
  type DocumentFullContentSummaryItem,
  type GetDocumentsFullContentToolOutput,
  type GetDocumentsFullContentCallback,
  type DocumentMetadataItem,
  type GetConversationDocumentsMetadataToolOutput,
  type GetConversationDocumentsMetadataCallback,
  type AskUserQuestionItem,
  type AskUserQuestionToolInput,
  type CreateDocumentSummaryToolInput,
  type CreateDocumentSummaryToolOutput,
  type CreateDocumentSummaryCallback,
  type CitationItem,
} from './tools/index.js';

export {
  CHAT_AGENT_SYSTEM_PROMPT,
  AUTO_HEADER_SYSTEM_PROMPT,
  FOLLOW_UP_SUGGESTIONS_SYSTEM_PROMPT,
  buildSystemPromptWithDocumentCatalog,
  type SearchDocumentChunksToolInput,
  type SearchDocumentChunksSourceSummary,
  type SearchDocumentChunksToolOutput,
  type SearchDocumentChunksCallback,
  type GetDocumentSectionOrPagesToolInput,
  type GetDocumentSectionOrPagesToolOutput,
  type GetDocumentSectionOrPagesCallback,
  type GetDocumentsFullContentToolInput,
  type DocumentFullContentSummaryItem,
  type GetDocumentsFullContentToolOutput,
  type GetDocumentsFullContentCallback,
  type DocumentMetadataItem,
  type GetConversationDocumentsMetadataToolOutput,
  type GetConversationDocumentsMetadataCallback,
  type AskUserQuestionItem,
  type AskUserQuestionToolInput,
  type CreateDocumentSummaryToolInput,
  type CreateDocumentSummaryToolOutput,
  type CreateDocumentSummaryCallback,
  type CitationItem,
};

@Injectable()
export class ChatAgentAiService {
  private readonly logger = new Logger(ChatAgentAiService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  /**
   * Tạo danh mục công cụ phục vụ xác thực mảng tin nhắn UIMessage[]
   */
  getValidationTools(): Record<string, any> {
    return this.toolRegistry.getChatValidationTools();
  }

  /**
   * Xác thực mảng tin nhắn UIMessage[] theo chuẩn Vercel AI SDK v6
   */
  async validateIncomingMessages(messages: UIMessage[]): Promise<UIMessage[]> {
    try {
      const tools = this.getValidationTools();
      return await validateUIMessages({
        messages,
        tools,
      });
    } catch (error) {
      if (error instanceof TypeValidationError) {
        this.logger.error(
          `[ChatAgentAiService] validateIncomingMessages failed: ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Bổ sung Danh mục tài liệu khả dụng siêu gọn trong cuộc trò chuyện vào System Prompt
   */
  buildSystemPromptWithDocumentCatalog(
    basePrompt: string,
    availableDocuments?: AvailableDocumentItem[],
    attachedDocumentIds?: string[],
  ): string {
    return buildSystemPromptWithDocumentCatalog(
      basePrompt,
      availableDocuments,
      attachedDocumentIds,
    );
  }

  async executeChatStream(
    messages: UIMessage[],
    onFinish: (result: {
      responseMessages: any;
      assistantParts: any[];
      sourceChunkIds: string[];
      text: string;
      assistantUIMessage: UIMessage;
    }) => Promise<void>,
    abortSignal?: AbortSignal,
    options?: {
      systemPrompt?: string;
      availableDocuments?: AvailableDocumentItem[];
      attachedDocumentIds?: string[];
      onSearchDocumentChunks?: SearchDocumentChunksCallback;
      onGetDocumentSectionOrPages?: GetDocumentSectionOrPagesCallback;
      onGetDocumentsFullContent?: GetDocumentsFullContentCallback;
      onGetDocumentsMetadata?: GetConversationDocumentsMetadataCallback;
      onCreateDocumentSummary?: CreateDocumentSummaryCallback;
      chatConfig?: {
        modelName: string;
        temperature: number;
        maxOutputTokens: number;
        topK: number;
      };
    },
  ) {
    const chatConfig = options?.chatConfig ?? {
      modelName: 'cx/gpt-6-luna-medium',
      temperature: 0.5,
      maxOutputTokens: 2048,
      topK: 15,
    };

    const basePrompt = options?.systemPrompt ?? CHAT_AGENT_SYSTEM_PROMPT;
    const finalSystemPrompt = this.buildSystemPromptWithDocumentCatalog(
      basePrompt,
      options?.availableDocuments,
      options?.attachedDocumentIds,
    );

    const { tools, tracker } = this.toolRegistry.createChatSessionToolset(
      options,
      chatConfig.topK,
    );

    const activeTools = Object.keys(tools).length > 0 ? tools : undefined;

    const modelMessages = await convertToModelMessages(messages, {
      tools: activeTools,
    });
    this.logger.log(
      `[ChatAgentAiService] convertToModelMessages: input count=${messages.length}, output count=${modelMessages.length}, activeTools=${activeTools ? Object.keys(activeTools).join(',') : 'none'}, model=${chatConfig.modelName}, temp=${chatConfig.temperature}, maxTokens=${chatConfig.maxOutputTokens}, topK=${chatConfig.topK}`,
    );

    const streamResult = this.aiService.streamChatAgent(chatConfig.modelName, {
      system: finalSystemPrompt,
      messages: modelMessages,
      tools: activeTools,
      temperature: chatConfig.temperature,
      maxOutputTokens: chatConfig.maxOutputTokens,
      stopWhen: stepCountIs(5),
      abortSignal,
      onFinish: async (event) => {
        const responseMessages = event.response?.messages ?? [];
        const assistantParts = this.toolRegistry.extractAssistantUIParts(
          responseMessages,
          tracker,
          event.text,
        );

        const collectedChunkIds = tracker.getCollectedChunkIds();
        this.logger.log(
          `[ChatAgentAiService] onFinish: text="${event.text?.slice(0, 50)}...", finishReason=${event.finishReason}, partsCount=${assistantParts.length}, sourceChunks=${collectedChunkIds.size}`,
        );

        const assistantMessageId = event.response?.id || generateId();
        const assistantUIMessage: UIMessage = {
          id: assistantMessageId,
          role: 'assistant',
          parts: assistantParts,
        };

        await onFinish({
          responseMessages,
          assistantParts,
          sourceChunkIds: Array.from(collectedChunkIds),
          text: event.text,
          assistantUIMessage,
        });
      },
    });

    if (typeof (streamResult as any)?.consumeStream === 'function') {
      (streamResult as any).consumeStream();
    }

    (streamResult as any).tracker = tracker;

    return streamResult;
  }

  async generateSessionTitle(messages: UIMessage[]): Promise<string> {
    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) return '';

    // Lấy nội dung văn bản từ 1-2 tin nhắn đầu tiên của user
    const textSnippets: string[] = [];
    for (const msg of userMessages.slice(0, 2)) {
      if (Array.isArray(msg.parts)) {
        for (const part of msg.parts) {
          if (part.type === 'text' && typeof (part as any).text === 'string') {
            textSnippets.push((part as any).text);
          }
        }
      } else if (typeof (msg as any).content === 'string') {
        textSnippets.push((msg as any).content);
      }
    }

    const promptText = textSnippets.join('\n').trim();
    if (!promptText) return '';

    try {
      this.logger.log(
        `[ChatAgentAiService] Generating auto-header for prompt: "${promptText.slice(0, 80)}..."`,
      );
      const response = await this.aiService.generateTextForFeature(
        'AUTO_HEADER',
        {
          firstMessageSnippet: promptText,
        },
      );

      let rawTitle = response.text || '';
      // Làm sạch tiêu đề: loại bỏ ngoặc kép, dấu xuống dòng, tiền tố "Tiêu đề:"
      rawTitle = rawTitle
        .replace(/^["'«“`]+|["'»”`]+$/g, '')
        .replace(/^(tiêu đề|title|chủ đề):\s*/i, '')
        .replace(/\n+/g, ' ')
        .trim();

      // Giới hạn độ dài từ 3 đến 10 từ
      const words = rawTitle.split(/\s+/).filter(Boolean);
      if (words.length > 10) {
        rawTitle = words.slice(0, 10).join(' ');
      }

      this.logger.log(
        `[ChatAgentAiService] Generated auto-header title: "${rawTitle}"`,
      );
      return rawTitle;
    } catch (error: any) {
      this.logger.warn(
        `[ChatAgentAiService] generateSessionTitle error: ${error?.message}`,
      );
      return '';
    }
  }

  /**
   * Sinh 2-3 câu hỏi gợi ý tiếp nối (Follow-up Questions) dựa trên câu trả lời vừa hoàn tất của AI
   */
  async generateFollowUpSuggestions(
    lastAssistantResponse: string,
    lastUserQuestion?: string,
  ): Promise<string[]> {
    const trimmedResponse = lastAssistantResponse?.trim() || '';
    if (!trimmedResponse) return [];

    try {
      const { object } = await this.aiService.generateObjectForFeature(
        'FOLLOW_UP_SUGGESTIONS',
        {
          lastAssistantResponse: trimmedResponse,
          lastUserQuestion,
        },
      );

      const rawSuggestions = object?.suggestions;
      if (!Array.isArray(rawSuggestions)) {
        return [];
      }

      return rawSuggestions
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .slice(0, 3);
    } catch (error: any) {
      this.logger.warn(
        `[ChatAgentAiService] generateFollowUpSuggestions error: ${error?.message}`,
      );
      return [];
    }
  }
}
