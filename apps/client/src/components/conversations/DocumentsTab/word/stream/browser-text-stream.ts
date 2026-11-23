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
 * Chu kỳ nhịp cơ sở (~27 transactions/giây, mỗi bước 3–5 ký tự) tiệm cận
 * chuẩn 5 chars / 50ms của SuperDocs Demo, tránh nghẽn layout engine.
 */
const TARGET_STEP_INTERVAL_MS = 36;
const PUNCTUATION_PAUSE_EXTRA_MS = 24;
const PARAGRAPH_SWITCH_PAUSE_MS = 55;
const STREAM_IDLE_POLL_INTERVAL_MS = 1000;
const MAX_STREAM_IDLE_WAIT_MS = 60_000;

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

function computeGraphemesForTick(
  remainingGraphemes: number,
  isInputComplete: boolean,
): number {
  if (isInputComplete) {
    if (remainingGraphemes > 160) {
      return Math.min(20, Math.ceil(remainingGraphemes / 5));
    }
    if (remainingGraphemes > 60) return 8;
    if (remainingGraphemes > 20) return 5;
    return 3;
  }
  if (remainingGraphemes > 180) return 10;
  if (remainingGraphemes > 90) return 7;
  if (remainingGraphemes > 35) return 5;
  if (remainingGraphemes > 10) return 3;
  if (remainingGraphemes > 3) return 2;
  return 1;
}

