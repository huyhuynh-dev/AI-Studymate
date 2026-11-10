import type { Quiz, QuizAttempt, QuestionType } from "../types";
import { answeredCount, toPct } from "../utils";

export function quizStats(quiz: Quiz, attempts: QuizAttempt[]) {
  const submitted = attempts.filter((a) => a.status === "submitted");
  const inProgress = attempts.find((a) => a.status === "in_progress") ?? null;
  const pcts = submitted.map((a) => toPct(a.score, a.maxScore));
  return {
    questionCount: quiz.questions.length,
    totalPoints: quiz.questions.reduce((s, q) => s + q.points, 0),
    types: [...new Set(quiz.questions.map((q) => q.type))] as QuestionType[],
    attemptCount: submitted.length,
    inProgress,
    inProgressAnswered: inProgress ? answeredCount(inProgress, quiz.questions) : 0,
    inProgressTotal: inProgress?.config?.questionOrder.length ?? quiz.questions.length,
    bestPct: pcts.length ? Math.max(...pcts) : null,
    lastPct: pcts.length ? pcts[0] : null, // attempts đã sắp xếp mới → cũ
    lastAttempt: submitted[0] ?? null,
  };
}

export function typeSummary(types: QuestionType[]) {
  const hasEssay = types.includes("essay");
  const hasObjective = types.some((t) => t !== "essay");
  if (hasEssay && hasObjective) return "Trắc nghiệm + Tự luận";
  if (hasEssay) return "Tự luận";
  return types.length > 1 ? "Nhiều dạng câu" : "Trắc nghiệm";
}
