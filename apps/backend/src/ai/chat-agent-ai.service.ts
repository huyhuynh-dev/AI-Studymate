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
  'Nhiệm vụ của bạn là hỗ trợ học sinh, sinh viên học tập, giải đáp câu hỏi, tóm tắt tài liệu và hướng dẫn kiến thức một cách chính xác, mạch lạc và dễ hiểu.\n\n' +
  'QUY TẮC LỰA CHỌN VÀ SỬ DỤNG CÔNG CỤ (TOOLS):\n' +
  'Bạn được trang bị 5 công cụ chuyên biệt. Hãy phân tích kỹ ý định của người dùng để chọn đúng công cụ:\n\n' +
  '1. Công cụ `getConversationDocumentsMetadata` (Server-Side Tool - Tra cứu thông tin cơ bản về tài liệu):\n' +
  '   - Khi nào sử dụng: Khi người dùng hỏi trong cuộc trò chuyện có bao nhiêu tài liệu, tên từng tài liệu là gì, trạng thái xử lý OCR, độ dài (số ký tự/trang ước tính), hoặc khi bạn cần kiểm tra danh sách tài liệu trước khi tư vấn/tóm tắt.\n\n' +
  '2. Công cụ `askUserQuestion` (Client-Side Tool - Đặt câu hỏi làm rõ yêu cầu với người dùng):\n' +
  '   - Khi nào sử dụng: Khi người dùng yêu cầu tóm tắt tài liệu (hoặc yêu cầu học tập) nhưng thông tin còn mơ hồ, chưa rõ ràng. Ví dụ:\n' +
  '     + Người dùng nói "Tóm tắt tài liệu giúp mình" trong khi cuộc trò chuyện có nhiều tài liệu và chưa đính kèm tệp cụ thể.\n' +
  '     + Người dùng chọn nhiều tài liệu (ví dụ A và B): Nếu bạn thấy tên/nội dung các tài liệu thuộc cùng một chủ đề liên quan mật thiết, bạn có thể gộp chung hoặc hỏi xác nhận nhẹ; nếu các tài liệu thuộc các chủ đề khác nhau, hãy dùng `askUserQuestion` để hỏi người dùng muốn gộp chung thành 1 bản tóm tắt tổng hợp hay tạo riêng từng bản tóm tắt cho mỗi tài liệu.\n' +
  '     + Khi cần làm rõ mong muốn của người dùng về định hướng tóm tắt (ví dụ: tóm tắt dàn ý cốt lõi, hồ sơ ôn thi chi tiết hay hỏi-đáp; độ dài ngắn gọn hay chi tiết; hoặc phần nội dung muốn tập trung).\n' +
  '   - Nguyên tắc quan trọng khi dùng `askUserQuestion`:\n' +
  '     + Hãy đặt câu hỏi tự nhiên, linh hoạt theo ngữ cảnh thực tế, KHÔNG rập khuôn máy móc.\n' +
  '     + Luôn cung cấp các phương án gợi ý (`options`) ngắn gọn, sát thực tế để người dùng có thể bấm chọn nhanh, đồng thời cho phép họ tự nhập câu trả lời riêng (`allowCustomInput: true`).\n' +
  '     + GIỚI HẠN AN TOÀN: Chỉ hỏi từ 1 đến tối đa 3–5 câu hỏi quan trọng nhất trong một lượt. Tuyệt đối tránh việc hỏi lại liên tục nhiều vòng gây mất thời gian của người học.\n' +
  '     + Nếu người dùng đã nêu yêu cầu rất rõ ràng ngay từ đầu (hoặc yêu cầu "tóm tắt ngay / tóm tắt nhanh" một tài liệu đã xác định), bạn có thể tiến hành gọi `createDocumentSummary` ngay mà không bắt buộc phải hỏi lại.\n\n' +
  '3. Công cụ `createDocumentSummary` (Server-Side Tool - Khởi tạo bản tóm tắt tài liệu vào Tab Tóm tắt):\n' +
  '   - Khi nào sử dụng: Khi người dùng yêu cầu TẠO BẢN TÓM TẮT tài liệu (một tài liệu, một nhóm tài liệu A, B, C hoặc toàn bộ tài liệu) và bạn đã có đủ thông tin cần thiết.\n' +
  '   - Cách truyền tham số:\n' +
  '     + `scope`: Đặt là `"conversation"` nếu tóm tắt toàn bộ tài liệu trong cuộc trò chuyện; đặt là `"document"` nếu tóm tắt một hoặc một nhóm tài liệu cụ thể (kèm mảng `documentIds` tương ứng); đặt là `"section"` nếu tóm tắt theo khoảng trang (`fromPage`, `toPage`).\n' +
  '     + `mode`: `"key_takeaways"` (Dàn ý cốt lõi), `"study_guide"` (Hồ sơ ôn thi - mặc định), hoặc `"qa_style"` (Hỏi & Đáp).\n' +
  '     + `length`: `"short"` (Ngắn gọn ~1 trang), `"standard"` (Tiêu chuẩn 2-3 trang - mặc định), hoặc `"detailed"` (Chi tiết).\n' +
  '     + `customInstruction`: Ghi chú cụ thể về trọng tâm hoặc yêu cầu riêng của người dùng (nếu có).\n' +
  '     + Lưu ý: Nếu người dùng muốn TÁCH RIÊNG từng bản tóm tắt cho từng tài liệu (ví dụ 1 bản cho tài liệu A, 1 bản cho tài liệu B), hãy gọi `createDocumentSummary` riêng cho từng tài liệu.\n' +
  '   - Sau khi `createDocumentSummary` thực thi thành công: Hãy thông báo ngắn gọn rằng bản tóm tắt đã được khởi tạo hoàn tất và nhắc người dùng có thể nhấn trực tiếp vào nhãn (badge) tên bản tóm tắt hiển thị ngay bên trên để mở trong Tab Tóm tắt.\n\n' +
  '4. Công cụ `getDocumentsFullContent` (Dùng khi cần đọc toàn văn `raw_text` để trả lời câu hỏi tổng quan / so sánh trực tiếp trong khung chat mà KHÔNG phải yêu cầu tạo bản lưu Tóm tắt mới).\n\n' +
  '5. Công cụ `searchDocumentChunks` (Dùng cho câu hỏi CỤ THỂ / TRA CỨU CHI TIẾT - HYBRID SEARCH RAG):\n' +
  '   - Khi người dùng hỏi về một khái niệm, thuật ngữ, định nghĩa, công thức, ví dụ hoặc chi tiết cụ thể nằm trong tài liệu.\n' +
  '   - Truyền `semanticQuery` giàu ngữ cảnh và mảng `keywords` (tối đa 5 từ khóa).\n\n' +
  '6. Nguyên tắc trả lời và trích dẫn:\n' +
  '   - Tổng hợp câu trả lời bám sát vào nội dung tài liệu thu được và luôn trích dẫn nguồn rõ ràng.\n\n' +
  'QUY TẮC ĐỊNH DẠNG NỘI DUNG:\n' +
  '1. Công thức toán học (LaTeX):\n' +
  '   - Dùng cú pháp `$ ... $` cho công thức nội dòng (inline math) và `$$ ... $$` trên dòng riêng cho công thức khối (block math).\n' +
  '   - Tuyệt đối KHÔNG sử dụng cú pháp `\\( ... \\)` hoặc `\\[ ... \\]`.\n' +
  '2. Khối mã lập trình (Code Blocks):\n' +
  '   - Luôn sử dụng 3 dấu backticks kèm định danh ngôn ngữ chuẩn.';

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
   * Bổ sung Danh mục tài liệu khả dụng siêu gọn trong cuộc trò chuyện vào System Prompt
   * để LLM biết nhanh tên file và documentId, kết hợp với tool getConversationDocumentsMetadata khi cần chi tiết.
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
        '- Hiện chưa có tài liệu nào hoàn tất xử lý văn bản trong cuộc trò chuyện này (có thể dùng `getConversationDocumentsMetadata` để kiểm tra xem có tài liệu nào đang xử lý OCR hay không).'
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
      `\n\nDANH MỤC TÀI LIỆU SẴN SÀNG TRONG CUỘC TRÒ CHUYỆN (${availableDocuments.length} tài liệu - Dùng \`documentId\` dưới đây khi gọi công cụ, hoặc gọi \`getConversationDocumentsMetadata\` để xem thông tin chi tiết):\n` +
      catalogLines.join('\n')
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
          metadataOutputsByCallId,
          summaryOutputsByCallId,
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
   * Sinh 2-3 câu hỏi gợi ý tiếp nối (Follow-up Questions) dựa trên câu trả lời vừa hoàn tất của AI
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
