import { Injectable, Logger } from '@nestjs/common';
import {
  convertToModelMessages,
  stepCountIs,
  tool,
} from 'ai';
import { z } from 'zod';
import type { UIMessage } from 'ai';
import { AiService } from './ai.service.js';
import type {
  AvailableDocumentItem,
  DocumentFullContent,
  RetrievedChunk,
} from '../documents/services/retrieval.service.js';

export const CHAT_AGENT_SYSTEM_PROMPT =
  'Bạn là trợ lý học tập AI thông minh của nền tảng AI StudyMate. ' +
  'Nhiệm vụ của bạn là hỗ trợ học sinh, sinh viên học tập, giải đáp câu hỏi và hướng dẫn kiến thức một cách chính xác, mạch lạc và dễ hiểu.\n\n' +
  'QUY TẮC LỰA CHỌN VÀ SỬ DỤNG CÔNG CỤ TRUY XUẤT TÀI LIỆU:\n' +
  'Bạn được trang bị 2 công cụ chuyên biệt để lấy ngữ cảnh từ tài liệu của người dùng. Hãy phân tích kỹ câu hỏi để chọn đúng công cụ:\n\n' +
  '1. Công cụ `getDocumentsFullContent` (Dùng cho câu hỏi TỔNG QUAN / TÓM TẮT TOÀN VĂN):\n' +
  '   - Khi nào sử dụng: Khi người dùng yêu cầu tóm tắt tài liệu, hỏi nội dung tổng quát, bố cục các chương mục, ý chính của toàn bài, hoặc yêu cầu tổng hợp/so sánh toàn bộ nội dung của một, một vài tài liệu (A, B, C) hay tất cả tài liệu trong cuộc trò chuyện.\n' +
  '   - Cách truyền tham số:\n' +
  '     + Nếu người dùng nêu tên tài liệu cụ thể (ví dụ tài liệu A, B): Đối chiếu với "DANH MỤC TÀI LIỆU HIỆN CÓ" bên dưới để truyền đúng mảng `documentIds` tương ứng.\n' +
  '     + Nếu người dùng đính kèm tài liệu và yêu cầu tóm tắt tài liệu đó: Truyền `documentIds` của các tài liệu đang đính kèm.\n' +
  '     + Nếu người dùng yêu cầu tóm tắt/tổng hợp TOÀN BỘ tài liệu trong hệ thống (hoặc hỏi chung mà không chỉ định tệp nào và không đính kèm tệp): Đặt `fetchAllDocuments: true`.\n\n' +
  '2. Công cụ `searchDocumentChunks` (Dùng cho câu hỏi CỤ THỂ / TRA CỨU CHI TIẾT - HYBRID SEARCH RAG):\n' +
  '   - Khi nào sử dụng: Khi người dùng hỏi về một khái niệm, thuật ngữ, định nghĩa, công thức, ví dụ hoặc chi tiết cụ thể nằm trong tài liệu.\n' +
  '   - Cách truyền tham số:\n' +
  '     + `semanticQuery`: Viết một câu văn, đoạn mô tả hoặc câu hỏi đầy đủ, giàu ngữ cảnh ngữ nghĩa dựa trên ý định của người dùng (phục vụ truy vấn Vector pgvector).\n' +
  '     + `keywords`: Một mảng chứa tối đa 5 từ khóa, thuật ngữ chuyên ngành, tên riêng hoặc cụm từ cốt lõi ngắn gọn nhất (phục vụ truy vấn từ khóa PGRoonga trên bảng document_chunks).\n\n' +
  '3. Nguyên tắc trả lời sau khi nhận Context từ công cụ:\n' +
  '   - Tổng hợp câu trả lời bám sát vào nội dung tài liệu thu được.\n' +
  '   - Luôn trích dẫn nguồn rõ ràng (ví dụ: *(Nguồn: Tên_tài_liệu - Trang X)* đối với đoạn trích, hoặc *(Nguồn: Tên_tài_liệu)* đối với toàn văn).\n' +
  '   - Nếu tài liệu không có thông tin liên quan đến câu hỏi, hãy thông báo rõ rằng không tìm thấy trong tài liệu đã tải lên trước khi giải thích bằng kiến thức chung của bạn.\n\n' +
  'QUY TẮC ĐỊNH DẠNG NỘI DUNG:\n' +
  '1. Công thức toán học (LaTeX):\n' +
  '   - Dùng cú pháp `$ ... $` cho các ký hiệu hoặc công thức nội dòng (inline math). Ví dụ: `$O(1)$`, `$O(n \\log n)$`, `$x \\in \\mathbb{R}$`.\n' +
  '   - Dùng cú pháp `$$ ... $$` nằm trên các dòng riêng cho công thức dạng khối (block math).\n' +
  '   - Tuyệt đối KHÔNG sử dụng cú pháp `\\( ... \\)` hoặc `\\[ ... \\]`.\n' +
  '2. Khối mã lập trình (Code Blocks):\n' +
  '   - Luôn sử dụng 3 dấu backticks kèm theo định danh ngôn ngữ chuẩn (ví dụ: ```cpp, ```python, ```typescript, ```javascript, ```sql, ```json, ```html, v.v.).\n' +
  '   - Luôn viết code sạch, có chú thích ngắn gọn, súc tích.';

