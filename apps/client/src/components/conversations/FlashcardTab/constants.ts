import type { CardStatus, CardType, Rating } from "./types";

export type Tone = "blue" | "amber" | "green" | "red" | "indigo" | "violet" | "gray";

/** Nền nhạt + chữ đậm cùng tông + viền hairline — hỗ trợ đầy đủ Light & Dark Mode */
export const TONE_SOFT: Record<Tone, string> = {
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-500/20",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20",
  red: "bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-1 ring-inset ring-rose-500/20",
  indigo: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 ring-1 ring-inset ring-indigo-500/20",
  violet: "bg-purple-500/10 text-purple-700 dark:text-purple-400 ring-1 ring-inset ring-purple-500/20",
  gray: "bg-neutral-500/10 text-neutral-700 dark:text-neutral-300 ring-1 ring-inset ring-neutral-500/20",
};

export const TONE_BAR: Record<Tone, string> = {
  blue: "bg-blue-500 dark:bg-blue-400",
  amber: "bg-amber-500 dark:bg-amber-400",
  green: "bg-emerald-500 dark:bg-emerald-400",
  red: "bg-rose-600 dark:bg-rose-500",
  indigo: "bg-indigo-600 dark:bg-indigo-500",
  violet: "bg-purple-600 dark:bg-purple-500",
  gray: "bg-neutral-400 dark:bg-neutral-600",
};

export const TONE_TEXT: Record<Tone, string> = {
  blue: "text-blue-600 dark:text-blue-400",
  amber: "text-amber-600 dark:text-amber-400",
  green: "text-emerald-600 dark:text-emerald-400",
  red: "text-rose-600 dark:text-rose-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  violet: "text-purple-600 dark:text-purple-400",
  gray: "text-neutral-900 dark:text-white",
};

export const CARD_TYPE_LABEL: Record<CardType, string> = {
  basic: "Cơ bản",
  cloze: "Điền khuyết",
  typein: "Gõ đáp án",
};

export const CARD_TYPE_TONE: Record<CardType, Tone> = {
  basic: "indigo",
  cloze: "violet",
  typein: "gray",
};

export const STATUS_META: Record<CardStatus, { label: string; tone: Tone }> = {
  new: { label: "Mới", tone: "blue" },
  learning: { label: "Đang học", tone: "amber" },
  relearning: { label: "Học lại", tone: "red" },
  review: { label: "Ôn tập", tone: "green" },
};

export const RATING_ORDER: Rating[] = ["again", "hard", "good", "easy"];

export const RATING_META: Record<Rating, { label: string; tone: Tone; key: string }> = {
  again: { label: "Quên", tone: "red", key: "1" },
  hard: { label: "Khó", tone: "amber", key: "2" },
  good: { label: "Tốt", tone: "green", key: "3" },
  easy: { label: "Quá dễ", tone: "blue", key: "4" },
};
