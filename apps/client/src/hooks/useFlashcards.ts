"use client";

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { flashcardApi } from '@/services/flashcard.api';
import type { CardDraft, Flashcard, Rating } from '@/components/conversations/FlashcardTab/types';

export function useFlashcards(deckId?: string | null) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const swrKey = deckId ? `/deck-flashcard/decks/${deckId}/flashcards` : null;

  const { data: cards = [], error, isLoading, mutate } = useSWR<Flashcard[]>(
    swrKey,
    () => flashcardApi.getByDeckId(deckId!),
    {
      revalidateOnFocus: false,
    }
  );

  const clearError = useCallback(() => setErrorMessage(null), []);

  const createCard = useCallback(
    async (draft: CardDraft): Promise<Flashcard[]> => {
      if (!deckId) return [];
      setErrorMessage(null);
      try {
        const createdList = await flashcardApi.create({ ...draft, deckId });
        await mutate([...createdList, ...cards], false);
        return createdList;
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || 'Không thể tạo thẻ ghi nhớ';
        setErrorMessage(msg);
        throw err;
      }
    },
    [deckId, cards, mutate]
  );

  const createCards = useCallback(
    async (drafts: CardDraft[]): Promise<Flashcard[]> => {
      if (!deckId || drafts.length === 0) return [];
      setErrorMessage(null);
      try {
        const allCreated: Flashcard[] = [];
        for (const draft of drafts) {
          const list = await flashcardApi.create({ ...draft, deckId });
          allCreated.push(...list);
        }
        await mutate([...allCreated, ...cards], false);
        return allCreated;
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || 'Không thể tạo danh sách thẻ';
        setErrorMessage(msg);
        throw err;
      }
    },
    [deckId, cards, mutate]
  );

  const updateCard = useCallback(
    async (id: string, patch: Partial<CardDraft>): Promise<Flashcard | undefined> => {
      setErrorMessage(null);
      try {
        const updated = await flashcardApi.update(id, patch);
        await mutate(
          cards.map((c) => (c.id === id ? { ...c, ...updated } : c)),
          false
        );
        return updated;
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || 'Không thể cập nhật thẻ';
        setErrorMessage(msg);
        throw err;
      }
    },
    [cards, mutate]
  );

  const deleteCard = useCallback(
    async (id: string): Promise<boolean> => {
      setErrorMessage(null);
      try {
        await flashcardApi.delete(id);
        await mutate(
          cards.filter((c) => c.id !== id),
          false
        );
        return true;
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || 'Không thể xóa thẻ';
        setErrorMessage(msg);
        throw err;
      }
    },
    [cards, mutate]
  );

  const reviewCard = useCallback(
    async (id: string, rating: Rating): Promise<Flashcard | undefined> => {
      setErrorMessage(null);
      try {
        const updated = await flashcardApi.review(id, rating);
        await mutate(
          cards.map((c) => (c.id === id ? { ...c, ...updated } : c)),
          false
        );
        return updated;
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || 'Không thể lưu kết quả ôn tập';
        setErrorMessage(msg);
        throw err;
      }
    },
    [cards, mutate]
  );

  return {
    cards,
    isLoading,
    error: error || errorMessage,
    errorMessage,
    clearError,
    createCard,
    createCards,
    updateCard,
    deleteCard,
    reviewCard,
    refreshCards: mutate,
  };
}
