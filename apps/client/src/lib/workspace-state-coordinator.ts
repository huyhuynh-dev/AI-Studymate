import type {
  UpsertWorkspaceStateDto,
  UpsertWorkspaceStateResponse,
  ValidConversationTab,
  WorkspaceDocumentState,
  WorkspaceLayoutState,
  WorkspaceLocationState,
  WorkspaceStateSnapshot,
} from '../types/workspace-state';

export interface WorkspaceStateTransport {
  putState(
    payload: UpsertWorkspaceStateDto,
    signal?: AbortSignal,
  ): Promise<UpsertWorkspaceStateResponse>;
  putStateKeepalive(payload: UpsertWorkspaceStateDto): void;
}

export interface CoordinatorTimers {
  setTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}

export interface CoordinatorOptions {
  readonly transport: WorkspaceStateTransport;
  readonly generateSourceId?: () => string;
  readonly timers?: CoordinatorTimers;
  readonly standardDebounceMs?: number;
  readonly standardMaxWaitMs?: number;
  readonly pageDebounceMs?: number;
  readonly pageMaxWaitMs?: number;
  readonly retryDelaysMs?: readonly number[];
}

export type GateState = 'pending' | 'settled' | 'unknown';

export type ConversationLocationPatch =
  | { readonly kind: 'route'; readonly subjectId: string; readonly conversationId: string }
  | { readonly kind: 'tab'; readonly subjectId: string; readonly conversationId: string; readonly tab: ValidConversationTab }
  | { readonly kind: 'document'; readonly subjectId: string; readonly conversationId: string; readonly document: WorkspaceDocumentState | null }
  | { readonly kind: 'summary'; readonly subjectId: string; readonly conversationId: string; readonly summaryId: string | null }
  | { readonly kind: 'deck'; readonly subjectId: string; readonly conversationId: string; readonly deckId: string | null }
  | { readonly kind: 'quiz'; readonly subjectId: string; readonly conversationId: string; readonly quizId: string | null }
  | { readonly kind: 'chatSession'; readonly subjectId: string; readonly conversationId: string; readonly chatSessionId: string | null };

export function areDocumentsEqual(
  a: WorkspaceDocumentState | undefined,
  b: WorkspaceDocumentState | undefined,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.docId === b.docId && (a.page ?? undefined) === (b.page ?? undefined);
}

export function areLocationsEqual(
  a: WorkspaceLocationState | null,
  b: WorkspaceLocationState | null,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    (a.subjectId ?? undefined) === (b.subjectId ?? undefined) &&
    (a.conversationId ?? undefined) === (b.conversationId ?? undefined) &&
    (a.tab ?? undefined) === (b.tab ?? undefined) &&
    areDocumentsEqual(a.document, b.document) &&
    (a.summaryId ?? undefined) === (b.summaryId ?? undefined) &&
    (a.deckId ?? undefined) === (b.deckId ?? undefined) &&
    (a.quizId ?? undefined) === (b.quizId ?? undefined) &&
    (a.chatSessionId ?? undefined) === (b.chatSessionId ?? undefined)
  );
}

export function areLayoutsEqual(
  a: WorkspaceLayoutState | null,
  b: WorkspaceLayoutState | null,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.leftSidebarCollapsed === b.leftSidebarCollapsed &&
    a.rightSidebarCollapsed === b.rightSidebarCollapsed
  );
}

/**
 * Hợp nhất các thay đổi ở cấp conversation theo `conversationId`
 * để tránh mất các trường anh em (`document`, `summaryId`, `deckId`, `quizId`, `chatSessionId`)
 * khi báo cáo đến từ nhiều component theo thứ tự khác nhau.
 */
