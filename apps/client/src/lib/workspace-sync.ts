"use client";

import { mutate } from 'swr';
import { deckApi } from '@/services/deck.api';
import { documentsApi } from '@/services/documents.api';
import { flashcardApi } from '@/services/flashcard.api';
import { summariesApi } from '@/services/summaries.api';
import { usersApi } from '@/services/users.api';
import {
  WORKSPACE_ACTION_DATA_PART_TYPE,
  WORKSPACE_SYNC_DATA_PART_TYPE,
  createWorkspaceSyncHub,
  parseWorkspaceActionDataPart,
  parseWorkspaceSyncDataPart,
  workspaceSwrKeys,
  type WorkspaceActionEvent,
  type WorkspaceSyncEvent,
  type WorkspaceSyncListener,
  type WorkspaceSyncResource,
} from './workspace-sync.core';

export {
  WORKSPACE_ACTION_DATA_PART_TYPE,
  WORKSPACE_SYNC_DATA_PART_TYPE,
  parseWorkspaceActionDataPart,
  parseWorkspaceSyncDataPart,
  workspaceSwrKeys,
  type WorkspaceActionEvent,
  type WorkspaceSyncEvent,
  type WorkspaceSyncListener,
  type WorkspaceSyncResource,
};

const workspaceSyncHub = createWorkspaceSyncHub({
  mutateKey: (key, updater, options) => mutate(key, updater, options),
  revalidateMatcher: (matcher) => mutate((key) => matcher(key)),
  fetchers: {
    summaries: (conversationId) =>
      summariesApi.getByConversationId(conversationId),
    decks: (conversationId) => deckApi.getByConversationId(conversationId),
    flashcards: (deckId) => flashcardApi.getByDeckId(deckId),
    documents: (conversationId) =>
      documentsApi.getByConversationId(conversationId),
    currentUser: () => usersApi.getMe(),
  },
  createBroadcastChannel: (name) => {
    if (typeof BroadcastChannel === 'undefined') return null;
    const channel = new BroadcastChannel(name);
    return {
      subscribe: (listener) => {
        const handler = (event: MessageEvent<unknown>) => {
          listener(event.data);
        };
        channel.addEventListener('message', handler);
        return () => channel.removeEventListener('message', handler);
      },
      postMessage: (message) => channel.postMessage(message),
      close: () => channel.close(),
    };
  },
});

export function publishWorkspaceSync(
  event: WorkspaceSyncEvent,
  options?: { broadcast?: boolean },
): void {
  workspaceSyncHub.publish(event, options);
}

export function subscribeWorkspaceSync(
  conversationId: string,
  resources: readonly WorkspaceSyncResource[],
  listener: WorkspaceSyncListener,
): () => void {
  return workspaceSyncHub.subscribe(conversationId, resources, listener);
}

export function handleChatStreamDataPart(dataPart: unknown): boolean {
  return workspaceSyncHub.handleChatStreamDataPart(dataPart);
}
