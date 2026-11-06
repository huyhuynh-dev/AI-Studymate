"use client";

import { useRef, useState } from "react";
import type { Flashcard, Rating } from "../types";
import { applyRating } from "../utils/srs";

/**
 * Quản lý hàng đợi một phiên học.
 * - queue chỉ giữ id; nội dung luôn lấy từ `cards` (store) nên sửa thẻ giữa phiên được cập nhật ngay.
 * - Thẻ "Quên" được đưa xuống cuối hàng đợi để học lại trong cùng phiên.
 */
export function useStudySession(
  initialIds: string[],
  cards: Flashcard[],
  persist: (card: Flashcard) => void
) {
  const [queue, setQueue] = useState(initialIds);
  const [total] = useState(initialIds.length);
  const [completed, setCompleted] = useState(0);
  const [answers, setAnswers] = useState(0);
  const [goodAnswers, setGoodAnswers] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef(Date.now());

  const current = queue.length ? cards.find((c) => c.id === queue[0]) ?? null : null;

  const remaining = { new: 0, learning: 0, review: 0 };
  queue.forEach((id) => {
    const c = cards.find((x) => x.id === id);
    if (c) remaining[c.status] += 1;
  });

  const rate = (rating: Rating) => {
    if (!current) return;
    persist(applyRating(current, rating));
    setAnswers((n) => n + 1);
    if (rating === "good" || rating === "easy") setGoodAnswers((n) => n + 1);
    setRevealed(false);
    if (rating === "again") {
      setQueue((q) => [...q.slice(1), q[0]]);
      return;
    }
    setCompleted((n) => n + 1);
    if (queue.length === 1) setSeconds(Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)));
    setQueue((q) => q.slice(1));
  };

  return {
    current,
    revealed,
    reveal: () => setRevealed(true),
    rate,
    finished: queue.length === 0,
    progress: total ? completed / total : 0,
    remaining,
    summary: {
      total,
      goodRate: answers ? Math.round((goodAnswers / answers) * 100) : 0,
      seconds,
    },
  };
}
