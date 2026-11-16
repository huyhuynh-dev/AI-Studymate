import type { BloomLevel, BloomPreset, Difficulty, EvaluationStatus, QuestionType } from "./types";
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

export const BLOOM_LEVELS: readonly BloomLevel[] = [
  "remember",
  "understand",
  "apply",
  "analyze",
] as const;

export const BLOOM_META: Record<
  BloomLevel,
  { label: string; short: string; description: string; tone: Tone }
> = {
  remember: {
    label: "Ghi nhớ (Remember)",
    short: "Ghi nhớ",
    description: "Nhận diện khái niệm, định nghĩa, thuật ngữ cốt lõi",
    tone: "neutral",
  },
  understand: {
    label: "Thông hiểu (Understand)",
    short: "Thông hiểu",
    description: "Giải thích ý nghĩa, so sánh, phân biệt cơ chế",
    tone: "primary",
  },
  apply: {
    label: "Vận dụng (Apply)",
    short: "Vận dụng",
    description: "Áp dụng kiến thức giải quyết tình huống thực tế",
    tone: "warning",
  },
  analyze: {
    label: "Phân tích (Analyze)",
    short: "Phân tích",
    description: "Phân tích nguyên nhân, hệ quả, cấu trúc vấn đề",
    tone: "ai",
  },
};

export const BLOOM_PRESET_OPTIONS: {
  value: BloomPreset;
  label: string;
  description: string;
  weights: Record<BloomLevel, number>;
}[] = [
  {
    value: "familiarize",
    label: "Làm quen kiến thức",
    description: "Ưu tiên Ghi nhớ & Thông hiểu để nắm nền tảng",
    weights: { remember: 40, understand: 35, apply: 20, analyze: 5 },
  },
  {
    value: "balanced",
    label: "Cân bằng toàn diện",
    description: "Phân bổ đều cả 4 cấp độ tư duy Bloom",
    weights: { remember: 25, understand: 30, apply: 30, analyze: 15 },
  },
  {
    value: "exam_prep",
    label: "Ôn thi chuyên sâu",
    description: "Tập trung Vận dụng & Phân tích tình huống nâng cao",
    weights: { remember: 10, understand: 20, apply: 40, analyze: 30 },
  },
  {
    value: "custom",
    label: "Tùy chỉnh tỷ lệ",
    description: "Tự điều chỉnh % cho từng cấp độ Bloom",
    weights: { remember: 25, understand: 25, apply: 25, analyze: 25 },
  },
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