function snapNextEndToWordBoundary(
  graphemes: string[],
  start: number,
  desiredEnd: number,
): number {
  if (desiredEnd - start < 3 || desiredEnd >= graphemes.length) {
    return desiredEnd;
  }
  const minScan = Math.max(start + 2, desiredEnd - 1);
  const maxScan = Math.min(graphemes.length, desiredEnd + 2);
  for (let i = minScan; i <= maxScan; i += 1) {
    if (/\s/.test(graphemes[i - 1] ?? "")) {
      return i;
    }
  }
  return desiredEnd;
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
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      globalThis.clearTimeout(timer);
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
          resultText?: {
            segments?: Array<{ range?: { end?: unknown } }>;
          };
        })
      : undefined;
  const end = effects?.insertedText?.[0]?.target?.range?.end;
  if (typeof end === "number" && Number.isFinite(end) && end >= 0) {
    return end;
  }
  const resultTextEnd = effects?.resultText?.segments?.[0]?.range?.end;
  if (
    typeof resultTextEnd === "number" &&
    Number.isFinite(resultTextEnd) &&
    resultTextEnd >= 0
  ) {
    return resultTextEnd;
  }
  const resolution =
    typeof receipt.resolution === "object" && receipt.resolution !== null
      ? (receipt.resolution as { target?: { range?: { end?: unknown } } })
      : undefined;
  const resEnd = resolution?.target?.range?.end;
  if (typeof resEnd === "number" && Number.isFinite(resEnd) && resEnd >= 0) {
    return resEnd;
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

function createSingleBrowserTextStream(params: {
  doc: BrowserDocumentApi;
  changeMode: "tracked" | "direct";
  signal: AbortSignal;
  runWithScrollGuard: StreamScrollGuard;
  onMutated?: () => void;
  onCursorMove?: (cursor: AgentStreamCursorTarget) => void;
  onStreamTargetResolved?: (target: AgentStreamCursorTarget) => void;
}): TextStreamSession {
  const {
    doc,
    changeMode,
    signal,
    runWithScrollGuard,
    onMutated,
    onCursorMove,
    onStreamTargetResolved,
  } = params;

  let latest: BrowserStreamTextArgs | undefined;
  let lastText = "";
  let targetGraphemes: string[] = [];
  let segmentedRawLength = 0;
  let writtenGraphemeCount = 0;
  let metadataKey: string | undefined;
  let block: unknown;
  let expectedStart = 0;
  let used = false;
  let targetResolvedNotified = false;
  let failure: unknown;
  let stopped = false;
  let inputComplete = false;
  let lastWriteAt = 0;
  let lastStepDelayMs = TARGET_STEP_INTERVAL_MS;
  let activeRunPromise: Promise<void> | null = null;
  let wakeWaiter: (() => void) | null = null;

  function appendIncrementalGraphemes(nextText: string): void {
    if (nextText.length === segmentedRawLength) return;
    if (nextText.length > segmentedRawLength && nextText.startsWith(lastText)) {
      const delta = nextText.slice(segmentedRawLength);
      const deltaGraphemes = splitGraphemes(delta);
      for (const g of deltaGraphemes) {
        targetGraphemes.push(g);
      }
      segmentedRawLength = nextText.length;
      return;
    }
    targetGraphemes = splitGraphemes(nextText);
    segmentedRawLength = nextText.length;
    writtenGraphemeCount = splitGraphemes(lastText).length;
  }

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
        globalThis.clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        if (wakeWaiter === onWake) {
          wakeWaiter = null;
        }
        resolve(wokeBySignal);
      };
      const onWake = () => done(true);
      const onAbort = () => done(false);
      const timer = globalThis.setTimeout(() => done(false), timeoutMs);
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

    let item =
      candidates[0] ??
      (withinBlock && rawItems.length === 1 ? rawItems[0] : undefined);
    if (!item && withinBlock && rawItems.length > 0) {
      let bestDistance = Infinity;
      for (const candidate of rawItems) {
        if (
          !candidate.target ||
          candidate.target.start.blockId !== candidate.target.end.blockId
        ) {
          continue;
        }
        const dist = Math.abs(candidate.target.start.offset - expectedStart);
        if (dist < bestDistance) {
          bestDistance = dist;
          item = candidate;
        }
      }
    }
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
      const createOptions: Record<string, unknown> = {
        changeMode,
        ...(expectedRevision ? { expectedRevision } : {}),
      };
      const created = await runWithScrollGuard(() =>
        doc.create.paragraph(
          {
            text: suffix,
            at: at as never,
          } as never,
          createOptions as never,
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
      };
      if (createdObj?.success !== true) {
        assertBrowserReceiptOk(created);
      }

      block = createdObj.paragraph;
      const newBlockId =
        createdObj.insertionPoint?.blockId ?? createdObj.paragraph?.nodeId;
      expectedStart = 0;

      const endOffset =
        typeof createdObj.insertionPoint?.range?.end === "number" &&
        createdObj.insertionPoint.range.end >= suffix.length
          ? createdObj.insertionPoint.range.end
          : suffix.length;

      if (newBlockId) {
        const cursorTarget: AgentStreamCursorTarget = {
          blockId: newBlockId,
          offset: endOffset,
          story: createdObj.insertionPoint?.story,
        };
        if (!targetResolvedNotified) {
          targetResolvedNotified = true;
          onStreamTargetResolved?.(cursorTarget);
        }
        onCursorMove?.(cursorTarget);
      }
    } else {
      const { revision, item } = await matchAnchor(
        used ? lastText : (latest.anchor ?? ""),
        used ? block : undefined,
      );

      let target: Record<string, unknown> = {
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
        expectedStart = replacing
          ? item.target!.start.offset
          : (target.start as { offset: number }).offset;
      }

      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const options = { changeMode, expectedRevision: revision };

      const result = await runWithScrollGuard(() =>
        replacing
          ? doc.replace(
              { target: target as never, text: suffix } as never,
              options as never,
            )
          : doc.insert(
              {
                target: target as never,
                value: suffix,
                type: "text",
              } as never,
              options as never,
            ),
      );
      const receipt = assertBrowserReceiptOk(result);
      block = item.address;

      const startPoint = target.start as { blockId: string; offset: number };
      const nextOffset = extractInsertedEndOffset(
        receipt,
        startPoint.offset + suffix.length,
      );
      const cursorTarget: AgentStreamCursorTarget = {
        blockId: startPoint.blockId,
        offset: nextOffset,
        story: item.target?.story,
      };
      if (!targetResolvedNotified) {
        targetResolvedNotified = true;
        onStreamTargetResolved?.(cursorTarget);
      }
      onCursorMove?.(cursorTarget);
    }

    metadataKey = identity;
    lastText = targetText;
    used = true;
    onMutated?.();
  }

  async function runLoop(canFinishWhenEmpty: () => boolean): Promise<void> {
    let idleStartedAt: number | null = null;

    while (!stopped && !failure) {
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      if (!latest) {
        if (inputComplete || canFinishWhenEmpty()) break;
        const woke = await waitForNewInputOrTimeout(STREAM_IDLE_POLL_INTERVAL_MS);
        if (woke) {
          idleStartedAt = null;
        } else {
          idleStartedAt ??= Date.now();
          if (Date.now() - idleStartedAt >= MAX_STREAM_IDLE_WAIT_MS) {
            throw new Error("Hết thời gian chờ dữ liệu stream ban đầu từ AI Agent.");
          }
        }
        continue;
      }

      const remaining = targetGraphemes.length - writtenGraphemeCount;

      if (remaining <= 0) {
        if (inputComplete || canFinishWhenEmpty()) {
          break;
        }
        const woke = await waitForNewInputOrTimeout(STREAM_IDLE_POLL_INTERVAL_MS);
        if (woke) {
          idleStartedAt = null;
        } else if (!inputComplete && !canFinishWhenEmpty()) {
          idleStartedAt ??= Date.now();
          if (Date.now() - idleStartedAt >= MAX_STREAM_IDLE_WAIT_MS) {
            throw new Error(
              "Hết thời gian chờ token tiếp theo từ AI Agent khi chưa hoàn tất đoạn văn.",
            );
          }
        }
        continue;
      }

      idleStartedAt = null;

      const waitMs = lastStepDelayMs - (Date.now() - lastWriteAt);
      if (lastWriteAt > 0 && waitMs > 0) {
        await delayMs(waitMs, signal);
      }
      if (stopped || !latest) break;

      const currentRemaining = targetGraphemes.length - writtenGraphemeCount;
      if (currentRemaining <= 0) continue;

      const stepSize = computeGraphemesForTick(
        currentRemaining,
        inputComplete || canFinishWhenEmpty(),
      );
      const desiredEnd = Math.min(
        writtenGraphemeCount + stepSize,
        targetGraphemes.length,
      );
      const nextEnd = snapNextEndToWordBoundary(
        targetGraphemes,
        writtenGraphemeCount,
        desiredEnd,
      );
      const nextPrefix = targetGraphemes.slice(0, nextEnd).join("");
      const newlyInserted = targetGraphemes
        .slice(writtenGraphemeCount, nextEnd)
        .join("");
      await writeNextPrefix(nextPrefix);
      writtenGraphemeCount = nextEnd;
      lastWriteAt = Date.now();
      lastStepDelayMs = computePostCharDelayMs(newlyInserted);
    }
  }

  return {
    setLatest(args: BrowserStreamTextArgs, isComplete: boolean) {
      latest = args;
      appendIncrementalGraphemes(args.text);
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
      return (
        used &&
        !failure &&
        inputComplete &&
        writtenGraphemeCount >= targetGraphemes.length
      );
    },
    hasFailed() {
      return Boolean(failure);
    },
  };
}

