import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  convertToModelMessages,
  generateId,
  stepCountIs,
  validateUIMessages,
  TypeValidationError,
} from 'ai';
import type { ModelMessage, UIMessage } from 'ai';
import { AiService } from './ai.service.js';
import { ChatCompactionService } from './chat-compaction.service.js';
import type {
  AvailableDocumentItem,
} from '../documents/services/retrieval.service.js';
import {
  CHAT_AGENT_SYSTEM_PROMPT,
  CHAT_AGENT_PROMPT_VERSION,
  AUTO_HEADER_SYSTEM_PROMPT,
  FOLLOW_UP_SUGGESTIONS_SYSTEM_PROMPT,
  buildSystemPromptWithDocumentCatalog,
} from './prompts/templates/chat-agent.prompt.js';
import {
  AgentTelemetryService,
  type AgentTaskTraceSession,
} from './telemetry/agent-telemetry.service.js';
import { renderEphemeralUiContextBlock } from './prompts/templates/workspace-context.formatter.js';
import type { ResolvedWorkspaceContext } from './prompts/workspace-context.types.js';
import {
  buildSystemPromptWithSuperDocAgent,
  renderEphemeralWordSelectionBlock,
  type ActiveWordDocumentPromptContext,
} from './prompts/templates/superdoc-agent.prompt.js';
import { hasResolvedClarificationInCurrentChain } from './utils/clarification-policy.helper.js';
import {
  CLEAR_KEEP_RECENT_TURNS,
  buildClearedToolSummariesMap,
  clearOldToolResultsInModelMessages,
} from './utils/chat-context-manager.helper.js';
import {
  evaluateToolRiskTier,
  resolveActiveToolsForTurn,
} from './utils/risk-gate.helper.js';
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
  type CreateFlashcardsToolInput,
  type CreateFlashcardsToolOutput,
  type CreateFlashcardsCallback,
  type QuizToolQuestionType,
  type QuizToolDifficulty,
  type CreateQuizToolInput,
  type CreateQuizToolOutput,
  type CreateQuizCallback,
  type GetNoteContentToolInput,
  type GetNoteContentToolOutput,
  type GetNoteContentCallback,
  type GetQuizContentToolInput,
  type GetQuizContentToolOutput,
  type GetQuizContentCallback,
  type GetDeckCardsToolInput,
  type GetDeckCardsToolOutput,
  type GetDeckCardsCallback,
  type SearchWorkspaceResourcesToolInput,
  type SearchWorkspaceResourcesToolOutput,
  type SearchWorkspaceResourcesCallback,
  type SearchInternetToolInput,
  type SearchInternetToolOutput,
  type SearchInternetCallback,
  type ExtractWebPageToolInput,
  type ExtractWebPageToolOutput,
  type ExtractWebPageCallback,
  type SuperDocInspectCallback,
  type SuperDocPerformActionCallback,
  type SuperDocStreamTextCallback,
  type SuperDocApiSearchCallback,
  type SuperDocApiCallCallback,
  type SuperDocToolkitToolMeta,
  type ManageNotesCallback,
  type ManageFlashcardsCallback,
  type ManageQuizCallback,
  type ManageEditableDocumentCallback,
  type ManageWorkspaceAndJobsCallback,
  type CitationItem,
  type DocumentCitationItem,
  type WebCitationItem,
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
  type CreateFlashcardsToolInput,
  type CreateFlashcardsToolOutput,
  type CreateFlashcardsCallback,
  type QuizToolQuestionType,
  type QuizToolDifficulty,
  type CreateQuizToolInput,
  type CreateQuizToolOutput,
  type CreateQuizCallback,
  type GetNoteContentToolInput,
  type GetNoteContentToolOutput,
  type GetNoteContentCallback,
  type GetQuizContentToolInput,
  type GetQuizContentToolOutput,
  type GetQuizContentCallback,
  type GetDeckCardsToolInput,
  type GetDeckCardsToolOutput,
  type GetDeckCardsCallback,
  type SearchWorkspaceResourcesToolInput,
  type SearchWorkspaceResourcesToolOutput,
  type SearchWorkspaceResourcesCallback,
  type SearchInternetToolInput,
  type SearchInternetToolOutput,
  type SearchInternetCallback,
  type ExtractWebPageToolInput,
  type ExtractWebPageToolOutput,
  type ExtractWebPageCallback,
  type CitationItem,
  type DocumentCitationItem,
  type WebCitationItem,
};

