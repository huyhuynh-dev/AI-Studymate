export type CardType = "basic" | "cloze" | "typein";
export type CardStatus = "new" | "learning" | "relearning" | "review";
export type Rating = "again" | "hard" | "good" | "easy";

export interface DeckStats {
  total: number;
  new: number;
  learning: number;
  relearning?: number;
  inProgress?: number;
  review: number;
  dueToday: number;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  conversationId?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  stats?: DeckStats;
}

export interface Flashcard {
  id: string;
  deckId: string;
  type: CardType;
  /** basic: câu hỏi · cloze: câu có {{chỗ trống}} · typein: câu hỏi gợi ý */
  front: string;
  /** basic: đáp án · cloze: ghi chú thêm · typein: đáp án chính xác */
  back: string;
  imageUrl?: string;
  audioUrl?: string;
  status: CardStatus;
  /** Số ngày đến lần ôn tiếp theo (<= 0 nghĩa là đến hạn hôm nay) */
  dueInDays: number;
  intervalDays: number;
  ease: number;
}

export type CardDraft = Pick<Flashcard, "type" | "front" | "back" | "imageUrl" | "audioUrl">;

/** Một tài liệu trong phiên học, dùng cho bộ chọn nguồn của AI */
export interface AiDocument {
  id: string;
  name: string;
  /** Dòng phụ, ví dụ "PDF · 24 trang" */
  meta?: string;
}

export interface AiConfig {
  count: number;
  types: CardType[];
  instructions: string;
  deckName?: string;
  /** "all" = toàn bộ tài liệu của phiên; mảng id = chỉ các tài liệu đã chọn */
  documentIds?: string[] | "all";
}
