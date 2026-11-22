import type { BrowserDocumentApi } from "superdoc/ui";

export type BrowserStreamTextMode =
  | "replace"
  | "before"
  | "after"
  | "append"
  | "paragraphBefore"
  | "paragraphAfter";

export interface BrowserStreamTextArgs {
  mode: BrowserStreamTextMode;
  anchor: string | null;
  text: string;
}

const CHARACTERS_PER_UPDATE = 6;
const UPDATE_INTERVAL_MS = 40;

const VALID_MODES = new Set<string>([
  "replace",
  "before",
  "after",
  "append",
  "paragraphBefore",
  "paragraphAfter",
]);

function delayMs(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function assertBrowserReceiptOk(raw: unknown): void {
  const obj =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : null;
  const receipt =
    obj && typeof obj.receipt === "object" && obj.receipt !== null
      ? (obj.receipt as Record<string, unknown>)
      : obj;

  if (!receipt || receipt.success !== true) {
    const failure =
      typeof receipt?.failure === "object" && receipt.failure !== null
        ? (receipt.failure as Record<string, unknown>)
        : undefined;
    const message =
      (typeof failure?.message === "string" && failure.message) ||
      (typeof receipt?.error === "string" && receipt.error) ||
      "Không thể ghi nội dung trực tiếp vào trình soạn thảo SuperDoc.";
    throw new Error(message);
  }
}

export function isValidStreamTextInput(
  raw: unknown,
): raw is BrowserStreamTextArgs {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.mode !== "string" || !VALID_MODES.has(obj.mode)) {
    return false;
  }
  if (typeof obj.text !== "string" || obj.text.length === 0) {
    return false;
  }
  if (/[\r\n]/.test(obj.text)) {
    return false;
  }
  if (obj.mode === "append") {
    return obj.anchor === null || obj.anchor === undefined || obj.anchor === "";
  }
  return typeof obj.anchor === "string" && obj.anchor.trim().length > 0;
}

interface TextStreamSession {
  push: (args: BrowserStreamTextArgs) => void;
  drain: () => Promise<void>;
  stop: () => Promise<void>;
  hasSucceeded: () => boolean;
  hasFailed: () => boolean;
}