export const AUTO_HEADER_SYSTEM_PROMPT =
  'Bạn là một API tự động đặt tên nhãn (Label) cho luồng trò chuyện.\n' +
  'Nhiệm vụ: Đọc câu hỏi đầu tiên của học sinh và chuyển nó thành một CỤM DANH TỪ hoặc CỤM TỪ NGẮN GỌN (tên thư mục).\n' +
  'QUY TẮC BẮT BUỘC:\n' +
  '1. Không được giải thích, không được trả lời hay định nghĩa câu hỏi.\n' +
  '2. Độ dài bắt buộc từ 3 đến 6 từ.\n' +
  '3. Định dạng: Chỉ xuất ra chuỗi văn bản thuần (Plain Text). Không chứa dấu ngoặc kép (""), không có từ dẫn nhập, không có dấu chấm câu.\n' +
  '4. BỘ VÍ DỤ ĐA DẠNG (Hãy bắt chước cấu trúc này):\n' +
  '   - Câu hỏi: "Lập trình hướng đối tượng trong Python là gì và cho ví dụ" -> Lập trình hướng đối tượng Python\n' +
  '   - Câu hỏi: "Tóm tắt diễn biến trận chiến Điện Biên Phủ năm 1954" -> Diễn biến trận Điện Biên Phủ\n' +
  '   - Câu hỏi: "Công thức tính diện tích hình tròn lớp 5" -> Diện tích hình tròn lớp 5\n' +
  '   - Câu hỏi: "Tại sao lá cây lại có màu xanh lục hả trợ lý" -> Lý do lá cây màu xanh\n' +
  'CẢNH BÁO LỖI PHỔ BIẾN (TUYỆT ĐỐI KHÔNG VI PHẠM):\n' +
  '• KHÔNG ĐƯỢC định nghĩa từ khóa (Ví dụ người dùng hỏi "X là gì", tuyệt đối không được viết "X là những đoạn...", mà phải đặt tiêu đề là "Khái niệm về X").\n' +
  '• KHÔNG ĐƯỢC hành văn thành một câu đầy đủ có chủ ngữ vị ngữ, chỉ được dùng CỤM DANH TỪ.';

export const FOLLOW_UP_SUGGESTIONS_SYSTEM_PROMPT =
  'Bạn là chuyên gia gợi ý hội thoại học tập trên nền tảng AI StudyMate. ' +
  'Dựa vào câu trả lời vừa rồi của AI (và câu hỏi trước đó của người học nếu có), hãy tạo ra 2 đến 3 câu hỏi gợi ý nối tiếp (follow-up questions) giúp người học tiếp tục khám phá, đào sâu kiến thức hoặc làm rõ chủ đề vừa thảo luận.\n' +
  'QUY TẮC BẮT BUỘC:\n' +
  '1. Câu hỏi phải ngắn gọn (tối đa 80 ký tự), tự nhiên, rõ ràng bằng tiếng Việt.\n' +
  '2. Phải neo trực tiếp vào khái niệm, ví dụ hoặc nội dung vừa được AI trình bày.\n' +
  '3. Tuyệt đối tránh các câu gợi ý chung chung như "Hãy giải thích thêm", "Cho biết thêm thông tin".';

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

