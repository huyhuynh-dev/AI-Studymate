export const WORKSPACE_SYNC_CHUNK_TYPE = 'data-workspace-sync' as const;

export type WorkspaceSyncResource = 'summary' | 'flashcard' | 'quiz';

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
