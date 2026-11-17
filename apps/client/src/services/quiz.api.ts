import { axiosClient } from '@/lib/axios.client';
import { parseClientSourceRefs } from '@/types';
import type {
  AIGenerateOptions,
  BloomLevel,
  TargetedQuizOptions,
  WeakAreasSummary,
  AttemptAnswer,
  AttemptConfig,
  AttemptStatus,
  DeckGenerateOptions,
  EvaluationStatus,
  FlashcardTarget,
  QuestionType,
  Quiz,
  QuizAttempt,
  QuizDraft,
  QuizSource,
} from '@/components/conversations/QuizTab/types';
import type { QuizApi } from '@/components/conversations/QuizTab/data/quizApi';

interface RawQuizOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

interface RawQuizQuestion {
  id: string;
  quizId: string;
  type: QuestionType;
  orderIndex: number;
  text: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  points?: number;
  options?: RawQuizOption[] | null;
  sampleAnswer?: string | null;
  gradingCriteria?: string[];
  explanation?: string | null;
  bloomLevel?: unknown;
  bloom_level?: unknown;
  sourceRefs?: unknown;
  source_refs?: unknown;
}

const VALID_BLOOM_LEVELS = new Set<BloomLevel>([
  'remember',
  'understand',
  'apply',
  'analyze',
]);

function parseBloomLevel(raw: unknown): BloomLevel | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.toLowerCase().trim() as BloomLevel;
  return VALID_BLOOM_LEVELS.has(normalized) ? normalized : null;
}

interface BackendWeakAreasSummary {
  hasWeakAreas?: boolean;
  has_weak_areas?: boolean;
  weakChunkCount?: number;
  weak_chunk_count?: number;
  incorrectQuizCount?: number;
  incorrect_quiz_count?: number;
  leechCardCount?: number;
  leech_card_count?: number;
  topWeakTopics?: unknown;
  top_weak_topics?: unknown;
  topMissingPoints?: unknown;
  top_missing_points?: unknown;
}

function toStringArray(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === 'string')
    : [];
}

function mapWeakAreasSummary(raw: BackendWeakAreasSummary): WeakAreasSummary {
  return {
    hasWeakAreas: Boolean(raw.hasWeakAreas ?? raw.has_weak_areas ?? false),
    weakChunkCount: Number(raw.weakChunkCount ?? raw.weak_chunk_count ?? 0),
    incorrectQuizCount: Number(raw.incorrectQuizCount ?? raw.incorrect_quiz_count ?? 0),
    leechCardCount: Number(raw.leechCardCount ?? raw.leech_card_count ?? 0),
    topWeakTopics: toStringArray(raw.topWeakTopics ?? raw.top_weak_topics),
    topMissingPoints: toStringArray(raw.topMissingPoints ?? raw.top_missing_points),
  };
}

interface RawQuiz {
  id: string;
  conversationId: string;
  title: string;
  description?: string | null;
  timeLimitSec?: number | null;
  sourceDeckId?: string | null;
  sourceDeckName?: string | null;
  source?: QuizSource;
  questions?: RawQuizQuestion[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface RawAttemptAnswer {
  questionId?: string;
  selectedOptionIds?: string[];
  textAnswer?: string;
  isFlagged?: boolean;
  evaluationStatus?: EvaluationStatus;
  pointsEarned?: number;
  matchedPoints?: string[];
  missingPoints?: string[];
  aiFeedback?: string | null;
}

interface RawQuizAttempt {
  id: string;
  quizId: string;
  status: AttemptStatus;
  score?: number;
  maxScore?: number;
  timeSpentSec?: number;
  startedAt: string | Date;
  completedAt?: string | Date | null;
  answers?: RawAttemptAnswer[] | Record<string, RawAttemptAnswer>;
  config?: AttemptConfig;
}

function mapQuiz(raw: RawQuiz): Quiz {
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
      ? raw.questions.map((q) => ({
          id: q.id,
          quizId: q.quizId,
          type: q.type,
          orderIndex: q.orderIndex,
          text: q.text,
          imageUrl: q.imageUrl ?? null,
          audioUrl: q.audioUrl ?? null,
          points: q.points ?? 1,
          options: Array.isArray(q.options)
            ? q.options.map((o) => ({
                id: o.id,
                text: o.text,
                isCorrect: Boolean(o.isCorrect),
              }))
            : null,
          sampleAnswer: q.sampleAnswer ?? null,
          gradingCriteria: Array.isArray(q.gradingCriteria) ? q.gradingCriteria : [],
          explanation: q.explanation ?? null,
          bloomLevel: parseBloomLevel(q.bloomLevel ?? q.bloom_level),
          sourceRefs: parseClientSourceRefs(q.sourceRefs ?? q.source_refs),
        }))
      : [],
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(raw.createdAt).toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(raw.updatedAt).toISOString(),
  };
}

function mapAttempt(raw: RawQuizAttempt): QuizAttempt {
  const answers: Record<string, AttemptAnswer> = {};

  if (raw.answers && typeof raw.answers === 'object') {
    if (Array.isArray(raw.answers)) {
      for (const a of raw.answers) {
        if (!a.questionId) continue;
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
      for (const [key, val] of Object.entries(raw.answers)) {
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
      bloomLevel: q.bloomLevel ?? null,
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

  getWeakAreasSummary: async (
    conversationId: string
  ): Promise<WeakAreasSummary> => {
    const res = await axiosClient.get<BackendWeakAreasSummary>(
      `/quiz/conversations/${conversationId}/quizzes/weak-summary`
    );
    return mapWeakAreasSummary(res.data);
  },

  generateTargetedQuiz: async (
    conversationId: string,
    opts: TargetedQuizOptions
  ): Promise<Quiz> => {
    const res = await axiosClient.post(
      `/quiz/conversations/${conversationId}/quizzes/generate-targeted-ai`,
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
