import { tool } from 'ai';
import { z } from 'zod';
import type {
  DocumentFullContentSummaryItem,
  GetDocumentsFullContentCallback,
  GetDocumentsFullContentToolOutput,
  ToolCallTracker,
} from '../types.js';

export const getDocumentsFullContentInputSchema = z.object({
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
});

export function toFullContentLightweightOutput(
  output?: GetDocumentsFullContentToolOutput,
): Record<string, unknown> | undefined {
  if (!output) return undefined;
  return {
    requestedDocumentIds: output.requestedDocumentIds,
    fetchAllDocuments: output.fetchAllDocuments,
    totalDocuments: output.totalDocuments,
    documents: output.documents,
  };
}

export function createGetDocumentsFullContentTool(
  callback: GetDocumentsFullContentCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'Lấy toàn bộ nội dung văn bản (raw_text) của một tài liệu, một nhóm tài liệu hoặc toàn bộ tài liệu trong cuộc trò chuyện để trả lời câu hỏi tổng quan/so sánh trực tiếp trong khung chat. Lưu ý: Nếu người dùng yêu cầu TẠO BẢN TÓM TẮT tài liệu lưu vào hệ thống, hãy ưu tiên sử dụng công cụ `createDocumentSummary`.',
    inputSchema: getDocumentsFullContentInputSchema,
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

      const fullContents = await callback({
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

      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'getDocumentsFullContent',
          output,
          toFullContentLightweightOutput(output),
        );
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