export function isSupportedBrowserInlineAction(
  raw: unknown,
): raw is Record<string, unknown> & { action: "apply_style" | "format_text" } {
  if (!raw || typeof raw !== "object") return false;
  const action = (raw as Record<string, unknown>).action;
  return action === "apply_style" || action === "format_text";
}

async function resolveBlockTargetFromSelector(
  doc: BrowserDocumentApi,
  selector: unknown,
): Promise<Record<string, unknown> | null> {
  if (!selector || typeof selector !== "object") return null;
  const sel = selector as Record<string, unknown>;
  if (sel.kind === "nodeId" && typeof sel.nodeId === "string" && sel.nodeId) {
    return {
      kind: "block",
      nodeType: typeof sel.nodeType === "string" ? sel.nodeType : "paragraph",
      nodeId: sel.nodeId,
    };
  }
  if (sel.kind === "textSearch" && Array.isArray(sel.terms)) {
    const firstTerm = sel.terms.find(
      (t): t is string => typeof t === "string" && t.trim().length > 0,
    );
    if (firstTerm) {
      const matches = await doc.query.match({
        select: { type: "text", pattern: firstTerm, caseSensitive: false },
        require: "first",
      });
      const item = matches?.items?.[0];
      if (item?.address) {
        return item.address as unknown as Record<string, unknown>;
      }
    }
  }
  return null;
}