/**
 * Tiêm block `<current_ui_context>` tạm thời vào message user cuối cùng trong mảng `ModelMessage[]`
 * (chỉ tồn tại trong RAM của lượt hiện tại, không làm thay đổi `UIMessage` lưu DB và giữ nguyên Prompt Cache prefix).
 */
export function injectEphemeralTurnContext(
  modelMessages: ModelMessage[],
  contextBlock: string,
): ModelMessage[] {
  if (!contextBlock || !Array.isArray(modelMessages) || modelMessages.length === 0) {
    return modelMessages;
  }

  let lastUserIdx = -1;
  for (let i = modelMessages.length - 1; i >= 0; i -= 1) {
    if (modelMessages[i]?.role === 'user') {
      lastUserIdx = i;
      break;
    }
  }

  if (lastUserIdx === -1) {
    return modelMessages;
  }

  const target = modelMessages[lastUserIdx];
  if (!target || target.role !== 'user') {
    return modelMessages;
  }

  const nextMessages = [...modelMessages];

  if (typeof target.content === 'string') {
    nextMessages[lastUserIdx] = {
      ...target,
      content: `${contextBlock}\n\n${target.content}`,
    };
    return nextMessages;
  }

  if (Array.isArray(target.content)) {
    nextMessages[lastUserIdx] = {
      ...target,
      content: [{ type: 'text' as const, text: contextBlock }, ...target.content],
    };
    return nextMessages;
  }

  return modelMessages;
}

@Injectable()
export class ChatAgentAiService {
  private readonly logger = new Logger(ChatAgentAiService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly toolRegistry: ToolRegistryService,
    @Optional()
    private readonly chatCompactionService?: ChatCompactionService,
    @Optional()
    private readonly agentTelemetryService?: AgentTelemetryService,
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
    options?: { omitAttachedTag?: boolean },
  ): string {
    return buildSystemPromptWithDocumentCatalog(
      basePrompt,
      availableDocuments,
      attachedDocumentIds,
      options,
    );
  }

