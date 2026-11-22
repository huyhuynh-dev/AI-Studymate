import { beforeAll, describe, it, expect, vi } from 'vitest';

type WorkspaceSyncResource = 'summary' | 'flashcard' | 'quiz';

type WorkspaceSyncEvent =
  | {
      readonly resource: 'summary';
      readonly action: 'created' | 'updated';
      readonly conversationId: string;
      readonly entityId: string;
      readonly title?: string;
      readonly occurredAt: string;
    }
  | {
      readonly resource: 'flashcard';
      readonly action: 'created' | 'updated';
      readonly conversationId: string;
      readonly entityId: string;
      readonly targetKind: 'new' | 'deck';
      readonly title?: string;
      readonly count?: number;
      readonly occurredAt: string;
    }
  | {
      readonly resource: 'quiz';
      readonly action: 'created' | 'updated';
      readonly conversationId: string;
      readonly entityId: string;
      readonly title?: string;
      readonly count?: number;
      readonly occurredAt: string;
    };

interface BroadcastChannelAdapter {
  subscribe(listener: (data: unknown) => void): () => void;
  postMessage(message: unknown): void;
  close(): void;
}

interface WorkspaceSyncHubDeps {
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

type WorkspaceSyncCoreMod = {
  WORKSPACE_SYNC_DATA_PART_TYPE: 'data-workspace-sync';
  WORKSPACE_SYNC_BROADCAST_CHANNEL: 'studymate:workspace-sync';
  workspaceSwrKeys: {
    summaries: (conversationId: string) => string;
    decks: (conversationId: string) => string;
    flashcards: (deckId: string) => string;
    conversationAnalytics: (
      conversationId: string,
      windowDays: number,
    ) => readonly [string, number];
    isConversationAnalyticsKey: (key: unknown, conversationId: string) => boolean;
  };
  parseWorkspaceSyncDataPart: (
    part: unknown,
    logger?: { warn: (message: string, error?: unknown) => void },
  ) => WorkspaceSyncEvent | null;
  createWorkspaceSyncHub: (deps: WorkspaceSyncHubDeps) => {
    publish: (event: WorkspaceSyncEvent, options?: { broadcast?: boolean }) => void;
    handleChatStreamDataPart: (dataPart: unknown) => boolean;
    subscribe: (
      conversationId: string,
      resources: readonly WorkspaceSyncResource[],
      listener: (event: WorkspaceSyncEvent) => void,
    ) => () => void;
    dispose: () => void;
  };
};

let coreMod: WorkspaceSyncCoreMod;

beforeAll(async () => {
  coreMod = await vi.importActual<WorkspaceSyncCoreMod>(
    '../../../client/src/lib/workspace-sync.core.ts',
  );
});

function createMockBroadcastChannelBus() {
  const entries = new Map<
    BroadcastChannelAdapter,
    Set<(data: unknown) => void>
  >();

  const createChannel = (_name: string): BroadcastChannelAdapter => {
    const listeners = new Set<(data: unknown) => void>();
    const instance: BroadcastChannelAdapter = {
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      postMessage(message: unknown) {
        for (const [peer, peerListeners] of entries.entries()) {
          if (peer !== instance) {
            for (const listener of peerListeners) {
              listener(message);
            }
          }
        }
      },
      close() {
        listeners.clear();
        entries.delete(instance);
      },
    };
    entries.set(instance, listeners);
    return instance;
  };

  return { createChannel };
}

describe('Client workspace-sync core', () => {
  it('workspaceSwrKeys nên khớp chính xác định dạng khóa SWR của các hooks', () => {
    expect(coreMod.workspaceSwrKeys.summaries('conv-1')).toBe(
      '/conversations/conv-1/summaries',
    );
    expect(coreMod.workspaceSwrKeys.decks('conv-1')).toBe(
      '/deck-flashcard/decks?conversationId=conv-1',
    );
    expect(coreMod.workspaceSwrKeys.flashcards('deck-1')).toBe(
      '/deck-flashcard/decks/deck-1/flashcards',
    );
    expect(coreMod.workspaceSwrKeys.conversationAnalytics('conv-1', 30)).toEqual([
      '/analytics/conversations/conv-1',
      30,
    ]);
    expect(
      coreMod.workspaceSwrKeys.isConversationAnalyticsKey(
        ['/analytics/conversations/conv-1', 30],
        'conv-1',
      ),
    ).toBe(true);
    expect(
      coreMod.workspaceSwrKeys.isConversationAnalyticsKey(
        ['/analytics/conversations/conv-2', 30],
        'conv-1',
      ),
    ).toBe(false);
  });

  it('parseWorkspaceSyncDataPart nên chấp nhận 3 resource hợp lệ và từ chối data sai loại hoặc sai schema', () => {
    const summaryPart = {
      type: coreMod.WORKSPACE_SYNC_DATA_PART_TYPE,
      data: {
        resource: 'summary',
        action: 'created',
        conversationId: 'conv-1',
        entityId: 'sum-1',
        title: 'Ghi chú chương 1',
        occurredAt: '2026-11-22T06:00:00.000Z',
      },
    };
    expect(coreMod.parseWorkspaceSyncDataPart(summaryPart)).toEqual(
      summaryPart.data,
    );

    const flashcardPart = {
      type: coreMod.WORKSPACE_SYNC_DATA_PART_TYPE,
      data: {
        resource: 'flashcard',
        action: 'updated',
        conversationId: 'conv-1',
        entityId: 'deck-1',
        targetKind: 'deck',
        count: 10,
        occurredAt: '2026-11-22T06:00:00.000Z',
      },
    };
    expect(coreMod.parseWorkspaceSyncDataPart(flashcardPart)).toEqual(
      flashcardPart.data,
    );

    const quizPart = {
      type: coreMod.WORKSPACE_SYNC_DATA_PART_TYPE,
      data: {
        resource: 'quiz',
        action: 'created',
        conversationId: 'conv-1',
        entityId: 'quiz-1',
        count: 5,
        occurredAt: '2026-11-22T06:00:00.000Z',
      },
    };
    expect(coreMod.parseWorkspaceSyncDataPart(quizPart)).toEqual(quizPart.data);

    // Loại data part khác -> bỏ qua im lặng (không cảnh báo)
    const silentLogger = { warn: vi.fn() };
    expect(
      coreMod.parseWorkspaceSyncDataPart(
        { type: 'data-other', data: { foo: 'bar' } },
        silentLogger,
      ),
    ).toBeNull();
    expect(silentLogger.warn).not.toHaveBeenCalled();

    // Đúng loại nhưng thiếu targetKind của flashcard -> log warn & trả về null
    expect(
      coreMod.parseWorkspaceSyncDataPart(
        {
          type: coreMod.WORKSPACE_SYNC_DATA_PART_TYPE,
          data: {
            resource: 'flashcard',
            action: 'created',
            conversationId: 'conv-1',
            entityId: 'deck-1',
            occurredAt: '2026-11-22T06:00:00.000Z',
          },
        },
        silentLogger,
      ),
    ).toBeNull();
    expect(silentLogger.warn).toHaveBeenCalledTimes(1);
  });

  it('nên điều phối mutate đúng SWR keys, gọi đúng Service fetchers và thông báo subscribers theo conversationId + resource', () => {
    const mutateKey = vi.fn(
      async (_key: string, updater: () => Promise<unknown>) => updater(),
    );
    const revalidateMatcher = vi.fn(
      async (_matcher: (key: unknown) => boolean) => [],
    );
    const fetchers = {
      summaries: vi.fn(async () => [{ id: 'sum-1' }]),
      decks: vi.fn(async () => [{ id: 'deck-1' }]),
      flashcards: vi.fn(async () => [{ id: 'card-1' }]),
    };

    const hub = coreMod.createWorkspaceSyncHub({
      mutateKey,
      revalidateMatcher,
      fetchers,
      logger: { warn: vi.fn() },
    });

    const conv1QuizListener = vi.fn();
    const conv2QuizListener = vi.fn();
    const conv1SummaryListener = vi.fn();

    const unsub1 = hub.subscribe('conv-1', ['quiz'], conv1QuizListener);
    hub.subscribe('conv-2', ['quiz'], conv2QuizListener);
    hub.subscribe('conv-1', ['summary'], conv1SummaryListener);

    // 1. Summary data part
    const acceptedSummary = hub.handleChatStreamDataPart({
      type: coreMod.WORKSPACE_SYNC_DATA_PART_TYPE,
      data: {
        resource: 'summary',
        action: 'created',
        conversationId: 'conv-1',
        entityId: 'sum-1',
        occurredAt: '2026-11-22T06:00:00.000Z',
      },
    });
    expect(acceptedSummary).toBe(true);
    expect(mutateKey).toHaveBeenCalledWith(
      '/conversations/conv-1/summaries',
      expect.any(Function),
      { revalidate: false },
    );
    expect(fetchers.summaries).toHaveBeenCalledWith('conv-1');
    expect(conv1SummaryListener).toHaveBeenCalledTimes(1);
    expect(conv1QuizListener).not.toHaveBeenCalled();

    // 2. Flashcard data part -> làm mới cả decks(conv) lẫn flashcards(deckId)
    hub.handleChatStreamDataPart({
      type: coreMod.WORKSPACE_SYNC_DATA_PART_TYPE,
      data: {
        resource: 'flashcard',
        action: 'updated',
        conversationId: 'conv-1',
        entityId: 'deck-1',
        targetKind: 'deck',
        count: 6,
        occurredAt: '2026-11-22T06:00:01.000Z',
      },
    });
    expect(mutateKey).toHaveBeenCalledWith(
      '/deck-flashcard/decks?conversationId=conv-1',
      expect.any(Function),
      { revalidate: false },
    );
    expect(mutateKey).toHaveBeenCalledWith(
      '/deck-flashcard/decks/deck-1/flashcards',
      expect.any(Function),
      { revalidate: false },
    );
    expect(fetchers.decks).toHaveBeenCalledWith('conv-1');
    expect(fetchers.flashcards).toHaveBeenCalledWith('deck-1');

    // 3. Quiz data part -> chỉ gọi subscriber đúng conversationId và resource
    hub.handleChatStreamDataPart({
      type: coreMod.WORKSPACE_SYNC_DATA_PART_TYPE,
      data: {
        resource: 'quiz',
        action: 'created',
        conversationId: 'conv-1',
        entityId: 'quiz-1',
        occurredAt: '2026-11-22T06:00:02.000Z',
      },
    });
    expect(conv1QuizListener).toHaveBeenCalledTimes(1);
    expect(conv2QuizListener).not.toHaveBeenCalled();

    // Kiểm tra analytics matcher
    expect(revalidateMatcher).toHaveBeenCalledTimes(3);
    const matcherFn = revalidateMatcher.mock.calls[0]?.[0];
    expect(matcherFn).toBeDefined();
    expect(matcherFn?.(['/analytics/conversations/conv-1', 30])).toBe(true);
    expect(matcherFn?.(['/analytics/conversations/conv-2', 30])).toBe(false);

    // Hủy đăng ký không còn nhận thông báo
    unsub1();
    hub.handleChatStreamDataPart({
      type: coreMod.WORKSPACE_SYNC_DATA_PART_TYPE,
      data: {
        resource: 'quiz',
        action: 'created',
        conversationId: 'conv-1',
        entityId: 'quiz-2',
        occurredAt: '2026-11-22T06:00:03.000Z',
      },
    });
    expect(conv1QuizListener).toHaveBeenCalledTimes(1);
    hub.dispose();
  });

  it('nên đồng bộ sang tab trình duyệt khác qua BroadcastChannel và không phát lại lặp trên cùng tab', () => {
    const bus = createMockBroadcastChannelBus();
    const createChannelSpy = vi.fn(bus.createChannel);

    const mutateA = vi.fn(async () => undefined);
    const mutateB = vi.fn(async () => undefined);

    const hubA = coreMod.createWorkspaceSyncHub({
      mutateKey: mutateA,
      revalidateMatcher: vi.fn(async () => undefined),
      fetchers: {
        summaries: vi.fn(async () => []),
        decks: vi.fn(async () => []),
        flashcards: vi.fn(async () => []),
      },
      createBroadcastChannel: createChannelSpy,
      tabInstanceId: 'tab-A',
      logger: { warn: vi.fn() },
    });

    const hubB = coreMod.createWorkspaceSyncHub({
      mutateKey: mutateB,
      revalidateMatcher: vi.fn(async () => undefined),
      fetchers: {
        summaries: vi.fn(async () => []),
        decks: vi.fn(async () => []),
        flashcards: vi.fn(async () => []),
      },
      createBroadcastChannel: createChannelSpy,
      tabInstanceId: 'tab-B',
      logger: { warn: vi.fn() },
    });

    const listenerA = vi.fn();
    const listenerB = vi.fn();
    hubA.subscribe('conv-1', ['summary'], listenerA);
    hubB.subscribe('conv-1', ['summary'], listenerB);

    expect(createChannelSpy).toHaveBeenCalledWith(
      coreMod.WORKSPACE_SYNC_BROADCAST_CHANNEL,
    );

    const event: WorkspaceSyncEvent = {
      resource: 'summary',
      action: 'created',
      conversationId: 'conv-1',
      entityId: 'sum-sync',
      occurredAt: '2026-11-22T06:05:00.000Z',
    };

    hubA.publish(event);

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledWith(event);
    expect(mutateB).toHaveBeenCalledWith(
      '/conversations/conv-1/summaries',
      expect.any(Function),
      { revalidate: false },
    );

    hubA.dispose();
    hubB.dispose();
  });

  it('nên cô lập lỗi nếu mutate hoặc subscriber ném ngoại lệ', async () => {
    const warn = vi.fn();
    const hub = coreMod.createWorkspaceSyncHub({
      mutateKey: vi.fn().mockRejectedValue(new Error('Network offline')),
      revalidateMatcher: vi.fn().mockRejectedValue(new Error('Analytics fail')),
      fetchers: {
        summaries: vi.fn(async () => []),
        decks: vi.fn(async () => []),
        flashcards: vi.fn(async () => []),
      },
      logger: { warn },
    });

    const goodListener = vi.fn();
    hub.subscribe('conv-1', ['summary'], () => {
      throw new Error('Listener crashed');
    });
    hub.subscribe('conv-1', ['summary'], goodListener);

    expect(() =>
      hub.publish({
        resource: 'summary',
        action: 'created',
        conversationId: 'conv-1',
        entityId: 'sum-1',
        occurredAt: '2026-11-22T06:00:00.000Z',
      }),
    ).not.toThrow();

    await Promise.resolve();
    await Promise.resolve();

    expect(goodListener).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
    hub.dispose();
  });
});
