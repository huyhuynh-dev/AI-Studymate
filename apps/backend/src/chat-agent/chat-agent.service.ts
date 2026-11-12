import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createIdGenerator, type UIMessage } from 'ai';
import { ChatAgentRepoService } from '../repo/chat-agent-repo/chat-agent-repo.service.js';
import { DocumentsRepoService } from '../repo/documents-repo/documents-repo.service.js';
import { ChatAgentAiService } from '../ai/chat-agent-ai.service.js';
import { RetrievalService } from '../documents/services/retrieval.service.js';
import { SummariesService } from '../summaries/summaries.service.js';
import { TavilyService } from '../search/tavily.service.js';
import {
  SummaryLength,
  SummaryMode,
  SummaryScope,
} from '../summaries/dto/create-summary.dto.js';
import { CreateChatSessionDto } from './dto/create-chat-session.dto.js';
import { UpdateChatSessionDto } from './dto/update-chat-session.dto.js';
import { GenerateSuggestionsDto } from './dto/generate-suggestions.dto.js';

export interface ResolvedChatConfig {
  modelName: string;
  temperature: number;
  maxOutputTokens: number;
  topK: number;
}

export function resolveChatConfig(
  modelId?: string,
  effort?: string,
): ResolvedChatConfig {
  // 1. Phân giải base model
  let baseModel = 'cx/gpt-6-luna'; // Default: StudyMate Standar
  if (modelId === 'studymate-flash') {
    baseModel = 'cx/gpt-5.6-luna';
  } else if (modelId === 'studymate-pro') {
    baseModel = 'cx/gpt-5.6-terra';
  }

  // 2. Phân giải effort & params
  let suffix = '-medium';
  let temperature = 0.5;
  let maxOutputTokens = 2048;
  let topK = 8;

  if (effort === 'low') {
    suffix = '-low';
    temperature = 0.2;
    maxOutputTokens = 1024;
    topK = 5;
  } else if (effort === 'high' || effort === 'extra' || effort === 'max') {
    suffix = '-high';
    temperature = 0.2;
    maxOutputTokens = 4096;
    topK = 12;
  }

  return {
    modelName: `${baseModel}${suffix}`,
    temperature,
    maxOutputTokens,
    topK,
  };
}

@Injectable()
export class ChatAgentService {
  constructor(
    private readonly chatAgentRepo: ChatAgentRepoService,
    private readonly chatAgentAiService: ChatAgentAiService,
    private readonly retrievalService: RetrievalService,
    @Optional() private readonly summariesService?: SummariesService,
    @Optional() private readonly documentsRepo?: DocumentsRepoService,
    @Optional() private readonly tavilyService?: TavilyService,
  ) {}

  async createChatSession(
    userId: string,
    conversationId: string,
    data: CreateChatSessionDto,
  ) {
    return this.chatAgentRepo.createChatSession(
      {
        conversation_id: conversationId,
        title: data.title,
      },
      userId,
    );
  }

  async getChatSessionsByConversationId(
    userId: string,
    conversationId: string,
  ) {
    return this.chatAgentRepo.getChatSessionsByConversationId(
      conversationId,
      userId,
    );
  }

  async getChatSessionById(userId: string, chatSessionId: string) {
    const chatSession = await this.chatAgentRepo.getChatSessionById(
      chatSessionId,
      userId,
    );
    if (!chatSession) {
      throw new NotFoundException(
        'Không tìm thấy phiên trò chuyện hoặc bạn không có quyền truy cập',
      );
    }
    return chatSession;
  }

  async updateChatSession(
    userId: string,
    chatSessionId: string,
    data: UpdateChatSessionDto,
  ) {
    return this.chatAgentRepo.updateChatSession(
      chatSessionId,
      data.title,
      userId,
    );
  }

  async deleteChatSession(userId: string, chatSessionId: string) {
    return this.chatAgentRepo.deleteChatSession(chatSessionId, userId);
  }

