import type { DeckStats, Flashcard, Rating } from "../types";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function formatInterval(days: number): string {
  if (days <= 0) return "10 phút";
  if (days === 1) return "1 ngày";
  if (days < 30) return `${days} ngày`;
  if (days < 365) return `${Math.round(days / 30)} tháng`;
  return `${(days / 365).toFixed(1)} năm`;
}

/**
 * Hiển thị mốc thời gian xem trước trên 4 nút đánh giá của RatingBar
 * Đồng bộ chính xác theo tham số thuật toán SM-2 Anki của Backend.
 */
export function previewInterval(card: Flashcard, rating: Rating): string {
  const isNewOrLearning = card.status === "new" || card.status === "learning";
  const isRelearning = card.status === "relearning";

  if (isNewOrLearning) {
    switch (rating) {
      case "again":
        return "1 phút";
      case "hard":
        return "1 phút";
      case "good":
        return card.status === "learning" ? "1 ngày" : "10 phút";
      case "easy":
        return "4 ngày";
    }
  }

  if (isRelearning) {
    switch (rating) {
      case "again":
        return "10 phút";
      case "hard":
        return "10 phút";
      case "good":
        return formatInterval(card.intervalDays || 1);
      case "easy":
        return formatInterval((card.intervalDays || 1) + 1);
    }
  }

  // REVIEW (dài hạn)
  const cur = Math.max(1, card.intervalDays || 1);
  const ease = card.ease || 2.5;

  switch (rating) {
    case "again":
      return "10 phút";
    case "hard":
      return formatInterval(Math.max(cur + 1, Math.round(cur * 1.2)));
    case "good":
      return formatInterval(Math.max(cur + 1, Math.round(cur * ease)));
    case "easy":
      return formatInterval(Math.max(cur + 1, Math.round(cur * ease * 1.3)));
  }
}

function nextInterval(card: Flashcard, rating: Rating): number {
  const cur = card.intervalDays || 0;
  switch (rating) {
    case "again":
      return 0;
    case "hard":
      return Math.max(1, Math.round(cur * 1.2));
    case "good":
      return cur < 1 ? 1 : Math.max(cur + 1, Math.round(cur * (card.ease || 2.5)));
    case "easy":
      return cur < 1 ? 4 : Math.max(cur + 2, Math.round(cur * (card.ease || 2.5) * 1.3));
  }
}

/** Cập nhật cục bộ tạm thời cho phiên học (được ghi đè bởi API SM-2 trả về từ server) */
export function applyRating(card: Flashcard, rating: Rating): Flashcard {
  const interval = nextInterval(card, rating);
  const delta = rating === "again" ? -0.2 : rating === "hard" ? -0.05 : rating === "easy" ? 0.15 : 0;
  return {
    ...card,
    intervalDays: interval,
    dueInDays: interval,
    ease: clamp((card.ease || 2.5) + delta, 1.3, 3),
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
    learning: cards.filter((c) => c.status === "learning" || c.status === "relearning").length,
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
