import { jsonSchema, tool } from 'ai';
import { z } from 'zod';
import type {
  SuperDocPerformActionCallback,
  SuperDocPerformActionToolInput,
  ToolCallTracker,
} from '../../types.js';

export const superdocPerformActionInputSchema = z
  .object({
    action: z.string().min(1),
    changeMode: z.enum(['tracked', 'direct']).optional(),
  })
  .passthrough();

export function toSuperDocPerformActionLightweightOutput(
  input: SuperDocPerformActionToolInput,
  rawOutput: unknown,
  meta?: { documentId?: string; fileName?: string },
): Record<string, unknown> {
  const obj =
    typeof rawOutput === 'object' && rawOutput !== null
      ? (rawOutput as Record<string, unknown>)
      : {};
  const preSnapshot =
    typeof obj.preSnapshot === 'object' && obj.preSnapshot !== null
      ? (obj.preSnapshot as Record<string, unknown>)
      : undefined;
  const postSnapshot =
    typeof obj.postSnapshot === 'object' && obj.postSnapshot !== null
      ? (obj.postSnapshot as Record<string, unknown>)
      : undefined;

  const preRevision =
    typeof preSnapshot?.revision === 'string'
      ? preSnapshot.revision
      : undefined;
  const postRevision =
    typeof postSnapshot?.revision === 'string'
      ? postSnapshot.revision
      : undefined;

  const changed =
    preRevision !== undefined && postRevision !== undefined
      ? preRevision !== postRevision
      : obj.status === 'ok';

  const errorObj =
    typeof obj.error === 'object' && obj.error !== null
      ? (obj.error as Record<string, unknown>)
      : undefined;
  const firstErrors = Array.isArray(obj.errors) ? obj.errors : undefined;
  const firstErrorMsg =
    typeof errorObj?.message === 'string'
      ? errorObj.message
      : firstErrors &&
          typeof firstErrors[0] === 'object' &&
          firstErrors[0] !== null &&
          typeof (firstErrors[0] as Record<string, unknown>).message === 'string'
        ? String((firstErrors[0] as Record<string, unknown>).message)
        : undefined;

  return {
    ...(meta?.documentId ? { documentId: meta.documentId } : {}),
    ...(meta?.fileName ? { fileName: meta.fileName } : {}),
    action:
      typeof obj.intent === 'string'
        ? obj.intent
        : typeof input.action === 'string'
          ? input.action
          : 'unknown',
    status: typeof obj.status === 'string' ? obj.status : 'ok',
    changeMode:
      typeof obj.changeMode === 'string'
        ? obj.changeMode
        : input.changeMode ?? 'tracked',
    changed,
    verificationPassed:
      typeof obj.verificationPassed === 'boolean'
        ? obj.verificationPassed
        : undefined,
    ...(preRevision ? { preRevision } : {}),
    ...(postRevision ? { postRevision } : {}),
    ...(firstErrorMsg ? { errorMessage: firstErrorMsg } : {}),
  };
}

export function createSuperDocPerformActionTool(
  callback: SuperDocPerformActionCallback,
  tracker?: ToolCallTracker,
  runtimeMeta?: {
    description?: string;
    inputSchema?: Record<string, unknown>;
    documentId?: string;
    fileName?: string;
  },
) {
  const resolvedInputSchema = runtimeMeta?.inputSchema
    ? jsonSchema<SuperDocPerformActionToolInput>(runtimeMeta.inputSchema as any)
    : superdocPerformActionInputSchema;

  return tool({
    description:
      runtimeMeta?.description ??
      'Perform one named editing action on the currently open Word (.docx) document in SuperDoc.',
    inputSchema: resolvedInputSchema,
    execute: async (input, { toolCallId }) => {
      const safeInput =
        typeof input === 'object' && input !== null
          ? (input as SuperDocPerformActionToolInput)
          : { action: '' };
      const result = await callback(safeInput);

      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'superdoc_perform_action',
          result,
          toSuperDocPerformActionLightweightOutput(safeInput, result, {
            documentId: runtimeMeta?.documentId,
            fileName: runtimeMeta?.fileName,
          }),
        );
      }

      return result;
    },
  });
}
