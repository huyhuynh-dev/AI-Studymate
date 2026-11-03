import { Injectable, Logger } from '@nestjs/common';
import {
  convertToModelMessages,
  jsonSchema,
  stepCountIs,
  tool,
} from 'ai';
import type { UIMessage } from 'ai';
import { AiService } from './ai.service.js';
import type { RetrievedChunk } from '../documents/services/retrieval.service.js';

export const CHAT_AGENT_SYSTEM_PROMPT =
  'Bạn là trợ lý học tập AI thông minh của nền tảng AI StudyMate. ' +
  'Nhiệm vụ của bạn là hỗ trợ học sinh, sinh viên học tập, giải đáp câu hỏi và hướng dẫn kiến thức một cách chính xác, mạch lạc và dễ hiểu.\n\n' +
  'QUY TẮC TRA CỨU TÀI LIỆU (RAG - HYBRID SEARCH):\n' +
  '1. Bạn được cung cấp công cụ `searchDocuments` để tìm kiếm ngữ cảnh trong các tài liệu do người dùng tải lên cuộc trò chuyện.\n' +
  '2. Khi người dùng đặt câu hỏi về bài học, tài liệu, khái niệm, bài tập hoặc yêu cầu tóm tắt/giải thích kiến thức, hãy LUÔN gọi công cụ `searchDocuments` trước khi trả lời.\n' +
  '3. Cách truyền tham số khi gọi `searchDocuments`:\n' +
  '   - `semanticQuery`: Viết một câu văn, đoạn mô tả hoặc câu hỏi đầy đủ, giàu ngữ cảnh ngữ nghĩa dựa trên ý định của người dùng (dùng cho truy vấn Vector pgvector).\n' +
  '   - `keywords`: Một mảng chứa tối đa 5 từ khóa, thuật ngữ chuyên ngành, tên riêng hoặc cụm từ cốt lõi ngắn gọn nhất (dùng cho truy vấn từ khóa PGRoonga trên bảng document_chunks).\n' +
  '4. Sau khi nhận được danh sách các đoạn trích (chunks) từ công cụ:\n' +
  '   - Tổng hợp câu trả lời dựa sát trên nội dung tài liệu tìm được.\n' +
  '   - Trích dẫn nguồn rõ ràng trong câu trả lời (ví dụ: *(Nguồn: Tên_tài_liệu - Trang X)*).\n' +
  '   - Nếu kết quả tìm kiếm không có thông tin liên quan đến câu hỏi, hãy thông báo rõ rằng không tìm thấy trong tài liệu đã tải lên trước khi giải thích bằng kiến thức chung của bạn.\n\n' +
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

export interface SearchDocumentsToolInput {
  semanticQuery: string;
  keywords: string[];
}

export interface SearchDocumentsSourceSummary {
  documentId: string;
  fileName: string;
  pageNumbers: number[];
  chunkCount: number;
}

export interface SearchDocumentsToolOutput {
  semanticQuery: string;
  keywords: string[];
  totalChunks: number;
  sources: SearchDocumentsSourceSummary[];
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

export type DocumentSearchCallback = (
  input: SearchDocumentsToolInput,
) => Promise<RetrievedChunk[]>;

@Injectable()
export class ChatAgentAiService {
  private readonly logger = new Logger(ChatAgentAiService.name);

  constructor(private readonly aiService: AiService) {}

