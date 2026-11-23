import { tool } from 'ai';
import { z } from 'zod';
import {
  formatBackendChunkLocationLabel,
  isPagedDocumentFileName,
} from '../../../../documents/helpers/text-anchor.helper.js';
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
      'A semantically rich sentence or question synthesized from the user’s query for vector similarity search.',
    ),
  keywords: z
    .array(z.string())
    .max(5)
    .describe(
      'Up to 5 important keywords, technical terms, or exact phrases for full-text PGRoonga search.',
    ),
  pageNumbers: z
    .array(z.number().int())
    .optional()
    .describe('Filter search to specific page numbers (e.g., [3, 4]).'),
  pageRange: z
    .object({
      start: z.number().int().describe('Start page number'),
      end: z.number().int().describe('End page number'),
    })
    .optional()
    .describe('Filter search to a page range (e.g., { start: 1, end: 10 }).'),
  includeNeighbors: z
    .boolean()
    .optional()
    .describe(
      'Set to true to also fetch adjacent chunks (chunk_index - 1 and + 1) when a passage appears cut off or needs broader context.',
    ),
  topK: z
    .number()
    .int()
    .min(1)
    .max(12)
    .optional()
    .describe(
      'Number of chunks to retrieve (default 8, max 12 for broad synthesis).',
    ),
});

export function toSearchChunksLightweightOutput(
  output?: SearchDocumentChunksToolOutput,
): Record<string, unknown> | undefined {
  if (!output) return undefined;
  return {
    semanticQuery: output.semanticQuery,
    keywords: output.keywords,
    ...(output.subQueriesUsed ? { subQueriesUsed: output.subQueriesUsed } : {}),
    totalChunks: output.totalChunks,
    sources: output.sources,
    citationIds: output.chunks.map((c) => c.citationId),
  };
}

export function createSearchDocumentChunksTool(
  callback: SearchDocumentChunksCallback,
  tracker?: ToolCallTracker,
  maxChunks: number = 8,
) {
  return tool({
    description: `Search relevant passages (chunks) in workspace study documents using Hybrid Search (pgvector + PGRoonga RRF). Use for specific questions about concepts, definitions, formulas, code, or details in the student's materials. Do NOT call for casual greetings or follow-up questions already answered by prior conversation context. Supports page filtering (pageNumbers/pageRange) and adjacent context expansion (includeNeighbors). Returns up to ${maxChunks} chunks with citation IDs [cX].`,
    inputSchema: searchDocumentChunksInputSchema,
    execute: async (
      { semanticQuery, keywords, pageNumbers, pageRange, includeNeighbors, topK },
      { toolCallId },
    ): Promise<SearchDocumentChunksToolOutput> => {
      const safeKeywords = Array.isArray(keywords)
        ? keywords
            .filter((k) => typeof k === 'string' && k.trim().length > 0)
            .map((k) => k.trim())
            .slice(0, 5)
        : [];

      const limit = Math.min(topK || maxChunks, 12);
      const retrievedChunks = await callback({
        semanticQuery: semanticQuery || '',
        keywords: safeKeywords,
        pageNumbers,
        pageRange,
        includeNeighbors,
        topK: limit,
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
        const roundedRrfScore = Number(c.rrfScore.toFixed(5));
        const rerankScore = c.rerankScore ?? null;
        const rrfRank = c.rrfRank ?? null;
        const vectorRank = c.vectorRank ?? null;
        const keywordRank = c.keywordRank ?? null;

        let citationId = `c${idx + 1}`;
        if (tracker) {
          citationId = tracker.allocateCitation({
            chunkId: c.id,
            chunkIndex: c.chunkIndex,
            documentId: c.documentId,
            fileName: c.fileName,
            pageNumbers: c.pageNumbers,
            headings: c.headings,
            content: c.content,
            rawContent: c.rawContent,
            bboxes: c.bboxes,
            ...(c.textAnchor ? { textAnchor: c.textAnchor } : {}),
            assets: c.assets,
            rrfScore: roundedRrfScore,
            rerankScore,
            rrfRank,
            vectorRank,
            keywordRank,
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
          previewSnippet: c.content ? c.content.slice(0, 200) : '',
          ...(c.textAnchor ? { textAnchor: c.textAnchor } : {}),
          neighbors: c.neighbors,
          rrfScore: roundedRrfScore,
          rerankScore,
          rrfRank,
          vectorRank,
          keywordRank,
        };
      });

      const subQueriesUsed = retrievedChunks.find(
        (c) => Array.isArray(c.subQueriesUsed) && c.subQueriesUsed.length > 1,
      )?.subQueriesUsed;

      const output: SearchDocumentChunksToolOutput = {
        semanticQuery,
        keywords: safeKeywords,
        ...(subQueriesUsed ? { subQueriesUsed } : {}),
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
          const isPaged = isPagedDocumentFileName(chunk.fileName);
          const locationLabel = formatBackendChunkLocationLabel({
            fileName: chunk.fileName,
            pageNumbers: chunk.pageNumbers,
            textAnchor: chunk.textAnchor,
            headings: chunk.headings,
            chunkIndex: chunk.chunkIndex,
          });

          const headingLabel =
            chunk.headings &&
            chunk.headings.length > 0 &&
            !locationLabel.startsWith('Mục: ')
              ? ` | Mục: "${chunk.headings.join(' > ')}"`
              : '';

          const rerankLabel =
            chunk.rerankScore !== undefined && chunk.rerankScore !== null
              ? ` | Rerank: ${chunk.rerankScore}`
              : '';

          let textBlock = `[Dẫn chứng [${chunk.citationId}] | Hạng #${chunk.rank} | Tài liệu: "${chunk.fileName}" | ${locationLabel}${headingLabel}${rerankLabel} | RRF Score: ${chunk.rrfScore}]`;

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
            const prevScope = isPaged
              ? ` (Trang ${prevNeighbor.pageNumbers?.join(', ') || 'N/A'})`
              : '';
            textBlock += `\n<<< [Ngữ cảnh trước liền kề #${prevNeighbor.chunkIndex}${prevScope}]:\n${prevNeighbor.content}\n>>>`;
          }

          textBlock += `\n${chunk.content}`;

          if (nextNeighbor && !isNextDup && nextNeighbor.content) {
            const nextScope = isPaged
              ? ` (Trang ${nextNeighbor.pageNumbers?.join(', ') || 'N/A'})`
              : '';
            textBlock += `\n<<< [Ngữ cảnh sau liền kề #${nextNeighbor.chunkIndex}${nextScope}]:\n${nextNeighbor.content}\n>>>`;
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
