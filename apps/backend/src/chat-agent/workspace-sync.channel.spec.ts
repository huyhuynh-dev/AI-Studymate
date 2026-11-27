import { describe, it, expect, vi } from 'vitest';
import type { UIMessageChunk } from 'ai';
import {
  WorkspaceSyncChannel,
  pipeWorkspaceSyncIntoUIMessageStream,
} from './workspace-sync.channel.js';
import {
  AGENT_STATUS_CHUNK_TYPE,
  WORKSPACE_SYNC_CHUNK_TYPE,
  type WorkspaceSyncEvent,
} from './workspace-sync.types.js';

async function readAllChunks<T>(stream: ReadableStream<T>): Promise<T[]> {
  const reader = stream.getReader();
  const chunks: T[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

describe('WorkspaceSyncChannel', () => {
  const sampleEvent: WorkspaceSyncEvent = {
    resource: 'summary',
    action: 'created',
    conversationId: 'conv-1',
    entityId: 'summary-1',
    title: 'Tóm tắt Chương 1',
    occurredAt: '2026-11-22T06:00:00.000Z',
  };

  it('nên đệm FIFO các sự kiện phát trước khi attach và xả ngay theo đúng thứ tự khi attach', () => {
    const channel = new WorkspaceSyncChannel();
    const event2: WorkspaceSyncEvent = {
      resource: 'quiz',
      action: 'created',
      conversationId: 'conv-1',
      entityId: 'quiz-1',
      title: 'Quiz 1',
      count: 10,
      occurredAt: '2026-11-22T06:00:01.000Z',
    };

    channel.emit(sampleEvent);
    channel.emit(event2);

    const received: WorkspaceSyncEvent[] = [];
    const detach = channel.attach((e) => received.push(e));

    expect(received).toEqual([sampleEvent, event2]);

    const event3: WorkspaceSyncEvent = {
      resource: 'flashcard',
      action: 'updated',
      conversationId: 'conv-1',
      entityId: 'deck-1',
      targetKind: 'deck',
      count: 5,
      occurredAt: '2026-11-22T06:00:02.000Z',
    };
    channel.emit(event3);
    expect(received).toEqual([sampleEvent, event2, event3]);

    detach();
    channel.emit(sampleEvent);
    expect(received).toHaveLength(3);
  });

  it('close() nên idempotent và bỏ qua mọi sự kiện phát sau khi đóng', () => {
    const channel = new WorkspaceSyncChannel();
    const received: WorkspaceSyncEvent[] = [];
    channel.attach((e) => received.push(e));

    channel.close();
    channel.close();
    channel.emit(sampleEvent);

    const lateDetach = channel.attach((e) => received.push(e));
    lateDetach();
    expect(received).toHaveLength(0);
  });

  it('nên cô lập lỗi nếu sink ném exception mà không làm sập caller', () => {
    const channel = new WorkspaceSyncChannel();
    const throwingSink = vi.fn(() => {
      throw new Error('sink failed');
    });

    channel.attach(throwingSink);
    expect(() => channel.emit(sampleEvent)).not.toThrow();
    expect(throwingSink).toHaveBeenCalledTimes(1);
  });
});

describe('pipeWorkspaceSyncIntoUIMessageStream', () => {
  it('nên bảo đảm chunk start đi trước data-workspace-sync và phát live ngay khi DB commit giữa stream', async () => {
    const channel = new WorkspaceSyncChannel();

    const preStartEvent: WorkspaceSyncEvent = {
      resource: 'summary',
      action: 'created',
      conversationId: 'conv-1',
      entityId: 'sum-pre',
      occurredAt: '2026-11-22T06:00:00.000Z',
    };
    const midStreamEvent: WorkspaceSyncEvent = {
      resource: 'flashcard',
      action: 'created',
      conversationId: 'conv-1',
      entityId: 'deck-live',
      targetKind: 'new',
      count: 8,
      occurredAt: '2026-11-22T06:00:01.000Z',
    };

    channel.emit(preStartEvent);

    let controllerRef: ReadableStreamDefaultController<UIMessageChunk> | null =
      null;
    const innerStream = new ReadableStream<UIMessageChunk>({
      start(controller) {
        controllerRef = controller;
      },
    });

    const mergedStream = pipeWorkspaceSyncIntoUIMessageStream(
      innerStream,
      channel,
    );
    const reader = mergedStream.getReader();

    // Đẩy chunk `start` từ innerStream
    controllerRef!.enqueue({ type: 'start', messageId: 'msg-stable-123' });

    const first = await reader.read();
    expect(first.value).toEqual({
      type: 'start',
      messageId: 'msg-stable-123',
    });

    // Sự kiện đệm trước `start` được đẩy ra ngay sau `start`
    const second = await reader.read();
    expect(second.value).toEqual({
      type: WORKSPACE_SYNC_CHUNK_TYPE,
      transient: true,
      data: preStartEvent,
    });

    // Bắt đầu chờ chunk text tiếp theo từ LLM -> phát midStreamEvent NGAY LẬP TỨC trước khi LLM đẩy text
    const pendingNextRead = reader.read();
    channel.emit(midStreamEvent);

    const third = await pendingNextRead;
    expect(third.value).toEqual({
      type: WORKSPACE_SYNC_CHUNK_TYPE,
      transient: true,
      data: midStreamEvent,
    });

    // LLM hoàn tất phần text & finish
    controllerRef!.enqueue({ type: 'text-start', id: 't1' });
    controllerRef!.enqueue({ type: 'text-delta', id: 't1', delta: 'Xong!' });
    controllerRef!.enqueue({ type: 'text-end', id: 't1' });
    controllerRef!.enqueue({ type: 'finish', finishReason: 'stop' });
    controllerRef!.close();

    const remaining: UIMessageChunk[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      remaining.push(value);
    }

    expect(remaining.map((c) => c.type)).toEqual([
      'text-start',
      'text-delta',
      'text-end',
      'finish',
    ]);
  });

  it('nên truyền qua lỗi stream qua onError và dọn dẹp channel khi innerStream thất bại', async () => {
    const channel = new WorkspaceSyncChannel();
    const onError = vi.fn(() => 'Mapped stream error');

    const innerStream = new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({ type: 'start', messageId: 'msg-err-1' });
      },
      pull() {
        throw new Error('Upstream failure');
      },
    });

    const mergedStream = pipeWorkspaceSyncIntoUIMessageStream(
      innerStream,
      channel,
      onError,
    );

    const chunks = await readAllChunks(mergedStream);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(chunks.some((c) => c.type === 'start')).toBe(true);
    expect(chunks.some((c) => c.type === 'error' && c.errorText === 'Mapped stream error')).toBe(true);
  });

  it('nên phát transient data-agent-status cho compaction ban đầu và pha synthesizing sau tool finish-step', async () => {
    const channel = new WorkspaceSyncChannel();
    const innerStream = new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({ type: 'start', messageId: 'msg-status-1' });
        controller.enqueue({ type: 'start-step' });
        controller.enqueue({
          type: 'tool-input-available',
          toolCallId: 'tc-1',
          toolName: 'searchDocumentChunks',
          input: { semanticQuery: 'AVL' },
        });
        controller.enqueue({
          type: 'tool-output-available',
          toolCallId: 'tc-1',
          output: { totalChunks: 2 },
        });
        controller.enqueue({ type: 'finish-step' });
        controller.enqueue({ type: 'start-step' });
        controller.enqueue({ type: 'text-start', id: 't1' });
        controller.enqueue({ type: 'text-delta', id: 't1', delta: 'Kết quả...' });
        controller.enqueue({ type: 'text-end', id: 't1' });
        controller.enqueue({ type: 'finish-step' });
        controller.enqueue({ type: 'finish', finishReason: 'stop' });
        controller.close();
      },
    });

    const mergedStream = pipeWorkspaceSyncIntoUIMessageStream(
      innerStream,
      channel,
      undefined,
      {
        initialStatusEvents: [
          {
            phase: 'compacted',
            label: 'Đã tối ưu ngữ cảnh phiên trò chuyện dài',
          },
        ],
        emitStepStatus: true,
      },
    );

    const chunks = await readAllChunks(mergedStream);
    const statusChunks = chunks.filter(
      (c: any) => c.type === AGENT_STATUS_CHUNK_TYPE,
    ) as Array<{ type: string; transient: boolean; data: { phase: string; stepIndex?: number } }>;

    expect(statusChunks).toHaveLength(2);
    expect(statusChunks[0]).toMatchObject({
      type: AGENT_STATUS_CHUNK_TYPE,
      transient: true,
      data: { phase: 'compacted' },
    });
    expect(statusChunks[1]).toMatchObject({
      type: AGENT_STATUS_CHUNK_TYPE,
      transient: true,
      data: { phase: 'synthesizing', stepIndex: 1 },
    });
  });
});