  private buildSearchDocumentsTool(
    onSearchDocuments: DocumentSearchCallback,
    collectedChunkIds: Set<string>,
    toolOutputsByCallId: Map<string, SearchDocumentsToolOutput>,
  ) {
    return tool({
      description:
        'Tìm kiếm ngữ cảnh trong tài liệu của người dùng bằng phương pháp Hybrid Search (pgvector + PGRoonga kết hợp thuật toán xếp hạng RRF). Trả về danh sách tối đa 20 đoạn trích (chunks) liên quan nhất.',
      inputSchema: jsonSchema<SearchDocumentsToolInput>({
        type: 'object',
        properties: {
          semanticQuery: {
            type: 'string',
            description:
              'Câu văn, đoạn mô tả hoặc câu hỏi giàu ngữ cảnh ngữ nghĩa được tổng hợp từ câu hỏi của người dùng, dùng để tạo vector embedding và tìm kiếm tương đồng ngữ nghĩa (Vector Search).',
          },
          keywords: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 5,
            description:
              'Mảng danh sách các từ khóa, thuật ngữ chuyên môn hoặc cụm từ quan trọng (tối đa 5 từ khóa) dùng để tìm kiếm toàn văn PGRoonga trên cột content của bảng document_chunks.',
          },
        },
        required: ['semanticQuery', 'keywords'],
        additionalProperties: false,
      }),
      execute: async (
        { semanticQuery, keywords },
        { toolCallId },
      ): Promise<SearchDocumentsToolOutput> => {
        const safeKeywords = Array.isArray(keywords)
          ? keywords
              .filter((k) => typeof k === 'string' && k.trim().length > 0)
              .map((k) => k.trim())
              .slice(0, 5)
          : [];

        this.logger.log(
          `[searchDocuments] Executing tool (callId=${toolCallId}): semanticQuery="${semanticQuery}", keywords=${JSON.stringify(safeKeywords)}`,
        );

        const retrievedChunks = await onSearchDocuments({
          semanticQuery: semanticQuery || '',
          keywords: safeKeywords,
        });

        // Lưu lại ID của các chunks đã truy xuất để ghi nhận vào cột source_chunks
        for (const chunk of retrievedChunks) {
          if (chunk.id) {
            collectedChunkIds.add(chunk.id);
          }
        }

        // Nhóm thông tin tài liệu nguồn để hiển thị gọn gàng trên UI
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

        const sources: SearchDocumentsSourceSummary[] = Array.from(
          sourceMap.values(),
        ).map((s) => ({
          documentId: s.documentId,
          fileName: s.fileName,
          pageNumbers: Array.from(s.pages).sort((a, b) => a - b),
          chunkCount: s.chunkCount,
        }));

        const output: SearchDocumentsToolOutput = {
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
          toolOutputsByCallId.set(toolCallId, output);
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
      onSearchDocuments?: DocumentSearchCallback;
    },
  ) {
    const systemPrompt = options?.systemPrompt ?? CHAT_AGENT_SYSTEM_PROMPT;
    const collectedChunkIds = new Set<string>();
    const toolOutputsByCallId = new Map<string, SearchDocumentsToolOutput>();

    const tools = options?.onSearchDocuments
      ? {
          searchDocuments: this.buildSearchDocumentsTool(
            options.onSearchDocuments,
            collectedChunkIds,
            toolOutputsByCallId,
          ),
        }
      : undefined;

    const modelMessages = await convertToModelMessages(messages);
    this.logger.log(
      `[ChatAgentAiService] convertToModelMessages: input count=${messages.length}, output count=${modelMessages.length}, toolsEnabled=${Boolean(tools)}`,
    );

    return this.aiService.streamTextForTask('CHAT_AGENT', {
      system: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(5),
      abortSignal,
      onFinish: async (event) => {
        const responseMessages = event.response?.messages ?? [];
        const assistantParts = this.extractAssistantUIParts(
          responseMessages,
          toolOutputsByCallId,
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
    toolOutputsByCallId: Map<string, SearchDocumentsToolOutput>,
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
          const toolName = contentPart.toolName || 'searchDocuments';
          const toolCallId = contentPart.toolCallId;
          const toolOutput = toolCallId
            ? toolOutputsByCallId.get(toolCallId)
            : undefined;

          // Khi lưu vào DB, lược bỏ nội dung thô của 20 chunks trong phần UI part để tiết kiệm dung lượng,
          // chỉ giữ lại metadata (semanticQuery, keywords, totalChunks, sources) phục vụ hiển thị UI
          const lightweightOutput = toolOutput
            ? {
                semanticQuery: toolOutput.semanticQuery,
                keywords: toolOutput.keywords,
                totalChunks: toolOutput.totalChunks,
                sources: toolOutput.sources,
              }
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
}
