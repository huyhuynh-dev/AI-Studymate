import { Injectable, Logger } from '@nestjs/common';
import { tool } from 'ai';
import { toolDefinitionsToToolSet } from '@blocknote/xl-ai/server';
import type {
  ChatAgentToolName,
  ChatSessionToolCallbacks,
  CitationItem,
  DocumentCitationItem,
  ToolCallTracker,
  WebCitationItem,
} from './types.js';
import {
  createAskUserQuestionTool,
  createSearchWorkspaceResourcesTool,
  searchWorkspaceResourcesInputSchema,
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
  createGetNoteContentTool,
  getNoteContentInputSchema,
} from './definitions/summaries/index.js';
import {
  createCreateFlashcardsTool,
  createFlashcardsInputSchema,
  createGetDeckCardsTool,
  getDeckCardsInputSchema,
} from './definitions/flashcards/index.js';
import {
  createCreateQuizTool,
  createQuizInputSchema,
  createGetQuizContentTool,
  getQuizContentInputSchema,
} from './definitions/quiz/index.js';
import {
  createSearchInternetTool,
  searchInternetInputSchema,
  createExtractWebPageTool,
  extractWebPageInputSchema,
} from './definitions/web/index.js';
import {
  createSuperDocInspectTool,
  superdocInspectInputSchema,
  createSuperDocPerformActionTool,
  superdocPerformActionInputSchema,
  createSuperDocStreamTextTool,
  superdocStreamTextInputSchema,
  createSuperDocApiSearchTool,
  superdocApiSearchInputSchema,
  createSuperDocApiCallTool,
  superdocApiCallInputSchema,
} from './definitions/superdoc/index.js';
import {
  createManageEditableDocumentTool,
  createManageFlashcardsTool,
  createManageNotesTool,
  createManageQuizTool,
  createManageWorkspaceAndJobsTool,
  manageEditableDocumentInputSchema,
  manageFlashcardsInputSchema,
  manageNotesInputSchema,
  manageQuizInputSchema,
  manageWorkspaceAndJobsInputSchema,
} from './definitions/mutations/index.js';

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

  // Turn-scoped citation counter & registry cho Document (c1, c2...)
  private citationCounter = 0;
  private readonly citationsByChunkKey = new Map<string, DocumentCitationItem>();
  private readonly citationsById = new Map<string, CitationItem>();

  // Turn-scoped citation counter & registry cho Web (w1, w2...)
  private webCitationCounter = 0;
  private readonly webCitationsByUrl = new Map<string, WebCitationItem>();

  recordChunkId(chunkId: string): void {
    if (chunkId) {
      this.collectedChunkIds.add(chunkId);
    }
  }

  /**
   * Cấp phát citationId tuần tự (c1, c2, c3...) duy nhất cho toàn bộ turn stream đối với tài liệu.
   * Nếu cùng 1 chunkId (hoặc cùng documentId + chunkIndex) đã được cấp citationId trước đó
   * (ở bước tool trước trong cùng turn), trả về lại citationId cũ để tránh trùng lặp.
   */
  allocateCitation(
    chunk: Omit<DocumentCitationItem, 'citationId' | 'sourceType'> & {
      sourceType?: 'document';
    },
  ): string {
    const chunkKey =
      chunk.chunkId ||
      `${chunk.documentId}:${(chunk as any).chunkIndex ?? ''}`;
    const existing = this.citationsByChunkKey.get(chunkKey);
    if (existing) {
      return existing.citationId;
    }

    this.citationCounter += 1;
    const citationId = `c${this.citationCounter}`;

    const citationItem: DocumentCitationItem = {
      ...chunk,
      sourceType: 'document',
      citationId,
    };

    this.citationsByChunkKey.set(chunkKey, citationItem);
    this.citationsById.set(citationId, citationItem);
    if (chunk.chunkId) {
      this.recordChunkId(chunk.chunkId);
    }

    return citationId;
  }

  /**
   * Cấp phát citationId tuần tự (w1, w2, w3...) duy nhất cho toàn bộ turn stream đối với nguồn Web.
   * Khử trùng lặp theo URL: Nếu cùng một URL đã được trích dẫn ở bước trước (ví dụ ở searchInternet),
   * sau đó được gọi ở extractWebPage, tái sử dụng citationId cũ (w1) và cập nhật thông tin bổ sung.
   */
  allocateWebCitation(
    webSource: Omit<WebCitationItem, 'citationId' | 'sourceType'>,
  ): string {
    const rawUrl = (webSource.url || '').trim();
    // Chuẩn hóa URL để so sánh khử trùng lặp (bỏ trailing slash, chuyển chữ thường)
    const normalizedUrl = rawUrl.replace(/\/+$/, '').toLowerCase();
    const existing = this.webCitationsByUrl.get(normalizedUrl);
    if (existing) {
      // Cập nhật tiêu đề chi tiết hơn nếu có (ví dụ từ bước extract)
      if (webSource.title && webSource.title !== existing.domain) {
        existing.title = webSource.title;
      }
      if (webSource.previewSnippet) {
        existing.previewSnippet = webSource.previewSnippet.slice(0, 400);
      }
      if (webSource.favicon && !existing.favicon) {
        existing.favicon = webSource.favicon;
      }
      return existing.citationId;
    }

    this.webCitationCounter += 1;
    const citationId = `w${this.webCitationCounter}`;

    const webCitationItem: WebCitationItem = {
      sourceType: 'web',
      citationId,
      title: webSource.title || webSource.domain || rawUrl,
      url: rawUrl,
      domain: webSource.domain || '',
      favicon: webSource.favicon,
      publishedDate: webSource.publishedDate,
      previewSnippet: webSource.previewSnippet
        ? webSource.previewSnippet.slice(0, 400)
        : undefined,
    };

    this.webCitationsByUrl.set(normalizedUrl, webCitationItem);
    this.citationsById.set(citationId, webCitationItem);

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
      createFlashcards: tool({
        description: 'Khởi tạo bộ thẻ ghi nhớ Flashcard từ tài liệu học tập',
        inputSchema: createFlashcardsInputSchema,
      }),
      createQuiz: tool({
        description: 'Khởi tạo bài kiểm tra Quiz từ tài liệu học tập hoặc bộ thẻ Flashcard',
        inputSchema: createQuizInputSchema,
      }),
      getNoteContent: tool({
        description: 'Đọc nội dung chi tiết và mục lục của một Ghi chú / Tóm tắt',
        inputSchema: getNoteContentInputSchema,
      }),
      getQuizContent: tool({
        description: 'Đọc nội dung câu hỏi và kết quả lượt làm bài của một Quiz',
        inputSchema: getQuizContentInputSchema,
      }),
      getDeckCards: tool({
        description: 'Đọc danh sách thẻ ghi nhớ trong một bộ Flashcard Deck',
        inputSchema: getDeckCardsInputSchema,
      }),
      searchWorkspaceResources: tool({
        description: 'Tìm kiếm tài nguyên học tập (tài liệu, ghi chú, bộ thẻ, quiz, phiên học) trong workspace',
        inputSchema: searchWorkspaceResourcesInputSchema,
      }),
      searchInternet: tool({
        description: 'Tìm kiếm thông tin trên Internet qua Tavily Search API',
        inputSchema: searchInternetInputSchema,
      }),
      extractWebPage: tool({
        description:
          'Đọc sâu và bóc tách nội dung từ 1-3 URLs qua Tavily Extract API',
        inputSchema: extractWebPageInputSchema,
      }),
      superdoc_inspect: tool({
        description:
          'Đọc cấu trúc và nội dung hiện tại của tài liệu Word đang mở trong SuperDoc',
        inputSchema: superdocInspectInputSchema,
      }),
      superdoc_perform_action: tool({
        description:
          'Thực hiện thao tác chỉnh sửa tài liệu Word đang mở trong SuperDoc',
        inputSchema: superdocPerformActionInputSchema,
      }),
      superdoc_stream_text: tool({
        description:
          'Ghi/dịch/sửa nội dung văn bản đoạn văn hoặc tiêu đề trực tiếp lên tài liệu Word theo luồng',
        inputSchema: superdocStreamTextInputSchema,
      }),
      superdoc_api_search: tool({
        description: 'Tra cứu các hàm và schema của Document API cấp thấp',
        inputSchema: superdocApiSearchInputSchema,
      }),
      superdoc_api_call: tool({
        description: 'Thực thi các lệnh Document API cấp thấp trên tài liệu Word',
        inputSchema: superdocApiCallInputSchema,
      }),
      manageNotes: tool({
        description:
          'Tạo, đổi tên, chỉnh sửa section, viết lại hoặc xóa Notes/Summaries',
        inputSchema: manageNotesInputSchema,
      }),
      manageFlashcards: tool({
        description:
          'Quản lý Flashcard Decks, thêm/sửa/xóa/di chuyển và gộp thẻ trùng lặp',
        inputSchema: manageFlashcardsInputSchema,
      }),
      manageQuiz: tool({
        description:
          'Cập nhật đề kiểm tra Quiz và thêm/sửa/xóa câu hỏi kiểm tra',
        inputSchema: manageQuizInputSchema,
      }),
      manageEditableDocument: tool({
        description:
          'Đọc, chỉnh sửa và chuyển đổi tài liệu văn bản (.md, .txt, ...)',
        inputSchema: manageEditableDocumentInputSchema,
      }),
      manageWorkspaceAndJobs: tool({
        description:
          'Điều hướng giao diện, cập nhật cài đặt, hoàn tác hành động và quản lý tác vụ nền',
        inputSchema: manageWorkspaceAndJobsInputSchema,
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

    if (callbacks?.onCreateFlashcards) {
      tools.createFlashcards = createCreateFlashcardsTool(
        callbacks.onCreateFlashcards,
        tracker,
      );
    }

    if (callbacks?.onCreateQuiz) {
      tools.createQuiz = createCreateQuizTool(
        callbacks.onCreateQuiz,
        tracker,
      );
    }

    if (callbacks?.onGetNoteContent) {
      tools.getNoteContent = createGetNoteContentTool(
        callbacks.onGetNoteContent,
        tracker,
      );
    }

    if (callbacks?.onGetQuizContent) {
      tools.getQuizContent = createGetQuizContentTool(
        callbacks.onGetQuizContent,
        tracker,
      );
    }

    if (callbacks?.onGetDeckCards) {
      tools.getDeckCards = createGetDeckCardsTool(
        callbacks.onGetDeckCards,
        tracker,
      );
    }

    if (callbacks?.onSearchWorkspaceResources) {
      tools.searchWorkspaceResources = createSearchWorkspaceResourcesTool(
        callbacks.onSearchWorkspaceResources,
        tracker,
      );
    }

    if (callbacks?.onSearchInternet) {
      tools.searchInternet = createSearchInternetTool(
        callbacks.onSearchInternet,
        tracker,
      );
    }

    if (callbacks?.onExtractWebPage) {
      tools.extractWebPage = createExtractWebPageTool(
        callbacks.onExtractWebPage,
        tracker,
      );
    }

    if (callbacks?.onSuperDocInspect) {
      tools.superdoc_inspect = createSuperDocInspectTool(
        callbacks.onSuperDocInspect,
        tracker,
        {
          description: callbacks.superdocToolkitMeta?.inspectDescription,
          inputSchema: callbacks.superdocToolkitMeta?.inspectInputSchema,
          documentId: callbacks.superdocToolkitMeta?.documentId,
          fileName: callbacks.superdocToolkitMeta?.fileName,
        },
      );
    }

    if (callbacks?.onSuperDocPerformAction) {
      tools.superdoc_perform_action = createSuperDocPerformActionTool(
        callbacks.onSuperDocPerformAction,
        tracker,
        {
          description: callbacks.superdocToolkitMeta?.performActionDescription,
          inputSchema: callbacks.superdocToolkitMeta?.performActionInputSchema,
          documentId: callbacks.superdocToolkitMeta?.documentId,
          fileName: callbacks.superdocToolkitMeta?.fileName,
        },
      );
    }

    if (callbacks?.onSuperDocStreamText) {
      tools.superdoc_stream_text = createSuperDocStreamTextTool(
        callbacks.onSuperDocStreamText,
        tracker,
        {
          documentId: callbacks.superdocToolkitMeta?.documentId,
          fileName: callbacks.superdocToolkitMeta?.fileName,
          liveHandlers: callbacks.superdocStreamTextLiveHandlers,
        },
      );
    }

    if (callbacks?.onSuperDocApiSearch) {
      tools.superdoc_api_search = createSuperDocApiSearchTool(
        callbacks.onSuperDocApiSearch,
        tracker,
        {
          description: callbacks.superdocToolkitMeta?.apiSearchDescription,
          inputSchema: callbacks.superdocToolkitMeta?.apiSearchInputSchema,
          documentId: callbacks.superdocToolkitMeta?.documentId,
          fileName: callbacks.superdocToolkitMeta?.fileName,
        },
      );
    }

    if (callbacks?.onSuperDocApiCall) {
      tools.superdoc_api_call = createSuperDocApiCallTool(
        callbacks.onSuperDocApiCall,
        tracker,
        {
          description: callbacks.superdocToolkitMeta?.apiCallDescription,
          inputSchema: callbacks.superdocToolkitMeta?.apiCallInputSchema,
          documentId: callbacks.superdocToolkitMeta?.documentId,
          fileName: callbacks.superdocToolkitMeta?.fileName,
        },
      );
    }

    if (callbacks?.onManageNotes) {
      tools.manageNotes = createManageNotesTool(
        callbacks.onManageNotes,
        tracker,
      );
    }

    if (callbacks?.onManageFlashcards) {
      tools.manageFlashcards = createManageFlashcardsTool(
        callbacks.onManageFlashcards,
        tracker,
      );
    }

    if (callbacks?.onManageQuiz) {
      tools.manageQuiz = createManageQuizTool(
        callbacks.onManageQuiz,
        tracker,
      );
    }

    if (callbacks?.onManageEditableDocument) {
      tools.manageEditableDocument = createManageEditableDocumentTool(
        callbacks.onManageEditableDocument,
        tracker,
      );
    }

    if (callbacks?.onManageWorkspaceAndJobs) {
      tools.manageWorkspaceAndJobs = createManageWorkspaceAndJobsTool(
        callbacks.onManageWorkspaceAndJobs,
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

    // Tập hợp các toolCallId đã có tool-result, tool-approval-request, hoặc tool-output-denied trong responseMessages
    const completedToolResultsByCallId = new Map<string, unknown>();
    const approvalRequestsByCallId = new Map<
      string,
      { id: string; signature?: string }
    >();
    const deniedToolCallIds = new Set<string>();

    for (const msg of responseMessages) {
      if (msg?.role === 'assistant' && Array.isArray(msg.content)) {
        for (const item of msg.content) {
          if (item?.type === 'tool-approval-request' && item.toolCallId) {
            approvalRequestsByCallId.set(item.toolCallId, {
              id: String(item.approvalId ?? item.toolCallId),
              ...(typeof item.signature === 'string'
                ? { signature: item.signature }
                : {}),
            });
          }
        }
      } else if (msg?.role === 'tool' && Array.isArray(msg.content)) {
        for (const item of msg.content) {
          if (item?.type === 'tool-output-denied' && item.toolCallId) {
            deniedToolCallIds.add(item.toolCallId);
          } else if (item?.type === 'tool-result' && item.toolCallId) {
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
          const hasResult =
            Boolean(toolCallId) && completedToolResultsByCallId.has(toolCallId);
          const approvalReq = toolCallId
            ? approvalRequestsByCallId.get(toolCallId)
            : undefined;
          const isDenied = Boolean(toolCallId) && deniedToolCallIds.has(toolCallId);

          // Client-Side Tool: askUserQuestion (khi dừng chờ người dùng trả lời thì chưa có kết quả)
          if (toolName === 'askUserQuestion') {
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

          if (isDenied && !hasResult) {
            parts.push({
              type: `tool-${toolName}`,
              toolCallId,
              state: 'output-denied',
              input: contentPart.input,
              ...(approvalReq ? { approval: approvalReq } : {}),
            });
            continue;
          }

          if (approvalReq && !hasResult) {
            parts.push({
              type: `tool-${toolName}`,
              toolCallId,
              state: 'approval-requested',
              input: contentPart.input,
              approval: approvalReq,
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
