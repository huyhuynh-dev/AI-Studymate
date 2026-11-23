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

export interface AgentStreamCursorTarget {
  blockId: string;
  offset: number;
  story?: unknown;
}

export type StreamScrollGuard = <T>(fn: () => T | Promise<T>) => Promise<T>;

/**
 * Chu kỳ nhịp cơ sở (~60 ký tự/giây) giúp từng chữ cái xuất hiện trôi chảy
 * như đang gõ phím thật, kết hợp nghỉ vi mô ở dấu câu và xuống dòng.
 */
const TARGET_STEP_INTERVAL_MS = 16;
const PUNCTUATION_PAUSE_EXTRA_MS = 28;
const PARAGRAPH_SWITCH_PAUSE_MS = 70;
const STREAM_IDLE_WAIT_TIMEOUT_MS = 1800;

const VALID_MODES = new Set<string>([
  "replace",
  "before",
  "after",
  "append",
  "paragraphBefore",
  "paragraphAfter",
]);

const GRAPHEME_SEGMENTER =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("vi", { granularity: "grapheme" })
    : null;

function splitGraphemes(text: string): string[] {
  if (!text) return [];
  if (GRAPHEME_SEGMENTER) {
    const out: string[] = [];
    for (const seg of GRAPHEME_SEGMENTER.segment(text)) {
      out.push(seg.segment);
    }
    return out;
  }
  return Array.from(text);
}

function computeGraphemesForTick(remainingGraphemes: number): number {
  if (remainingGraphemes > 240) return 3;
  if (remainingGraphemes > 110) return 2;
  return 1;
}

function computePostCharDelayMs(lastInsertedText: string): number {
  if (/[,.!?;:…]$/.test(lastInsertedText)) {
    return TARGET_STEP_INTERVAL_MS + PUNCTUATION_PAUSE_EXTRA_MS;
  }
  return TARGET_STEP_INTERVAL_MS;
}

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

function unwrapReceipt(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.receipt === "object" && obj.receipt !== null) {
    return obj.receipt as Record<string, unknown>;
  }
  return obj;
}

function assertBrowserReceiptOk(raw: unknown): Record<string, unknown> {
  const receipt = unwrapReceipt(raw);
  if (!receipt || receipt.success !== true) {
    const failure =
      typeof receipt?.failure === "object" && receipt.failure !== null
        ? (receipt.failure as Record<string, unknown>)
        : undefined;
    const message =
      (typeof failure?.message === "string" && failure.message) ||
      (typeof receipt?.error === "string" && receipt.error) ||
      "Không thể ghi nội dung trực tiếp vào trình soạn thảo SuperDoc.";
    const error = new Error(message) as Error & { code?: string };
    if (typeof failure?.code === "string") {
      error.code = failure.code;
    }
    throw error;
  }
  return receipt;
}

function extractPostRevision(
  raw: unknown,
  receipt: Record<string, unknown>,
): string | undefined {
  const evaluated =
    typeof receipt.evaluatedRevision === "object" &&
    receipt.evaluatedRevision !== null
      ? (receipt.evaluatedRevision as { after?: unknown })
      : undefined;
  if (typeof evaluated?.after === "string" && evaluated.after) {
    return evaluated.after;
  }
  if (typeof receipt.evaluatedRevision === "string" && receipt.evaluatedRevision) {
    return receipt.evaluatedRevision;
  }
  const topObj =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : undefined;
  if (typeof topObj?.evaluatedRevision === "string" && topObj.evaluatedRevision) {
    return topObj.evaluatedRevision;
  }
  const topEvaluated =
    typeof topObj?.evaluatedRevision === "object" &&
    topObj.evaluatedRevision !== null
      ? (topObj.evaluatedRevision as { after?: unknown })
      : undefined;
  if (typeof topEvaluated?.after === "string" && topEvaluated.after) {
    return topEvaluated.after;
  }
  return undefined;
}

function extractInsertedEndOffset(
  receipt: Record<string, unknown>,
  fallbackOffset: number,
): number {
  const effects =
    typeof receipt.effects === "object" && receipt.effects !== null
      ? (receipt.effects as {
          insertedText?: Array<{
            target?: { range?: { end?: unknown } };
          }>;
        })
      : undefined;
  const end = effects?.insertedText?.[0]?.target?.range?.end;
  if (typeof end === "number" && Number.isFinite(end) && end >= 0) {
    return end;
  }
  return fallbackOffset;
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
    return (
      obj.anchor === null || obj.anchor === undefined || obj.anchor === ""
    );
  }
  return typeof obj.anchor === "string" && obj.anchor.trim().length > 0;
}