export function mergeConversationPatch(
  current: WorkspaceLocationState | null,
  patch: ConversationLocationPatch,
): WorkspaceLocationState {
  const isSameConversation = current?.conversationId === patch.conversationId;
  const base: WorkspaceLocationState = isSameConversation
    ? { ...current, subjectId: patch.subjectId, conversationId: patch.conversationId }
    : { subjectId: patch.subjectId, conversationId: patch.conversationId };

  switch (patch.kind) {
    case 'route':
      return base;
    case 'tab':
      return { ...base, tab: patch.tab };
    case 'document': {
      const next = { ...base };
      if (patch.document) {
        next.document = patch.document;
      } else {
        delete (next as { document?: WorkspaceDocumentState }).document;
      }
      return next;
    }
    case 'summary': {
      const next = { ...base };
      if (patch.summaryId) {
        next.summaryId = patch.summaryId;
      } else {
        delete (next as { summaryId?: string }).summaryId;
      }
      return next;
    }
    case 'deck': {
      const next = { ...base };
      if (patch.deckId) {
        next.deckId = patch.deckId;
      } else {
        delete (next as { deckId?: string }).deckId;
      }
      return next;
    }
    case 'quiz': {
      const next = { ...base };
      if (patch.quizId) {
        next.quizId = patch.quizId;
      } else {
        delete (next as { quizId?: string }).quizId;
      }
      return next;
    }
    case 'chatSession': {
      const next = { ...base };
      if (patch.chatSessionId) {
        next.chatSessionId = patch.chatSessionId;
      } else {
        delete (next as { chatSessionId?: string }).chatSessionId;
      }
      return next;
    }
  }
}

function createDefaultSourceId(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const DEFAULT_TIMERS: CoordinatorTimers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
};

const DEFAULT_RETRY_DELAYS_MS = [1000, 3000, 8000] as const;

function getHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const errObj = error as { status?: unknown; response?: { status?: unknown } };
  if (typeof errObj.response?.status === 'number') {
    return errObj.response.status;
  }
  if (typeof errObj.status === 'number') {
    return errObj.status;
  }
  return undefined;
}

/**
 * Deep module điều phối việc ghi trạng thái workspace lên server:
 * - Gắn chặt với `userId` hiện hành, tự hủy hàng đợi khi user đổi/logout.
 * - Gate `pending -> settled | unknown` chống ghi đè `/home` khi GET khởi động chưa xong hoặc lỗi.
 * - Debounce 2 tầng (ngắn cho điều hướng/tab/layout, dài hơn cho cuộn trang PDF) kèm maxWait.
 * - Single-flight (tối đa 1 request đang bay) + thứ tự `sourceId` / `seq` + retry giới hạn.
 */
export class WorkspaceStateCoordinator {
  private readonly transport: WorkspaceStateTransport;
  private readonly timers: CoordinatorTimers;
  private readonly standardDebounceMs: number;
  private readonly standardMaxWaitMs: number;
  private readonly pageDebounceMs: number;
  private readonly pageMaxWaitMs: number;
  private readonly retryDelaysMs: readonly number[];
  private readonly sourceId: string;

  private boundUserId: string | null = null;
  private epoch = 0;
  private seq = 0;
  private gateState: GateState = 'pending';
  private suppressInitialLocation = false;

  private draftLocation: WorkspaceLocationState | null = null;
  private draftLayout: WorkspaceLayoutState | null = null;
  private confirmedLocation: WorkspaceLocationState | null = null;
  private confirmedLayout: WorkspaceLayoutState | null = null;

  private locationDirty = false;
  private layoutDirty = false;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;

  private inFlightPromise: Promise<void> | null = null;
  private activeRequestController: AbortController | null = null;

  constructor(options: CoordinatorOptions) {
    this.transport = options.transport;
    this.timers = options.timers ?? DEFAULT_TIMERS;
    this.standardDebounceMs = options.standardDebounceMs ?? 400;
    this.standardMaxWaitMs = options.standardMaxWaitMs ?? 1500;
    this.pageDebounceMs = options.pageDebounceMs ?? 1200;
    this.pageMaxWaitMs = options.pageMaxWaitMs ?? 3500;
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    this.sourceId = (options.generateSourceId ?? createDefaultSourceId)();
  }

  getGateState(): GateState {
    return this.gateState;
  }

  getSourceId(): string {
    return this.sourceId;
  }

