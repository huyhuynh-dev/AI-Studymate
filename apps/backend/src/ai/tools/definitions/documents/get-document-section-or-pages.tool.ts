import { tool } from 'ai';
import { z } from 'zod';
import type {
  GetDocumentSectionOrPagesCallback,
  GetDocumentSectionOrPagesToolOutput,
  ToolCallTracker,
} from '../../types.js';

export const getDocumentSectionOrPagesInputSchema = z.object({
  documentId: z
    .string()
    .describe(
      'UUID of the target document (from the <workspace_documents> catalog in the System Prompt).',
    ),
  pageNumbers: z
    .array(z.number().int())
    .optional()
    .describe(
      'Specific page numbers to read (e.g., [1, 2, 3] or [4]).',
    ),
  headingKeyword: z
    .string()
    .optional()
    .describe(
      'Chapter, section, or heading keyword to read (e.g., "Chương 2", "Derivatives").',
    ),
});

export function toSectionOrPagesLightweightOutput(
  output?: GetDocumentSectionOrPagesToolOutput,
): Record<string, unknown> | undefined {
  if (!output) return undefined;
  return {
    documentId: output.documentId,
    fileName: output.fileName,
    pageCount: output.pageCount,
    isFullDocument: output.isFullDocument,
    totalChunks: output.totalChunks,
    message: output.message,
    citationIds: output.chunks.map((c) => c.citationId),
  };
}

export function createGetDocumentSectionOrPagesTool(
  callback: GetDocumentSectionOrPagesCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'Read document text by specific pages, section, or chapter. Use when the student asks to read/explain/summarize by page range or heading (e.g., "pages 1-3", "Chapter 2"), when reviewing an entire short document (<= 15 pages), or as a fallback when searchDocumentChunks returns no matches but the Table of Contents shows a relevant section. Specify pageNumbers or headingKeyword for long documents.',
    inputSchema: getDocumentSectionOrPagesInputSchema,
    execute: async (
      { documentId, pageNumbers, headingKeyword },
      { toolCallId },
    ): Promise<GetDocumentSectionOrPagesToolOutput> => {
      const res = await callback({
        documentId,
        pageNumbers,
        headingKeyword,
      });

      const chunksWithCitations = res.chunks.map((chunk, idx) => {
        let citationId = `c${idx + 1}`;
        if (tracker) {
          citationId = tracker.allocateCitation({
            chunkId: chunk.id,
            documentId: chunk.documentId,
            fileName: chunk.fileName,
            pageNumbers: chunk.pageNumbers,
            headings: chunk.headings,
            content: chunk.content,
            rawContent: chunk.rawContent,
            bboxes: chunk.bboxes,
            assets: chunk.assets,
          });
        }

        return {
          citationId,
          chunkId: chunk.id,
          chunkIndex: chunk.chunkIndex,
          pageNumbers: chunk.pageNumbers,
          headings: chunk.headings,
          content: chunk.content,
          previewSnippet: chunk.content ? chunk.content.slice(0, 200) : '',
        };
      });

      const output: GetDocumentSectionOrPagesToolOutput = {
        documentId: res.documentId,
        fileName: res.fileName,
        pageCount: res.pageCount,
        isFullDocument: res.isFullDocument,
        totalChunks: chunksWithCitations.length,
        message: res.message,
        chunks: chunksWithCitations,
      };

      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'getDocumentSectionOrPages',
          output,
          toSectionOrPagesLightweightOutput(output),
        );
      }

      return output;
    },
    toModelOutput: ({ output }) => {
      if (!output?.chunks || output.chunks.length === 0) {
        return {
          type: 'text',
          value: output?.message
            ? output.message
            : `Không tìm thấy nội dung văn bản phù hợp trong tài liệu "${output?.fileName || output?.documentId}".`,
        };
      }

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
          return `[Dẫn chứng [${chunk.citationId}] | Tài liệu: "${output.fileName}" | ${pageLabel}${headingLabel}]\n${chunk.content}`;
        })
        .join('\n\n---\n\n');

      const prefixMessage = output.message ? `ℹ️ Lưu ý: ${output.message}\n\n` : '';

      return {
        type: 'text',
        value: `${prefixMessage}Đã tải ${output.totalChunks} đoạn trích từ "${output.fileName}" (${output.isFullDocument ? 'Toàn bộ tài liệu' : 'Theo phạm vi yêu cầu'}):\n\n${formattedChunks}`,
      };
    },
  });
}
