import type { Difficulty, EvaluationStatus, QuestionType } from "./types";
import type { Tone } from "./utils";

export const QUESTION_TYPE_META: Record<QuestionType, { label: string; short: string; hint: string }> = {
  single_choice: { label: "Trắc nghiệm 1 đáp án", short: "Trắc nghiệm", hint: "Chọn 1 đáp án đúng" },
  multiple_choice: { label: "Nhiều đáp án", short: "Nhiều đáp án", hint: "Chọn tất cả đáp án đúng" },
  true_false: { label: "Đúng / Sai", short: "Đúng / Sai", hint: "Chọn Đúng hoặc Sai" },
  short_answer: { label: "Điền từ ngắn", short: "Điền từ", hint: "Nhập từ hoặc cụm từ" },
  essay: { label: "Tự luận", short: "Tự luận", hint: "Viết câu trả lời bằng lời của bạn" },
};

export const QUESTION_TYPES = Object.keys(QUESTION_TYPE_META) as QuestionType[];

export const EVAL_META: Record<EvaluationStatus, { label: string; tone: Tone }> = {
  correct: { label: "Đúng", tone: "success" },
  partial: { label: "Đúng một phần", tone: "warning" },
  incorrect: { label: "Sai", tone: "danger" },
  pending: { label: "Đang chấm", tone: "ai" },
};

export const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "basic", label: "Cơ bản" },
  { value: "applied", label: "Vận dụng" },
  { value: "advanced", label: "Nâng cao" },
];

/** Lớp Tailwind đầy đủ theo tone (viết literal để Tailwind quét được) */
export const TONE: Record<Tone, { text: string; soft: string; border: string; solid: string }> = {
  success: { text: "text-[var(--qz-success)]", soft: "bg-[var(--qz-success-soft)]", border: "border-[var(--qz-success)]", solid: "bg-[var(--qz-success)]" },
  warning: { text: "text-[var(--qz-warning)]", soft: "bg-[var(--qz-warning-soft)]", border: "border-[var(--qz-warning)]", solid: "bg-[var(--qz-warning)]" },
  danger: { text: "text-[var(--qz-danger)]", soft: "bg-[var(--qz-danger-soft)]", border: "border-[var(--qz-danger)]", solid: "bg-[var(--qz-danger)]" },
  ai: { text: "text-[var(--qz-ai)]", soft: "bg-[var(--qz-ai-soft)]", border: "border-[var(--qz-ai)]", solid: "bg-[var(--qz-ai)]" },
  primary: { text: "text-primary", soft: "bg-[var(--qz-primary-soft)]", border: "border-primary", solid: "bg-primary" },
  neutral: { text: "text-[var(--on-surface-variant)]", soft: "bg-[var(--qz-fill)]", border: "border-[var(--border-outline)]", solid: "bg-[var(--on-surface-variant)]" },
};

export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
export const TIME_PRESETS = [10, 15, 20, 30, 45, 60];
