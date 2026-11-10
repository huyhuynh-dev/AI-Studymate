import { Injectable, Logger } from '@nestjs/common';
import {
  convertToModelMessages,
  generateId,
  stepCountIs,
  tool,
  validateUIMessages,
  TypeValidationError,
} from 'ai';
import { z } from 'zod';
import type { UIMessage } from 'ai';
import { AiService } from './ai.service.js';
import type {
  AvailableDocumentItem,
  DocumentFullContent,
  RetrievedChunk,
} from '../documents/services/retrieval.service.js';
import {
  CHAT_AGENT_SYSTEM_PROMPT,
  AUTO_HEADER_SYSTEM_PROMPT,
  FOLLOW_UP_SUGGESTIONS_SYSTEM_PROMPT,
  buildSystemPromptWithDocumentCatalog,
} from './prompts/templates/chat-agent.prompt.js';

export {
  CHAT_AGENT_SYSTEM_PROMPT,
  AUTO_HEADER_SYSTEM_PROMPT,
  FOLLOW_UP_SUGGESTIONS_SYSTEM_PROMPT,
  buildSystemPromptWithDocumentCatalog,
};

// ── Interfaces cho Tool 1: searchDocumentChunks ──
export interface SearchDocumentChunksToolInput {
  semanticQuery: string;
  keywords: string[];
}

export interface SearchDocumentChunksSourceSummary {
  documentId: string;
  fileName: string;
  pageNumbers: number[];
  chunkCount: number;
}

export interface SearchDocumentChunksToolOutput {
  semanticQuery: string;
  keywords: string[];
  totalChunks: number;
  sources: SearchDocumentChunksSourceSummary[];
  chunks: Array<{
    rank: number;
    id: string;
    documentId: string;
    fileName: string;
    chunkIndex: number;
    pageNumbers: number[];
    content: string;
    rrfScore: number;
  }>;
}

export type SearchDocumentChunksCallback = (
  input: SearchDocumentChunksToolInput,
) => Promise<RetrievedChunk[]>;

// ── Interfaces cho Tool 2: getDocumentsFullContent ──
export interface GetDocumentsFullContentToolInput {
  documentIds?: string[];
  fetchAllDocuments?: boolean;
}

export interface DocumentFullContentSummaryItem {
  documentId: string;
  fileName: string;
  characterCount: number;
}

export interface GetDocumentsFullContentToolOutput {
  requestedDocumentIds: string[];
  fetchAllDocuments: boolean;
  totalDocuments: number;
  documents: DocumentFullContentSummaryItem[];
  fullContents: DocumentFullContent[];
}

export type GetDocumentsFullContentCallback = (
  input: GetDocumentsFullContentToolInput,
) => Promise<DocumentFullContent[]>;

// ── Interfaces cho Tool 3: getConversationDocumentsMetadata ──
export interface DocumentMetadataItem {
  documentId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  ocrStatus: string;
  characterCount: number;
  estimatedPages: number;
  isAttached: boolean;
  uploadedAt: string;
}

export interface GetConversationDocumentsMetadataToolOutput {
  totalDocuments: number;
  readyDocumentsCount: number;
  attachedDocumentIds: string[];
  documents: DocumentMetadataItem[];
}

export type GetConversationDocumentsMetadataCallback =
  () => Promise<GetConversationDocumentsMetadataToolOutput>;

// ── Interfaces cho Tool 4: askUserQuestion (Client-Side Tool) ──
export interface AskUserQuestionItem {
  id: string;
  question: string;
  options?: string[];
  allowMultiple?: boolean;
  allowCustomInput?: boolean;
}

export interface AskUserQuestionToolInput {
  contextMessage?: string;
  questions: AskUserQuestionItem[];
}

// ── Interfaces cho Tool 5: createDocumentSummary ──
export interface CreateDocumentSummaryToolInput {
  scope: 'conversation' | 'document' | 'section';
  documentIds?: string[];
  mode?: 'key_takeaways' | 'study_guide' | 'qa_style';
  length?: 'short' | 'standard' | 'detailed';
  customInstruction?: string;
  fromPage?: number;
  toPage?: number;
}

