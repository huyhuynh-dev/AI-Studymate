import { Logger } from '@nestjs/common';
import { createUIMessageStream, type UIMessageChunk } from 'ai';
import {
  WORKSPACE_SYNC_CHUNK_TYPE,
  type WorkspaceSyncChunk,
  type WorkspaceSyncEvent,
  type WorkspaceSyncNotifier,
} from './workspace-sync.types.js';

export type WorkspaceSyncSink = (event: WorkspaceSyncEvent) => void;

/**
 * Kênh đồng bộ theo vòng đời một lượt chat (turn-scoped).
 * Cho phép các domain callback phát sự kiện ngay khi DB commit thành công;
 * tự động đệm FIFO trước khi stream được attach và cách ly lỗi để không
 * ảnh hưởng tới luồng phản hồi chính.
 */
export class WorkspaceSyncChannel implements WorkspaceSyncNotifier {
  private readonly logger = new Logger(WorkspaceSyncChannel.name);
  private sink: WorkspaceSyncSink | null = null;
  private pending: WorkspaceSyncEvent[] = [];
  private closed = false;

  emit(event: WorkspaceSyncEvent): void {
    if (this.closed) {
      return;
    }
    if (this.sink) {
      this.safeDeliver(this.sink, event);
      return;
    }
    this.pending.push(event);
  }

  attach(sink: WorkspaceSyncSink): () => void {
    if (this.closed) {
      return () => undefined;
    }

    this.sink = sink;
    const queued = this.pending;
    this.pending = [];

    for (const event of queued) {
      this.safeDeliver(sink, event);
    }

    return () => {
      if (this.sink === sink) {
        this.sink = null;
      }
    };
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.sink = null;
    this.pending = [];
  }

  private safeDeliver(sink: WorkspaceSyncSink, event: WorkspaceSyncEvent): void {
    try {
      sink(event);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Không thể chuyển tiếp sự kiện workspace-sync (${event.resource}:${event.entityId}): ${reason}`,
      );
    }
  }
}

/**
 * Hợp nhất sự kiện transient `data-workspace-sync` vào UIMessageStream của Vercel AI SDK v6.
 * Đảm bảo chunk `start` (chứa messageId ổn định từ innerStream) luôn đi trước mọi chunk đồng bộ,
 * đồng thời giữ nguyên 100% logic `originalMessages`, `citations` và `onFinish` lưu DB của innerStream.
 */
export function pipeWorkspaceSyncIntoUIMessageStream(
  innerStream: ReadableStream<UIMessageChunk>,
  syncChannel: WorkspaceSyncChannel,
  onError?: (error: unknown) => string,
): ReadableStream<UIMessageChunk> {
  return createUIMessageStream({
    execute: async ({ writer }) => {
      let hasSeenStart = false;
      const pendingBeforeStart: WorkspaceSyncEvent[] = [];

      const writeSyncEvent = (event: WorkspaceSyncEvent): void => {
        const chunk: WorkspaceSyncChunk = {
          type: WORKSPACE_SYNC_CHUNK_TYPE,
          transient: true,
          data: event,
        };
        writer.write(chunk);
      };

      const flushPendingBeforeStart = (): void => {
        if (pendingBeforeStart.length === 0) {
          return;
        }
        const events = pendingBeforeStart.splice(0, pendingBeforeStart.length);
        for (const event of events) {
          writeSyncEvent(event);
        }
      };

      const detach = syncChannel.attach((event) => {
        if (!hasSeenStart) {
          pendingBeforeStart.push(event);
          return;
        }
        writeSyncEvent(event);
      });

      const reader = innerStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          writer.write(value);

          if (!hasSeenStart && value.type === 'start') {
            hasSeenStart = true;
            flushPendingBeforeStart();
          }
        }

        if (!hasSeenStart) {
          hasSeenStart = true;
          flushPendingBeforeStart();
        }
      } finally {
        detach();
        syncChannel.close();
        reader.releaseLock();
      }
    },
    onError,
  });
}
