export const WORKSPACE_SYNC_CHUNK_TYPE = 'data-workspace-sync' as const;

export type WorkspaceSyncResource =
  | 'summary'
  | 'flashcard'
  | 'quiz'
  | 'word-document'
  | 'document'
  | 'preferences';

export type WorkspaceSyncAction = 'created' | 'updated' | 'deleted';

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
    }
  | {
      readonly resource: 'document';
      readonly action: WorkspaceSyncAction;
      readonly conversationId: string;
      readonly entityId: string;
      readonly title?: string;
      readonly version?: number;
      readonly occurredAt: string;
    }
  | {
      readonly resource: 'preferences';
      readonly action: WorkspaceSyncAction;
      readonly conversationId: string;
      readonly entityId: string;
      readonly theme?: 'system' | 'light' | 'dark';
      readonly aiResponseLanguage?: 'auto' | 'vi' | 'en';
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
  emitAction?(event: WorkspaceActionEvent): void;
}

export const WORKSPACE_ACTION_CHUNK_TYPE = 'data-workspace-action' as const;

export type WorkspaceActionEvent =
  | {
      readonly type: 'navigate';
      readonly target: {
        readonly page?: 'home' | 'subject' | 'conversation' | 'profile';
        readonly subjectId?: string;
        readonly conversationId?: string;
        readonly tab?: 'documents' | 'summary' | 'flashcard' | 'quiz' | 'analytics';
        readonly resourceType?: 'document' | 'summary' | 'deck' | 'quiz';
        readonly resourceId?: string;
      };
      readonly occurredAt: string;
    }
  | {
      readonly type: 'theme_changed';
      readonly theme: 'system' | 'light' | 'dark';
      readonly occurredAt: string;
    }
  | {
      readonly type: 'job_enqueued';
      readonly jobId: string;
      readonly jobType: string;
      readonly title: string;
      readonly conversationId: string;
      readonly occurredAt: string;
    };

export interface WorkspaceActionChunk {
  readonly type: typeof WORKSPACE_ACTION_CHUNK_TYPE;
  readonly transient: true;
  readonly data: WorkspaceActionEvent;
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
