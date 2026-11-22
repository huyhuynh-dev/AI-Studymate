import { jsonSchema, tool } from 'ai';
import { z } from 'zod';
import type {
  SuperDocApiSearchCallback,
  SuperDocApiSearchToolInput,
  ToolCallTracker,
} from '../../types.js';

export const superdocApiSearchInputSchema = z.object({}).passthrough();

export function toSuperDocApiSearchLightweightOutput(
  input: SuperDocApiSearchToolInput,
  rawOutput: unknown,
  meta?: { documentId?: string; fileName?: string },
): Record<string, unknown> {
  const obj =
    typeof rawOutput === 'object' && rawOutput !== null
      ? (rawOutput as Record<string, unknown>)
      : {};
  const matches = Array.isArray(obj.matches)
    ? obj.matches.length
    : Array.isArray(obj.operations)
      ? obj.operations.length
      : undefined;

  return {
    ...(meta?.documentId ? { documentId: meta.documentId } : {}),
    ...(meta?.fileName ? { fileName: meta.fileName } : {}),
    ...(typeof input.query === 'string' && input.query.trim()
      ? { query: input.query.trim() }
      : {}),
    ...(typeof input.operationId === 'string' && input.operationId.trim()
      ? { operationId: input.operationId.trim() }
      : {}),
    ...(matches !== undefined ? { matchCount: matches } : {}),
    ...(typeof obj.error === 'object' && obj.error !== null
      ? { error: obj.error }
      : {}),
  };
}

export function createSuperDocApiSearchTool(
  callback: SuperDocApiSearchCallback,
  tracker?: ToolCallTracker,
  runtimeMeta?: {
    description?: string;
    inputSchema?: Record<string, unknown>;
    documentId?: string;
    fileName?: string;
  },
) {
  const resolvedInputSchema = runtimeMeta?.inputSchema
    ? jsonSchema<SuperDocApiSearchToolInput>(runtimeMeta.inputSchema as any)
    : superdocApiSearchInputSchema;

  return tool({
    description:
      runtimeMeta?.description ??
      'Search native SuperDoc Document API operations and inspect their exact parameter schemas before calling superdoc_api_call.',
    inputSchema: resolvedInputSchema,
    execute: async (input, { toolCallId }) => {
      const rawOutput = await callback(input);
      const lightweight = toSuperDocApiSearchLightweightOutput(
        input,
        rawOutput,
        {
          documentId: runtimeMeta?.documentId,
          fileName: runtimeMeta?.fileName,
        },
      );
      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'superdoc_api_search',
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
