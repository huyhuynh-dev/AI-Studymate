import { Prisma } from '../generated/prisma/client.js';
import {
    AttemptAnswerResponse,
    AttemptConfigResponse,
    QuizAttemptResponse,
    QuizOptionItem,
    QuizQuestionResponse,
    QuizResponse,
} from './quiz.types.js';

export const ALLOWED_TAGS = new Set(['p', 'strong', 'em', 'u', 'ul', 'ol', 'li']);
export const ALIGNABLE_TAGS = new Set(['p', 'ul', 'ol', 'li']);

/**
 * Làm sạch HTML từ TipTap của QuizTab:
 * - Chỉ giữ lại các thẻ: p, br, strong, em, u, ul, ol, li
 * - Giữ lại thuộc tính căn lề hợp lệ: style="text-align: left|center|right" trên p, ul, ol, li
 * - Loại bỏ toàn bộ script, style, iframe, object, embed, svg, math
 */
export function sanitizeQuizHtml(raw?: string | null): string {
    if (!raw) return '';

    const withoutDangerousBlocks = raw.replace(
        /<(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\/\1>/gi,
        ''
    );

    return withoutDangerousBlocks
        .replace(
            /<\/?([a-zA-Z0-9-]+)([^>]*)>/g,
            (fullMatch, rawTag: string, attrs: string) => {
                const tag = rawTag.toLowerCase();
                const isClosing = fullMatch.startsWith('</');

                if (tag === 'br') {
                    return isClosing ? '' : '<br>';
                }

                if (ALLOWED_TAGS.has(tag)) {
                    if (isClosing) {
                        return `</${tag}>`;
                    }
                    if (ALIGNABLE_TAGS.has(tag)) {
                        const alignMatch = attrs.match(
                            /text-align\s*:\s*(left|center|right)/i
                        );
                        if (alignMatch) {
                            return `<${tag} style="text-align: ${alignMatch[1].toLowerCase()}">`;
                        }
                    }
                    return `<${tag}>`;
                }

                return '';
            }
        )
        .trim();
}

export function stripHtml(html?: string | null): string {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

export function normalizeShortAnswer(text: string): string {
    return text
        .normalize('NFC')
        .toLowerCase()
        .replace(/[.,;:!?'"“”‘’()]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function parseQuizOptions(raw: Prisma.JsonValue | null): QuizOptionItem[] | null {
    if (!Array.isArray(raw)) return null;
    return raw.map((item: any, idx: number) => ({
        id: typeof item?.id === 'string' ? item.id : String(idx + 1),
        text: typeof item?.text === 'string' ? item.text : '',
        isCorrect: Boolean(item?.isCorrect ?? item?.is_correct),
    }));
}

export function parseGradingCriteria(raw: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((item): item is string => typeof item === 'string')
        .map((s) => s.trim())
        .filter(Boolean);
}

export function parseAttemptConfig(
    raw: Prisma.JsonValue | null,
    fallbackTimeLimitSec: number | null,
    fallbackQuestionIds: string[]
): AttemptConfigResponse {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const obj = raw as Record<string, unknown>;
        const mode = obj.mode === 'practice' ? 'practice' : 'exam';
        const timeLimitSec =
            typeof obj.timeLimitSec === 'number'
                ? obj.timeLimitSec
                : obj.timeLimitSec === null
                  ? null
                  : fallbackTimeLimitSec;
        const questionOrder = Array.isArray(obj.questionOrder)
            ? obj.questionOrder.filter(
                  (id): id is string => typeof id === 'string'
              )
            : fallbackQuestionIds;
        const optionOrder =
            obj.optionOrder &&
            typeof obj.optionOrder === 'object' &&
            !Array.isArray(obj.optionOrder)
                ? (obj.optionOrder as Record<string, string[]>)
                : {};

        return {
            mode,
            timeLimitSec,
            questionOrder:
                questionOrder.length > 0 ? questionOrder : fallbackQuestionIds,
            optionOrder,
        };
    }

    return {
        mode: 'exam',
        timeLimitSec: fallbackTimeLimitSec,
        questionOrder: fallbackQuestionIds,
        optionOrder: {},
    };
}

export function mapQuizToResponse(quiz: any): QuizResponse {
    const sourceValue: 'ai' | 'flashcard' | 'manual' =
        quiz.source === 'ai' || quiz.source === 'flashcard'
            ? quiz.source
            : quiz.source_deck_id
              ? 'flashcard'
              : 'manual';

    return {
        id: quiz.id,
        conversationId: quiz.conversation_id,
        title: quiz.title,
        description: quiz.description ?? null,
        timeLimitSec: quiz.time_limit_sec ?? null,
        sourceDeckId: quiz.source_deck_id ?? null,
        sourceDeckName: quiz.source_deck?.name ?? null,
        source: sourceValue,
        questions: (quiz.questions ?? []).map(
            (q: any): QuizQuestionResponse => ({
                id: q.id,
                quizId: q.quiz_id,
                type: q.question_type,
                orderIndex: q.order_index,
                text: q.question_text,
                imageUrl: q.image_url ?? null,
                audioUrl: q.audio_url ?? null,
                points: q.points,
                options: parseQuizOptions(q.options),
                sampleAnswer: q.sample_answer ?? null,
                gradingCriteria: parseGradingCriteria(q.grading_criteria),
                explanation: q.explanation ?? null,
            })
        ),
        createdAt:
            quiz.created_at instanceof Date
                ? quiz.created_at.toISOString()
                : String(quiz.created_at),
        updatedAt:
            quiz.updated_at instanceof Date
                ? quiz.updated_at.toISOString()
                : String(quiz.updated_at),
    };
}

export function mapAttemptToResponse(attempt: any): QuizAttemptResponse {
    const answersMap: Record<string, AttemptAnswerResponse> = {};
    for (const a of attempt.answers ?? []) {
        answersMap[a.question_id] = {
            questionId: a.question_id,
            selectedOptionIds: Array.isArray(a.selected_option_ids)
                ? (a.selected_option_ids as string[])
                : [],
            textAnswer: a.text_answer ?? '',
            isFlagged: Boolean(a.is_flagged),
            evaluationStatus: a.evaluation_status,
            pointsEarned: a.points_earned ?? 0,
            matchedPoints: parseGradingCriteria(a.matched_points),
            missingPoints: parseGradingCriteria(a.missing_points),
            aiFeedback: a.ai_feedback ?? null,
        };
    }

    const fallbackIds = Object.keys(answersMap);
    const config = parseAttemptConfig(attempt.config, null, fallbackIds);

    return {
        id: attempt.id,
        quizId: attempt.quiz_id,
        status: attempt.status,
        score: attempt.score ?? 0,
        maxScore: attempt.max_score ?? 0,
        timeSpentSec: attempt.time_spent_sec ?? 0,
        startedAt:
            attempt.started_at instanceof Date
                ? attempt.started_at.toISOString()
                : String(attempt.started_at),
        completedAt: attempt.completed_at
            ? attempt.completed_at instanceof Date
                ? attempt.completed_at.toISOString()
                : String(attempt.completed_at)
            : null,
        answers: answersMap,
        config,
    };
}
