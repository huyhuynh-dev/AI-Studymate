import {
    AttemptStatusEnum,
    EvaluationStatusEnum,
    QuestionTypeEnum,
} from '../generated/prisma/client.js';

export interface QuizOptionItem {
    id: string;
    text: string;
    isCorrect: boolean;
}

export interface QuizQuestionResponse {
    id: string;
    quizId: string;
    type: QuestionTypeEnum;
    orderIndex: number;
    text: string;
    imageUrl: string | null;
    audioUrl: string | null;
    points: number;
    options: QuizOptionItem[] | null;
    sampleAnswer: string | null;
    gradingCriteria: string[];
    explanation: string | null;
}

export interface QuizResponse {
    id: string;
    conversationId: string;
    title: string;
    description: string | null;
    timeLimitSec: number | null;
    sourceDeckId: string | null;
    sourceDeckName: string | null;
    source: 'ai' | 'flashcard' | 'manual';
    questions: QuizQuestionResponse[];
    createdAt: string;
    updatedAt: string;
}

export interface AttemptAnswerResponse {
    questionId: string;
    selectedOptionIds: string[];
    textAnswer: string;
    isFlagged: boolean;
    evaluationStatus: EvaluationStatusEnum;
    pointsEarned: number;
    matchedPoints: string[];
    missingPoints: string[];
    aiFeedback: string | null;
}

export interface AttemptConfigResponse {
    mode: 'practice' | 'exam';
    timeLimitSec: number | null;
    questionOrder: string[];
    optionOrder: Record<string, string[]>;
}

export interface QuizAttemptResponse {
    id: string;
    quizId: string;
    status: AttemptStatusEnum;
    score: number;
    maxScore: number;
    timeSpentSec: number;
    startedAt: string;
    completedAt: string | null;
    answers: Record<string, AttemptAnswerResponse>;
    config?: AttemptConfigResponse;
}
