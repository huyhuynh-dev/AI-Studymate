import { tool } from 'ai';
import { z } from 'zod';
import type {
  GetConversationDocumentsMetadataCallback,
  GetConversationDocumentsMetadataToolOutput,
  ToolCallTracker,
} from '../../types.js';

export const getConversationDocumentsMetadataInputSchema = z.object({});

export function toMetadataLightweightOutput(
  output?: GetConversationDocumentsMetadataToolOutput,
): Record<string, unknown> | undefined {
  if (!output) return undefined;
  return {
    totalDocuments: output.totalDocuments,
    readyDocumentsCount: output.readyDocumentsCount,
    attachedDocumentIds: output.attachedDocumentIds,
    documents: output.documents,
  };
}

export function createGetConversationDocumentsMetadataTool(
  callback: GetConversationDocumentsMetadataCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'Lấy thông tin metadata cơ bản (số lượng tài liệu, tên file, định dạng, trạng thái OCR, độ dài ký tự, số trang ước tính, trạng thái đính kèm) của tất cả tài liệu hiện có trong cuộc trò chuyện.',
    inputSchema: getConversationDocumentsMetadataInputSchema,
    execute: async (
      _input,
      { toolCallId },
    ): Promise<GetConversationDocumentsMetadataToolOutput> => {
      const output = await callback();

      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'getConversationDocumentsMetadata',
          output,
          toMetadataLightweightOutput(output),
        );
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