  /**
   * Hòa giải các client-side tool call còn dang dở (ví dụ `tool-askUserQuestion` ở trạng thái
   * `input-available` / `input-streaming`) khi phía sau đã có tin nhắn mới từ người dùng.
   * Ngăn lỗi `AI_MissingToolResultsError` từ `convertToLanguageModelPrompt` của Vercel AI SDK v6.
   */
  sanitizePendingToolCalls(messages: UIMessage[]): UIMessage[] {
    if (!Array.isArray(messages) || messages.length <= 1) {
      return messages;
    }

    return messages.map((msg, idx) => {
      const hasSubsequentMessage = idx < messages.length - 1;
      if (
        !hasSubsequentMessage ||
        msg.role !== 'assistant' ||
        !Array.isArray(msg.parts)
      ) {
        return msg;
      }

      let hasPendingTool = false;
      const sanitizedParts = msg.parts.map((part: any) => {
        if (
          part &&
          typeof part.type === 'string' &&
          part.type.startsWith('tool-')
        ) {
          if (
            part.state === 'input-available' ||
            part.state === 'input-streaming'
          ) {
            hasPendingTool = true;
            return {
              ...part,
              state: 'output-available',
              output: {
                skipped: true,
                note: 'User bypassed the interactive question widget and sent a new message directly.',
              },
            };
          }
          if (part.state === 'approval-requested') {
            hasPendingTool = true;
            return {
              ...part,
              state: 'output-denied',
              approval: {
                ...part.approval,
                id: part.approval?.id ?? part.toolCallId,
                approved: false,
                reason:
                  'User bypassed the approval confirmation card and sent a new message directly.',
              },
            };
          }
        }
        return part;
      });

      return hasPendingTool ? { ...msg, parts: sanitizedParts } : msg;
    });
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
      onCreateFlashcards?: CreateFlashcardsCallback;
      onCreateQuiz?: CreateQuizCallback;
      onGetNoteContent?: GetNoteContentCallback;
      onGetQuizContent?: GetQuizContentCallback;
      onGetDeckCards?: GetDeckCardsCallback;
      onSearchWorkspaceResources?: SearchWorkspaceResourcesCallback;
      onSearchInternet?: SearchInternetCallback;
      onExtractWebPage?: ExtractWebPageCallback;
      activeWordDocument?: ActiveWordDocumentPromptContext;
      onSuperDocInspect?: SuperDocInspectCallback;
      onSuperDocPerformAction?: SuperDocPerformActionCallback;
      onSuperDocStreamText?: SuperDocStreamTextCallback;
      onSuperDocApiSearch?: SuperDocApiSearchCallback;
      onSuperDocApiCall?: SuperDocApiCallCallback;
      superdocToolkitMeta?: SuperDocToolkitToolMeta;
      onManageNotes?: ManageNotesCallback;
      onManageFlashcards?: ManageFlashcardsCallback;
      onManageQuiz?: ManageQuizCallback;
      onManageEditableDocument?: ManageEditableDocumentCallback;
      onManageWorkspaceAndJobs?: ManageWorkspaceAndJobsCallback;
      workspaceContext?: ResolvedWorkspaceContext;
      chatSessionId?: string;
      userId?: string;
      conversationId?: string;
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
    const promptWithCatalog = this.buildSystemPromptWithDocumentCatalog(
      basePrompt,
      options?.availableDocuments,
      options?.attachedDocumentIds,
      { omitAttachedTag: Boolean(options?.workspaceContext) },
    );
    const finalSystemPrompt = buildSystemPromptWithSuperDocAgent(
      promptWithCatalog,
      options?.activeWordDocument,
    );

    const { tools, tracker } = this.toolRegistry.createChatSessionToolset(
      options,
      chatConfig.topK,
    );

    const activeTools = Object.keys(tools).length > 0 ? tools : undefined;
    const lastUserText = (() => {
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        const msg = messages[i];
        if (msg?.role === 'user' && Array.isArray(msg.parts)) {
          return msg.parts
            .filter((p: any) => p?.type === 'text' && typeof p.text === 'string')
            .map((p: any) => p.text)
            .join(' ');
        }
      }
      return '';
    })();
    const scopedActiveToolNames = activeTools
      ? resolveActiveToolsForTurn({
          registeredToolNames: Object.keys(activeTools),
          hasActiveWordDocument: Boolean(options?.activeWordDocument?.documentId),
          lastUserMessageText: lastUserText,
        })
      : undefined;
    const toolApprovalSecret =
      process.env.AGENT_TOOL_APPROVAL_SECRET ||
      process.env.JWT_SECRET ||
      'studymate-phase4-tool-approval-secret';
    const maxSteps =
      options?.onSuperDocPerformAction || options?.onSuperDocStreamText
        ? 12
        : 8;

    const sanitizedMessages = this.sanitizePendingToolCalls(messages);
    const clarificationCompleted =
      hasResolvedClarificationInCurrentChain(sanitizedMessages);
    const clearedSummaryMap = buildClearedToolSummariesMap(
      sanitizedMessages,
      CLEAR_KEEP_RECENT_TURNS,
    );
    const baseModelMessages = await convertToModelMessages(sanitizedMessages, {
      tools: activeTools,
    });
    const clearingResult = clearOldToolResultsInModelMessages(
      baseModelMessages,
      clearedSummaryMap,
    );
    const compactionResult = this.chatCompactionService
      ? await this.chatCompactionService.compactIfNeeded({
          chatSessionId: options?.chatSessionId,
          modelMessages: clearingResult.messages,
          uiMessages: sanitizedMessages,
        })
      : {
          messages: clearingResult.messages,
          compacted: false,
          fromCache: false,
          usedFallback: false,
          estimatedTokensBefore: 0,
          estimatedTokensAfter: 0,
          compactedTurns: 0,
        };

