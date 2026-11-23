import { jsonSchema, tool } from 'ai';
import { z } from 'zod';
import type {
  SuperDocApiCallCallback,
  SuperDocApiCallToolInput,
  ToolCallTracker,
} from '../../types.js';

export const superdocApiCallInputSchema = z.object({}).passthrough();

export function toSuperDocApiCallLightweightOutput(
  input: SuperDocApiCallToolInput,
  rawOutput: unknown,
  meta?: { documentId?: string; fileName?: string },
): Record<string, unknown> {
  const obj =
    typeof rawOutput === 'object' && rawOutput !== null
      ? (rawOutput as Record<string, unknown>)
      : {};
  const errorObj =
    typeof obj.error === 'object' && obj.error !== null
      ? (obj.error as Record<string, unknown>)
      : undefined;
  const errorMessage =
    typeof errorObj?.message === 'string'
      ? errorObj.message
      : typeof obj.error === 'string'
        ? obj.error
        : undefined;

  const calls = Array.isArray(input.calls) ? input.calls : undefined;
  const operationId =
    typeof input.operationId === 'string'
      ? input.operationId
      : calls &&
          calls[0] &&
          typeof calls[0] === 'object' &&
          typeof (calls[0] as Record<string, unknown>).operationId === 'string'
        ? String((calls[0] as Record<string, unknown>).operationId)
        : 'native_api';

  return {
    ...(meta?.documentId ? { documentId: meta.documentId } : {}),
    ...(meta?.fileName ? { fileName: meta.fileName } : {}),
    operationId,
    ...(calls ? { batchSize: calls.length } : {}),
    status:
      obj.status === 'failed' || obj.ok === false || Boolean(errorMessage)
        ? 'failed'
        : 'ok',
    ...(errorMessage ? { errorMessage } : {}),
  };
}

export function createSuperDocApiCallTool(
  callback: SuperDocApiCallCallback,
  tracker?: ToolCallTracker,
  runtimeMeta?: {
    description?: string;
    inputSchema?: Record<string, unknown>;
    documentId?: string;
    fileName?: string;
  },
) {
  const resolvedInputSchema = runtimeMeta?.inputSchema
    ? jsonSchema<SuperDocApiCallToolInput>(runtimeMeta.inputSchema as any)
    : superdocApiCallInputSchema;

  return tool({
    description:
      runtimeMeta?.description ??
      'Execute native SuperDoc Document API reads, mutations, or ordered batches (e.g. doc.citations.*, doc.fields.*, doc.tables.*, doc.sections.*). Ordinary document text MUST use superdoc_stream_text.',
    inputSchema: resolvedInputSchema,
    execute: async (input, { toolCallId }) => {
      const rawOutput = await callback(input);
      const lightweight = toSuperDocApiCallLightweightOutput(input, rawOutput, {
        documentId: runtimeMeta?.documentId,
        fileName: runtimeMeta?.fileName,
      });
      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'superdoc_api_call',
          rawOutput,
          lightweight,
        );
      }
      return rawOutput;
    },
    toModelOutput: ({ output }) => ({
      type: 'json',
      value: output as any,
    }),
  });
}
