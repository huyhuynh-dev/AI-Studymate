export const VALID_CONVERSATION_TABS = [
  'documents',
  'summary',
  'flashcard',
  'quiz',
  'analytics',
] as const;

export type ValidConversationTab = (typeof VALID_CONVERSATION_TABS)[number];

export interface WorkspaceDocumentState {
  readonly docId: string;
  readonly page?: number;
}

export interface WorkspaceLocationState {
  readonly subjectId?: string;
  readonly conversationId?: string;
  readonly tab?: ValidConversationTab;
  readonly document?: WorkspaceDocumentState;
  readonly summaryId?: string;
  readonly deckId?: string;
  readonly quizId?: string;
  readonly chatSessionId?: string;
}

export type ResolvedWorkspaceLocationState =
  | ({ readonly resolution: 'valid' } & WorkspaceLocationState)
  | { readonly resolution: 'invalid' };

export interface WorkspaceLayoutState {
  readonly leftSidebarCollapsed: boolean;
  readonly rightSidebarCollapsed: boolean;
}

export interface WorkspaceStateSnapshot {
  readonly schemaVersion: number;
  readonly location: ResolvedWorkspaceLocationState | null;
  readonly layout: WorkspaceLayoutState | null;
}

export interface UpsertWorkspaceStateDto {
  readonly sourceId: string;
  readonly seq: number;
  readonly location?: WorkspaceLocationState;
  readonly layout?: WorkspaceLayoutState;
}

export interface UpsertWorkspaceStateResponse {
  readonly locationApplied?: boolean;
  readonly layoutApplied?: boolean;
}
