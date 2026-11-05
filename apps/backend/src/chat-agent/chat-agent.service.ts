import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { UIMessage } from 'ai';
import { ChatAgentRepoService } from '../repo/chat-agent-repo/chat-agent-repo.service.js';
import { DocumentsRepoService } from '../repo/documents-repo/documents-repo.service.js';
import { ChatAgentAiService } from '../ai/chat-agent-ai.service.js';
import { RetrievalService } from '../documents/services/retrieval.service.js';
import { SummariesService } from '../summaries/summaries.service.js';
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
  let topK = 15;

  if (effort === 'low') {
    suffix = '-low';
    temperature = 0.2;
    maxOutputTokens = 1024;
    topK = 10;
  } else if (effort === 'high' || effort === 'extra' || effort === 'max') {
    suffix = '-high';
    temperature = 0.2;
    maxOutputTokens = 4096;
    topK = 20;
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

    const parsedMessages: UIMessage[] = rawMessages.map((msg) => {
      let parts: UIMessage['parts'] = [];
      try {
        const parsed = JSON.parse(msg.content);
        if (Array.isArray(parsed)) {
          // Xử lý nếu dữ liệu bị lồng trong ResponseMessage: [{ role: 'assistant', content: [...] }]
          if (
            parsed.length > 0 &&
            parsed[0]?.role &&
            Array.isArray(parsed[0]?.content)
          ) {
            parts = parsed[0].content;
          } else {
            parts = parsed;
          }
        } else if (typeof parsed === 'string') {
          parts = [{ type: 'text', text: parsed }];
        } else {
          parts = [{ type: 'text', text: msg.content }];
        }
      } catch {
        parts = [{ type: 'text', text: msg.content }];
      }

      return {
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        parts,
      };
    });

    // Gộp các bản ghi assistant liên tiếp phát sinh từ chu trình Human-in-the-loop (askUserQuestion -> addToolOutput)
    const consolidated: UIMessage[] = [];
    for (const current of parsedMessages) {
      const prev = consolidated[consolidated.length - 1];
      if (prev && prev.role === 'assistant' && current.role === 'assistant') {
        const prevCallIds = new Set(
          (prev.parts || [])
            .map((p: any) => p?.toolCallId)
            .filter((id): id is string => typeof id === 'string'),
        );
        const currentCallIds = new Set(
          (current.parts || [])
            .map((p: any) => p?.toolCallId)
            .filter((id): id is string => typeof id === 'string'),
        );

        const isContinuation = Array.from(prevCallIds).some((id) =>
          currentCallIds.has(id),
        );
        if (isContinuation) {
          consolidated[consolidated.length - 1] = current;
          continue;
        }
      }
      consolidated.push(current);
    }

    return consolidated;
  }

  // ── 1. Lưu tin nhắn vào Database ──
  async saveMessage(
    chatSessionId: string,
    role: 'user' | 'assistant',
    content: string,
    sourceChunks?: string[],
  ) {
    console.log(
      `[ChatAgentService] saveMessage: sessionId=${chatSessionId}, role=${role}, length=${content?.length}, sourceChunks=${sourceChunks?.length ?? 0}`,
    );
    return this.chatAgentRepo.createMessage({
      chat_session_id: chatSessionId,
      role,
      content,
      source_chunks: sourceChunks,
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

    // Kiểm tra nếu tin nhắn cuối cùng là assistant (tức là lượt chạy tiếp nối sau khi user trả lời Client-Side Tool askUserQuestion)
    const lastInputMessage = messages[messages.length - 1];
    const previousAssistantParts: any[] =
      lastInputMessage &&
      lastInputMessage.role === 'assistant' &&
      Array.isArray(lastInputMessage.parts)
        ? lastInputMessage.parts
        : [];

    return this.chatAgentAiService.executeChatStream(
      messages,
      async ({
        responseMessages,
        assistantParts: extractedParts,
        sourceChunkIds,
        text,
      }) => {
        console.log(
          `[ChatAgentService] executeAiChatStream onFinish: text length=${text?.length}, responseMessages count=${responseMessages?.length}, sourceChunkIds=${sourceChunkIds?.length ?? 0}`,
        );

        let assistantParts: any[] = Array.isArray(extractedParts)
          ? extractedParts
          : [];

        if (
          assistantParts.length === 0 &&
          responseMessages &&
          responseMessages.length > 0
        ) {
          const firstMsg = responseMessages[0];
          if (Array.isArray(firstMsg?.content)) {
            assistantParts = firstMsg.content;
          }
        }
        if (assistantParts.length === 0 && text) {
          assistantParts = [{ type: 'text', text }];
        }

        const finalPartsToSave =
          previousAssistantParts.length > 0
            ? [...previousAssistantParts, ...assistantParts]
            : assistantParts;

        await this.saveMessage(
          chatSessionId,
          'assistant',
          JSON.stringify(finalPartsToSave),
          sourceChunkIds,
        );
      },
      abortSignal,
      ragContext
        ? {
            availableDocuments,
            attachedDocumentIds: ragContext.attachedDocumentIds,
            chatConfig: config,
            onSearchDocumentChunks: async ({ semanticQuery, keywords }) => {
              return this.retrievalService.searchRelevantChunks({
                userId: ragContext.userId,
                conversationId: ragContext.conversationId,
                semanticQuery,
                keywords,
                preferredDocumentIds: ragContext.attachedDocumentIds,
                topK: config.topK,
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
        : { chatConfig: config },
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

    // b. Lưu tin nhắn mới nhất của user vào Database (chỉ lưu khi tin nhắn cuối là của user)
    const lastMessage = messages[messages.length - 1];
    console.log(`[ChatAgentService] lastMessage role=${lastMessage?.role}`);
    if (lastMessage && lastMessage.role === 'user') {
      const userContent = lastMessage.parts
        ? JSON.stringify(lastMessage.parts)
        : '';

      console.log(
        `[ChatAgentService] Saving user message for session ${chatSessionId}...`,
      );
      await this.saveMessage(chatSessionId, 'user', userContent);
    }

    // c. Tự động sinh tiêu đề ngầm (Fire-and-forget Asynchronous Fast LLM)
    this.triggerAutoHeaderAsync(userId, chatSessionId, messages);

    // d. Khởi tạo luồng sinh văn bản từ AI kèm ngữ cảnh RAG & Summary Tools
    return this.executeAiChatStream(
      chatSessionId,
      messages,
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
