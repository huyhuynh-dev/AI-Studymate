import type {
  UpsertWorkspaceStateResult,
  WorkspaceLayoutPayload,
  WorkspaceLocationPayload,
} from './domain/workspace-state.types.js';

export const WORKSPACE_STATE_REPOSITORY = Symbol('WORKSPACE_STATE_REPOSITORY');

export interface StoredWorkspaceStateRecord {
  readonly userId: string;
  readonly schemaVersion: number;
  readonly locationJson: unknown;
  readonly locationSourceId: string | null;
  readonly locationSeq: number;
  readonly layoutJson: unknown;
  readonly layoutSourceId: string | null;
  readonly layoutSeq: number;
}

export interface AtomicUpsertInput {
  readonly userId: string;
  readonly schemaVersion: number;
  readonly sourceId: string;
  readonly seq: number;
  readonly location?: WorkspaceLocationPayload;
  readonly layout?: WorkspaceLayoutPayload;
}

export interface ChildEntityRefs {
  readonly docId?: string;
  readonly summaryId?: string;
  readonly deckId?: string;
  readonly quizId?: string;
  readonly chatSessionId?: string;
}

export interface VerifiedChildEntityRefs {
  readonly docValid: boolean;
  readonly summaryValid: boolean;
  readonly deckValid: boolean;
  readonly quizValid: boolean;
  readonly chatSessionValid: boolean;
}

export interface WorkspaceStateRepositoryPort {
  findByUserId(userId: string): Promise<StoredWorkspaceStateRecord | null>;
  upsertGroupsAtomic(
    input: AtomicUpsertInput,
  ): Promise<UpsertWorkspaceStateResult>;
  verifyOwnedSubject(userId: string, subjectId: string): Promise<boolean>;
  findOwnedConversation(
    userId: string,
    conversationId: string,
  ): Promise<{ readonly id: string; readonly subjectId: string } | null>;
  verifyConversationChildren(
    conversationId: string,
    refs: ChildEntityRefs,
  ): Promise<VerifiedChildEntityRefs>;
}