  async generateFollowUpSuggestions(
    userId: string,
    chatSessionId: string,
    data: GenerateSuggestionsDto,
  ): Promise<{ suggestions: string[] }> {
    await this.getChatSessionById(userId, chatSessionId);
    const suggestions =
      await this.chatAgentAiService.generateFollowUpSuggestions(
        data.lastAssistantResponse,
        data.lastUserQuestion,
      );
    return { suggestions };
  }

  async getMessagesBySessionId(
    userId: string,
    chatSessionId: string,
  ): Promise<UIMessage[]> {
    await this.getChatSessionById(userId, chatSessionId);
    const rawMessages = await this.chatAgentRepo.getMessagesBySessionId(
      chatSessionId,
      userId,
    );

    return rawMessages.map((msg) => {
      const msgJson = msg.message_json as unknown as UIMessage;
      return {
        ...msgJson,
        id: msgJson?.id || msg.id,
        role: (msgJson?.role || msg.role) as 'user' | 'assistant',
        parts: msgJson?.parts ?? [],
      };
    });
  }

  // ── 1. Lưu tin nhắn vào Database dưới dạng JsonB (UIMessage) ──
  async saveUIMessage(
    chatSessionId: string,
    message: UIMessage,
    sourceChunks?: string[],
  ) {
    console.log(
      `[ChatAgentService] saveUIMessage: sessionId=${chatSessionId}, id=${message.id}, role=${message.role}, sourceChunks=${sourceChunks?.length ?? 0}`,
    );
    if (typeof this.chatAgentRepo.upsertMessage === 'function') {
      return this.chatAgentRepo.upsertMessage({
        id: message.id,
        chat_session_id: chatSessionId,
        role: message.role,
        message_json: message as any,
        source_chunks: sourceChunks,
      });
    }
    return (this.chatAgentRepo as any).createMessage({
      id: message.id,
      chat_session_id: chatSessionId,
      role: message.role,
      message_json: message as any,
      source_chunks: sourceChunks,
    });
  }

  /**
   * Tạo luồng UI Message Stream chuẩn hóa theo Vercel AI SDK v6 với đầy đủ tính năng:
   *  - Gán ID ổn định (đồng bộ giữa Client và Server) qua `createIdGenerator`
   *  - Bật chế độ persistence qua `originalMessages`
   *  - Lưu trữ tin nhắn AI (`UIMessage`) hoàn chỉnh vào Database qua callback `onFinish`
   */
  createChatUIMessageStream(params: {
    streamResult: any;
    chatSessionId: string;
    originalMessages: UIMessage[];
  }) {
    const { streamResult, chatSessionId, originalMessages } = params;

    const tracker = streamResult?.tracker;
    const getSourceChunkIds = (): string[] => {
      if (tracker && typeof tracker.getCollectedChunkIds === 'function') {
        return Array.from(tracker.getCollectedChunkIds());
      }
      return [];
    };

    return streamResult.toUIMessageStream({
      originalMessages,
      generateMessageId: createIdGenerator({
        prefix: 'msg-',
        size: 16,
      }),
      messageMetadata: ({ part }: { part: any }) => {
        if (part?.type === 'finish') {
          const citations =
            tracker && typeof tracker.getAllCitations === 'function'
              ? tracker.getAllCitations()
              : [];
          if (citations.length > 0) {
            return { citations };
          }
        }
        return undefined;
      },
      onFinish: async ({
        responseMessage,
        isAborted,
      }: {
        responseMessage?: UIMessage;
        isAborted?: boolean;
      }) => {
        if (isAborted) {
          console.log(
            `[ChatAgentService] Stream bị hủy cho session ${chatSessionId}`,
          );
          return;
        }

        if (
          responseMessage &&
          Array.isArray(responseMessage.parts) &&
          responseMessage.parts.length > 0
        ) {
          const sourceChunkIds = getSourceChunkIds();
          const citations =
            tracker && typeof tracker.getAllCitations === 'function'
              ? tracker.getAllCitations()
              : [];

          if (citations.length > 0) {
            (responseMessage as any).metadata = {
              ...((responseMessage as any).metadata),
              citations,
            };
          }

          console.log(
            `[ChatAgentService] toUIMessageStream onFinish -> Lưu tin nhắn AI: id=${responseMessage.id}, partsCount=${responseMessage.parts.length}, sourceChunks=${sourceChunkIds.length}, citations=${citations.length}`,
          );
          await this.saveUIMessage(
            chatSessionId,
            responseMessage,
            sourceChunkIds,
          );
        }
      },
      onError: (error: unknown) => {
        console.error(
          `[ChatAgentService] Stream onError cho session ${chatSessionId}:`,
          error,
        );
        return 'AI chat stream encountered an error';
      },
    });
  }

