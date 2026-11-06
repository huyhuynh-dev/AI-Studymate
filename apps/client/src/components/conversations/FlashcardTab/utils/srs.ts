import type { DeckStats, Flashcard, Rating } from "../types";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function formatInterval(days: number): string {
  if (days <= 0) return "10 phút";
  if (days < 30) return `${days} ngày`;
  if (days < 365) return `${Math.round(days / 30)} tháng`;
  return `${(days / 365).toFixed(1)} năm`;
}

function nextInterval(card: Flashcard, rating: Rating): number {
  const cur = card.intervalDays;
  switch (rating) {
    case "again":
      return 0;
    case "hard":
      return Math.max(1, Math.round(cur * 1.2));
    case "good":
      return cur < 1 ? 1 : Math.max(cur + 1, Math.round(cur * card.ease));
    case "easy":
      return cur < 1 ? 4 : Math.max(cur + 2, Math.round(cur * card.ease * 1.3));
  }
}

export const previewInterval = (card: Flashcard, rating: Rating) =>
  formatInterval(nextInterval(card, rating));

/** Thuật toán SRS đơn giản (mock) — thay bằng kết quả từ API khi tích hợp backend */
export function applyRating(card: Flashcard, rating: Rating): Flashcard {
  const interval = nextInterval(card, rating);
  const delta = rating === "again" ? -0.2 : rating === "hard" ? -0.05 : rating === "easy" ? 0.15 : 0;
  return {
    ...card,
    intervalDays: interval,
    dueInDays: interval,
    ease: clamp(card.ease + delta, 1.3, 3),
    status: rating === "good" || rating === "easy" ? "review" : "learning",
  };
}

export function dueLabel(card: Flashcard): string {
  if (card.dueInDays <= 0) return "Hôm nay";
  if (card.dueInDays === 1) return "Ngày mai";
  return `Sau ${card.dueInDays} ngày`;
}

export function getDeckStats(cards: Flashcard[]): DeckStats {
  return {
    total: cards.length,
    new: cards.filter((c) => c.status === "new").length,
    learning: cards.filter((c) => c.status === "learning").length,
    review: cards.filter((c) => c.status === "review").length,
    dueToday: cards.filter((c) => c.dueInDays <= 0).length,
  };
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} giây`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} phút ${s} giây` : `${m} phút`;
}