    const wordSelectionBlock = renderEphemeralWordSelectionBlock(
      options?.activeWordDocument?.selectedText,
    );
    const ephemeralUiBlock = options?.workspaceContext
      ? renderEphemeralUiContextBlock(options.workspaceContext, {
          omitDocumentSelection: Boolean(wordSelectionBlock),
          clarificationCompleted,
        })
      : clarificationCompleted
        ? '<current_ui_context trust="application_verified" scope="turn_only">\n[CLARIFICATION_COMPLETED] User already responded to or skipped clarification for this request. Proceed directly using reasonable defaults—do NOT call askUserQuestion again.\n</current_ui_context>'
        : '';
    const combinedEphemeralBlock = [ephemeralUiBlock, wordSelectionBlock]
      .filter(Boolean)
      .join('\n\n');
    const modelMessages = combinedEphemeralBlock
      ? injectEphemeralTurnContext(
          compactionResult.messages,
          combinedEphemeralBlock,
        )
      : compactionResult.messages;
    this.logger.log(
      `[ChatAgentAiService] contextPipeline: input=${messages.length}, modelMsgs=${modelMessages.length}, clearedTools=${clearingResult.clearedToolCount}, prunedReasoning=${clearingResult.prunedReasoningCount}, savedChars=${clearingResult.savedChars}, compacted=${compactionResult.compacted} (cache=${compactionResult.fromCache}, fallback=${compactionResult.usedFallback}, tokens=${compactionResult.estimatedTokensBefore}->${compactionResult.estimatedTokensAfter}), activeTools=${scopedActiveToolNames ? scopedActiveToolNames.join(',') : 'none'} (${scopedActiveToolNames?.length ?? 0}), model=${chatConfig.modelName}`,
    );

    const startedAt = Date.now();
    const telemetryService =
      typeof this.aiService.getTelemetryService === 'function'
        ? this.aiService.getTelemetryService()
        : undefined;
    const capturedUserId =
      options?.userId ?? telemetryService?.getCurrentUserId();

    const traceSession: AgentTaskTraceSession | undefined =
      this.agentTelemetryService?.startTaskTrace({
        userId: capturedUserId,
        conversationId: options?.conversationId,
        chatSessionId: options?.chatSessionId,
        modelName: chatConfig.modelName,
        promptVersion: CHAT_AGENT_PROMPT_VERSION,
        uiPageType: options?.workspaceContext?.location?.pageType ?? null,
        activeToolsCount: scopedActiveToolNames?.length ?? 0,
      });

    if (compactionResult.compacted) {
      traceSession?.recordCompactionSpan({
        compactedTurns: compactionResult.compactedTurns,
        tokensBefore: compactionResult.estimatedTokensBefore,
        tokensAfter: compactionResult.estimatedTokensAfter,
        usedFallback: compactionResult.usedFallback,
      });
    }

