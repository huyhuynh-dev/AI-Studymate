import { z } from 'zod';

export const WORKSPACE_SYNC_DATA_PART_TYPE = 'data-workspace-sync' as const;
export const WORKSPACE_SYNC_BROADCAST_CHANNEL = 'studymate:workspace-sync' as const;

export const workspaceSwrKeys = {
  summaries: (conversationId: string): string =>
    `/conversations/${conversationId}/summaries`,
  decks: (conversationId: string): string =>
    `/deck-flashcard/decks?conversationId=${conversationId}`,
  flashcards: (deckId: string): string =>
    `/deck-flashcard/decks/${deckId}/flashcards`,
  conversationAnalytics: (
    conversationId: string,
    windowDays: number,
  ): readonly [string, number] =>
    [`/analytics/conversations/${conversationId}`, windowDays] as const,
  isConversationAnalyticsKey: (key: unknown, conversationId: string): boolean =>
    Array.isArray(key) &&
    key[0] === `/analytics/conversations/${conversationId}`,
} as const;

const syncActionSchema = z.enum(['created', 'updated']);

export const workspaceSyncEventSchema = z.discriminatedUnion('resource', [
  z.object({
    resource: z.literal('summary'),
    action: syncActionSchema,
    conversationId: z.string().min(1),
    entityId: z.string().min(1),
    title: z.string().optional(),
    occurredAt: z.string().min(1),
  }),
  z.object({
    resource: z.literal('flashcard'),
    action: syncActionSchema,
    conversationId: z.string().min(1),
    entityId: z.string().min(1),
    targetKind: z.enum(['new', 'deck']),
    title: z.string().optional(),
    count: z.number().int().nonnegative().optional(),
    occurredAt: z.string().min(1),
  }),
  z.object({
    resource: z.literal('quiz'),
    action: syncActionSchema,
    conversationId: z.string().min(1),
    entityId: z.string().min(1),
    title: z.string().optional(),
    count: z.number().int().nonnegative().optional(),
    occurredAt: z.string().min(1),
  }),
  z.object({
    resource: z.literal('word-document'),
    action: syncActionSchema,
    conversationId: z.string().min(1),
    entityId: z.string().min(1),
    title: z.string().optional(),
    changeMode: z.enum(['tracked', 'direct']).optional(),
    count: z.number().int().nonnegative().optional(),
    requiresSnapshotReload: z.boolean().optional(),
    occurredAt: z.string().min(1),
  }),
]);

export type WorkspaceSyncEvent = Readonly<
  z.infer<typeof workspaceSyncEventSchema>
>;

export type WorkspaceSyncResource = WorkspaceSyncEvent['resource'];

export interface BroadcastChannelAdapter {
  subscribe(listener: (data: unknown) => void): () => void;
  postMessage(message: unknown): void;
  close(): void;
}

export interface WorkspaceSyncHubDeps {
  mutateKey: (
    key: string,
    updater: () => Promise<unknown>,
    options: { revalidate: boolean },
  ) => Promise<unknown>;
  revalidateMatcher: (matcher: (key: unknown) => boolean) => Promise<unknown>;
  fetchers: {
    summaries: (conversationId: string) => Promise<unknown>;
    decks: (conversationId: string) => Promise<unknown>;
    flashcards: (deckId: string) => Promise<unknown>;
  };
  createBroadcastChannel?: (name: string) => BroadcastChannelAdapter | null;
  tabInstanceId?: string;
  logger?: {
    warn: (message: string, error?: unknown) => void;
  };
}

export type WorkspaceSyncListener = (event: WorkspaceSyncEvent) => void;

interface SubscriberEntry {
  readonly conversationId: string;
  readonly resources: ReadonlySet<WorkspaceSyncResource>;
  readonly listener: WorkspaceSyncListener;
}

interface BroadcastEnvelope {
  readonly originTabId: string;
  readonly event: WorkspaceSyncEvent;
}

