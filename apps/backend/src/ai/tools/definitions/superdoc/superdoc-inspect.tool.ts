import { jsonSchema, tool } from 'ai';
import { z } from 'zod';
import type {
  SuperDocInspectCallback,
  SuperDocInspectToolInput,
  ToolCallTracker,
} from '../../types.js';

export const superdocInspectInputSchema = z
  .object({
    countsOnly: z.boolean().optional(),
    includeDomains: z.array(z.string()).optional(),
    blockNodeTypes: z.array(z.string()).optional(),
    findText: z.string().optional(),
    findLimit: z.number().int().optional(),
    blockOffset: z.number().int().optional(),
    blockLimit: z.number().int().optional(),
    omitEmptyBlocks: z.boolean().optional(),
    dropTextPreview: z.boolean().optional(),
    blockTextLimit: z.number().int().optional(),
    includeListItemRuns: z.boolean().optional(),
    listItemRunsLimit: z.number().int().optional(),
    includeBlockRuns: z.boolean().optional(),
    blockRunsLimit: z.number().int().optional(),
    includeTableCellRuns: z.boolean().optional(),
    tableCellRunsLimit: z.number().int().optional(),
    listLimit: z.number().int().optional(),
    tableLimit: z.number().int().optional(),
    commentLimit: z.number().int().optional(),
    trackedChangeLimit: z.number().int().optional(),
  })
  .passthrough();

function extractNumber(record: Record<string, unknown> | undefined, key: string): number {
  const val = record?.[key];
  return typeof val === 'number' && Number.isFinite(val) ? val : 0;
}

export function toSuperDocInspectLightweightOutput(
  input: SuperDocInspectToolInput,
  rawOutput: unknown,
  meta?: { documentId?: string; fileName?: string },
): Record<string, unknown> {
  const obj =
    typeof rawOutput === 'object' && rawOutput !== null
      ? (rawOutput as Record<string, unknown>)
      : {};
  const counts =
    typeof obj.counts === 'object' && obj.counts !== null
      ? (obj.counts as Record<string, unknown>)
      : undefined;

  return {
    ...(meta?.documentId ? { documentId: meta.documentId } : {}),
    ...(meta?.fileName ? { fileName: meta.fileName } : {}),
    ...(typeof obj.revision === 'string' ? { revision: obj.revision } : {}),
    ...(typeof input.findText === 'string' && input.findText.trim()
      ? { findText: input.findText.trim() }
      : {}),
    countsOnly: Boolean(input.countsOnly),
    paragraphCount: extractNumber(counts, 'paragraphs'),
    headingCount: extractNumber(counts, 'headings'),
    tableCount: extractNumber(counts, 'tables'),
    listCount: extractNumber(counts, 'lists'),
    commentCount: extractNumber(counts, 'comments'),
    trackedChangeCount: extractNumber(counts, 'trackedChanges'),
    ...(typeof obj.error === 'object' && obj.error !== null
      ? { error: obj.error }
      : {}),
  };
}

export function createSuperDocInspectTool(
  callback: SuperDocInspectCallback,
  tracker?: ToolCallTracker,
  runtimeMeta?: {
    description?: string;
    inputSchema?: Record<string, unknown>;
    documentId?: string;
    fileName?: string;
  },
) {
  const resolvedInputSchema = runtimeMeta?.inputSchema
    ? jsonSchema<SuperDocInspectToolInput>(runtimeMeta.inputSchema as any)
    : superdocInspectInputSchema;

  return tool({
    description:
      runtimeMeta?.description ??
      'Inspect a deterministic snapshot of the currently open Word (.docx) document in SuperDoc.',
    inputSchema: resolvedInputSchema,
    execute: async (input, { toolCallId }) => {
      const safeInput =
        typeof input === 'object' && input !== null
          ? (input as SuperDocInspectToolInput)
          : {};
      const result = await callback(safeInput);

      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'superdoc_inspect',
          result,
          toSuperDocInspectLightweightOutput(safeInput, result, {
            documentId: runtimeMeta?.documentId,
            fileName: runtimeMeta?.fileName,
          }),
        );
      }

      return result;
    },
  });
}
