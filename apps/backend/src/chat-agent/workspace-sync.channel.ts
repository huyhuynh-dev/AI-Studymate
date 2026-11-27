import { Logger } from '@nestjs/common';
import { createUIMessageStream, type UIMessageChunk } from 'ai';
import {
  AGENT_STATUS_CHUNK_TYPE,
  WORKSPACE_ACTION_CHUNK_TYPE,
  WORKSPACE_SYNC_CHUNK_TYPE,
  type AgentStatusChunk,
  type AgentStatusEvent,
  type WorkspaceActionChunk,
  type WorkspaceActionEvent,
  type WorkspaceSyncChunk,
  type WorkspaceSyncEvent,
  type WorkspaceSyncNotifier,
} from './workspace-sync.types.js';

export interface PipeStreamStatusOptions {
  initialStatusEvents?: AgentStatusEvent[];
  emitStepStatus?: boolean;
}

export type WorkspaceSyncSink = (event: WorkspaceSyncEvent) => void;
export type WorkspaceActionSink = (event: WorkspaceActionEvent) => void;

/**
 * Kênh đồng bộ theo vòng đời một lượt chat (turn-scoped).
 * Cho phép các domain callback phát sự kiện đồng bộ dữ liệu (`data-workspace-sync`)
 * và điều khiển giao diện (`data-workspace-action`) ngay khi DB commit thành công.
 */
export class WorkspaceSyncChannel implements WorkspaceSyncNotifier {
  private readonly logger = new Logger(WorkspaceSyncChannel.name);
  private sink: WorkspaceSyncSink | null = null;
  private actionSink: WorkspaceActionSink | null = null;
  private pending: WorkspaceSyncEvent[] = [];
  private pendingActions: WorkspaceActionEvent[] = [];
  private closed = false;

  emit(event: WorkspaceSyncEvent): void {
    if (this.closed) {
      return;
    }
    if (this.sink) {
      this.safeDeliver(this.sink, event, `${event.resource}:${event.entityId}`);
      return;
    }
    this.pending.push(event);
  }

  emitAction(event: WorkspaceActionEvent): void {
    if (this.closed) {
      return;
    }
    if (this.actionSink) {
      this.safeDeliver(this.actionSink, event, `action:${event.type}`);
      return;
    }
    this.pendingActions.push(event);
  }

  attach(
    sink: WorkspaceSyncSink,
    actionSink?: WorkspaceActionSink,
  ): () => void {
    if (this.closed) {
      return () => undefined;
    }

    this.sink = sink;
    this.actionSink = actionSink ?? null;

    const queued = this.pending;
    this.pending = [];
    for (const event of queued) {
      this.safeDeliver(sink, event, `${event.resource}:${event.entityId}`);
    }

    if (this.actionSink && this.pendingActions.length > 0) {
      const queuedActions = this.pendingActions;
      this.pendingActions = [];
      for (const action of queuedActions) {
        this.safeDeliver(this.actionSink, action, `action:${action.type}`);
      }
    }

    return () => {
      if (this.sink === sink) {
        this.sink = null;
      }
      if (actionSink && this.actionSink === actionSink) {
        this.actionSink = null;
      }
    };
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.sink = null;
    this.actionSink = null;
    this.pending = [];
    this.pendingActions = [];
  }

  private safeDeliver<T>(
    sink: (payload: T) => void,
    payload: T,
    label: string,
  ): void {
    try {
      sink(payload);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Không thể chuyển tiếp sự kiện (${label}): ${reason}`,
      );
    }
  }
}

/**
 * Hợp nhất sự kiện transient `data-workspace-sync`, `data-workspace-action`, và `data-agent-status`
 * vào UIMessageStream của Vercel AI SDK v6.
 */
export function pipeWorkspaceSyncIntoUIMessageStream(
  innerStream: ReadableStream<UIMessageChunk>,
  syncChannel: WorkspaceSyncChannel,
  onError?: (error: unknown) => string,
  statusOptions?: PipeStreamStatusOptions,
): ReadableStream<UIMessageChunk> {
  return createUIMessageStream({
    execute: async ({ writer }) => {
      let hasSeenStart = false;
      const pendingBeforeStart: WorkspaceSyncEvent[] = [];
      const pendingActionsBeforeStart: WorkspaceActionEvent[] = [];
      const emitStepStatus = statusOptions?.emitStepStatus !== false;
      let stepIndex = 0;
      let stepHadTool = false;

      const writeSyncEvent = (event: WorkspaceSyncEvent): void => {
        const chunk: WorkspaceSyncChunk = {
          type: WORKSPACE_SYNC_CHUNK_TYPE,
          transient: true,
          data: event,
        };
        writer.write(chunk);
      };

      const writeActionEvent = (event: WorkspaceActionEvent): void => {
        const chunk: WorkspaceActionChunk = {
          type: WORKSPACE_ACTION_CHUNK_TYPE,
          transient: true,
          data: event,
        };
        writer.write(chunk as unknown as UIMessageChunk);
      };

      const writeStatusEvent = (event: AgentStatusEvent): void => {
        const chunk: AgentStatusChunk = {
          type: AGENT_STATUS_CHUNK_TYPE,
          transient: true,
          data: event,
        };
        writer.write(chunk as unknown as UIMessageChunk);
      };

      const flushPendingBeforeStart = (): void => {
        if (pendingBeforeStart.length > 0) {
          const events = pendingBeforeStart.splice(0, pendingBeforeStart.length);
          for (const event of events) {
            writeSyncEvent(event);
          }
        }
        if (pendingActionsBeforeStart.length > 0) {
          const actions = pendingActionsBeforeStart.splice(
            0,
            pendingActionsBeforeStart.length,
          );
          for (const action of actions) {
            writeActionEvent(action);
          }
        }
        if (
          Array.isArray(statusOptions?.initialStatusEvents) &&
          statusOptions.initialStatusEvents.length > 0
        ) {
          for (const statusEvent of statusOptions.initialStatusEvents) {
            writeStatusEvent(statusEvent);
          }
        }
      };

      const detach = syncChannel.attach(
        (event) => {
          if (!hasSeenStart) {
            pendingBeforeStart.push(event);
            return;
          }
          writeSyncEvent(event);
        },
        (action) => {
          if (!hasSeenStart) {
            pendingActionsBeforeStart.push(action);
            return;
          }
          writeActionEvent(action);
        },
      );

      const reader = innerStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          if (value.type === 'start-step') {
            stepIndex += 1;
            stepHadTool = false;
          } else if (
            value.type === 'tool-input-start' ||
            value.type === 'tool-input-available' ||
            value.type === 'tool-output-available' ||
            value.type === 'tool-approval-request'
          ) {
            stepHadTool = true;
          }

          writer.write(value);

          if (!hasSeenStart && value.type === 'start') {
            hasSeenStart = true;
            flushPendingBeforeStart();
          } else if (
            value.type === 'finish-step' &&
            emitStepStatus &&
            stepHadTool
          ) {
            writeStatusEvent({
              phase: 'synthesizing',
              stepIndex,
              label: 'Đang tổng hợp kết quả và viết câu trả lời…',
            });
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