  // ── 2. Kích hoạt luồng Stream AI qua ChatAgentAiService ──
  async executeAiChatStream(
    chatSessionId: string,
    messages: UIMessage[],
    abortSignal?: AbortSignal,
    ragContext?: {
      userId: string;
      conversationId: string;
      attachedDocumentIds?: string[];
    },
    chatOptions?: {
      modelId?: string;
      effort?: string;
    },
  ) {
    const config = resolveChatConfig(chatOptions?.modelId, chatOptions?.effort);
    console.log(
      `[ChatAgentService] executeAiChatStream: session=${chatSessionId}, model=${config.modelName}, temp=${config.temperature}, maxTokens=${config.maxOutputTokens}, topK=${config.topK}`,
    );

    const availableDocuments = ragContext
      ? await this.retrievalService.getAvailableDocumentsCatalog(
          ragContext.userId,
          ragContext.conversationId,
        )
      : undefined;

    const webCallbacks = {
      onSearchInternet: async (input: any) => {
        if (!this.tavilyService) {
          return {
            query: input.query,
            totalResults: 0,
            results: [],
            message: 'Tìm kiếm Internet bị lỗi.',
          };
        }
        return this.tavilyService.search(input);
      },
      onExtractWebPage: async (input: any) => {
        if (!this.tavilyService) {
          return {
            query: input.query,
            totalSuccess: 0,
            totalFailed: input.urls?.length || 0,
            results: [],
            failedResults: (input.urls || []).map((u: string) => ({
              url: u,
              error: 'Dịch vụ chưa được cấu hình',
            })),
            message: 'Tìm kiếm Internet bị lỗi.',
          };
        }
        return this.tavilyService.extract(input);
      },
    };

    return this.chatAgentAiService.executeChatStream(
      messages,
      async ({
        assistantUIMessage,
        sourceChunkIds,
        text,
      }) => {
        console.log(
          `[ChatAgentService] executeAiChatStream fallback onFinish: text length=${text?.length}, parts count=${assistantUIMessage?.parts?.length}, sourceChunkIds=${sourceChunkIds?.length ?? 0}`,
        );
      },
      abortSignal,
      ragContext
        ? {
            availableDocuments,
            attachedDocumentIds: ragContext.attachedDocumentIds,
            chatConfig: config,
            ...webCallbacks,
            onSearchDocumentChunks: async (input) => {
              return this.retrievalService.searchRelevantChunks({
                userId: ragContext.userId,
                conversationId: ragContext.conversationId,
                semanticQuery: input.semanticQuery,
                keywords: input.keywords,
                preferredDocumentIds: ragContext.attachedDocumentIds,
                pageNumbers: input.pageNumbers,
                pageRange: input.pageRange,
                includeNeighbors: input.includeNeighbors,
                topK: input.topK || config.topK,
              });
            },
            onGetDocumentSectionOrPages: async (input) => {
              return this.retrievalService.getDocumentSectionOrPages({
                userId: ragContext.userId,
                conversationId: ragContext.conversationId,
                documentId: input.documentId,
                pageNumbers: input.pageNumbers,
                headingKeyword: input.headingKeyword,
              });
            },
            onGetDocumentsFullContent: async ({
              documentIds,
              fetchAllDocuments,
            }) => {
              return this.retrievalService.getDocumentsFullContent({
                userId: ragContext.userId,
                conversationId: ragContext.conversationId,
                documentIds,
                fetchAllDocuments,
                preferredDocumentIds: ragContext.attachedDocumentIds,
              });
            },
            onGetDocumentsMetadata: async () => {
              const attachedSet = new Set(ragContext.attachedDocumentIds ?? []);
              if (this.documentsRepo) {
                const docs =
                  await this.documentsRepo.getAllDocumentsByConversationId(
                    ragContext.conversationId,
                    ragContext.userId,
                  );
                const mapped = docs.map((doc) => {
                  const charCount = doc.raw_text
                    ? doc.raw_text.trim().length
                    : 0;
                  return {
                    documentId: doc.id,
                    fileName: doc.file_name,
                    mimeType: doc.mime_type,
                    fileSize: Number(doc.file_size || 0),
                    ocrStatus: doc.ocr_status,
                    characterCount: charCount,
                    estimatedPages:
                      charCount > 0
                        ? Math.max(1, Math.round(charCount / 1800))
                        : 0,
                    isAttached: attachedSet.has(doc.id),
                    uploadedAt:
                      doc.uploaded_at instanceof Date
                        ? doc.uploaded_at.toISOString()
                        : String(doc.uploaded_at),
                  };
                });
                return {
                  totalDocuments: mapped.length,
                  readyDocumentsCount: mapped.filter(
                    (d) => d.ocrStatus === 'done',
                  ).length,
                  attachedDocumentIds: ragContext.attachedDocumentIds ?? [],
                  documents: mapped,
                };
              }

              const fallbackDocs = (availableDocuments ?? []).map((doc) => ({
                documentId: doc.documentId,
                fileName: doc.fileName,
                mimeType: 'application/pdf',
                fileSize: 0,
                ocrStatus: 'done',
                characterCount: 0,
                estimatedPages: 1,
                isAttached: attachedSet.has(doc.documentId),
                uploadedAt:
                  doc.uploadedAt instanceof Date
                    ? doc.uploadedAt.toISOString()
                    : String(doc.uploadedAt),
              }));

              return {
                totalDocuments: fallbackDocs.length,
                readyDocumentsCount: fallbackDocs.length,
                attachedDocumentIds: ragContext.attachedDocumentIds ?? [],
                documents: fallbackDocs,
              };
            },
            onCreateDocumentSummary: async (input) => {
              if (!this.summariesService) {
                throw new Error('SummariesService chưa được khởi tạo');
              }

              const requestedDocIds =
                Array.isArray(input.documentIds) && input.documentIds.length > 0
                  ? input.documentIds
                  : ragContext.attachedDocumentIds &&
                      ragContext.attachedDocumentIds.length > 0
                    ? ragContext.attachedDocumentIds
                    : availableDocuments && availableDocuments.length === 1
                      ? [availableDocuments[0].documentId]
                      : [];

              const scopeEnum =
                input.scope === 'document'
                  ? SummaryScope.DOCUMENT
                  : input.scope === 'section'
                    ? SummaryScope.SECTION
                    : SummaryScope.CONVERSATION;

              const modeEnum =
                input.mode === 'key_takeaways'
                  ? SummaryMode.KEY_TAKEAWAYS
                  : input.mode === 'qa_style'
                    ? SummaryMode.QA_STYLE
                    : SummaryMode.STUDY_GUIDE;

              const lengthEnum =
                input.length === 'short'
                  ? SummaryLength.SHORT
                  : input.length === 'detailed'
                    ? SummaryLength.DETAILED
                    : SummaryLength.STANDARD;

              const created = await this.summariesService.createSummary(
                ragContext.userId,
                ragContext.conversationId,
                {
                  scope: scopeEnum,
                  documentId: requestedDocIds[0],
                  documentIds:
                    requestedDocIds.length > 0 ? requestedDocIds : undefined,
                  mode: modeEnum,
                  length: lengthEnum,
                  customInstruction: input.customInstruction,
                  sectionRange:
                    input.fromPage || input.toPage
                      ? {
                          fromPage: input.fromPage,
                          toPage: input.toPage,
                        }
                      : undefined,
                  modelName: config.modelName,
                },
              );

              const catalogMap = new Map(
                (availableDocuments ?? []).map((d) => [
                  d.documentId,
                  d.fileName,
                ]),
              );
              const documentNames =
                scopeEnum === SummaryScope.CONVERSATION
                  ? (availableDocuments ?? []).map((d) => d.fileName)
                  : requestedDocIds
                      .map((id) => catalogMap.get(id))
                      .filter((name): name is string => Boolean(name));

              return {
                summaryId: created.id,
                title: created.title,
                scope: input.scope,
                mode: input.mode || 'study_guide',
                length: input.length || 'standard',
                documentNames,
                createdAt:
                  created.created_at instanceof Date
                    ? created.created_at.toISOString()
                    : String(created.created_at),
              };
            },
          }
        : { chatConfig: config, ...webCallbacks },
    );
  }