    const streamResult = this.aiService.streamChatAgent(chatConfig.modelName, {
      system: finalSystemPrompt,
      messages: modelMessages,
      tools: activeTools,
      ...(scopedActiveToolNames && scopedActiveToolNames.length > 0
        ? { activeTools: scopedActiveToolNames }
        : {}),
      experimental_toolApprovalSecret: toolApprovalSecret,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'studymate.chat_agent',
        metadata: {
          chatSessionId: options?.chatSessionId ?? '',
          promptVersion: CHAT_AGENT_PROMPT_VERSION,
        },
      },
      temperature: chatConfig.temperature,
      maxOutputTokens: chatConfig.maxOutputTokens,
      stopWhen: stepCountIs(maxSteps),
      abortSignal,
      onStepFinish: (stepEvent: any) => {
        const stepUsage = stepEvent?.usage ?? {};
        const cacheReadTokens =
          stepUsage?.cachedInputTokens ??
          stepUsage?.inputTokenDetails?.cacheReadTokens ??
          0;
        traceSession?.recordStepSpan({
          stepNumber: Number(stepEvent?.stepNumber ?? 1),
          inputTokens: stepUsage?.inputTokens ?? stepUsage?.promptTokens ?? 0,
          outputTokens:
            stepUsage?.outputTokens ?? stepUsage?.completionTokens ?? 0,
          cacheReadTokens:
            typeof cacheReadTokens === 'number' ? cacheReadTokens : 0,
          finishReason:
            typeof stepEvent?.finishReason === 'string'
              ? stepEvent.finishReason
              : undefined,
        });
        if (Array.isArray(stepEvent?.toolCalls)) {
          for (const tc of stepEvent.toolCalls) {
            const tcName = String(tc?.toolName ?? 'unknown');
            const tcId = String(tc?.toolCallId ?? '');
            const hasApprovalReq =
              Array.isArray(stepEvent?.content) &&
              stepEvent.content.some(
                (p: any) =>
                  p?.type === 'tool-approval-request' && p?.toolCallId === tcId,
              );
            traceSession?.recordToolSpan({
              toolName: tcName,
              toolCallId: tcId,
              riskTier: evaluateToolRiskTier(tcName, tc?.input),
              outcome: hasApprovalReq ? 'approval_requested' : 'ok',
            });
          }
        }
      },
      onAbort: () => {
        traceSession?.finish({
          status: 'aborted',
          compacted: compactionResult.compacted,
        });
      },
      onError: (err) => {
        const msg =
          err instanceof Error
            ? err.message
            : typeof (err as any)?.error === 'string'
              ? (err as any).error
              : 'Stream error';
        traceSession?.finish({
          status: 'error',
          compacted: compactionResult.compacted,
          errorMessage: msg,
        });
      },
      onFinish: async (event) => {
        const rawUsage = (event as { totalUsage?: unknown; usage?: unknown })
          .totalUsage ?? (event as { usage?: unknown }).usage;
        const usageObj = (rawUsage ?? null) as {
          inputTokens?: number;
          outputTokens?: number;
          totalTokens?: number;
          promptTokens?: number;
          completionTokens?: number;
          cachedInputTokens?: number;
          inputTokenDetails?: { cacheReadTokens?: number };
        } | null;

        const inputTok =
          usageObj?.inputTokens ??
          usageObj?.promptTokens ??
          Math.max(1, Math.ceil(finalSystemPrompt.length / 4));
        const outputTok =
          usageObj?.outputTokens ??
          usageObj?.completionTokens ??
          Math.max(0, Math.ceil((event.text?.length ?? 0) / 4));
        const cacheReadTok =
          usageObj?.cachedInputTokens ??
          usageObj?.inputTokenDetails?.cacheReadTokens ??
          0;

        telemetryService?.recordUsage({
          userId: capturedUserId,
          featureKey: 'CHAT_AGENT',
          profile: 'REASONING',
          modelName: chatConfig.modelName,
          promptTokens: inputTok,
          completionTokens: outputTok,
          totalTokens: usageObj?.totalTokens,
          latencyMs: Date.now() - startedAt,
          status: 'success',
        });

        const responseMessages = event.response?.messages ?? [];
        const assistantParts = this.toolRegistry.extractAssistantUIParts(
          responseMessages,
          tracker,
          event.text,
        );
        const hasPendingApproval = assistantParts.some(
          (p: any) => p?.state === 'approval-requested',
        );

        traceSession?.finish({
          status: hasPendingApproval ? 'approval_paused' : 'success',
          inputTokens: inputTok,
          outputTokens: outputTok,
          cacheReadTokens: typeof cacheReadTok === 'number' ? cacheReadTok : 0,
          compacted: compactionResult.compacted,
        });

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
    (streamResult as any).agentContextMeta = {
      compacted: compactionResult.compacted,
      compactedTurns: compactionResult.compactedTurns,
      clearedToolCount: clearingResult.clearedToolCount,
    };

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
