import { tool } from 'ai';
import { z } from 'zod';
import type {
  SearchDocumentChunksCallback,
  SearchDocumentChunksSourceSummary,
  SearchDocumentChunksToolOutput,
  ToolCallTracker,
} from '../../types.js';

export const searchDocumentChunksInputSchema = z.object({
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
  pageNumbers: z
    .array(z.number().int())
    .optional()
    .describe('Lọc tìm kiếm trong danh sách số trang cụ thể (ví dụ [3, 4]).'),
  pageRange: z
    .object({
      start: z.number().int().describe('Trang bắt đầu'),
      end: z.number().int().describe('Trang kết thúc'),
    })
    .optional()
    .describe('Lọc tìm kiếm trong khoảng trang (ví dụ { start: 1, end: 10 }).'),
  includeNeighbors: z
    .boolean()
    .optional()
    .describe(
      'Đặt là true để lấy thêm đoạn trích liền kề (chunk_index - 1 và chunk_index + 1) nếu đoạn trích bị ngắt câu/đoạn hoặc cần thêm ngữ cảnh rộng hơn.',
    ),
});

export function toSearchChunksLightweightOutput(
  output?: SearchDocumentChunksToolOutput,
): Record<string, unknown> | undefined {
  if (!output) return undefined;
  return {
    semanticQuery: output.semanticQuery,
    keywords: output.keywords,
    totalChunks: output.totalChunks,
    sources: output.sources,
    citationIds: output.chunks.map((c) => c.citationId),
  };
}

export function createSearchDocumentChunksTool(
  callback: SearchDocumentChunksCallback,
  tracker?: ToolCallTracker,
  maxChunks: number = 15,
) {
  return tool({
    description: `Tìm kiếm các đoạn trích (chunks) cụ thể trong tài liệu bằng Hybrid Search (pgvector + PGRoonga kết hợp thuật toán RRF). Sử dụng công cụ này cho các câu hỏi cụ thể về khái niệm, thuật ngữ, định nghĩa, công thức hoặc chi tiết trong tài liệu. Cho phép lọc theo trang (pageNumbers/pageRange) và mở rộng ngữ cảnh liền kề (includeNeighbors). Trả về tối đa ${maxChunks} chunks liên quan nhất kèm mã trích dẫn [cX].`,
    inputSchema: searchDocumentChunksInputSchema,
    execute: async (
      { semanticQuery, keywords, pageNumbers, pageRange, includeNeighbors },
      { toolCallId },
    ): Promise<SearchDocumentChunksToolOutput> => {
      const safeKeywords = Array.isArray(keywords)
        ? keywords
            .filter((k) => typeof k === 'string' && k.trim().length > 0)
            .map((k) => k.trim())
            .slice(0, 5)
        : [];

      const retrievedChunks = await callback({
        semanticQuery: semanticQuery || '',
        keywords: safeKeywords,
        pageNumbers,
        pageRange,
        includeNeighbors,
      });

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

      const chunksWithCitations = retrievedChunks.map((c, idx) => {
        let citationId = `c${idx + 1}`;
        if (tracker) {
          citationId = tracker.allocateCitation({
            chunkId: c.id,
            documentId: c.documentId,
            fileName: c.fileName,
            pageNumbers: c.pageNumbers,
            headings: c.headings,
            content: c.content,
            rawContent: c.rawContent,
            bboxes: c.bboxes,
            assets: c.assets,
          });
        }

        return {
          citationId,
          rank: idx + 1,
          id: c.id,
          documentId: c.documentId,
          fileName: c.fileName,
          chunkIndex: c.chunkIndex,
          pageNumbers: c.pageNumbers,
          headings: c.headings,
          content: c.content,
          rawContent: c.rawContent,
          bboxes: c.bboxes,
          assets: c.assets,
          neighbors: c.neighbors,
          rrfScore: Number(c.rrfScore.toFixed(5)),
        };
      });

      const output: SearchDocumentChunksToolOutput = {
        semanticQuery,
        keywords: safeKeywords,
        totalChunks: chunksWithCitations.length,
        sources,
        chunks: chunksWithCitations,
      };

      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'searchDocumentChunks',
          output,
          toSearchChunksLightweightOutput(output),
        );
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

      // Thu thập tập hợp các chunkIndex của các chunk chính thuộc từng documentId để khử trùng lặp
      const primaryChunkKeys = new Set(
        output.chunks.map((c) => `${c.documentId}:${c.chunkIndex}`),
      );

      const formattedChunks = output.chunks
        .map((chunk) => {
          const pageLabel =
            chunk.pageNumbers && chunk.pageNumbers.length > 0
              ? `Trang ${chunk.pageNumbers.join(', ')}`
              : `Chunk #${chunk.chunkIndex}`;

          const headingLabel =
            chunk.headings && chunk.headings.length > 0
              ? ` | Mục: "${chunk.headings.join(' > ')}"`
              : '';

          let textBlock = `[Dẫn chứng [${chunk.citationId}] | Hạng #${chunk.rank} | Tài liệu: "${chunk.fileName}" | ${pageLabel}${headingLabel} | RRF Score: ${chunk.rrfScore}]`;

          // Xử lý hiển thị includeNeighbors kèm khử trùng lặp
          const prevNeighbor = chunk.neighbors?.prev;
          const nextNeighbor = chunk.neighbors?.next;

          const isPrevDup =
            prevNeighbor &&
            primaryChunkKeys.has(
              `${chunk.documentId}:${prevNeighbor.chunkIndex}`,
            );
          const isNextDup =
            nextNeighbor &&
            primaryChunkKeys.has(
              `${chunk.documentId}:${nextNeighbor.chunkIndex}`,
            );

          if (prevNeighbor && !isPrevDup && prevNeighbor.content) {
            textBlock += `\n<<< [Ngữ cảnh trước liền kề #${prevNeighbor.chunkIndex} (Trang ${prevNeighbor.pageNumbers?.join(', ') || 'N/A'})]:\n${prevNeighbor.content}\n>>>`;
          }

          textBlock += `\n${chunk.content}`;

          if (nextNeighbor && !isNextDup && nextNeighbor.content) {
            textBlock += `\n<<< [Ngữ cảnh sau liền kề #${nextNeighbor.chunkIndex} (Trang ${nextNeighbor.pageNumbers?.join(', ') || 'N/A'})]:\n${nextNeighbor.content}\n>>>`;
          }

          return textBlock;
        })
        .join('\n\n---\n\n');

      return {
        type: 'text',
        value: `Tìm thấy ${output.totalChunks} đoạn trích liên quan từ tài liệu:\n\n${formattedChunks}`,
      };
    },
  });
}