  // ── 3. Function tổng hợp điều phối toàn bộ chu trình Chat ──
  async handleChatStream(
    userId: string,
    chatSessionId: string,
    messages: UIMessage[],
    abortSignal?: AbortSignal,
    attachedDocumentIds?: string[],
    chatOptions?: {
      modelId?: string;
      effort?: string;
    },
  ) {
    console.log(
      `[ChatAgentService] handleChatStream: verifying session ${chatSessionId} for user ${userId}...`,
    );
    // a. Xác thực quyền truy cập phiên của người dùng và lấy conversation_id
    const chatSession = await this.getChatSessionById(userId, chatSessionId);

    // b. Xác thực toàn bộ mảng tin nhắn UIMessage[] theo schemas công cụ
    const validatedMessages =
      typeof this.chatAgentAiService?.validateIncomingMessages === 'function'
        ? await this.chatAgentAiService.validateIncomingMessages(messages)
        : messages;

    // c. Lưu tin nhắn vào Database dưới dạng JsonB:
    // - Nếu tin nhắn cuối là của user: lưu user message vào DB
    // - Nếu tin nhắn cuối là của assistant (Human-in-the-loop: user vừa gửi output cho client-side tool askUserQuestion):
    //   cập nhật lại tin nhắn assistant đó trong DB
    const lastMessage = validatedMessages[validatedMessages.length - 1];
    if (lastMessage) {
      if (lastMessage.role === 'user') {
        console.log(
          `[ChatAgentService] Saving user message for session ${chatSessionId}...`,
        );
        await this.saveUIMessage(chatSessionId, lastMessage);
      } else if (lastMessage.role === 'assistant') {
        console.log(
          `[ChatAgentService] Updating assistant message (tool output) for session ${chatSessionId}...`,
        );
        await this.saveUIMessage(chatSessionId, lastMessage);
      }
    }

    // d. Tự động sinh tiêu đề ngầm (Fire-and-forget Asynchronous Fast LLM)
    this.triggerAutoHeaderAsync(userId, chatSessionId, validatedMessages);

    // e. Khởi tạo luồng sinh văn bản từ AI kèm ngữ cảnh RAG & Summary Tools
    return this.executeAiChatStream(
      chatSessionId,
      validatedMessages,
      abortSignal,
      {
        userId,
        conversationId: chatSession.conversation_id,
        attachedDocumentIds,
      },
      chatOptions,
    );
  }

  private triggerAutoHeaderAsync(
    userId: string,
    chatSessionId: string,
    messages: UIMessage[],
  ) {
    const userMessages = messages.filter((m) => m.role === 'user');
    // Chỉ kích hoạt tự động đặt tiêu đề cho 1-2 tin nhắn đầu tiên của cuộc trò chuyện
    if (userMessages.length > 2) return;

    setImmediate(async () => {
      try {
        const title =
          await this.chatAgentAiService.generateSessionTitle(userMessages);
        if (title && title.length >= 2) {
          await this.chatAgentRepo.updateChatSession(
            chatSessionId,
            title,
            userId,
          );
          console.log(
            `[ChatAgentService] Auto-header updated: session=${chatSessionId}, title="${title}"`,
          );
        }
      } catch (err: any) {
        console.warn(
          `[ChatAgentService] Auto-header error for session ${chatSessionId}: ${err?.message}`,
        );
      }
    });
  }
}