function buildInlineFormatPatch(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const inline: Record<string, unknown> = {};
  if (typeof args.bold === "boolean") inline.bold = args.bold;
  if (typeof args.italic === "boolean") inline.italic = args.italic;
  if (typeof args.underline === "boolean") inline.underline = args.underline;
  if (typeof args.strikethrough === "boolean") {
    inline.strike = args.strikethrough;
  } else if (typeof args.strike === "boolean") {
    inline.strike = args.strike;
  }
  if (typeof args.color === "string" && args.color.trim()) {
    inline.color = args.color.trim();
  }
  const highlight = args.highlightColor ?? args.highlight;
  if (typeof highlight === "string" && highlight.trim()) {
    inline.highlight = highlight.trim();
  }
  const fontSize = args.fontSizePt ?? args.fontSize;
  if (typeof fontSize === "number" && Number.isFinite(fontSize)) {
    inline.fontSizePt = fontSize;
  }
  if (typeof args.fontFamily === "string" && args.fontFamily.trim()) {
    inline.fontFamily = args.fontFamily.trim();
  }
  return inline;
}

function createInlineActionSession(params: {
  doc: BrowserDocumentApi;
  args: Record<string, unknown> & { action: "apply_style" | "format_text" };
  changeMode: "tracked" | "direct";
  signal: AbortSignal;
  runWithScrollGuard: StreamScrollGuard;
  onMutated?: () => void;
}): TextStreamSession {
  const { doc, args, changeMode, signal, runWithScrollGuard, onMutated } =
    params;
  let completed = false;
  let failure: unknown;
  let stopped = false;

  return {
    setLatest() {
      // Action định dạng là one-shot, không stream từng phần
    },
    markInputComplete() {
      // Không cần chờ thêm input
    },
    async runUntilDrained() {
      if (stopped || completed || failure) return;
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      try {
        if (args.action === "apply_style") {
          const headingLevel =
            typeof args.headingLevel === "number" ? args.headingLevel : undefined;
          const styleId =
            typeof args.styleId === "string" && args.styleId.trim()
              ? args.styleId.trim()
              : headingLevel && headingLevel >= 1 && headingLevel <= 6
                ? `Heading${headingLevel}`
                : undefined;
          if (!styleId) {
            throw new Error("Thiếu styleId hoặc headingLevel cho apply_style.");
          }
          const blockTarget = await resolveBlockTargetFromSelector(
            doc,
            args.selector,
          );
          if (!blockTarget) {
            throw new Error("Không tìm thấy block cho apply_style trên trình duyệt.");
          }
          const result = await runWithScrollGuard(() =>
            doc.invoke({
              operationId: "styles.paragraph.setStyleRef",
              input: { target: blockTarget as never, styleId },
              options: { changeMode },
            } as never),
          );
          assertBrowserReceiptOk(result);
        } else {
          const inline = buildInlineFormatPatch(args);
          if (Object.keys(inline).length === 0) {
            throw new Error("Không có thuộc tính định dạng hợp lệ cho format_text.");
          }
          const patterns: string[] = [];
          if (Array.isArray(args.targetTexts)) {
            for (const item of args.targetTexts) {
              if (typeof item === "string" && item.trim()) {
                patterns.push(item);
              }
            }
          }
          if (typeof args.targetText === "string" && args.targetText.trim()) {
            patterns.push(args.targetText);
          }
          if (
            patterns.length === 0 &&
            args.selector &&
            typeof args.selector === "object" &&
            Array.isArray((args.selector as Record<string, unknown>).terms)
          ) {
            for (const t of (args.selector as Record<string, unknown>)
              .terms as unknown[]) {
              if (typeof t === "string" && t.trim()) patterns.push(t);
            }
          }
          if (patterns.length === 0) {
            throw new Error("Thiếu targetText cho format_text trên trình duyệt.");
          }
          for (const pattern of patterns) {
            const matches = await doc.query.match({
              select: { type: "text", pattern, caseSensitive: false },
              require: "first",
            });
            const match = matches?.items?.[0];
            if (!match || match.matchKind !== "text" || !match.target) {
              throw new Error(`Không tìm thấy đoạn "${pattern}" để format_text.`);
            }
            const result = await runWithScrollGuard(() =>
              doc.format.apply(
                { target: match.target, inline: inline as never },
                { changeMode } as never,
              ),
            );
            assertBrowserReceiptOk(result);
          }
        }
        completed = true;
        onMutated?.();
      } catch (err) {
        failure = err;
        throw err;
      }
    },
    async stop() {
      stopped = true;
    },
    hasSucceeded() {
      return completed && !failure;
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
  private readonly onStreamTargetResolved?: (
    target: AgentStreamCursorTarget,
  ) => void;
  private readonly runWithScrollGuard: StreamScrollGuard;
  private readonly onError?: (error: Error, toolCallId: string) => void;
  private isStreamingActive = false;
  private lastError: Error | null = null;

  constructor(params: {
    doc: BrowserDocumentApi;
    onMutated?: () => void;
    onStreamingChange?: (isStreaming: boolean) => void;
    onCursorMove?: (cursor: AgentStreamCursorTarget) => void;
    onStreamTargetResolved?: (target: AgentStreamCursorTarget) => void;
    onError?: (error: Error, toolCallId: string) => void;
    runWithScrollGuard?: StreamScrollGuard;
  }) {
    this.doc = params.doc;
    this.onMutated = params.onMutated;
    this.onStreamingChange = params.onStreamingChange;
    this.onCursorMove = params.onCursorMove;
    this.onStreamTargetResolved = params.onStreamTargetResolved;
    this.onError = params.onError;
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
          await entry.session.runUntilDrained(() => entry.inputComplete);
        } catch (err) {
          const normalized =
            err instanceof Error ? err : new Error(String(err));
          if (normalized.name !== "AbortError") {
            console.error(
              `[BrowserTextStreamManager] Live stream failed for toolCallId=${toolCallId}:`,
              normalized,
            );
            this.lastError = normalized;
            this.onError?.(normalized, toolCallId);
          }
        }
      }

      this.currentQueueIndex += 1;

      if (
        !this.disposed &&
        this.currentQueueIndex < this.queueOrder.length
      ) {
        try {
          await delayMs(PARAGRAPH_SWITCH_PAUSE_MS, this.controller.signal);
        } catch (delayErr) {
          if (
            delayErr instanceof Error &&
            delayErr.name !== "AbortError"
          ) {
            console.warn(
              "[BrowserTextStreamManager] Paragraph switch pause interrupted:",
              delayErr,
            );
          }
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
      const session = createSingleBrowserTextStream({
        doc: this.doc,
        changeMode,
        signal: this.controller.signal,
        runWithScrollGuard: this.runWithScrollGuard,
        onMutated: this.onMutated,
        onCursorMove: this.onCursorMove,
        onStreamTargetResolved: this.onStreamTargetResolved,
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

  pushPerformAction(
    toolCallId: string,
    args: unknown,
    changeMode: "tracked" | "direct",
  ): boolean {
    if (this.disposed || !isSupportedBrowserInlineAction(args)) {
      return false;
    }
    if (this.sessions.has(toolCallId)) {
      return true;
    }

    const session = createInlineActionSession({
      doc: this.doc,
      args,
      changeMode,
      signal: this.controller.signal,
      runWithScrollGuard: this.runWithScrollGuard,
      onMutated: this.onMutated,
    });

    this.sessions.set(toolCallId, {
      toolCallId,
      session,
      inputComplete: true,
    });
    this.queueOrder.push(toolCallId);
    this.ensureQueueProcessorRunning();
    return true;
  }

  async waitForAll(options?: {
    finalizeTurn?: boolean;
  }): Promise<{
    anyLiveSucceeded: boolean;
    anyFailed: boolean;
    lastErrorMessage?: string;
  }> {
    const finalizeTurn = options?.finalizeTurn !== false;

    if (finalizeTurn) {
      for (const entry of this.sessions.values()) {
        entry.inputComplete = true;
        entry.session.markInputComplete();
      }
    }

    while (this.queueProcessorPromise) {
      await this.queueProcessorPromise.catch(() => undefined);
    }

    const entries = Array.from(this.sessions.values());
    const anyFailed = entries.some((entry) => entry.session.hasFailed());
    const result = {
      anyLiveSucceeded:
        !anyFailed && entries.some((entry) => entry.session.hasSucceeded()),
      anyFailed,
      ...(this.lastError ? { lastErrorMessage: this.lastError.message } : {}),
    };

    if (finalizeTurn && entries.length > 0) {
      this.sessions.clear();
      this.queueOrder.length = 0;
      this.currentQueueIndex = 0;
      this.lastError = null;
    }

    return result;
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