function createDefaultTabId(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Kiểm định Zero-Trust cho `data-workspace-sync` từ SSE stream.
 * Bỏ qua im lặng các data part khác loại; ghi log cảnh báo nếu đúng loại nhưng sai schema.
 */
export function parseWorkspaceSyncDataPart(
  part: unknown,
  logger: { warn: (message: string, error?: unknown) => void } = console,
): WorkspaceSyncEvent | null {
  if (!isRecord(part) || part.type !== WORKSPACE_SYNC_DATA_PART_TYPE) {
    return null;
  }

  const parsed = workspaceSyncEventSchema.safeParse(part.data);
  if (!parsed.success) {
    logger.warn(
      '[workspace-sync] Bỏ qua payload đồng bộ không hợp lệ:',
      parsed.error.issues,
    );
    return null;
  }

  return parsed.data;
}

/**
 * Deep Module trung tâm điều phối đồng bộ Workspace phía Client:
 * - Làm mới cache SWR theo từng tài nguyên qua Service Layer
 * - Thông báo tới các subscriber cục bộ (ví dụ useQuizStore, tab badges)
 * - Đồng bộ đa tab trình duyệt qua BroadcastChannel (chống lặp echo cùng tab)
 */
export function createWorkspaceSyncHub(deps: WorkspaceSyncHubDeps) {
  const logger = deps.logger ?? console;
  const tabInstanceId = deps.tabInstanceId ?? createDefaultTabId();
  const subscribers = new Set<SubscriberEntry>();

  let broadcastChannel: BroadcastChannelAdapter | null = null;
  let unsubscribeBroadcast: (() => void) | null = null;
  let channelInitialized = false;

  const safeMutate = (operation: Promise<unknown>, context: string): void => {
    void operation.catch((error: unknown) => {
      logger.warn(`[workspace-sync] Lỗi làm mới dữ liệu (${context}):`, error);
    });
  };

  const revalidators: Record<
    WorkspaceSyncResource,
    (event: WorkspaceSyncEvent) => void
  > = {
    summary: (event) => {
      safeMutate(
        deps.mutateKey(
          workspaceSwrKeys.summaries(event.conversationId),
          () => deps.fetchers.summaries(event.conversationId),
          { revalidate: false },
        ),
        `summaries:${event.conversationId}`,
      );
    },
    flashcard: (event) => {
      safeMutate(
        deps.mutateKey(
          workspaceSwrKeys.decks(event.conversationId),
          () => deps.fetchers.decks(event.conversationId),
          { revalidate: false },
        ),
        `decks:${event.conversationId}`,
      );
      safeMutate(
        deps.mutateKey(
          workspaceSwrKeys.flashcards(event.entityId),
          () => deps.fetchers.flashcards(event.entityId),
          { revalidate: false },
        ),
        `flashcards:${event.entityId}`,
      );
    },
    quiz: () => {
      // QuizTab quản lý danh sách đề qua useQuizStore subscriber chuyên biệt.
    },
    'word-document': () => {
      // DocumentWordEditor quản lý working snapshot trực tiếp qua subscriber word-document.
    },
  };

  const applyEvent = (event: WorkspaceSyncEvent): void => {
    revalidators[event.resource](event);

    safeMutate(
      deps.revalidateMatcher((key) =>
        workspaceSwrKeys.isConversationAnalyticsKey(key, event.conversationId),
      ),
      `analytics:${event.conversationId}`,
    );

    for (const entry of subscribers) {
      if (
        entry.conversationId !== event.conversationId ||
        !entry.resources.has(event.resource)
      ) {
        continue;
      }
      try {
        entry.listener(event);
      } catch (error: unknown) {
        logger.warn(
          `[workspace-sync] Lỗi trong subscriber (${event.resource}:${event.entityId}):`,
          error,
        );
      }
    }
  };

  const ensureBroadcastChannel = (): BroadcastChannelAdapter | null => {
    if (channelInitialized) {
      return broadcastChannel;
    }
    channelInitialized = true;

    if (!deps.createBroadcastChannel) {
      return null;
    }

    try {
      const channel = deps.createBroadcastChannel(
        WORKSPACE_SYNC_BROADCAST_CHANNEL,
      );
      if (!channel) {
        return null;
      }

      unsubscribeBroadcast = channel.subscribe((raw) => {
        if (!isRecord(raw) || typeof raw.originTabId !== 'string') {
          return;
        }
        if (raw.originTabId === tabInstanceId) {
          return;
        }
        const parsed = workspaceSyncEventSchema.safeParse(raw.event);
        if (!parsed.success) {
          logger.warn(
            '[workspace-sync] Bỏ qua broadcast payload không hợp lệ:',
            parsed.error.issues,
          );
          return;
        }
        applyEvent(parsed.data);
      });

      broadcastChannel = channel;
      return channel;
    } catch (error: unknown) {
      logger.warn(
        '[workspace-sync] Không thể khởi tạo BroadcastChannel:',
        error,
      );
      return null;
    }
  };

  const publish = (
    event: WorkspaceSyncEvent,
    options?: { broadcast?: boolean },
  ): void => {
    applyEvent(event);

    if (options?.broadcast === false) {
      return;
    }

    const channel = ensureBroadcastChannel();
    if (!channel) {
      return;
    }

    const envelope: BroadcastEnvelope = {
      originTabId: tabInstanceId,
      event,
    };

    try {
      channel.postMessage(envelope);
    } catch (error: unknown) {
      logger.warn('[workspace-sync] Không thể phát BroadcastChannel:', error);
    }
  };

  const handleChatStreamDataPart = (dataPart: unknown): boolean => {
    const event = parseWorkspaceSyncDataPart(dataPart, logger);
    if (!event) {
      return false;
    }
    publish(event);
    return true;
  };

  const subscribe = (
    conversationId: string,
    resources: readonly WorkspaceSyncResource[],
    listener: WorkspaceSyncListener,
  ): (() => void) => {
    ensureBroadcastChannel();

    const entry: SubscriberEntry = {
      conversationId,
      resources: new Set(resources),
      listener,
    };
    subscribers.add(entry);

    return () => {
      subscribers.delete(entry);
    };
  };

  const dispose = (): void => {
    subscribers.clear();
    if (unsubscribeBroadcast) {
      try {
        unsubscribeBroadcast();
      } catch (error: unknown) {
        logger.warn(
          '[workspace-sync] Lỗi khi hủy đăng ký BroadcastChannel:',
          error,
        );
      }
      unsubscribeBroadcast = null;
    }
    if (broadcastChannel) {
      try {
        broadcastChannel.close();
      } catch (error: unknown) {
        logger.warn('[workspace-sync] Lỗi khi đóng BroadcastChannel:', error);
      }
      broadcastChannel = null;
    }
    channelInitialized = false;
  };

  return {
    publish,
    handleChatStreamDataPart,
    subscribe,
    dispose,
  };
}
