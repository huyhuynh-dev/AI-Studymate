import { axiosClient } from '@/lib/axios.client';
import { splitClozeHtml } from '@/components/conversations/FlashcardTab/richtext';
import type { CardDraft, Flashcard, Rating } from '@/components/conversations/FlashcardTab/types';

export function mapBackendToClientCard(b: any): Flashcard {
  const dueDate = new Date(b.due_date);
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const dueInDays = b.state === 'new' ? 0 : Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return {
    id: b.id,
    deckId: b.deck_id,
    type: b.card_type === 'type_in' ? 'typein' : b.card_type,
    front: b.front_text,
    back: b.back_text,
    imageUrl: b.image_url || undefined,
    audioUrl: b.audio_url || undefined,
    status: b.state,
    dueInDays,
    intervalDays: b.interval,
    ease: b.ease_factor,
  };
}

/**
 * Tách một câu Cloze có nhiều chỗ trống thành các câu độc lập (Cách 2 - Anki c1, c2):
 * Mỗi câu con chỉ che đúng 1 chỗ trống, các chỗ trống khác hiển thị bình thường.
 * Hỗ trợ cả HTML RichText (<span data-cloze="true">...</span>) và cú pháp cũ ({{...}}).
 */
export function splitMultiCloze(front: string): string[] {
  return splitClozeHtml(front);
}

export const flashcardApi = {
  getByDeckId: async (deckId: string): Promise<Flashcard[]> => {
    const res = await axiosClient.get(`/deck-flashcard/decks/${deckId}/flashcards`);
    return Array.isArray(res.data) ? res.data.map(mapBackendToClientCard) : [];
  },

  getById: async (id: string): Promise<Flashcard> => {
    const res = await axiosClient.get(`/deck-flashcard/flashcards/${id}`);
    return mapBackendToClientCard(res.data);
  },

  create: async (data: CardDraft & { deckId: string }): Promise<Flashcard[]> => {
    // Nếu là cloze có nhiều chỗ trống -> Tách thành nhiều thẻ độc lập
    if (data.type === 'cloze') {
      const fronts = splitMultiCloze(data.front);
      const createdCards: Flashcard[] = [];
      for (const frontText of fronts) {
        const payload = {
          deckId: data.deckId,
          frontText,
          backText: data.back?.trim() || '',
          cardType: 'cloze',
          imageUrl: data.imageUrl,
          audioUrl: data.audioUrl,
        };
        const res = await axiosClient.post('/deck-flashcard/flashcards', payload);
        createdCards.push(mapBackendToClientCard(res.data));
      }
      return createdCards;
    }

    const payload = {
      deckId: data.deckId,
      frontText: data.front,
      backText: data.back?.trim() || '',
      cardType: data.type === 'typein' ? 'type_in' : data.type,
      imageUrl: data.imageUrl,
      audioUrl: data.audioUrl,
    };
    const res = await axiosClient.post('/deck-flashcard/flashcards', payload);
    return [mapBackendToClientCard(res.data)];
  },

  update: async (id: string, data: Partial<CardDraft>): Promise<Flashcard> => {
    const payload: any = {};
    if (data.front !== undefined) payload.frontText = data.front;
    if (data.back !== undefined) payload.backText = data.back;
    if (data.type !== undefined) payload.cardType = data.type === 'typein' ? 'type_in' : data.type;
    if (data.imageUrl !== undefined) payload.imageUrl = data.imageUrl;
    if (data.audioUrl !== undefined) payload.audioUrl = data.audioUrl;

    const res = await axiosClient.put(`/deck-flashcard/flashcards/${id}`, payload);
    return mapBackendToClientCard(res.data);
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await axiosClient.delete(`/deck-flashcard/flashcards/${id}`);
    return res.data;
  },

  review: async (id: string, rating: Rating): Promise<Flashcard> => {
    const res = await axiosClient.post(`/deck-flashcard/flashcards/${id}/review`, { rating });
    return mapBackendToClientCard(res.data);
  },
};
