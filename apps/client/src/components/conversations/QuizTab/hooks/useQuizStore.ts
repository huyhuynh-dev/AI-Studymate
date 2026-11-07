"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AIGenerateOptions, AttemptAnswer, AttemptConfig, DeckGenerateOptions, EvaluationStatus,
  FlashcardTarget, Quiz, QuizAttempt, QuizDraft, TestSetup,
} from "../types";
import type { QuizApi } from "../data/quizApi";
import { shuffle } from "../utils";

/** Quản lý danh sách đề + lượt làm bài, đồng bộ với QuizApi (cập nhật lạc quan, lưu nháp có debounce). */
export function useQuizStore(api: QuizApi, conversationId: string) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<Record<string, QuizAttempt[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = await api.listQuizzes(conversationId);
      const entries = await Promise.all(qs.map(async (q) => [q.id, await api.listAttempts(q.id)] as const));
      setQuizzes(qs);
      setAttempts(Object.fromEntries(entries));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải danh sách bài kiểm tra");
    } finally {
      setLoading(false);
    }
  }, [api, conversationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const putAttempt = useCallback((att: QuizAttempt) => {
    setAttempts((prev) => {
      const list = prev[att.quizId] ?? [];
      const next = list.some((a) => a.id === att.id) ? list.map((a) => (a.id === att.id ? att : a)) : [att, ...list];
      return { ...prev, [att.quizId]: next.sort((x, y) => +new Date(y.startedAt) - +new Date(x.startedAt)) };
    });
  }, []);

  const putQuiz = useCallback((quiz: Quiz) => {
    setQuizzes((prev) => (prev.some((q) => q.id === quiz.id) ? prev.map((q) => (q.id === quiz.id ? quiz : q)) : [quiz, ...prev]));
  }, []);

  const actions = useMemo(() => ({
    reload: load,

    async createQuiz(draft: QuizDraft) { const q = await api.createQuiz(conversationId, draft); putQuiz(q); return q; },
    async updateQuiz(id: string, draft: QuizDraft) { const q = await api.updateQuiz(id, draft); putQuiz(q); return q; },
    async deleteQuiz(id: string) {
      await api.deleteQuiz(id);
      setQuizzes((p) => p.filter((q) => q.id !== id));
      setAttempts((p) => { const n = { ...p }; delete n[id]; return n; });
    },
    async generateWithAI(o: AIGenerateOptions) { const q = await api.generateWithAI(conversationId, o); putQuiz(q); setAttempts((p) => ({ ...p, [q.id]: [] })); return q; },
    async generateFromDeck(o: DeckGenerateOptions) { const q = await api.generateFromDeck(conversationId, o); putQuiz(q); setAttempts((p) => ({ ...p, [q.id]: [] })); return q; },

    async startAttempt(quiz: Quiz, setup: TestSetup) {
      const pool = setup.onlyQuestionIds?.length ? quiz.questions.filter((q) => setup.onlyQuestionIds!.includes(q.id)) : quiz.questions;
      const ids = pool.map((q) => q.id);
      const optionOrder: Record<string, string[]> = {};
      for (const q of pool) {
        if (q.options && (q.type === "single_choice" || q.type === "multiple_choice")) {
          const oids = q.options.map((o) => o.id);
          optionOrder[q.id] = setup.shuffleOptions ? shuffle(oids) : oids;
        }
      }
      const config: AttemptConfig = {
        mode: setup.mode, timeLimitSec: setup.timeLimitSec,
        questionOrder: setup.shuffleQuestions ? shuffle(ids) : ids, optionOrder,
      };
      const att = await api.startAttempt(quiz.id, config);
      putAttempt(att);
      return att;
    },

    /** Cập nhật lạc quan + lưu nháp sau 600ms */
    patchAnswer(att: QuizAttempt, answer: AttemptAnswer) {
      putAttempt({ ...att, answers: { ...att.answers, [answer.questionId]: answer } });
      const key = `${att.id}:${answer.questionId}`;
      clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => { api.saveAnswer(att.id, answer).catch(() => undefined); }, 600);
    },

    async saveProgress(att: QuizAttempt, timeSpentSec: number) {
      putAttempt({ ...att, timeSpentSec });
      await api.saveProgress(att.id, timeSpentSec).catch(() => undefined);
    },

    async submitAttempt(att: QuizAttempt, timeSpentSec: number, hasEssay: boolean) {
      if (hasEssay) putAttempt({ ...att, status: "grading", timeSpentSec });
      const res = await api.submitAttempt(att.id, timeSpentSec, Object.values(att.answers));
      putAttempt(res);
      return res;
    },

    async overrideEvaluation(att: QuizAttempt, questionId: string, status: Exclude<EvaluationStatus, "pending">) {
      const res = await api.overrideEvaluation(att.id, questionId, status);
      putAttempt(res);
    },

    convertToFlashcards(attemptId: string, questionIds: string[], target: FlashcardTarget) {
      return api.convertToFlashcards(attemptId, questionIds, target);
    },
  }), [api, conversationId, load, putAttempt, putQuiz]);

  return { quizzes, attempts, loading, error, ...actions };
}

export type QuizStore = ReturnType<typeof useQuizStore>;