interface TextStreamSession {
  setLatest: (args: BrowserStreamTextArgs, isComplete: boolean) => void;
  markInputComplete: () => void;
  runUntilDrained: (canFinishWhenEmpty: () => boolean) => Promise<void>;
  stop: () => Promise<void>;
  hasSucceeded: () => boolean;
  hasFailed: () => boolean;
}

interface CachedCursorState {
  blockId: string;
  offset: number;
  revision: string;
  pointBase: { kind: "text"; blockId: string; [k: string]: unknown };
  story?: unknown;
}

function buildSelectionTarget(
  cursor: CachedCursorState,
): Record<string, unknown> {
  return {
    kind: "selection",
    coordinateSpace: "visible",
    ...(cursor.story ? { story: cursor.story } : {}),
    start: { ...cursor.pointBase, blockId: cursor.blockId, offset: cursor.offset },
    end: { ...cursor.pointBase, blockId: cursor.blockId, offset: cursor.offset },
  };
}

function createSingleBrowserTextStream(params: {
  doc: BrowserDocumentApi;
  changeMode: "tracked" | "direct";
  signal: AbortSignal;
  runWithScrollGuard: StreamScrollGuard;
  onMutated?: () => void;
  onCursorMove?: (cursor: AgentStreamCursorTarget) => void;
}): TextStreamSession {
  const {
    doc,
    changeMode,
    signal,
    runWithScrollGuard,
    onMutated,
    onCursorMove,
  } = params;

  let latest: BrowserStreamTextArgs | undefined;
  let lastText = "";
  let metadataKey: string | undefined;
  let block: unknown;
  let expectedStart = 0;
  let cachedCursor: CachedCursorState | null = null;
  let used = false;
  let failure: unknown;
  let stopped = false;
  let inputComplete = false;
  let lastWriteAt = 0;
  let lastStepDelayMs = TARGET_STEP_INTERVAL_MS;
  let activeRunPromise: Promise<void> | null = null;
  let wakeWaiter: (() => void) | null = null;

  function notifyWake(): void {
    if (wakeWaiter) {
      const resolve = wakeWaiter;
      wakeWaiter = null;
      resolve();
    }
  }

  function waitForNewInputOrTimeout(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (stopped || signal.aborted) {
        resolve(false);
        return;
      }
      let settled = false;
      const done = (wokeBySignal: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        if (wakeWaiter === onWake) {
          wakeWaiter = null;
        }
        resolve(wokeBySignal);
      };
      const onWake = () => done(true);
      const onAbort = () => done(false);
      const timer = window.setTimeout(() => done(false), timeoutMs);
      wakeWaiter = onWake;
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  async function matchAnchor(
    pattern: string,
    withinBlock?: unknown,
  ): Promise<{
    revision: string;
    item: {
      address?: unknown;
      target?: {
        coordinateSpace?: string;
        story?: unknown;
        start: { kind?: "text"; blockId: string; offset: number; [k: string]: unknown };
        end: { kind?: "text"; blockId: string; offset: number; [k: string]: unknown };
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
        story?: unknown;
        start: { kind?: "text"; blockId: string; offset: number; [k: string]: unknown };
        end: { kind?: "text"; blockId: string; offset: number; [k: string]: unknown };
        [k: string]: unknown;
      };
    }>;

    const candidates = withinBlock
      ? rawItems.filter((item) => item.target?.start.offset === expectedStart)
      : rawItems;

    const item =
      candidates[0] ?? (withinBlock && rawItems.length === 1 ? rawItems[0] : undefined);
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

  async function insertViaFallbackMatch(suffix: string): Promise<void> {
    if (!latest) return;
    const { revision, item } = await matchAnchor(lastText, block);
    const endPoint = item.target!.end;
    const target: Record<string, unknown> = {
      ...item.target!,
      coordinateSpace: "visible",
      start: endPoint,
      end: endPoint,
    };

    const options = { changeMode, expectedRevision: revision };
    const result = await runWithScrollGuard(() =>
      doc.insert(
        {
          target: target as never,
          value: suffix,
          type: "text",
          ...options,
        } as never,
        options as never,
      ),
    );
    const receipt = assertBrowserReceiptOk(result);
    block = item.address;

    const nextOffset = extractInsertedEndOffset(
      receipt,
      endPoint.offset + suffix.length,
    );
    const postRev = extractPostRevision(result, receipt);
    if (postRev) {
      cachedCursor = {
        blockId: endPoint.blockId,
        offset: nextOffset,
        revision: postRev,
        pointBase: { ...endPoint, kind: "text" },
        story: item.target?.story,
      };
    } else {
      cachedCursor = null;
    }

    onCursorMove?.({
      blockId: endPoint.blockId,
      offset: nextOffset,
      story: item.target?.story,
    });
  }

  async function writeNextPrefix(targetText: string): Promise<void> {
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
      const created = await runWithScrollGuard(() =>
        doc.create.paragraph(
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
        ),
      );
      const createdObj = created as unknown as {
        success?: boolean;
        failure?: { code?: string; message?: string };
        paragraph?: { nodeId?: string };
        insertionPoint?: {
          blockId?: string;
          range?: { start?: number; end?: number };
          story?: unknown;
        };
        evaluatedRevision?: unknown;
      };
      if (createdObj?.success !== true) {
        assertBrowserReceiptOk(created);
      }

      block = createdObj.paragraph;
      const newBlockId =
        createdObj.insertionPoint?.blockId ?? createdObj.paragraph?.nodeId;
      // Đoạn văn mới tạo luôn bắt đầu tại offset 0 (giống stream-text.js của Demo)
      expectedStart = 0;

      const endOffset =
        typeof createdObj.insertionPoint?.range?.end === "number" &&
        createdObj.insertionPoint.range.end >= suffix.length
          ? createdObj.insertionPoint.range.end
          : suffix.length;
      const postRev = extractPostRevision(
        created,
        createdObj as unknown as Record<string, unknown>,
      );

      if (newBlockId && postRev) {
        cachedCursor = {
          blockId: newBlockId,
          offset: endOffset,
          revision: postRev,
          pointBase: { kind: "text", blockId: newBlockId },
          story: createdObj.insertionPoint?.story,
        };
      }
      if (newBlockId) {
        onCursorMove?.({
          blockId: newBlockId,
          offset: endOffset,
          story: createdObj.insertionPoint?.story,
        });
      }
    } else if (!used) {
      const { revision, item } = await matchAnchor(latest.anchor ?? "");

      const targetBase = {
        ...item.target!,
        coordinateSpace: "visible" as const,
      };
      const replacing = latest.mode === "replace";
      const anchorPoint =
        latest.mode === "before" || replacing
          ? item.target!.start
          : item.target!.end;
      const target = replacing
        ? targetBase
        : { ...targetBase, start: anchorPoint, end: anchorPoint };
      expectedStart = anchorPoint.offset;

      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const options = { changeMode, expectedRevision: revision };

      const result = await runWithScrollGuard(() =>
        replacing
          ? doc.replace(
              { target: target as never, text: suffix, ...options } as never,
              options as never,
            )
          : doc.insert(
              {
                target: target as never,
                value: suffix,
                type: "text",
                ...options,
              } as never,
              options as never,
            ),
      );
      const receipt = assertBrowserReceiptOk(result);
      block = item.address;

      const nextOffset = extractInsertedEndOffset(
        receipt,
        anchorPoint.offset + suffix.length,
      );
      const postRev = extractPostRevision(result, receipt);
      if (postRev) {
        cachedCursor = {
          blockId: anchorPoint.blockId,
          offset: nextOffset,
          revision: postRev,
          pointBase: { ...anchorPoint, kind: "text" },
          story: item.target?.story,
        };
      }
      onCursorMove?.({
        blockId: anchorPoint.blockId,
        offset: nextOffset,
        story: item.target?.story,
      });
    } else if (cachedCursor) {
      // Nhịp O(1): chèn trực tiếp tại tọa độ cuối hiện tại bằng revision liền trước
      const cursor = cachedCursor;
      const target = buildSelectionTarget(cursor);
      const options = { changeMode, expectedRevision: cursor.revision };

      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      try {
        const result = await runWithScrollGuard(() =>
          doc.insert(
            {
              target: target as never,
              value: suffix,
              type: "text",
              ...options,
            } as never,
            options as never,
          ),
        );
        const receipt = assertBrowserReceiptOk(result);
        const postRev = extractPostRevision(result, receipt);
        const nextOffset = extractInsertedEndOffset(
          receipt,
          cursor.offset + suffix.length,
        );
        if (postRev) {
          cursor.offset = nextOffset;
          cursor.revision = postRev;
        } else {
          cachedCursor = null;
        }
        onCursorMove?.({
          blockId: cursor.blockId,
          offset: nextOffset,
          story: cursor.story,
        });
      } catch (fastErr) {
        const code = (fastErr as { code?: string })?.code;
        if (
          code === "REVISION_MISMATCH" ||
          code === "STALE_REVISION" ||
          code === "ADDRESS_STALE" ||
          code === "INVALID_TARGET" ||
          code === "TARGET_NOT_FOUND" ||
          code === "PRECONDITION_FAILED"
        ) {
          cachedCursor = null;
          await insertViaFallbackMatch(suffix);
        } else {
          throw fastErr;
        }
      }
    } else {
      await insertViaFallbackMatch(suffix);
    }

    metadataKey = identity;
    lastText = targetText;
    used = true;
    onMutated?.();
  }

  async function runLoop(canFinishWhenEmpty: () => boolean): Promise<void> {
    while (!stopped && !failure) {
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      if (!latest) {
        if (inputComplete || canFinishWhenEmpty()) break;
        await waitForNewInputOrTimeout(STREAM_IDLE_WAIT_TIMEOUT_MS);
        continue;
      }

      const targetGraphemes = splitGraphemes(latest.text);
      const writtenCount = splitGraphemes(lastText).length;
      const remaining = targetGraphemes.length - writtenCount;

      if (remaining <= 0) {
        if (inputComplete || canFinishWhenEmpty()) {
          break;
        }
        const woke = await waitForNewInputOrTimeout(STREAM_IDLE_WAIT_TIMEOUT_MS);
        if (!woke && !inputComplete && !canFinishWhenEmpty()) {
          // Quá thời gian chờ token tiếp theo -> kết thúc an toàn để nhường hàng đợi
          break;
        }
        continue;
      }

      const waitMs = lastStepDelayMs - (Date.now() - lastWriteAt);
      if (lastWriteAt > 0 && waitMs > 0) {
        await delayMs(waitMs, signal);
      }
      if (stopped || !latest) break;

      const refreshedGraphemes = splitGraphemes(latest.text);
      const currentWritten = splitGraphemes(lastText).length;
      const currentRemaining = refreshedGraphemes.length - currentWritten;
      if (currentRemaining <= 0) continue;

      const stepSize = computeGraphemesForTick(currentRemaining);
      const nextEnd = Math.min(
        currentWritten + stepSize,
        refreshedGraphemes.length,
      );
      const nextPrefix = refreshedGraphemes.slice(0, nextEnd).join("");
      const newlyInserted = refreshedGraphemes
        .slice(currentWritten, nextEnd)
        .join("");
      await writeNextPrefix(nextPrefix);
      lastWriteAt = Date.now();
      lastStepDelayMs = computePostCharDelayMs(newlyInserted);
    }
  }

  return {
    setLatest(args: BrowserStreamTextArgs, isComplete: boolean) {
      latest = args;
      if (isComplete) {
        inputComplete = true;
      }
      notifyWake();
    },
    markInputComplete() {
      inputComplete = true;
      notifyWake();
    },
    async runUntilDrained(canFinishWhenEmpty: () => boolean) {
      if (stopped) return;
      if (!activeRunPromise) {
        activeRunPromise = runLoop(canFinishWhenEmpty)
          .catch((err) => {
            failure = err;
          })
          .finally(() => {
            activeRunPromise = null;
          });
      }
      await activeRunPromise;
      if (failure) throw failure;
    },
    async stop() {
      stopped = true;
      notifyWake();
      if (activeRunPromise) {
        await activeRunPromise.catch(() => undefined);
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

interface QueueEntry {
  toolCallId: string;
  session: TextStreamSession;
  inputComplete: boolean;
}

export class BrowserTextStreamManager {
  private readonly sessions = new Map<string, QueueEntry>();
  private readonly queueOrder: string[] = [];
  private currentQueueIndex = 0;
  private queueProcessorPromise: Promise<void> | null = null;
  private disposed = false;

  private readonly controller = new AbortController();
  private readonly doc: BrowserDocumentApi;
  private readonly onMutated?: () => void;
  private readonly onStreamingChange?: (isStreaming: boolean) => void;
  private readonly onCursorMove?: (cursor: AgentStreamCursorTarget) => void;
  private readonly runWithScrollGuard: StreamScrollGuard;
  private isStreamingActive = false;

  constructor(params: {
    doc: BrowserDocumentApi;
    onMutated?: () => void;
    onStreamingChange?: (isStreaming: boolean) => void;
    onCursorMove?: (cursor: AgentStreamCursorTarget) => void;
    runWithScrollGuard?: StreamScrollGuard;
  }) {
    this.doc = params.doc;
    this.onMutated = params.onMutated;
    this.onStreamingChange = params.onStreamingChange;
    this.onCursorMove = params.onCursorMove;
    this.runWithScrollGuard =
      params.runWithScrollGuard ?? (async (fn) => fn());
  }

  private updateStreamingState(active: boolean): void {
    if (this.isStreamingActive !== active) {
      this.isStreamingActive = active;
      this.onStreamingChange?.(active);
    }
  }

  private ensureQueueProcessorRunning(): void {
    if (this.disposed || this.queueProcessorPromise) return;
    this.queueProcessorPromise = this.processQueueLoop().finally(() => {
      this.queueProcessorPromise = null;
      if (
        !this.disposed &&
        this.currentQueueIndex < this.queueOrder.length
      ) {
        this.ensureQueueProcessorRunning();
      } else {
        this.updateStreamingState(false);
      }
    });
  }

  private async processQueueLoop(): Promise<void> {
    this.updateStreamingState(true);

    while (!this.disposed && this.currentQueueIndex < this.queueOrder.length) {
      const idx = this.currentQueueIndex;
      const toolCallId = this.queueOrder[idx];
      const entry = this.sessions.get(toolCallId);

      if (entry) {
        try {
          await entry.session.runUntilDrained(
            () => entry.inputComplete || this.queueOrder.length > idx + 1,
          );
        } catch {
          // Lỗi đã được ghi nhận trong session.hasFailed() để waitForAll xử lý fallback
        }
      }

      this.currentQueueIndex += 1;

      if (
        !this.disposed &&
        this.currentQueueIndex < this.queueOrder.length
      ) {
        try {
          await delayMs(PARAGRAPH_SWITCH_PAUSE_MS, this.controller.signal);
        } catch {
          break;
        }
      }
    }

    this.updateStreamingState(false);
  }

  pushUpdate(
    toolCallId: string,
    args: BrowserStreamTextArgs,
    changeMode: "tracked" | "direct",
    isFinal = false,
  ): void {
    if (this.disposed) return;

    let entry = this.sessions.get(toolCallId);
    if (!entry) {
      // Nếu LLM đã chuyển sang gọi toolCallId mới, mọi session đứng trước nó chắc chắn đã hoàn tất JSON
      for (const prevId of this.queueOrder) {
        const prevEntry = this.sessions.get(prevId);
        if (prevEntry && !prevEntry.inputComplete) {
          prevEntry.inputComplete = true;
          prevEntry.session.markInputComplete();
        }
      }

      const session = createSingleBrowserTextStream({
        doc: this.doc,
        changeMode,
        signal: this.controller.signal,
        runWithScrollGuard: this.runWithScrollGuard,
        onMutated: this.onMutated,
        onCursorMove: this.onCursorMove,
      });

      entry = {
        toolCallId,
        session,
        inputComplete: isFinal,
      };
      this.sessions.set(toolCallId, entry);
      this.queueOrder.push(toolCallId);
    } else if (isFinal) {
      entry.inputComplete = true;
    }

    entry.session.setLatest(args, entry.inputComplete);
    this.ensureQueueProcessorRunning();
  }

  async waitForAll(): Promise<{ anyLiveSucceeded: boolean; anyFailed: boolean }> {
    for (const entry of this.sessions.values()) {
      entry.inputComplete = true;
      entry.session.markInputComplete();
    }

    while (this.queueProcessorPromise) {
      await this.queueProcessorPromise.catch(() => undefined);
    }

    const entries = Array.from(this.sessions.values());
    return {
      anyLiveSucceeded: entries.some((entry) => entry.session.hasSucceeded()),
      anyFailed: entries.some((entry) => entry.session.hasFailed()),
    };
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.controller.abort();
    const entries = Array.from(this.sessions.values());
    await Promise.allSettled(entries.map((entry) => entry.session.stop()));
    if (this.queueProcessorPromise) {
      await this.queueProcessorPromise.catch(() => undefined);
    }
    this.sessions.clear();
    this.queueOrder.length = 0;
    this.currentQueueIndex = 0;
    this.updateStreamingState(false);
  }
}
