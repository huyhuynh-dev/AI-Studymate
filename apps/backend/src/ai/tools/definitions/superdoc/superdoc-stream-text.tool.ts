import { tool } from 'ai';
import { z } from 'zod';
import type {
  SuperDocStreamTextCallback,
  SuperDocStreamTextLiveHandlers,
  SuperDocStreamTextToolInput,
  ToolCallTracker,
} from '../../types.js';

export const superdocStreamTextInputSchema = z.object({
  mode: z
    .enum([
      'replace',
      'before',
      'after',
      'append',
      'paragraphBefore',
      'paragraphAfter',
    ])
    .describe(
      'replace for an exact unique passage inside ONE paragraph, before/after for inline text beside an anchor, paragraphBefore/paragraphAfter for a new paragraph beside an anchor, append for a new paragraph at document end.',
    ),
  anchor: z
    .string()
    .nullable()
    .describe('Exact unique current document text; null only for append.'),
  text: z
    .string()
    .describe(
      'New plain text for one paragraph, without newlines. Always supply this property LAST after mode and anchor.',
    ),
});

export function toSuperDocStreamTextLightweightOutput(
  input: SuperDocStreamTextToolInput,
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
      : typeof obj.errorMessage === 'string'
        ? obj.errorMessage
        : undefined;

  const anchorStr = typeof input.anchor === 'string' ? input.anchor.trim() : '';

  return {
    ...(meta?.documentId ? { documentId: meta.documentId } : {}),
    ...(meta?.fileName ? { fileName: meta.fileName } : {}),
    mode: typeof obj.mode === 'string' ? obj.mode : input.mode,
    ...(anchorStr
      ? {
          anchorPreview:
            anchorStr.length > 80 ? `${anchorStr.slice(0, 80)}…` : anchorStr,
        }
      : {}),
    characters:
      typeof obj.characters === 'number'
        ? obj.characters
        : typeof input.text === 'string'
          ? input.text.length
          : 0,
    changeMode: typeof obj.changeMode === 'string' ? obj.changeMode : 'tracked',
    status: typeof obj.status === 'string' ? obj.status : 'ok',
    streamed: Boolean(obj.streamed ?? obj.status !== 'failed'),
    ...(errorMessage ? { errorMessage } : {}),
  };
}

export function createSuperDocStreamTextTool(
  callback: SuperDocStreamTextCallback,
  tracker?: ToolCallTracker,
  meta?: {
    documentId?: string;
    fileName?: string;
    liveHandlers?: SuperDocStreamTextLiveHandlers;
  },
) {
  return tool({
    description:
      'The required tool for writing document prose and heading wording. Streams one paragraph as it is generated, without the user needing to request streaming. Use replace for an exact unique existing passage within ONE paragraph (including headings), before/after for inline text beside an exact unique passage, paragraphBefore/paragraphAfter to create a NEW paragraph beside an existing passage, or append for a NEW paragraph at document end. To create a heading, stream the paragraph then apply_style with headingLevel. To style new prose, stream first then format_text. Text must not contain newlines: make a separate call per paragraph. Inspect before editing. Supply mode and anchor BEFORE text, and text LAST.',
    inputSchema: superdocStreamTextInputSchema,
    ...(meta?.liveHandlers?.onInputStart
      ? {
          onInputStart: async ({ toolCallId, abortSignal }) => {
            await meta.liveHandlers?.onInputStart?.({
              toolCallId,
              abortSignal,
            });
          },
        }
      : {}),
    ...(meta?.liveHandlers?.onInputDelta
      ? {
          onInputDelta: async ({ toolCallId, inputTextDelta, abortSignal }) => {
            await meta.liveHandlers?.onInputDelta?.({
              toolCallId,
              inputTextDelta,
              abortSignal,
            });
          },
        }
      : {}),
    execute: async (input, { toolCallId, abortSignal }) => {
      const rawOutput = meta?.liveHandlers?.commit
        ? await meta.liveHandlers.commit({ toolCallId, input, abortSignal })
        : await callback(input);
      const lightweight = toSuperDocStreamTextLightweightOutput(
        input,
        rawOutput,
        meta,
      );
      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'superdoc_stream_text',
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
