"use client";

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { deckApi } from '@/services/deck.api';
import type { Deck } from '@/components/conversations/FlashcardTab/types';

export function useDecks(conversationId?: string | null) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const swrKey = conversationId ? `/deck-flashcard/decks?conversationId=${conversationId}` : null;

  const { data: decks = [], error, isLoading, mutate } = useSWR<Deck[]>(
    swrKey,
    () => deckApi.getByConversationId(conversationId!),
    {
      revalidateOnFocus: false,
    }
  );

  const clearError = useCallback(() => setErrorMessage(null), []);

  const createDeck = useCallback(
    async (data: { name: string; description?: string }): Promise<Deck | undefined> => {
      if (!conversationId) return;
      setErrorMessage(null);
      try {
        const created = await deckApi.create({
          name: data.name,
          description: data.description,
          conversationId,
        });
        await mutate([created, ...decks], false);
        return created;
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || 'Không thể tạo bộ thẻ mới';
        setErrorMessage(msg);
        throw err;
      }
    },
    [conversationId, decks, mutate]
  );

  const updateDeck = useCallback(
    async (deckId: string, data: { name?: string; description?: string }): Promise<Deck | undefined> => {
      setErrorMessage(null);
      try {
        const updated = await deckApi.update(deckId, data);
        await mutate(
          decks.map((d) => (d.id === deckId ? { ...d, ...updated } : d)),
          false
        );
        return updated;
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || 'Không thể cập nhật bộ thẻ';
        setErrorMessage(msg);
        throw err;
      }
    },
    [decks, mutate]
  );

  const deleteDeck = useCallback(
    async (deckId: string): Promise<boolean> => {
      setErrorMessage(null);
      try {
        await deckApi.delete(deckId);
        await mutate(
          decks.filter((d) => d.id !== deckId),
          false
        );
        return true;
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || 'Không thể xóa bộ thẻ';
        setErrorMessage(msg);
        throw err;
      }
    },
    [decks, mutate]
  );

  return {
    decks,
    isLoading,
    error: error || errorMessage,
    errorMessage,
    clearError,
    createDeck,
    updateDeck,
    deleteDeck,
    refreshDecks: mutate,
  };
}
