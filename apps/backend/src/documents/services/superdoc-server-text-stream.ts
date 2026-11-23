import { setTimeout as delay } from 'node:timers/promises';
import {
  validateStreamTextArgs,
  type ValidatedStreamTextArgs,
} from './superdoc-stream-text.helper.js';

export const DEMO_STREAM_CHARACTERS_PER_UPDATE = 5;
export const DEMO_STREAM_UPDATE_INTERVAL_MS = 50;

/**
 * Parse JSON arguments đang được model stream dở cho `superdoc_stream_text`
 * (port trực tiếp từ `stream-completion.js` trong `canonical-collaboration-demo`).
 * Chỉ trả về khi đã đọc đủ metadata (`mode`, `anchor`) và phần prefix an toàn của `text`.
 */
export function partialTextArguments(
  source: string,
): { mode: string; anchor: string | null; text: string } | undefined {
  let index = 0;
  const skip = () => {
    while (index < source.length && /\s/.test(source[index] ?? '')) {
      index += 1;
    }
  };

  function readJsonString(): { value: string; complete: boolean } {
    if (source[index++] !== '"') {
      throw new Error('Expected a JSON string.');
    }
    let value = '';
    while (index < source.length) {
      const char = source[index++];
      if (char === '"') {
        return { value, complete: true };
      }
      if (char === '\\') {
        if (index >= source.length) {
          return { value, complete: false };
        }
        const escape = source[index++];
        if (escape === 'u') {
          if (source.length - index < 4) {
            return { value, complete: false };
          }
          value += JSON.parse(`"\\u${source.slice(index, index + 4)}"`) as string;
          index += 4;
        } else {
          value += JSON.parse(`"\\${escape}"`) as string;
        }
      } else {
        if (char.charCodeAt(0) < 32) {
          throw new Error('Invalid JSON string.');
        }
        value += char;
      }
    }
    if (/[\uD800-\uDBFF]$/.test(value)) {
      value = value.slice(0, -1);
    }
    return { value, complete: false };
  }

  try {
    skip();
    if (source[index++] !== '{') return undefined;
    const result: Record<string, unknown> = {};
    while (index < source.length) {
      skip();
      const key = readJsonString();
      if (
        !key.complete ||
        !['mode', 'anchor', 'text', 'changeMode'].includes(key.value) ||
        key.value in result
      ) {
        return undefined;
      }
      skip();
      if (source[index++] !== ':') return undefined;
      skip();

      let parsed: { value: string | null; complete: boolean };
      if (source[index] === '"') {
        parsed = readJsonString();
      } else if (source.slice(index, index + 4) === 'null') {
        parsed = { value: null, complete: true };
        index += 4;
      } else {
        return undefined;
      }

      result[key.value] =
        !parsed.complete && typeof parsed.value === 'string'
          ? parsed.value.replace(/[\uD800-\uDBFF]$/, '')
          : parsed.value;

      if (key.value === 'text') {
        if (
          typeof result.mode === 'string' &&
          'anchor' in result &&
          typeof result.text === 'string'
        ) {
          return {
            mode: result.mode,
            anchor:
              typeof result.anchor === 'string' ? result.anchor : null,
            text: result.text,
          };
        }
        return undefined;
      }

      if (!parsed.complete) return undefined;
      skip();
      if (source[index++] !== ',') return undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

interface StreamQueryMatchItem {
  address?: unknown;
  target?: {
    coordinateSpace?: string;
    start: { blockId: string; offset: number; [key: string]: unknown };
    end: { blockId: string; offset: number; [key: string]: unknown };
    [key: string]: unknown;
  };
}

export interface CollaborativeDocumentHandleLike {
  blocks: {
    list: (input: { offset: number; limit: number }) => Promise<{ revision?: string }>;
  };
  query: {
    match: (input: {
      select: { type: 'text'; pattern: string; caseSensitive: boolean };
      within?: unknown;
      require: 'all' | 'exactlyOne';
      limit?: number;
    }) => Promise<{ items?: StreamQueryMatchItem[] }>;
  };
  create: {
    paragraph: (
      input: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>;
  };
  replace: (
    input: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  insert: (
    input: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
}

function assertCheckedResult(raw: Record<string, unknown> | undefined) {
  const receipt =
    raw && typeof raw.receipt === 'object' && raw.receipt !== null
      ? (raw.receipt as Record<string, unknown>)
      : raw;
  if (!receipt || receipt.success !== true) {
    const failure =
      typeof receipt?.failure === 'object' && receipt.failure !== null
        ? (receipt.failure as Record<string, unknown>)
        : undefined;
    const message =
      (typeof failure?.message === 'string' && failure.message) ||
      (typeof receipt?.error === 'string' && receipt.error) ||
      'Thao tác stream văn bản lên tài liệu cộng tác thất bại.';
    throw new Error(message);
  }
  return raw;
}

export interface ServerCollaborationTextStream {
  update: (input: Record<string, unknown>) => Promise<void>;
  commit: (
    input: ValidatedStreamTextArgs,
  ) => Promise<Record<string, unknown>>;
}

/**
 * Writer stream tuần tự trên handle tài liệu cộng tác `@superdoc/sdk`
 * (port trực tiếp từ `native/stream-text.js` trong `canonical-collaboration-demo`).
 * Chỉ thay thế/tạo đoạn ở nhịp đầu tiên, các nhịp sau chỉ chèn thêm `suffix` mới sinh.
 */
export function createServerCollaborationTextStream(
  handle: CollaborativeDocumentHandleLike,
  options: {
    changeMode: 'tracked' | 'direct';
    signal?: AbortSignal;
  },
): ServerCollaborationTextStream {
  const { changeMode, signal } = options;
  let metadataKey: string | undefined;
  let lastText = '';
  let block: unknown;
  let lastResult: Record<string, unknown> | undefined;
  let used = false;
  let expectedStart = 0;

  async function matchAnchor(pattern: string, within?: unknown) {
    const { revision } = await handle.blocks.list({ offset: 0, limit: 1 });
    if (typeof revision !== 'string' || revision === 'unknown') {
      throw new Error('Phiên bản revision hiện tại của tài liệu chưa sẵn sàng.');
    }

    const matches = await handle.query.match({
      select: { type: 'text', pattern, caseSensitive: true },
      ...(within
        ? { within, require: 'all' as const, limit: 200 }
        : { require: 'exactlyOne' as const }),
    });

    const candidates = within
      ? matches.items?.filter((item) => item.target?.start.offset === expectedStart)
      : matches.items;
    const item = candidates?.[0];
    if (
      candidates?.length !== 1 ||
      !item?.target ||
      item.target.start.blockId !== item.target.end.blockId
    ) {
      throw new Error(
        'Anchor cho superdoc_stream_text phải khớp duy nhất một đoạn trong cùng paragraph. Hãy gọi superdoc_inspect lại.',
      );
    }

    return { item, revision };
  }

  async function update(rawInput: Record<string, unknown>): Promise<void> {
    signal?.throwIfAborted();
    const validation = validateStreamTextArgs(rawInput);
    if (!validation.valid) {
      throw new Error(validation.message);
    }
    const args = validation.normalized;
    const identity = JSON.stringify([args.mode, args.anchor]);
    if (metadataKey && metadataKey !== identity) {
      throw new Error('Mục tiêu stream đã thay đổi trong lúc AI đang viết.');
    }
    if (!args.text.startsWith(lastText)) {
      throw new Error('Nội dung mới làm thay đổi phần chữ đã stream trước đó.');
    }
    if (args.text === lastText) return;

    const suffix = args.text.slice(lastText.length);
    if (
      !used &&
      (args.mode === 'append' ||
        args.mode === 'paragraphBefore' ||
        args.mode === 'paragraphAfter')
    ) {
      let at: Record<string, unknown> = { kind: 'documentEnd' };
      let expectedRevision: string | undefined;

      if (args.mode !== 'append' && args.anchor) {
        const { item, revision } = await matchAnchor(args.anchor);
        at = {
          kind: args.mode === 'paragraphBefore' ? 'before' : 'after',
          target: item.address,
        };
        expectedRevision = revision;
      }

      signal?.throwIfAborted();
      lastResult = assertCheckedResult(
        await handle.create.paragraph(
          {
            text: suffix,
            at,
            changeMode,
            ...(expectedRevision ? { expectedRevision } : {}),
          },
          { changeMode, ...(expectedRevision ? { expectedRevision } : {}) },
        ),
      );
      block = (lastResult as { paragraph?: unknown } | undefined)?.paragraph;
      expectedStart = 0;
    } else {
      const { item, revision } = await matchAnchor(
        used ? lastText : (args.anchor ?? ''),
        used ? block : undefined,
      );
      let target: Record<string, unknown> = {
        ...item.target!,
        coordinateSpace: 'visible',
      };
      const replacing = !used && args.mode === 'replace';
      if (!replacing) {
        const point =
          !used && args.mode === 'before'
            ? item.target!.start
            : item.target!.end;
        target = { ...target, start: point, end: point };
      }
      if (!used) {
        expectedStart = (target.start as { offset: number }).offset;
      }

      signal?.throwIfAborted();
      const writeOptions = { changeMode, expectedRevision: revision };
      lastResult = assertCheckedResult(
        await (replacing
          ? handle.replace({ target, text: suffix, ...writeOptions }, writeOptions)
          : handle.insert(
              { target, value: suffix, type: 'text', ...writeOptions },
              writeOptions,
            )),
      );
      block = item.address;
    }

    metadataKey = identity;
    lastText = args.text;
    used = true;
  }

  return {
    update,
    async commit(args: ValidatedStreamTextArgs): Promise<Record<string, unknown>> {
      await update(args as unknown as Record<string, unknown>);
      signal?.throwIfAborted();
      if (!used) {
        throw new Error('Nội dung văn bản được sinh ra bị rỗng.');
      }
      const rawReceipt =
        lastResult &&
        typeof lastResult.receipt === 'object' &&
        lastResult.receipt !== null
          ? (lastResult.receipt as Record<string, unknown>)
          : lastResult;
      const postRevision =
        typeof rawReceipt?.revision === 'string'
          ? rawReceipt.revision
          : typeof lastResult?.revision === 'string'
            ? lastResult.revision
            : undefined;

      return {
        status: 'ok',
        success: true,
        streamed: true,
        mode: args.mode,
        characters: lastText.length,
        changeMode,
        ...(postRevision ? { postSnapshot: { revision: postRevision } } : {}),
      };
    },
  };
}

export interface ServerStreamUpdateBuffer {
  push: (args: { mode: string; anchor: string | null; text: string }) => void;
  drain: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Bộ đệm nhịp gõ chuẩn `canonical-collaboration-demo` (`5 ký tự / 50ms`)
 * tách việc nhận delta token từ LLM khỏi các transaction ghi tuần tự vào phòng Yjs.
 */
export function createStreamUpdateBuffer(
  writer: ServerCollaborationTextStream,
  signal?: AbortSignal,
  pacing: { charactersPerUpdate?: number; updateIntervalMs?: number } = {},
): ServerStreamUpdateBuffer {
  const charactersPerUpdate =
    pacing.charactersPerUpdate ?? DEMO_STREAM_CHARACTERS_PER_UPDATE;
  const updateIntervalMs =
    pacing.updateIntervalMs ?? DEMO_STREAM_UPDATE_INTERVAL_MS;

  let latest: { mode: string; anchor: string | null; text: string } | undefined;
  let written = 0;
  let running: Promise<void> | undefined;
  let failure: unknown;
  let stopped = false;
  let lastWriteAt = 0;

  async function pump(): Promise<void> {
    while (
      !stopped &&
      latest &&
      written < Array.from(latest.text).length
    ) {
      signal?.throwIfAborted();
      const wait = updateIntervalMs - (Date.now() - lastWriteAt);
      if (lastWriteAt > 0 && wait > 0) {
        await delay(wait, undefined, signal ? { signal } : undefined);
      }
      if (stopped || !latest) break;
      const characters = Array.from(latest.text);
      const end = Math.min(written + charactersPerUpdate, characters.length);
      await writer.update({
        ...latest,
        text: characters.slice(0, end).join(''),
      });
      written = end;
      lastWriteAt = Date.now();
    }
  }

  function start(): void {
    if (!running && !failure && !stopped) {
      running = pump()
        .catch((error: unknown) => {
          failure = error;
        })
        .finally(() => {
          running = undefined;
          if (
            !stopped &&
            !failure &&
            latest &&
            written < Array.from(latest.text).length
          ) {
            start();
          }
        });
    }
  }

  return {
    push(args) {
      latest = args;
      start();
    },
    async drain() {
      while (running) {
        await running;
      }
      signal?.throwIfAborted();
      if (failure) {
        throw failure;
      }
    },
    async stop() {
      stopped = true;
      while (running) {
        await running.catch(() => undefined);
      }
    },
  };
}