  bindUser(userId: string | null): void {
    if (this.boundUserId === userId) return;
    const prevUserId = this.boundUserId;
    this.boundUserId = userId;

    // Chỉ xóa bộ nhớ khi chuyển từ tài khoản này sang tài khoản khác hoặc khi đăng xuất.
    // Khi hydrate từ null -> userId lần đầu sau khi mở trang, giữ nguyên seedFromServer / state đang chờ.
    if (prevUserId !== null) {
      this.clearPendingStateOnly();
      return;
    }

    if (userId !== null) {
      this.scheduleFlushIfDirty(false);
    }
  }

  markSettled(): void {
    this.gateState = 'settled';
    this.suppressInitialLocation = false;
    this.scheduleFlushIfDirty(false);
  }

  markUnknown(): void {
    this.gateState = 'unknown';
    this.suppressInitialLocation = true;
    // Bỏ qua mọi vị trí ban đầu tích tụ trước khi có kết quả bootstrap
    this.locationDirty = false;
    this.draftLocation = null;
  }

  seedFromServer(snapshot: WorkspaceStateSnapshot): void {
    if (snapshot.location && snapshot.location.resolution === 'valid') {
      const seededLocation: WorkspaceLocationState = {
        ...(snapshot.location.subjectId
          ? { subjectId: snapshot.location.subjectId }
          : {}),
        ...(snapshot.location.conversationId
          ? { conversationId: snapshot.location.conversationId }
          : {}),
        ...(snapshot.location.tab ? { tab: snapshot.location.tab } : {}),
        ...(snapshot.location.document
          ? { document: snapshot.location.document }
          : {}),
        ...(snapshot.location.summaryId
          ? { summaryId: snapshot.location.summaryId }
          : {}),
        ...(snapshot.location.deckId
          ? { deckId: snapshot.location.deckId }
          : {}),
        ...(snapshot.location.quizId
          ? { quizId: snapshot.location.quizId }
          : {}),
        ...(snapshot.location.chatSessionId
          ? { chatSessionId: snapshot.location.chatSessionId }
          : {}),
      };
      this.confirmedLocation = seededLocation;
      if (!this.locationDirty) {
        this.draftLocation = seededLocation;
      }
    }

    if (snapshot.layout) {
      this.confirmedLayout = { ...snapshot.layout };
      if (!this.layoutDirty) {
        this.draftLayout = { ...snapshot.layout };
      }
    }
  }

  reportHome(): void {
    this.applyLocationChange({}, false);
  }

  reportSubject(subjectId: string): void {
    this.applyLocationChange({ subjectId }, false);
  }

  reportConversation(subjectId: string, conversationId: string): void {
    const next = mergeConversationPatch(this.draftLocation, {
      kind: 'route',
      subjectId,
      conversationId,
    });
    this.applyLocationChange(next, false);
  }

  reportTab(
    subjectId: string,
    conversationId: string,
    tab: ValidConversationTab,
  ): void {
    const next = mergeConversationPatch(this.draftLocation, {
      kind: 'tab',
      subjectId,
      conversationId,
      tab,
    });
    this.applyLocationChange(next, false);
  }

  reportDocument(
    subjectId: string,
    conversationId: string,
    document: WorkspaceDocumentState | null,
    isPageOnlyChange = false,
  ): void {
    const next = mergeConversationPatch(this.draftLocation, {
      kind: 'document',
      subjectId,
      conversationId,
      document,
    });
    this.applyLocationChange(next, isPageOnlyChange);
  }

  reportSummary(
    subjectId: string,
    conversationId: string,
    summaryId: string | null,
  ): void {
    const next = mergeConversationPatch(this.draftLocation, {
      kind: 'summary',
      subjectId,
      conversationId,
      summaryId,
    });
    this.applyLocationChange(next, false);
  }

  reportDeck(
    subjectId: string,
    conversationId: string,
    deckId: string | null,
  ): void {
    const next = mergeConversationPatch(this.draftLocation, {
      kind: 'deck',
      subjectId,
      conversationId,
      deckId,
    });
    this.applyLocationChange(next, false);
  }