function createSingleBrowserTextStream(params: {
  doc: BrowserDocumentApi;
  changeMode: "tracked" | "direct";
  signal: AbortSignal;
  onMutated?: () => void;
  onActiveChange?: (active: boolean) => void;
}): TextStreamSession {
  const { doc, changeMode, signal, onMutated, onActiveChange } = params;

  let latest: BrowserStreamTextArgs | undefined;
  let lastText = "";
  let metadataKey: string | undefined;
  let block: unknown;
  let expectedStart = 0;
  let used = false;
  let running: Promise<void> | undefined;
  let failure: unknown;
  let stopped = false;
  let lastWriteAt = 0;

  async function matchAnchor(
    pattern: string,
    withinBlock?: unknown,
  ): Promise<{
    revision: string;
    item: {
      address?: unknown;
      target?: {
        coordinateSpace?: string;
        start: { blockId: string; offset: number; [k: string]: unknown };
        end: { blockId: string; offset: number; [k: string]: unknown };
        [k: string]: unknown;
      };
    };
  }> {
    const blocksResult = await doc.blocks.list({ offset: 0, limit: 1 });
    const revision = blocksResult?.revision;
    if (typeof revision !== "string" || revision === "unknown") {
      throw new Error("Revision tài liệu hiện tại chưa sẵn sàng.");
    }

    const matchQuery = withinBlock
      ? doc.query.match({
          select: { type: "text", pattern, caseSensitive: true },
          within: withinBlock as never,
          require: "all",
          limit: 200,
        })
      : doc.query.match({
          select: { type: "text", pattern, caseSensitive: true },
          require: "exactlyOne",
        });

    const matches = await matchQuery;
    const rawItems = (matches?.items ?? []) as Array<{
      address?: unknown;
      target?: {
        coordinateSpace?: string;
        start: { blockId: string; offset: number; [k: string]: unknown };
        end: { blockId: string; offset: number; [k: string]: unknown };
        [k: string]: unknown;
      };
    }>;

    const candidates = withinBlock
      ? rawItems.filter((item) => item.target?.start.offset === expectedStart)
      : rawItems;

    const item = candidates[0] ?? (withinBlock && rawItems.length === 1 ? rawItems[0] : undefined);
    if (
      !item?.target ||
      item.target.start.blockId !== item.target.end.blockId
    ) {
      throw new Error(
        "Anchor stream trên trình duyệt không khớp duy nhất một đoạn văn.",
      );
    }

    return { revision, item };
  }

  async function writePrefix(targetText: string): Promise<void> {
    if (!latest) return;
    const identity = JSON.stringify([latest.mode, latest.anchor]);
    if (metadataKey && metadataKey !== identity) {
      throw new Error("Mục tiêu stream đã thay đổi trong lúc AI đang viết.");
    }
    if (!targetText.startsWith(lastText)) {
      throw new Error("Nội dung mới làm thay đổi phần chữ đã stream trước đó.");
    }
    if (targetText === lastText) return;

    const suffix = targetText.slice(lastText.length);
    if (!suffix) return;

    if (
      !used &&
      (latest.mode === "append" ||
        latest.mode === "paragraphBefore" ||
        latest.mode === "paragraphAfter")
    ) {
      let at: Record<string, unknown> = { kind: "documentEnd" };
      let expectedRevision: string | undefined;

      if (latest.mode !== "append" && latest.anchor) {
        const { revision, item } = await matchAnchor(latest.anchor);
        at = {
          kind: latest.mode === "paragraphBefore" ? "before" : "after",
          target: item.address,
        };
        expectedRevision = revision;
      }

      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const created = await doc.create.paragraph(
        {
          text: suffix,
          at: at as never,
          changeMode,
          ...(expectedRevision ? { expectedRevision } : {}),
        } as never,
        {
          changeMode,
          ...(expectedRevision ? { expectedRevision } : {}),
        } as never,
      );
      assertBrowserReceiptOk(created);
      block = (created as unknown as { paragraph?: unknown }).paragraph;
      expectedStart = 0;
    } else {
      const pattern = used ? lastText : (latest.anchor ?? "");
      const { revision, item } = await matchAnchor(
        pattern,
        used ? block : undefined,
      );

      let target = {
        ...item.target!,
        coordinateSpace: "visible" as const,
      };
      const replacing = !used && latest.mode === "replace";
      if (!replacing) {
        const point =
          !used && latest.mode === "before"
            ? item.target!.start
            : item.target!.end;
        target = { ...target, start: point, end: point };
      }
      if (!used) {
        expectedStart = target.start.offset;
      }

      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const options = { changeMode, expectedRevision: revision };

      const result = replacing
        ? await doc.replace(
            { target: target as never, text: suffix, ...options } as never,
            options as never,
          )
        : await doc.insert(
            {
              target: target as never,
              value: suffix,
              type: "text",
              ...options,
            } as never,
            options as never,
          );
      assertBrowserReceiptOk(result);
      block = item.address;
    }

    metadataKey = identity;
    lastText = targetText;
    used = true;
    onMutated?.();
  }

  async function pump(): Promise<void> {
    onActiveChange?.(true);
    try {
      while (!stopped && latest) {
        const targetChars = Array.from(latest.text);
        const writtenChars = Array.from(lastText).length;
        if (writtenChars >= targetChars.length) break;

        if (signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const waitMs = UPDATE_INTERVAL_MS - (Date.now() - lastWriteAt);
        if (lastWriteAt > 0 && waitMs > 0) {
          await delayMs(waitMs, signal);
        }
        if (stopped || !latest) break;

        const refreshedChars = Array.from(latest.text);
        const currentWritten = Array.from(lastText).length;
        if (currentWritten >= refreshedChars.length) break;

        const nextEnd = Math.min(
          currentWritten + CHARACTERS_PER_UPDATE,
          refreshedChars.length,
        );
        const nextPrefix = refreshedChars.slice(0, nextEnd).join("");
        await writePrefix(nextPrefix);
        lastWriteAt = Date.now();
      }
    } finally {
      onActiveChange?.(false);
    }
  }

  function start(): void {
    if (!running && !failure && !stopped) {
      running = pump()
        .catch((err) => {
          failure = err;
        })
        .finally(() => {
          running = undefined;
          if (
            !stopped &&
            !failure &&
            latest &&
            Array.from(lastText).length < Array.from(latest.text).length
          ) {
            start();
          }
        });
    }
  }

  return {
    push(args: BrowserStreamTextArgs) {
      latest = args;
      start();
    },
    async drain() {
      while (running) {
        await running;
      }
      if (failure) throw failure;
    },
    async stop() {
      stopped = true;
      while (running) {
        await running.catch(() => undefined);
      }
    },
    hasSucceeded() {
      return used && !failure;
    },
    hasFailed() {
      return Boolean(failure);
    },
  };
}

export class BrowserTextStreamManager {
  private readonly sessions = new Map<string, TextStreamSession>();
  private readonly controller = new AbortController();
  private readonly doc: BrowserDocumentApi;
  private readonly onMutated?: () => void;
  private readonly onStreamingChange?: (isStreaming: boolean) => void;
  private activeStreams = 0;

  constructor(params: {
    doc: BrowserDocumentApi;
    onMutated?: () => void;
    onStreamingChange?: (isStreaming: boolean) => void;
  }) {
    this.doc = params.doc;
    this.onMutated = params.onMutated;
    this.onStreamingChange = params.onStreamingChange;
  }

  private setStreamActive(delta: number): void {
    const next = Math.max(0, this.activeStreams + delta);
    const wasActive = this.activeStreams > 0;
    const isNowActive = next > 0;
    this.activeStreams = next;
    if (wasActive !== isNowActive) {
      this.onStreamingChange?.(isNowActive);
    }
  }

  pushUpdate(
    toolCallId: string,
    args: BrowserStreamTextArgs,
    changeMode: "tracked" | "direct",
  ): void {
    let session = this.sessions.get(toolCallId);
    if (!session) {
      session = createSingleBrowserTextStream({
        doc: this.doc,
        changeMode,
        signal: this.controller.signal,
        onMutated: this.onMutated,
        onActiveChange: (active) => this.setStreamActive(active ? 1 : -1),
      });
      this.sessions.set(toolCallId, session);
    }
    session.push(args);
  }

  async waitForAll(): Promise<{ anyLiveSucceeded: boolean; anyFailed: boolean }> {
    const entries = Array.from(this.sessions.values());
    await Promise.allSettled(entries.map((session) => session.drain()));
    return {
      anyLiveSucceeded: entries.some((session) => session.hasSucceeded()),
      anyFailed: entries.some((session) => session.hasFailed()),
    };
  }

  async dispose(): Promise<void> {
    this.controller.abort();
    const entries = Array.from(this.sessions.values());
    await Promise.allSettled(entries.map((session) => session.stop()));
    this.sessions.clear();
    this.activeStreams = 0;
    this.onStreamingChange?.(false);
  }
}
