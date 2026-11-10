import { axiosClient } from '@/lib/axios.client';
import type {
  AIGenerateOptions,
  AttemptAnswer,
  AttemptConfig,
  DeckGenerateOptions,
  EvaluationStatus,
  FlashcardTarget,
  Quiz,
  QuizAttempt,
  QuizDraft,
} from '@/components/conversations/QuizTab/types';
import type { QuizApi } from '@/components/conversations/QuizTab/data/quizApi';

function mapQuiz(raw: any): Quiz {
  return {
    id: raw.id,
    conversationId: raw.conversationId,
    title: raw.title,
    description: raw.description ?? null,
    timeLimitSec: raw.timeLimitSec ?? null,
    sourceDeckId: raw.sourceDeckId ?? null,
    sourceDeckName: raw.sourceDeckName ?? null,
    source: raw.source ?? (raw.sourceDeckId ? 'flashcard' : 'manual'),
    questions: Array.isArray(raw.questions)
      ? raw.questions.map((q: any) => ({
          id: q.id,
          quizId: q.quizId,
          type: q.type,
          orderIndex: q.orderIndex,
          text: q.text,
          imageUrl: q.imageUrl ?? null,
          audioUrl: q.audioUrl ?? null,
          points: q.points ?? 1,
          options: Array.isArray(q.options)
            ? q.options.map((o: any) => ({
                id: o.id,
                text: o.text,
                isCorrect: Boolean(o.isCorrect),
              }))
            : null,
          sampleAnswer: q.sampleAnswer ?? null,
          gradingCriteria: Array.isArray(q.gradingCriteria) ? q.gradingCriteria : [],
          explanation: q.explanation ?? null,
        }))
      : [],
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(raw.createdAt).toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(raw.updatedAt).toISOString(),
  };
}

function mapAttempt(raw: any): QuizAttempt {
  const answers: Record<string, AttemptAnswer> = {};

  if (raw.answers && typeof raw.answers === 'object') {
    if (Array.isArray(raw.answers)) {
      for (const a of raw.answers) {
        answers[a.questionId] = {
          questionId: a.questionId,
          selectedOptionIds: Array.isArray(a.selectedOptionIds) ? a.selectedOptionIds : [],
          textAnswer: a.textAnswer ?? '',
          isFlagged: Boolean(a.isFlagged),
          evaluationStatus: a.evaluationStatus ?? 'pending',
          pointsEarned: a.pointsEarned ?? 0,
          matchedPoints: Array.isArray(a.matchedPoints) ? a.matchedPoints : [],
          missingPoints: Array.isArray(a.missingPoints) ? a.missingPoints : [],
          aiFeedback: a.aiFeedback ?? null,
        };
      }
    } else {
      for (const [key, val] of Object.entries<any>(raw.answers)) {
        answers[key] = {
          questionId: val.questionId ?? key,
          selectedOptionIds: Array.isArray(val.selectedOptionIds) ? val.selectedOptionIds : [],
          textAnswer: val.textAnswer ?? '',
          isFlagged: Boolean(val.isFlagged),
          evaluationStatus: val.evaluationStatus ?? 'pending',
          pointsEarned: val.pointsEarned ?? 0,
          matchedPoints: Array.isArray(val.matchedPoints) ? val.matchedPoints : [],
          missingPoints: Array.isArray(val.missingPoints) ? val.missingPoints : [],
          aiFeedback: val.aiFeedback ?? null,
        };
      }
    }
  }

  return {
    id: raw.id,
    quizId: raw.quizId,
    status: raw.status,
    score: raw.score ?? 0,
    maxScore: raw.maxScore ?? 0,
    timeSpentSec: raw.timeSpentSec ?? 0,
    startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : new Date(raw.startedAt).toISOString(),
    completedAt: raw.completedAt
      ? typeof raw.completedAt === 'string'
        ? raw.completedAt
        : new Date(raw.completedAt).toISOString()
      : null,
    answers,
    config: raw.config,
  };
}

