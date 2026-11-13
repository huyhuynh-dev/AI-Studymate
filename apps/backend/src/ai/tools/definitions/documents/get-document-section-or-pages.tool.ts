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
      'UUID của tài liệu cần đọc (lấy từ Danh mục tài liệu trong System Prompt).',
    ),
  pageNumbers: z
    .array(z.number().int())
    .optional()
    .describe(
      'Mảng danh sách các số trang cụ thể cần đọc (ví dụ [1, 2, 3] hoặc [4]).',
    ),
  headingKeyword: z
    .string()
    .optional()
    .describe(
      'Từ khóa tiêu đề hoặc tên chương/mục cần đọc (ví dụ "Chương 2", "Đạo hàm").',
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
      'Đọc nội dung văn bản theo phân đoạn, mục lục hoặc trang cụ thể của tài liệu. Dùng khi người dùng yêu cầu đọc/giải thích theo trang hoặc chương (ví dụ: "trang 1–3", "Chương 2"), khi cần xem toàn bộ tài liệu ngắn (<= 15 trang), hoặc làm phương án thay thế khi searchDocumentChunks không ra kết quả nhưng mục lục (TOC) có tiêu đề phù hợp.',
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
