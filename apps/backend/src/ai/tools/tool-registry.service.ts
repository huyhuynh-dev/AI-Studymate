import { Injectable, Logger } from '@nestjs/common';
import { tool } from 'ai';
import { toolDefinitionsToToolSet } from '@blocknote/xl-ai/server';
import type {
  ChatAgentToolName,
  ChatSessionToolCallbacks,
  CitationItem,
  ToolCallTracker,
} from './types.js';
import {
  createAskUserQuestionTool,
} from './definitions/common/index.js';
import {
  createSearchDocumentChunksTool,
  searchDocumentChunksInputSchema,
  createGetDocumentSectionOrPagesTool,
  getDocumentSectionOrPagesInputSchema,
  createGetDocumentsFullContentTool,
  getDocumentsFullContentInputSchema,
  getConversationDocumentsMetadataInputSchema,
} from './definitions/documents/index.js';
import {
  createCreateDocumentSummaryTool,
  createDocumentSummaryInputSchema,
} from './definitions/summaries/index.js';

export class ChatSessionToolTracker implements ToolCallTracker {
  private readonly collectedChunkIds = new Set<string>();
  private readonly rawOutputs = new Map<
    string,
    { toolName: ChatAgentToolName; output: unknown }
  >();
  private readonly lightweightOutputs = new Map<
    string,
    Record<string, unknown>
  >();

  // Turn-scoped citation counter & registry
  private citationCounter = 0;
  private readonly citationsByChunkKey = new Map<string, CitationItem>();
  private readonly citationsById = new Map<string, CitationItem>();

  recordChunkId(chunkId: string): void {
    if (chunkId) {
      this.collectedChunkIds.add(chunkId);
    }
  }

  /**
   * Cấp phát citationId tuần tự (c1, c2, c3...) duy nhất cho toàn bộ turn stream.
   * Nếu cùng 1 chunkId (hoặc cùng documentId + chunkIndex) đã được cấp citationId trước đó
   * (ở bước tool trước trong cùng turn), trả về lại citationId cũ để tránh trùng lặp.
   */
  allocateCitation(chunk: Omit<CitationItem, 'citationId'>): string {
    const chunkKey =
      chunk.chunkId ||
      `${chunk.documentId}:${(chunk as any).chunkIndex ?? ''}`;
    const existing = this.citationsByChunkKey.get(chunkKey);
    if (existing) {
      return existing.citationId;
    }

    this.citationCounter += 1;
    const citationId = `c${this.citationCounter}`;

    const citationItem: CitationItem = {
      ...chunk,
      citationId,
    };

    this.citationsByChunkKey.set(chunkKey, citationItem);
    this.citationsById.set(citationId, citationItem);
    if (chunk.chunkId) {
      this.recordChunkId(chunk.chunkId);
    }

    return citationId;
  }

  getAllCitations(): CitationItem[] {
    return Array.from(this.citationsById.values());
  }

  getCitation(citationId: string): CitationItem | undefined {
    return this.citationsById.get(citationId);
  }

  recordOutput(
    toolCallId: string,
    toolName: ChatAgentToolName,
    rawOutput: unknown,
    lightweightOutput?: Record<string, unknown>,
  ): void {
    this.rawOutputs.set(toolCallId, { toolName, output: rawOutput });
    if (lightweightOutput) {
      this.lightweightOutputs.set(toolCallId, lightweightOutput);
    }
  }

  getLightweightOutput(toolCallId: string): Record<string, unknown> | undefined {
    return this.lightweightOutputs.get(toolCallId);
  }

  getCollectedChunkIds(): Set<string> {
    return this.collectedChunkIds;
  }
}

export type BlocknoteToolDefinitions = Parameters<
  typeof toolDefinitionsToToolSet
