import type { AttemptAnswer, EvaluationStatus, QuizAttempt, QuizQuestion } from "./types";

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export function formatClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${r}` : `${m}:${r}`;
}

export function formatDuration(sec: number) {
  if (sec < 60) return `${Math.round(sec)} giây`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} giờ ${r} phút` : `${h} giờ`;
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

export const isHtmlEmpty = (html?: string | null) => !html || (stripHtml(html) === "" && !/<img/i.test(html));
export const countWords = (html: string) => {
  const t = stripHtml(html);
  return t ? t.split(" ").length : 0;
};

/** Thang điểm 10 (làm tròn 1 chữ số thập phân) */
export const toScale10 = (score: number, max: number) => (max > 0 ? Math.round((score / max) * 100) / 10 : 0);
export const toPct = (score: number, max: number) => (max > 0 ? Math.round((score / max) * 100) : 0);
export const fmtPoints = (n: number) => (Math.round(n * 100) / 100).toString().replace(".", ",");

export type Tone = "success" | "warning" | "danger" | "ai" | "primary" | "neutral";
export const toneForPct = (p: number): Tone => (p >= 80 ? "success" : p >= 50 ? "warning" : "danger");

export function scoreLabel(p: number) {
  if (p >= 90) return "Xuất sắc";
  if (p >= 80) return "Rất tốt";
  if (p >= 65) return "Khá tốt";
  if (p >= 50) return "Cần ôn thêm";
  return "Cần cố gắng thêm";
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const norm = (s: string) =>
  s.normalize("NFC").toLowerCase().replace(/[.,;:!?'"“”‘’()]/g, "").replace(/\s+/g, " ").trim();

export const isAnswered = (q: QuizQuestion, a?: AttemptAnswer) => {
  if (!a) return false;
  if (q.type === "short_answer" || q.type === "essay") return !isHtmlEmpty(a.textAnswer);
  return a.selectedOptionIds.length > 0;
};

/** Chấm các dạng khách quan. Trả về null với câu tự luận (cần AI chấm). */
export function evaluateObjective(
  q: QuizQuestion,
  a?: AttemptAnswer,
): { status: EvaluationStatus; earned: number } | null {
  if (q.type === "essay") return null;
  if (!a || !isAnswered(q, a)) return { status: "incorrect", earned: 0 };

  if (q.type === "short_answer") {
    const accepted = (q.sampleAnswer ?? "").split("|").map(norm).filter(Boolean);
    const ok = accepted.includes(norm(a.textAnswer));
    return ok ? { status: "correct", earned: q.points } : { status: "incorrect", earned: 0 };
  }

  const correct = new Set((q.options ?? []).filter((o) => o.isCorrect).map((o) => o.id));
  const picked = new Set(a.selectedOptionIds);
  const right = [...picked].filter((id) => correct.has(id)).length;
  const wrong = picked.size - right;
  if (wrong === 0 && right === correct.size) return { status: "correct", earned: q.points };
  if (q.type === "multiple_choice") {
    const ratio = Math.max(0, (right - wrong) / Math.max(1, correct.size));
    if (ratio > 0) return { status: "partial", earned: Math.round(q.points * ratio * 100) / 100 };
  }
  return { status: "incorrect", earned: 0 };
}

export function summarizeAttempt(attempt: QuizAttempt, questions: QuizQuestion[]) {
  let correct = 0, partial = 0, incorrect = 0, pending = 0;
  for (const q of questions) {
    const a = attempt.answers[q.id];
    const st = a?.evaluationStatus ?? "incorrect";
    if (st === "correct") correct++;
    else if (st === "partial") partial++;
    else if (st === "pending") pending++;
    else incorrect++;
  }
  return { correct, partial, incorrect, pending, total: questions.length };
}

export const emptyAnswer = (questionId: string): AttemptAnswer => ({
  questionId, selectedOptionIds: [], textAnswer: "", isFlagged: false,
  evaluationStatus: "pending", pointsEarned: 0, matchedPoints: [], missingPoints: [], aiFeedback: null,
});

export const answeredCount = (attempt: QuizAttempt, questions: QuizQuestion[]) =>
  questions.filter((q) => isAnswered(q, attempt.answers[q.id])).length;