export interface CreateDocumentSummaryToolOutput {
  summaryId: string;
  title: string;
  scope: 'conversation' | 'document' | 'section';
  mode: 'key_takeaways' | 'study_guide' | 'qa_style';
  length: 'short' | 'standard' | 'detailed';
  documentNames: string[];
  createdAt: string;
}

export type CreateDocumentSummaryCallback = (
  input: CreateDocumentSummaryToolInput,
) => Promise<CreateDocumentSummaryToolOutput>;

@Injectable()
export class ChatAgentAiService {
  private readonly logger = new Logger(ChatAgentAiService.name);

  constructor(private readonly aiService: AiService) {}

  /**
   * Tạo danh mục công cụ phục vụ xác thực mảng tin nhắn UIMessage[]
   */
  getValidationTools(): Record<string, any> {
    return {
      askUserQuestion: this.buildAskUserQuestionTool(),
      searchDocumentChunks: tool({
        description: 'Tìm kiếm các đoạn trích trong tài liệu',
        inputSchema: z.object({
          semanticQuery: z.string(),
          keywords: z.array(z.string()).max(5),
        }),
      }),
      getDocumentsFullContent: tool({
        description: 'Lấy toàn bộ nội dung văn bản của tài liệu',
        inputSchema: z.object({
          documentIds: z.array(z.string()).optional(),
          fetchAllDocuments: z.boolean().optional(),
        }),
      }),
      getConversationDocumentsMetadata: tool({
        description: 'Lấy thông tin metadata tài liệu trong cuộc trò chuyện',
        inputSchema: z.object({}),
      }),
      createDocumentSummary: tool({
        description: 'Khởi tạo bản tóm tắt tài liệu',
        inputSchema: z.object({
          scope: z.enum(['conversation', 'document', 'section']),
          documentIds: z.array(z.string()).optional(),
          mode: z.enum(['key_takeaways', 'study_guide', 'qa_style']).optional(),
          length: z.enum(['short', 'standard', 'detailed']).optional(),
          customInstruction: z.string().optional(),
          fromPage: z.number().optional(),
          toPage: z.number().optional(),
        }),
      }),
    };
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
   * để LLM biết nhanh tên file và documentId, kết hợp với tool getConversationDocumentsMetadata khi cần chi tiết.
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

  /**
   * Tool 1: Tìm kiếm các đoạn trích (chunks) bằng Hybrid Search (pgvector + PGRoonga + RRF)
   */
  private buildSearchDocumentChunksTool(
    onSearchDocumentChunks: SearchDocumentChunksCallback,
    collectedChunkIds: Set<string>,
    chunkToolOutputsByCallId: Map<string, SearchDocumentChunksToolOutput>,
    maxChunks: number = 15,
  ) {
    return tool({
      description: `Tìm kiếm các đoạn trích (chunks) cụ thể trong tài liệu bằng Hybrid Search (pgvector + PGRoonga kết hợp thuật toán RRF). Sử dụng công cụ này cho các câu hỏi cụ thể về khái niệm, thuật ngữ, định nghĩa, công thức hoặc chi tiết trong tài liệu. Trả về tối đa ${maxChunks} chunks liên quan nhất.`,
      inputSchema: z.object({
        semanticQuery: z
          .string()
          .describe(
            'Câu văn, đoạn mô tả hoặc câu hỏi giàu ngữ cảnh ngữ nghĩa được tổng hợp từ câu hỏi của người dùng, dùng để tạo vector embedding và tìm kiếm tương đồng ngữ nghĩa (Vector Search).',
          ),
        keywords: z
          .array(z.string())
          .max(5)
          .describe(
            'Mảng danh sách các từ khóa, thuật ngữ chuyên môn hoặc cụm từ quan trọng (tối đa 5 từ khóa) dùng để tìm kiếm toàn văn PGRoonga trên cột content của bảng document_chunks.',
          ),
      }),
      execute: async (
        { semanticQuery, keywords },
        { toolCallId },
      ): Promise<SearchDocumentChunksToolOutput> => {
        const safeKeywords = Array.isArray(keywords)
          ? keywords
              .filter((k) => typeof k === 'string' && k.trim().length > 0)
              .map((k) => k.trim())
              .slice(0, 5)
          : [];

        this.logger.log(
          `[searchDocumentChunks] Executing tool (callId=${toolCallId}): semanticQuery="${semanticQuery}", keywords=${JSON.stringify(safeKeywords)}`,
        );

        const retrievedChunks = await onSearchDocumentChunks({
          semanticQuery: semanticQuery || '',
          keywords: safeKeywords,
        });

        for (const chunk of retrievedChunks) {
          if (chunk.id) {
            collectedChunkIds.add(chunk.id);
          }
        }

        const sourceMap = new Map<
          string,
          {
            documentId: string;
            fileName: string;
            pages: Set<number>;
            chunkCount: number;
          }
        >();

        for (const chunk of retrievedChunks) {
          let entry = sourceMap.get(chunk.documentId);
          if (!entry) {
            entry = {
              documentId: chunk.documentId,
              fileName: chunk.fileName,
              pages: new Set<number>(),
              chunkCount: 0,
            };
            sourceMap.set(chunk.documentId, entry);
          }
          entry.chunkCount += 1;
          for (const p of chunk.pageNumbers || []) {
            if (Number.isFinite(p)) {
              entry.pages.add(p);
            }
          }
        }

        const sources: SearchDocumentChunksSourceSummary[] = Array.from(
          sourceMap.values(),
        ).map((s) => ({
          documentId: s.documentId,
          fileName: s.fileName,
          pageNumbers: Array.from(s.pages).sort((a, b) => a - b),
          chunkCount: s.chunkCount,
        }));

        const output: SearchDocumentChunksToolOutput = {
          semanticQuery,
          keywords: safeKeywords,
          totalChunks: retrievedChunks.length,
          sources,
          chunks: retrievedChunks.map((c, idx) => ({
            rank: idx + 1,
            id: c.id,
            documentId: c.documentId,
            fileName: c.fileName,
            chunkIndex: c.chunkIndex,
            pageNumbers: c.pageNumbers,
            content: c.content,
            rrfScore: Number(c.rrfScore.toFixed(5)),
          })),
        };

        if (toolCallId) {
          chunkToolOutputsByCallId.set(toolCallId, output);
        }

        return output;
      },
      toModelOutput: ({ output }) => {
        if (!output?.chunks || output.chunks.length === 0) {
          return {
            type: 'text',
            value:
              'Không tìm thấy đoạn văn bản (chunk) nào phù hợp trong tài liệu của cuộc trò chuyện.',
          };
        }

        const formattedChunks = output.chunks
          .map((chunk) => {
            const pageLabel =
              chunk.pageNumbers && chunk.pageNumbers.length > 0
                ? `Trang ${chunk.pageNumbers.join(', ')}`
                : `Chunk #${chunk.chunkIndex}`;
            return `[Hạng #${chunk.rank} | Tài liệu: "${chunk.fileName}" | ${pageLabel} | RRF Score: ${chunk.rrfScore}]\n${chunk.content}`;
          })
          .join('\n\n---\n\n');

        return {
          type: 'text',
          value: `Tìm thấy ${output.totalChunks} đoạn trích liên quan từ tài liệu:\n\n${formattedChunks}`,
        };
      },
    });
  }

  /**
   * Tool 2: Lấy toàn bộ nội dung văn bản (raw_text) của tài liệu để trả lời câu hỏi tổng quan trong khung chat
   */
  private buildGetDocumentsFullContentTool(
    onGetDocumentsFullContent: GetDocumentsFullContentCallback,
    fullContentOutputsByCallId: Map<string, GetDocumentsFullContentToolOutput>,
  ) {
    return tool({
      description:
        'Lấy toàn bộ nội dung văn bản (raw_text) của một tài liệu, một nhóm tài liệu hoặc toàn bộ tài liệu trong cuộc trò chuyện để trả lời câu hỏi tổng quan/so sánh trực tiếp trong khung chat. Lưu ý: Nếu người dùng yêu cầu TẠO BẢN TÓM TẮT tài liệu lưu vào hệ thống, hãy ưu tiên sử dụng công cụ `createDocumentSummary`.',
      inputSchema: z.object({
        documentIds: z
          .array(z.string())
          .optional()
          .describe(
            'Mảng danh sách các documentId của những tài liệu cụ thể cần đọc toàn bộ nội dung raw_text.',
          ),
        fetchAllDocuments: z
          .boolean()
          .optional()
          .describe(
            'Đặt là true khi cần đọc toàn bộ tài liệu có trong cuộc trò chuyện.',
          ),
      }),
      execute: async (
        { documentIds, fetchAllDocuments },
        { toolCallId },
      ): Promise<GetDocumentsFullContentToolOutput> => {
        const safeDocumentIds = Array.isArray(documentIds)
          ? documentIds
              .filter((id) => typeof id === 'string' && id.trim().length > 0)
              .map((id) => id.trim())
          : [];
        const shouldFetchAll = Boolean(fetchAllDocuments);

        this.logger.log(
          `[getDocumentsFullContent] Executing tool (callId=${toolCallId}): documentIds=${JSON.stringify(safeDocumentIds)}, fetchAllDocuments=${shouldFetchAll}`,
        );

        const fullContents = await onGetDocumentsFullContent({
          documentIds: safeDocumentIds,
          fetchAllDocuments: shouldFetchAll,
        });

        const documentsSummary: DocumentFullContentSummaryItem[] =
          fullContents.map((doc) => ({
            documentId: doc.documentId,
            fileName: doc.fileName,
            characterCount: doc.characterCount,
          }));

        const output: GetDocumentsFullContentToolOutput = {
          requestedDocumentIds: safeDocumentIds,
          fetchAllDocuments: shouldFetchAll,
          totalDocuments: fullContents.length,
          documents: documentsSummary,
          fullContents,
        };

        if (toolCallId) {
          fullContentOutputsByCallId.set(toolCallId, output);
        }

        return output;
      },
      toModelOutput: ({ output }) => {
        if (!output?.fullContents || output.fullContents.length === 0) {
          return {
            type: 'text',
            value:
              'Không tìm thấy nội dung văn bản (raw_text) của tài liệu nào trong cuộc trò chuyện.',
          };
        }

        const formattedDocuments = output.fullContents
          .map(
            (doc, idx) =>
              `=== TÀI LIỆU #${idx + 1}: "${doc.fileName}" (documentId: ${doc.documentId} | Độ dài: ${doc.characterCount} ký tự) ===\n${doc.rawText}`,
          )
          .join('\n\n========================================\n\n');

        return {
          type: 'text',
          value: `Đã tải toàn bộ nội dung của ${output.totalDocuments} tài liệu:\n\n${formattedDocuments}`,
        };
      },
    });
  }

  /**
   * Tool 3: Lấy thông tin Metadata cơ bản (siêu nhẹ) của toàn bộ tài liệu trong Conversation (Server-Side Tool)
   */
  private buildGetConversationDocumentsMetadataTool(
    onGetDocumentsMetadata: GetConversationDocumentsMetadataCallback,
    metadataOutputsByCallId: Map<
      string,
      GetConversationDocumentsMetadataToolOutput
    >,
  ) {
    return tool({
      description:
        'Lấy thông tin metadata cơ bản (số lượng tài liệu, tên file, định dạng, trạng thái OCR, độ dài ký tự, số trang ước tính, trạng thái đính kèm) của tất cả tài liệu hiện có trong cuộc trò chuyện.',
      inputSchema: z.object({}),
      execute: async (
        _input,
        { toolCallId },
      ): Promise<GetConversationDocumentsMetadataToolOutput> => {
        this.logger.log(
          `[getConversationDocumentsMetadata] Executing tool (callId=${toolCallId})`,
        );
        const output = await onGetDocumentsMetadata();
        if (toolCallId) {
          metadataOutputsByCallId.set(toolCallId, output);
        }
        return output;
      },
      toModelOutput: ({ output }) => {
        if (!output || !output.documents || output.documents.length === 0) {
          return {
            type: 'text',
            value:
              'Cuộc trò chuyện này hiện chưa có tài liệu nào được tải lên.',
          };
        }

        const lines = output.documents.map(
          (doc, idx) =>
            `${idx + 1}. "${doc.fileName}" | documentId: "${doc.documentId}" | Loại: ${doc.mimeType} | Trạng thái OCR: ${doc.ocrStatus} | Độ dài: ${doc.characterCount} ký tự (~${doc.estimatedPages} trang)${doc.isAttached ? ' [ĐANG ĐÍNH KÈM]' : ''}`,
        );

        return {
          type: 'text',
          value:
            `Tổng số tài liệu: ${output.totalDocuments} (Đã sẵn sàng OCR: ${output.readyDocumentsCount}).\nDanh sách chi tiết:\n` +
            lines.join('\n'),
        };
      },
    });
  }

  /**
   * Tool 4: Đặt câu hỏi tương tác với người dùng và chờ phản hồi (Client-Side Tool - KHÔNG có hàm execute)
   */
  private buildAskUserQuestionTool() {
    return tool({
      description:
        'Đặt từ 1 đến tối đa 5 câu hỏi cho người dùng để làm rõ yêu cầu (ví dụ: chọn tài liệu cần tóm tắt, chọn gộp chung hay tách riêng các tài liệu khác chủ đề, chọn phong cách/độ dài hoặc định hướng tóm tắt) và chờ người dùng trả lời trên giao diện trước khi xử lý tiếp.',
      inputSchema: z.object({
        contextMessage: z
          .string()
          .optional()
          .describe(
            'Lời dẫn ngắn gọn, thân thiện giải thích vì sao bạn cần hỏi thêm thông tin từ người dùng.',
          ),
        questions: z
          .array(
            z.object({
              id: z
                .string()
                .describe(
                  'Mã định danh ngắn gọn của câu hỏi (ví dụ: "target_docs", "merge_strategy", "summary_style").',
                ),
              question: z
                .string()
                .describe('Nội dung câu hỏi rõ ràng bằng tiếng Việt dành cho người dùng.'),
              options: z
                .array(z.string())
                .optional()
                .describe(
                  'Danh sách các phương án gợi ý sẵn để người dùng bấm chọn nhanh trên giao diện.',
                ),
              allowMultiple: z
                .boolean()
                .optional()
                .describe(
                  'Đặt là true nếu cho phép người dùng chọn nhiều phương án cùng lúc (mặc định: false).',
                ),
              allowCustomInput: z
                .boolean()
                .optional()
                .describe(
                  'Đặt là true để cho phép người dùng nhập câu trả lời tự do ngoài các phương án gợi ý (mặc định: true).',
                ),
            }),
          )
          .min(1)
          .max(5)
          .describe('Danh sách từ 1 đến tối đa 5 câu hỏi cần người dùng phản hồi.'),
      }),
    });
  }

  /**
   * Tool 5: Tạo bản tóm tắt tài liệu chính thức vào hệ thống (Server-Side Tool)
   */
  private buildCreateDocumentSummaryTool(
    onCreateDocumentSummary: CreateDocumentSummaryCallback,
    summaryOutputsByCallId: Map<string, CreateDocumentSummaryToolOutput>,
  ) {
    return tool({
      description:
        'Khởi tạo bản tóm tắt tài liệu học tập bằng AI và lưu trực tiếp vào Tab Tóm tắt của cuộc trò chuyện. Sử dụng công cụ này khi người dùng yêu cầu tóm tắt một tài liệu, một nhóm tài liệu hoặc toàn bộ tài liệu.',
      inputSchema: z.object({
        scope: z
          .enum(['conversation', 'document', 'section'])
          .describe(
            'Phạm vi tóm tắt: "conversation" (toàn bộ tài liệu trong cuộc trò chuyện), "document" (một hoặc một nhóm tài liệu cụ thể chỉ định qua documentIds), "section" (một khoảng trang cụ thể).',
          ),
        documentIds: z
          .array(z.string())
          .optional()
          .describe(
            'Danh sách UUID của các tài liệu cần tóm tắt (bắt buộc khi scope là "document" hoặc "section"). Nếu truyền nhiều documentIds, nội dung các tài liệu này sẽ được tổng hợp chung vào 1 bản tóm tắt.',
          ),
        mode: z
          .enum(['key_takeaways', 'study_guide', 'qa_style'])
          .optional()
          .default('study_guide')
          .describe(
            'Phong cách bản tóm tắt: "key_takeaways" (Dàn ý cốt lõi), "study_guide" (Hồ sơ ôn thi chi tiết), "qa_style" (Hỏi & Đáp).',
          ),
        length: z
          .enum(['short', 'standard', 'detailed'])
          .optional()
          .default('standard')
          .describe(
            'Độ dài mong muốn: "short" (Ngắn gọn ~1 trang), "standard" (Tiêu chuẩn 2-3 trang), "detailed" (Chi tiết).',
          ),
        customInstruction: z
          .string()
          .optional()
          .describe(
            'Yêu cầu hoặc chỉ dẫn bổ sung từ người dùng (ví dụ: tập trung vào phần nào, trình bày ra sao...).',
          ),
        fromPage: z
          .number()
          .optional()
          .describe('Trang bắt đầu (chỉ dùng khi scope="section").'),
        toPage: z
          .number()
          .optional()
          .describe('Trang kết thúc (chỉ dùng khi scope="section").'),
      }),
      execute: async (
        input,
        { toolCallId },
      ): Promise<CreateDocumentSummaryToolOutput> => {
        this.logger.log(
          `[createDocumentSummary] Executing tool (callId=${toolCallId}): scope=${input.scope}, documentIds=${JSON.stringify(input.documentIds)}, mode=${input.mode}, length=${input.length}`,
        );

        const output = await onCreateDocumentSummary(input);
        if (toolCallId) {
          summaryOutputsByCallId.set(toolCallId, output);
        }
        return output;
      },
      toModelOutput: ({ output }) => {
        if (!output?.summaryId) {
          return {
            type: 'text',
            value: 'Không thể khởi tạo bản tóm tắt.',
          };
        }

        return {
          type: 'text',
          value: `Đã tạo bản tóm tắt thành công!\n- Tên bản tóm tắt: "${output.title}"\n- Mã bản tóm tắt (summaryId): "${output.summaryId}"\n- Phạm vi: ${output.scope} (${(output.documentNames || []).join(', ') || 'Toàn bộ tài liệu'})\n- Phong cách: ${output.mode} | Độ dài: ${output.length}`,
        };
      },
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

    const collectedChunkIds = new Set<string>();
    const chunkToolOutputsByCallId = new Map<
      string,
      SearchDocumentChunksToolOutput
    >();
    const fullContentOutputsByCallId = new Map<
      string,
      GetDocumentsFullContentToolOutput
    >();
    const metadataOutputsByCallId = new Map<
      string,
      GetConversationDocumentsMetadataToolOutput
    >();
    const summaryOutputsByCallId = new Map<
      string,
      CreateDocumentSummaryToolOutput
    >();

    const tools: Record<string, any> = {
      askUserQuestion: this.buildAskUserQuestionTool(),
    };

    if (options?.onSearchDocumentChunks) {
      tools.searchDocumentChunks = this.buildSearchDocumentChunksTool(
        options.onSearchDocumentChunks,
        collectedChunkIds,
        chunkToolOutputsByCallId,
        chatConfig.topK,
      );
    }
    if (options?.onGetDocumentsFullContent) {
      tools.getDocumentsFullContent = this.buildGetDocumentsFullContentTool(
        options.onGetDocumentsFullContent,
        fullContentOutputsByCallId,
      );
    }
    if (options?.onGetDocumentsMetadata) {
      tools.getConversationDocumentsMetadata =
        this.buildGetConversationDocumentsMetadataTool(
          options.onGetDocumentsMetadata,
          metadataOutputsByCallId,
        );
    }
    if (options?.onCreateDocumentSummary) {
      tools.createDocumentSummary = this.buildCreateDocumentSummaryTool(
        options.onCreateDocumentSummary,
        summaryOutputsByCallId,
      );
    }

    const activeTools = Object.keys(tools).length > 0 ? tools : undefined;

    const modelMessages = await convertToModelMessages(messages);
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
        const assistantParts = this.extractAssistantUIParts(
          responseMessages,
          chunkToolOutputsByCallId,
          fullContentOutputsByCallId,
          metadataOutputsByCallId,
          summaryOutputsByCallId,
          event.text,
        );

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

    return streamResult;
  }

  /**
   * Chuyển đổi danh sách ResponseMessage từ nhiều bước (tool call -> tool result -> text)
   * sang mảng UIMessagePart chuẩn của Vercel AI SDK v6 để lưu vào CSDL và hiển thị lại trên UI.
   */
  private extractAssistantUIParts(
    responseMessages: any[],
    chunkToolOutputsByCallId: Map<string, SearchDocumentChunksToolOutput>,
    fullContentOutputsByCallId: Map<string, GetDocumentsFullContentToolOutput>,
    metadataOutputsByCallId: Map<
      string,
      GetConversationDocumentsMetadataToolOutput
    >,
    summaryOutputsByCallId: Map<string, CreateDocumentSummaryToolOutput>,
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
          const toolName = contentPart.toolName || 'searchDocumentChunks';
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

          let lightweightOutput: Record<string, unknown> | undefined;

          if (
            toolName === 'searchDocumentChunks' ||
            toolName === 'searchDocuments'
          ) {
            const chunkOutput = toolCallId
              ? chunkToolOutputsByCallId.get(toolCallId)
              : undefined;
            if (chunkOutput) {
              lightweightOutput = {
                semanticQuery: chunkOutput.semanticQuery,
                keywords: chunkOutput.keywords,
                totalChunks: chunkOutput.totalChunks,
                sources: chunkOutput.sources,
              };
            }
          } else if (toolName === 'getDocumentsFullContent') {
            const fullOutput = toolCallId
              ? fullContentOutputsByCallId.get(toolCallId)
              : undefined;
            if (fullOutput) {
              lightweightOutput = {
                requestedDocumentIds: fullOutput.requestedDocumentIds,
                fetchAllDocuments: fullOutput.fetchAllDocuments,
                totalDocuments: fullOutput.totalDocuments,
                documents: fullOutput.documents,
              };
            }
          } else if (toolName === 'getConversationDocumentsMetadata') {
            const metaOutput = toolCallId
              ? metadataOutputsByCallId.get(toolCallId)
              : undefined;
            if (metaOutput) {
              lightweightOutput = {
                totalDocuments: metaOutput.totalDocuments,
                readyDocumentsCount: metaOutput.readyDocumentsCount,
                attachedDocumentIds: metaOutput.attachedDocumentIds,
                documents: metaOutput.documents,
              };
            }
          } else if (toolName === 'createDocumentSummary') {
            const summaryOutput = toolCallId
              ? summaryOutputsByCallId.get(toolCallId)
              : undefined;
            if (summaryOutput) {
              lightweightOutput = {
                summaryId: summaryOutput.summaryId,
                title: summaryOutput.title,
                scope: summaryOutput.scope,
                mode: summaryOutput.mode,
                length: summaryOutput.length,
                documentNames: summaryOutput.documentNames,
                createdAt: summaryOutput.createdAt,
              };
            }
          }

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
        {
          schema: z.object({
            suggestions: z
              .array(z.string().max(90))
              .min(2)
              .max(3)
              .describe(
                'Danh sách từ 2 đến 3 câu hỏi tiếp theo ngắn gọn, tự nhiên và bám sát nội dung vừa trả lời',
              ),
          }),
        },
      );

      const rawSuggestions = (object as { suggestions?: string[] })?.suggestions;
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
