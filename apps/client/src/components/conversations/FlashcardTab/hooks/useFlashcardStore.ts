"use client";

import { useCallback, useState } from "react";
import { DEMO_CARDS, DEMO_DECKS } from "../data/demoData";
import type { CardDraft, Deck, Flashcard } from "../types";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const makeCard = (deckId: string, draft: CardDraft): Flashcard => ({
  id: uid(),
  deckId,
  ...draft,
  status: "new",
  dueInDays: 0,
  intervalDays: 0,
  ease: 2.5,
});

/**
 * Store in-memory cho Deck & Flashcard.
 * Khi có backend: giữ nguyên chữ ký các hàm, thay phần thân bằng gọi API (React Query / SWR…).
 * Truyền ([], []) để xem giao diện Empty State.
 */
export function useFlashcardStore(initialDecks: Deck[] = DEMO_DECKS, initialCards: Flashcard[] = DEMO_CARDS) {
  const [decks, setDecks] = useState(initialDecks);
  const [cards, setCards] = useState(initialCards);

  const createDeck = useCallback((v: { name: string; description: string }) => {
    const deck: Deck = { id: uid(), ...v };
    setDecks((p) => [deck, ...p]);
    return deck;
  }, []);

  const updateDeck = useCallback(
    (id: string, v: { name: string; description: string }) =>
      setDecks((p) => p.map((d) => (d.id === id ? { ...d, ...v } : d))),
    []
  );

  const deleteDeck = useCallback((id: string) => {
    setDecks((p) => p.filter((d) => d.id !== id));
    setCards((p) => p.filter((c) => c.deckId !== id));
  }, []);

  const addCard = useCallback(
    (deckId: string, draft: CardDraft) => setCards((p) => [...p, makeCard(deckId, draft)]),
    []
  );

  const addCards = useCallback(
    (deckId: string, drafts: CardDraft[]) => setCards((p) => [...p, ...drafts.map((d) => makeCard(deckId, d))]),
    []
  );

  const updateCard = useCallback(
    (id: string, patch: Partial<Flashcard>) =>
      setCards((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c))),
    []
  );

  const deleteCard = useCallback((id: string) => setCards((p) => p.filter((c) => c.id !== id)), []);

  return { decks, cards, createDeck, updateDeck, deleteDeck, addCard, addCards, updateCard, deleteCard };
}