function toQuizPayload(draft: QuizDraft) {
  return {
    title: draft.title.trim(),
    description: draft.description?.trim() || null,
    timeLimitSec: draft.timeLimitSec ?? null,
    questions: draft.questions.map((q) => ({
      id: q.id || undefined,
      type: q.type,
      text: q.text,
      imageUrl: q.imageUrl || null,
      audioUrl: q.audioUrl || null,
      points: Number(q.points) > 0 ? Number(q.points) : 1,
      options: q.options || null,
      sampleAnswer: q.sampleAnswer || null,
      gradingCriteria: Array.isArray(q.gradingCriteria) ? q.gradingCriteria : [],
      explanation: q.explanation || null,
    })),
  };
}

export const quizApi: QuizApi = {
  listQuizzes: async (conversationId: string): Promise<Quiz[]> => {
    const res = await axiosClient.get(`/quiz/conversations/${conversationId}/quizzes`);
    return Array.isArray(res.data) ? res.data.map(mapQuiz) : [];
  },

  listAttempts: async (quizId: string): Promise<QuizAttempt[]> => {
    const res = await axiosClient.get(`/quiz/quizzes/${quizId}/attempts`);
    return Array.isArray(res.data) ? res.data.map(mapAttempt) : [];
  },

  createQuiz: async (conversationId: string, draft: QuizDraft): Promise<Quiz> => {
    const res = await axiosClient.post(
      `/quiz/conversations/${conversationId}/quizzes`,
      toQuizPayload(draft)
    );
    return mapQuiz(res.data);
  },

  updateQuiz: async (quizId: string, draft: QuizDraft): Promise<Quiz> => {
    const res = await axiosClient.put(
      `/quiz/quizzes/${quizId}`,
      toQuizPayload(draft)
    );
    return mapQuiz(res.data);
  },

  deleteQuiz: async (quizId: string): Promise<void> => {
    await axiosClient.delete(`/quiz/quizzes/${quizId}`);
  },

  generateWithAI: async (
    conversationId: string,
    opts: AIGenerateOptions
  ): Promise<Quiz> => {
    const res = await axiosClient.post(
      `/quiz/conversations/${conversationId}/quizzes/generate`,
      opts
    );
    return mapQuiz(res.data);
  },

  generateFromDeck: async (
    conversationId: string,
    opts: DeckGenerateOptions
  ): Promise<Quiz> => {
    const res = await axiosClient.post(
      `/quiz/conversations/${conversationId}/quizzes/generate-from-deck`,
      opts
    );
    return mapQuiz(res.data);
  },

  startAttempt: async (quizId: string, config: AttemptConfig): Promise<QuizAttempt> => {
    const res = await axiosClient.post(`/quiz/quizzes/${quizId}/attempts`, { config });
    return mapAttempt(res.data);
  },

  saveAnswer: async (attemptId: string, answer: AttemptAnswer): Promise<void> => {
    await axiosClient.put(`/quiz/attempts/${attemptId}/answers/${answer.questionId}`, {
      questionId: answer.questionId,
      selectedOptionIds: answer.selectedOptionIds,
      textAnswer: answer.textAnswer,
      isFlagged: answer.isFlagged,
    });
  },

  saveProgress: async (attemptId: string, timeSpentSec: number): Promise<void> => {
    await axiosClient.patch(`/quiz/attempts/${attemptId}/progress`, { timeSpentSec });
  },

  submitAttempt: async (
    attemptId: string,
    timeSpentSec: number,
    answers: AttemptAnswer[]
  ): Promise<QuizAttempt> => {
    const res = await axiosClient.post(`/quiz/attempts/${attemptId}/submit`, {
      timeSpentSec,
      answers: answers.map((a) => ({
        questionId: a.questionId,
        selectedOptionIds: a.selectedOptionIds,
        textAnswer: a.textAnswer,
        isFlagged: a.isFlagged,
      })),
    });
    return mapAttempt(res.data);
  },

  overrideEvaluation: async (
    attemptId: string,
    questionId: string,
    status: Exclude<EvaluationStatus, 'pending'>
  ): Promise<QuizAttempt> => {
    const res = await axiosClient.patch(
      `/quiz/attempts/${attemptId}/answers/${questionId}/evaluation`,
      { status }
    );
    return mapAttempt(res.data);
  },

  convertToFlashcards: async (
    attemptId: string,
    questionIds: string[],
    target: FlashcardTarget
  ): Promise<{ deckId: string; created: number }> => {
    const res = await axiosClient.post<{ deckId: string; created: number }>(
      `/quiz/attempts/${attemptId}/convert-to-flashcards`,
      { questionIds, target }
    );
    return res.data;
  },
};
