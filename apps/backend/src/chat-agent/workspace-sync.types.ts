export const WORKSPACE_SYNC_CHUNK_TYPE = 'data-workspace-sync' as const;

export type WorkspaceSyncResource =
  | 'summary'
  | 'flashcard'
  | 'quiz'
  | 'word-document';

export type WorkspaceSyncAction = 'created' | 'updated';

export type WorkspaceSyncEvent =
  | {
      readonly resource: 'summary';
      readonly action: WorkspaceSyncAction;
      readonly conversationId: string;
      readonly entityId: string;
      readonly title?: string;
      readonly occurredAt: string;
    }
  | {
      readonly resource: 'flashcard';
      readonly action: WorkspaceSyncAction;
      readonly conversationId: string;
      readonly entityId: string;
      readonly targetKind: 'new' | 'deck';
      readonly title?: string;
      readonly count?: number;
      readonly occurredAt: string;
    }
  | {
      readonly resource: 'quiz';
      readonly action: WorkspaceSyncAction;
      readonly conversationId: string;
      readonly entityId: string;
      readonly title?: string;
      readonly count?: number;
      readonly occurredAt: string;
    }
  | {
      readonly resource: 'word-document';
      readonly action: WorkspaceSyncAction;
      readonly conversationId: string;
      readonly entityId: string;
      readonly title?: string;
      readonly changeMode?: 'tracked' | 'direct';
      readonly count?: number;
      readonly requiresSnapshotReload?: boolean;
      readonly occurredAt: string;
    };

export type WorkspaceSyncDataTypes = {
  'workspace-sync': WorkspaceSyncEvent;
};

export interface WorkspaceSyncChunk {
  readonly type: typeof WORKSPACE_SYNC_CHUNK_TYPE;
  readonly transient: true;
  readonly data: WorkspaceSyncEvent;
}

export interface WorkspaceSyncNotifier {
  emit(event: WorkspaceSyncEvent): void;
}

export const AGENT_STATUS_CHUNK_TYPE = 'data-agent-status' as const;

export type AgentStatusPhase = 'compacted' | 'tool_running' | 'synthesizing';

export interface AgentStatusEvent {
  readonly phase: AgentStatusPhase;
  readonly label: string;
  readonly toolName?: string;
  readonly stepIndex?: number;
}

export interface AgentStatusChunk {
  readonly type: typeof AGENT_STATUS_CHUNK_TYPE;
  readonly transient: true;
  readonly data: AgentStatusEvent;
}
