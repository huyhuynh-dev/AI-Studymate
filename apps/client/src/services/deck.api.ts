import { axiosClient } from '@/lib/axios.client';
import type { Deck } from '@/components/conversations/FlashcardTab/types';

export interface CreateDeckRequest {
  name: string;
  description?: string;
  conversationId: string;
}

export interface UpdateDeckRequest {
  name?: string;
  description?: string;
}

export const deckApi = {
  getByConversationId: async (conversationId: string, search?: string): Promise<Deck[]> => {
    const params = new URLSearchParams();
    if (conversationId) params.append('conversationId', conversationId);
    if (search && search.trim()) params.append('search', search.trim());

    const res = await axiosClient.get(`/deck-flashcard/decks?${params.toString()}`);
    return res.data;
  },

  getById: async (deckId: string): Promise<Deck> => {
    const res = await axiosClient.get(`/deck-flashcard/decks/${deckId}`);
    return res.data;
  },

  create: async (data: CreateDeckRequest): Promise<Deck> => {
    const res = await axiosClient.post('/deck-flashcard/decks', data);
    return res.data;
  },

  update: async (deckId: string, data: UpdateDeckRequest): Promise<Deck> => {
    const res = await axiosClient.put(`/deck-flashcard/decks/${deckId}`, data);
    return res.data;
  },

  delete: async (deckId: string): Promise<{ success: boolean; message: string }> => {
    const res = await axiosClient.delete(`/deck-flashcard/decks/${deckId}`);
    return res.data;
  },
};