>[0];

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);

  /**
   * Tạo danh mục công cụ phục vụ bước xác thực validateUIMessages()
   * Tái sử dụng 100% inputSchema chuẩn của từng tool để đảm bảo DRY
   */
  getChatValidationTools(): Record<string, any> {
    return {
      askUserQuestion: createAskUserQuestionTool(),
      searchDocumentChunks: tool({
        description: 'Tìm kiếm các đoạn trích trong tài liệu',
        inputSchema: searchDocumentChunksInputSchema,
      }),
      getDocumentSectionOrPages: tool({
        description:
          'Đọc nội dung văn bản theo phân đoạn, mục hoặc trang của tài liệu',
        inputSchema: getDocumentSectionOrPagesInputSchema,
      }),
      getDocumentsFullContent: tool({
        description: 'Lấy toàn bộ nội dung văn bản của tài liệu',
        inputSchema: getDocumentsFullContentInputSchema,
      }),
      getConversationDocumentsMetadata: tool({
        description: 'Lấy thông tin metadata tài liệu trong cuộc trò chuyện',
        inputSchema: getConversationDocumentsMetadataInputSchema,
      }),
      createDocumentSummary: tool({
        description: 'Khởi tạo bản tóm tắt tài liệu',
        inputSchema: createDocumentSummaryInputSchema,
      }),
    };
  }

  /**
   * Khởi tạo bộ công cụ động và tracker cho một phiên streaming của Chat Agent
   */
  createChatSessionToolset(
    callbacks?: ChatSessionToolCallbacks,
    maxChunks: number = 15,
  ): {
    tools: Record<string, any>;
    tracker: ToolCallTracker;
  } {
    const tracker = new ChatSessionToolTracker();
    const tools: Record<string, any> = {
      askUserQuestion: createAskUserQuestionTool(),
    };

    if (callbacks?.onSearchDocumentChunks) {
      tools.searchDocumentChunks = createSearchDocumentChunksTool(
        callbacks.onSearchDocumentChunks,
        tracker,
        maxChunks,
      );
    }

    if (callbacks?.onGetDocumentSectionOrPages) {
      tools.getDocumentSectionOrPages = createGetDocumentSectionOrPagesTool(
        callbacks.onGetDocumentSectionOrPages,
        tracker,
      );
    } else if (callbacks?.onGetDocumentsFullContent) {
      tools.getDocumentsFullContent = createGetDocumentsFullContentTool(
        callbacks.onGetDocumentsFullContent,
        tracker,
      );
    }

    // getConversationDocumentsMetadata không được đăng ký vào toolset hoạt động
    // vì danh mục tài liệu đã được nhúng sẵn ở System Prompt (Context Injection)

    if (callbacks?.onCreateDocumentSummary) {
      tools.createDocumentSummary = createCreateDocumentSummaryTool(
        callbacks.onCreateDocumentSummary,
        tracker,
      );
    }

    return {
      tools,
      tracker,
    };
  }

  /**
   * Chuyển đổi danh sách ResponseMessage từ các bước gọi Tool sang mảng UIMessagePart chuẩn
   */
  extractAssistantUIParts(
    responseMessages: any[],
    tracker: ToolCallTracker,
    fallbackText?: string,
  ): any[] {
    const parts: any[] = [];

    // Tập hợp các toolCallId đã có tool-result trong responseMessages
    const completedToolResultsByCallId = new Map<string, unknown>();
    for (const msg of responseMessages) {
      if (msg?.role === 'tool' && Array.isArray(msg.content)) {
        for (const item of msg.content) {
          if (item?.type === 'tool-result' && item.toolCallId) {
            completedToolResultsByCallId.set(
              item.toolCallId,
              item.output ?? item.result,
            );
          }
        }
      }
    }

    for (const msg of responseMessages) {
      if (msg?.role !== 'assistant' || !Array.isArray(msg.content)) {
        continue;
      }

      for (const contentPart of msg.content) {
        if (!contentPart || typeof contentPart !== 'object') continue;

        if (contentPart.type === 'reasoning') {
          const reasoningText = contentPart.text || contentPart.reasoning || '';
          if (reasoningText) {
            parts.push({
              type: 'reasoning',
              text: reasoningText,
            });
          }
        } else if (contentPart.type === 'tool-call') {
          const toolName = (contentPart.toolName ||
            'searchDocumentChunks') as ChatAgentToolName;
          const toolCallId = contentPart.toolCallId;

          // Client-Side Tool: askUserQuestion (khi dừng chờ người dùng trả lời thì chưa có kết quả)
          if (toolName === 'askUserQuestion') {
            const hasResult =
              toolCallId && completedToolResultsByCallId.has(toolCallId);
            parts.push({
              type: 'tool-askUserQuestion',
              toolCallId,
              state: hasResult ? 'output-available' : 'input-available',
              input: contentPart.input,
              ...(hasResult
                ? { output: completedToolResultsByCallId.get(toolCallId) }
                : {}),
            });
            continue;
          }

          // Server-Side Tools: Lấy dữ liệu lightweightOutput từ tracker
          const lightweightOutput = toolCallId
            ? tracker.getLightweightOutput(toolCallId)
            : undefined;

          parts.push({
            type: `tool-${toolName}`,
            toolCallId,
            state: 'output-available',
            input: contentPart.input,
            output: lightweightOutput,
          });
        } else if (
          contentPart.type === 'text' &&
          typeof contentPart.text === 'string' &&
          contentPart.text.length > 0
        ) {
          parts.push({
            type: 'text',
            text: contentPart.text,
          });
        }
      }
    }

    if (parts.length === 0 && fallbackText) {
      parts.push({
        type: 'text',
        text: fallbackText,
      });
    }

    return parts;
  }

  /**
   * Chuyển đổi định nghĩa công cụ của BlockNote sang ToolSet của AI SDK
   */
  createBlocknoteToolset(toolDefinitions: BlocknoteToolDefinitions) {
    return toolDefinitionsToToolSet(toolDefinitions);
  }
}