@Injectable()
export class ChatAgentAiService {
  private readonly logger = new Logger(ChatAgentAiService.name);

  constructor(private readonly aiService: AiService) {}

  /**
   * Bổ sung Danh mục tài liệu khả dụng trong cuộc trò chuyện vào System Prompt
   * để LLM biết chính xác documentId của từng tài liệu khi cần gọi getDocumentsFullContent.
   */
  buildSystemPromptWithDocumentCatalog(
    basePrompt: string,
    availableDocuments?: AvailableDocumentItem[],
    attachedDocumentIds?: string[],
  ): string {
    if (!availableDocuments || availableDocuments.length === 0) {
      return (
        basePrompt +
        '\n\nTRẠNG THÁI TÀI LIỆU CỦA CUỘC TRÒ CHUYỆN:\n' +
        '- Hiện chưa có tài liệu nào hoàn tất xử lý văn bản trong cuộc trò chuyện này.'
      );
    }

    const attachedSet = new Set(attachedDocumentIds ?? []);
    const catalogLines = availableDocuments.map((doc, idx) => {
      const isAttached = attachedSet.has(doc.documentId);
      const attachedLabel = isAttached
        ? ' [ĐANG ĐƯỢC NGƯỜI DÙNG ĐÍNH KÈM TRONG TIN NHẮN NÀY]'
        : '';
      return `${idx + 1}. Tên tài liệu: "${doc.fileName}" | documentId: "${doc.documentId}"${attachedLabel}`;
    });

    return (
      basePrompt +
      '\n\nDANH MỤC TÀI LIỆU HIỆN CÓ TRONG CUỘC TRÒ CHUYỆN (Dùng `documentId` dưới đây khi gọi `getDocumentsFullContent`):\n' +
      catalogLines.join('\n')
    );
  }

