import { tool } from 'ai';
import { z } from 'zod';
import type {
  SearchDocumentChunksCallback,
  SearchDocumentChunksSourceSummary,
  SearchDocumentChunksToolOutput,
  ToolCallTracker,
} from '../types.js';

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
  };
}

export function createSearchDocumentChunksTool(
  callback: SearchDocumentChunksCallback,
  tracker?: ToolCallTracker,
  maxChunks: number = 15,
) {
  return tool({
    description: `Tìm kiếm các đoạn trích (chunks) cụ thể trong tài liệu bằng Hybrid Search (pgvector + PGRoonga kết hợp thuật toán RRF). Sử dụng công cụ này cho các câu hỏi cụ thể về khái niệm, thuật ngữ, định nghĩa, công thức hoặc chi tiết trong tài liệu. Trả về tối đa ${maxChunks} chunks liên quan nhất.`,
    inputSchema: searchDocumentChunksInputSchema,
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

      const retrievedChunks = await callback({
        semanticQuery: semanticQuery || '',
        keywords: safeKeywords,
      });

      if (tracker) {
        for (const chunk of retrievedChunks) {
          if (chunk.id) {
            tracker.recordChunkId(chunk.id);
          }
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