  reportQuiz(
    subjectId: string,
    conversationId: string,
    quizId: string | null,
  ): void {
    const next = mergeConversationPatch(this.draftLocation, {
      kind: 'quiz',
      subjectId,
      conversationId,
      quizId,
    });
    this.applyLocationChange(next, false);
  }

  reportChatSession(
    subjectId: string,
    conversationId: string,
    chatSessionId: string | null,
  ): void {
    const next = mergeConversationPatch(this.draftLocation, {
      kind: 'chatSession',
      subjectId,
      conversationId,
      chatSessionId,
    });
    this.applyLocationChange(next, false);
  }

  reportLayout(layout: WorkspaceLayoutState): void {
    this.draftLayout = { ...layout };
    if (areLayoutsEqual(this.draftLayout, this.confirmedLayout)) {
      this.layoutDirty = false;
      return;
    }
    this.layoutDirty = true;
    this.scheduleFlushIfDirty(false);
  }

  async flushNow(timeoutMs = 1500): Promise<void> {
    if (!this.boundUserId) return;
    if (this.gateState === 'pending') return;

    this.clearTimers();

    const flushTask = (async () => {
      if (this.inFlightPromise) {
        await this.inFlightPromise.catch(() => {});
      }
      if (this.hasPendingChanges()) {
        await this.dispatchOnce();
      }
    })();

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
      await Promise.race([
        flushTask,
        new Promise<void>((resolve) => {
          timeoutHandle = this.timers.setTimeout(resolve, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle !== null) {
        this.timers.clearTimeout(timeoutHandle);
      }
    }
  }

  flushKeepalive(): void {
    if (!this.boundUserId || this.gateState === 'pending') return;
    if (!this.hasPendingChanges() || this.inFlightPromise) return;

    const payload = this.buildNextPayload();
    if (!payload) return;

    this.clearTimers();
    this.locationDirty = false;
    this.layoutDirty = false;
    this.transport.putStateKeepalive(payload);
  }

  reset(): void {
    this.boundUserId = null;
    this.gateState = 'pending';
    this.suppressInitialLocation = false;
    this.clearPendingStateOnly();
  }

  private applyLocationChange(
    next: WorkspaceLocationState,
    isPageOnlyChange: boolean,
  ): void {
    if (this.gateState === 'unknown' && this.suppressInitialLocation) {
      // Vị trí ban đầu ngay sau khi GET thất bại không được ghi đè lên server
      this.suppressInitialLocation = false;
      this.draftLocation = next;
      return;
    }

    this.draftLocation = next;
    if (areLocationsEqual(this.draftLocation, this.confirmedLocation)) {
      this.locationDirty = false;
      return;
    }

    this.locationDirty = true;
    this.scheduleFlushIfDirty(isPageOnlyChange);
  }

  private hasPendingChanges(): boolean {
    return (
      (this.locationDirty && this.draftLocation !== null) ||
      (this.layoutDirty && this.draftLayout !== null)
    );
  }

  private clearTimers(): void {
    if (this.debounceTimer !== null) {
      this.timers.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.maxWaitTimer !== null) {
      this.timers.clearTimeout(this.maxWaitTimer);
      this.maxWaitTimer = null;
    }
    if (this.retryTimer !== null) {
      this.timers.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private clearPendingStateOnly(): void {
    this.epoch += 1;
    this.clearTimers();
    this.activeRequestController?.abort();
    this.activeRequestController = null;
    this.inFlightPromise = null;
    this.draftLocation = null;
    this.draftLayout = null;
    this.confirmedLocation = null;
    this.confirmedLayout = null;
    this.locationDirty = false;
    this.layoutDirty = false;
    this.retryAttempt = 0;
  }

  private scheduleFlushIfDirty(isPageOnlyChange: boolean): void {
    if (this.gateState === 'pending' || !this.boundUserId) return;
    if (!this.hasPendingChanges()) return;

    if (this.retryTimer !== null) {
      this.timers.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.debounceTimer !== null) {
      this.timers.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const delayMs = isPageOnlyChange
      ? this.pageDebounceMs
      : this.standardDebounceMs;
    const maxWaitMs = isPageOnlyChange
      ? this.pageMaxWaitMs
      : this.standardMaxWaitMs;

    this.debounceTimer = this.timers.setTimeout(() => {
      this.triggerImmediateFlush();
    }, delayMs);

    if (this.maxWaitTimer === null) {
      this.maxWaitTimer = this.timers.setTimeout(() => {
        this.triggerImmediateFlush();
      }, maxWaitMs);
    }
  }

  private triggerImmediateFlush(): void {
    if (this.debounceTimer !== null) {
      this.timers.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.maxWaitTimer !== null) {
      this.timers.clearTimeout(this.maxWaitTimer);
      this.maxWaitTimer = null;
    }

    if (this.inFlightPromise || !this.boundUserId || this.gateState === 'pending') {
      return;
    }
    if (!this.hasPendingChanges()) return;

    void this.dispatchOnce();
  }

  private buildNextPayload(): UpsertWorkspaceStateDto | null {
    const includeLocation = this.locationDirty && this.draftLocation !== null;
    const includeLayout = this.layoutDirty && this.draftLayout !== null;

    if (!includeLocation && !includeLayout) return null;

    this.seq += 1;
    return {
      sourceId: this.sourceId,
      seq: this.seq,
      ...(includeLocation && this.draftLocation
        ? { location: this.draftLocation }
        : {}),
      ...(includeLayout && this.draftLayout ? { layout: this.draftLayout } : {}),
    };
  }

  private async dispatchOnce(): Promise<void> {
    const payload = this.buildNextPayload();
    if (!payload || !this.boundUserId) return;

    const sendEpoch = this.epoch;
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    this.activeRequestController = controller;

    // Xóa cờ dirty trước khi gửi; nếu trong lúc đang bay có thay đổi mới sẽ bật lại dirty
    if (payload.location !== undefined) this.locationDirty = false;
    if (payload.layout !== undefined) this.layoutDirty = false;

    const run = (async () => {
      try {
        await this.transport.putState(payload, controller?.signal);

        if (sendEpoch !== this.epoch) return;

        if (payload.location !== undefined) {
          this.confirmedLocation = payload.location;
        }
        if (payload.layout !== undefined) {
          this.confirmedLayout = payload.layout;
        }
        this.retryAttempt = 0;

        // Re-check xem trong lúc chờ request trước có thay đổi mới hơn hay không
        if (this.locationDirty && areLocationsEqual(this.draftLocation, this.confirmedLocation)) {
          this.locationDirty = false;
        }
        if (this.layoutDirty && areLayoutsEqual(this.draftLayout, this.confirmedLayout)) {
          this.layoutDirty = false;
        }
      } catch (error: unknown) {
        if (sendEpoch !== this.epoch) return;

        const status = getHttpStatus(error);
        if (status === 400 || status === 401 || status === 403) {
          // Lỗi validation/auth: không retry lặp; giữ im lặng
          if (process.env.NODE_ENV === 'development') {
            console.warn('[WorkspaceState] Bỏ qua lỗi client/auth khi lưu trạng thái:', status);
          }
          return;
        }

        // Khôi phục cờ dirty nếu chưa có bản mới hơn ghi đè
        if (payload.location !== undefined && !this.locationDirty) {
          this.locationDirty = true;
        }
        if (payload.layout !== undefined && !this.layoutDirty) {
          this.layoutDirty = true;
        }

        if (this.retryAttempt < this.retryDelaysMs.length) {
          const backoff = this.retryDelaysMs[this.retryAttempt];
          this.retryAttempt += 1;
          this.retryTimer = this.timers.setTimeout(() => {
            this.retryTimer = null;
            this.triggerImmediateFlush();
          }, backoff);
        }
      } finally {
        if (sendEpoch === this.epoch) {
          this.activeRequestController = null;
          this.inFlightPromise = null;
          if (this.hasPendingChanges() && this.retryTimer === null) {
            this.triggerImmediateFlush();
          }
        }
      }
    })();

    this.inFlightPromise = run;
    await run;
  }
}