  /**
   * Tool 1: Tìm kiếm các đoạn trích (chunks) bằng Hybrid Search (pgvector + PGRoonga + RRF)
   * phục vụ các câu hỏi chi tiết, thuật ngữ, khái niệm cụ thể.
   */
  private buildSearchDocumentChunksTool(
    onSearchDocumentChunks: SearchDocumentChunksCallback,
    collectedChunkIds: Set<string>,
    chunkToolOutputsByCallId: Map<string, SearchDocumentChunksToolOutput>,
    maxChunks: number = 15,
  ) {
    return tool({
      description:
        `Tìm kiếm các đoạn trích (chunks) cụ thể trong tài liệu bằng Hybrid Search (pgvector + PGRoonga kết hợp thuật toán RRF). Sử dụng công cụ này cho các câu hỏi cụ thể về khái niệm, thuật ngữ, định nghĩa, công thức hoặc chi tiết trong tài liệu. Trả về tối đa ${maxChunks} chunks liên quan nhất.`,
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
        if (!output.chunks || output.chunks.length === 0) {
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
   * Tool 2: Lấy toàn bộ nội dung văn bản (raw_text) của một, một nhóm hoặc tất cả tài liệu
   * phục vụ các yêu cầu tóm tắt tài liệu hoặc câu hỏi tổng quan.
   */
  private buildGetDocumentsFullContentTool(
    onGetDocumentsFullContent: GetDocumentsFullContentCallback,
    fullContentOutputsByCallId: Map<string, GetDocumentsFullContentToolOutput>,
  ) {
    return tool({
      description:
        'Lấy toàn bộ nội dung văn bản (raw_text) của một tài liệu, một nhóm tài liệu (A, B, C) hoặc toàn bộ tài liệu trong cuộc trò chuyện. Sử dụng công cụ này khi người dùng yêu cầu tóm tắt tài liệu, hỏi bố cục tổng quan, các chương mục chính hoặc câu hỏi bao quát toàn bộ tài liệu.',
      inputSchema: z.object({
        documentIds: z
          .array(z.string())
          .optional()
          .describe(
            'Mảng danh sách các documentId của những tài liệu cụ thể cần đọc toàn bộ nội dung raw_text (dựa trên Danh mục tài liệu hiện có). Để trống nếu muốn lấy theo tài liệu đính kèm hoặc lấy toàn bộ.',
          ),
        fetchAllDocuments: z
          .boolean()
          .optional()
          .describe(
            'Đặt là true khi người dùng yêu cầu tóm tắt hoặc tổng hợp kiến thức từ TOÀN BỘ tài liệu có trong cuộc trò chuyện.',
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
        if (!output.fullContents || output.fullContents.length === 0) {
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

  async executeChatStream(
    messages: UIMessage[],
    onFinish: (result: {
      responseMessages: any;
      assistantParts: any[];
      sourceChunkIds: string[];
      text: string;
    }) => Promise<void>,
    abortSignal?: AbortSignal,
    options?: {
      systemPrompt?: string;
      availableDocuments?: AvailableDocumentItem[];
      attachedDocumentIds?: string[];
      onSearchDocumentChunks?: SearchDocumentChunksCallback;
      onGetDocumentsFullContent?: GetDocumentsFullContentCallback;
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

    const tools: Record<string, any> = {};
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

    const activeTools = Object.keys(tools).length > 0 ? tools : undefined;

    const modelMessages = await convertToModelMessages(messages);
    this.logger.log(
      `[ChatAgentAiService] convertToModelMessages: input count=${messages.length}, output count=${modelMessages.length}, activeTools=${activeTools ? Object.keys(activeTools).join(',') : 'none'}, model=${chatConfig.modelName}, temp=${chatConfig.temperature}, maxTokens=${chatConfig.maxOutputTokens}, topK=${chatConfig.topK}`,
    );

    return this.aiService.streamChatAgent(chatConfig.modelName, {
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
          event.text,
        );

        this.logger.log(
          `[ChatAgentAiService] onFinish: text="${event.text?.slice(0, 50)}...", finishReason=${event.finishReason}, partsCount=${assistantParts.length}, sourceChunks=${collectedChunkIds.size}`,
        );

        await onFinish({
          responseMessages,
          assistantParts,
          sourceChunkIds: Array.from(collectedChunkIds),
          text: event.text,
        });
      },
    });
  }

  /**
   * Chuyển đổi danh sách ResponseMessage từ nhiều bước (tool call -> tool result -> text)
   * sang mảng UIMessagePart chuẩn của Vercel AI SDK v6 để lưu vào CSDL và hiển thị lại trên UI.
   */
  private extractAssistantUIParts(
    responseMessages: any[],
    chunkToolOutputsByCallId: Map<string, SearchDocumentChunksToolOutput>,
    fullContentOutputsByCallId: Map<string, GetDocumentsFullContentToolOutput>,
    fallbackText?: string,
  ): any[] {
    const parts: any[] = [];

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
      const response = await this.aiService.generateTextForTask('AUTO_HEADER', [
        { role: 'user', content: AUTO_HEADER_SYSTEM_PROMPT },
        { role: 'user', content: promptText.slice(0, 500) },
      ]);

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
   * Sinh 2-3 câu hỏi gợi ý tiếp nối (Follow-up Questions) dựa trên câu trả lời vừa hoàn tất của AI,
   * sử dụng generateObject với Zod Schema và model của task CHAT_AGENT.
   */
  async generateFollowUpSuggestions(
    lastAssistantResponse: string,
    lastUserQuestion?: string,
  ): Promise<string[]> {
    const trimmedResponse = lastAssistantResponse?.trim() || '';
    if (!trimmedResponse) return [];

    try {
      const promptParts: string[] = [];
      if (lastUserQuestion && lastUserQuestion.trim()) {
        promptParts.push(
          `Câu hỏi trước đó của người học:\n"${lastUserQuestion.trim().slice(0, 500)}"`,
        );
      }
      promptParts.push(
        `Câu trả lời vừa rồi của AI:\n"${trimmedResponse.slice(0, 3000)}"`,
      );

      const { object } = await this.aiService.generateObjectForTask(
        'CHAT_AGENT',
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
          system: FOLLOW_UP_SUGGESTIONS_SYSTEM_PROMPT,
          prompt: promptParts.join('\n\n'),
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
