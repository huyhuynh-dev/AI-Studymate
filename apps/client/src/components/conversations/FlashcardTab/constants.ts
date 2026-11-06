import type { CardStatus, CardType, Rating } from "./types";

export type Tone = "blue" | "amber" | "green" | "red" | "indigo" | "violet" | "gray";

/** Nền nhạt + chữ đậm cùng tông — dùng cho Pill, nút đánh giá… */
export const TONE_SOFT: Record<Tone, string> = {
  blue: "bg-blue-100/70 text-blue-800",
  amber: "bg-amber-100/70 text-amber-800",
  green: "bg-[#6CF8BB]/30 text-[#005236]",
  red: "bg-[#FFDAD6]/80 text-[#93000A]",
  indigo: "bg-indigo-50 text-indigo-700",
  violet: "bg-[#E9DDFF]/70 text-[#5516BE]",
  gray: "bg-[#EFF4FF] text-[#464555]",
};

export const TONE_BAR: Record<Tone, string> = {
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  red: "bg-[#BA1A1A]",
  indigo: "bg-indigo-500",
  violet: "bg-[#6F3DD9]",
  gray: "bg-[#C7C4D8]",
};

export const TONE_TEXT: Record<Tone, string> = {
  blue: "text-blue-600",
  amber: "text-amber-600",
  green: "text-emerald-600",
  red: "text-[#BA1A1A]",
  indigo: "text-indigo-600",
  violet: "text-[#6F3DD9]",
  gray: "text-[#0B1C30]",
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
  review: { label: "Ôn tập", tone: "green" },
};

export const RATING_ORDER: Rating[] = ["again", "hard", "good", "easy"];

export const RATING_META: Record<Rating, { label: string; tone: Tone; key: string }> = {
  again: { label: "Quên", tone: "red", key: "1" },
  hard: { label: "Khó", tone: "amber", key: "2" },
  good: { label: "Tốt", tone: "green", key: "3" },
  easy: { label: "Quá dễ", tone: "blue", key: "4" },
};
