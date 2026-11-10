import { Injectable, NotFoundException } from '@nestjs/common';
import {
    AttemptStatusEnum,
    EvaluationStatusEnum,
    Prisma,
    QuestionTypeEnum,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface QuestionCreatePayload {
    id?: string;
    question_type: QuestionTypeEnum;
    order_index: number;
    question_text: string;
    image_url?: string | null;
    audio_url?: string | null;
    points: number;
    options?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    sample_answer?: string | null;
    grading_criteria: Prisma.InputJsonValue;
    explanation?: string | null;
}

export interface GradedAnswerPayload {
    question_id: string;
    selected_option_ids: Prisma.InputJsonValue;
    text_answer: string | null;
    is_flagged: boolean;
    evaluation_status: EvaluationStatusEnum;
    points_earned: number;
    matched_points: Prisma.InputJsonValue;
    missing_points: Prisma.InputJsonValue;
    ai_feedback: string | null;
}

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value?: string | null): value is string {
    return Boolean(value && UUID_REGEX.test(value));
}

@Injectable()
export class QuizRepoService {
    constructor(private readonly prisma: PrismaService) {}

    /* ==========================================================
     * KIỂM TRA QUYỀN SỞ HỮU (OWNERSHIP ASSERTIONS)
     * ========================================================== */

    async assertConversationOwnership(
        conversationId: string,
        userId: string
    ): Promise<void> {
        const conversation = await this.prisma.conversation.findFirst({
            where: {
                id: conversationId,
                user_id: userId,
            },
            select: { id: true },
        });

        if (!conversation) {
            throw new NotFoundException(
                'Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền truy cập'
            );
        }
    }

    async assertQuizOwnership(quizId: string, userId: string) {
        const quiz = await this.prisma.quiz.findFirst({
            where: {
                id: quizId,
                user_id: userId,
            },
            include: {
                questions: {
                    orderBy: { order_index: 'asc' },
                },
                source_deck: {
                    select: { name: true },
                },
            },
        });

        if (!quiz) {
            throw new NotFoundException(
                'Không tìm thấy đề kiểm tra hoặc bạn không có quyền truy cập'
            );
        }

        return quiz;
    }

    async assertAttemptOwnership(attemptId: string, userId: string) {
        const attempt = await this.prisma.quizAttempt.findFirst({
            where: {
                id: attemptId,
                user_id: userId,
            },
            include: {
                answers: true,
                quiz: {
                    include: {
                        questions: {
                            orderBy: { order_index: 'asc' },
                        },
                    },
                },
            },
        });

        if (!attempt) {
            throw new NotFoundException(
                'Không tìm thấy lượt làm bài hoặc bạn không có quyền truy cập'
            );
        }

        return attempt;
    }

    /* ==========================================================
     * NHÓM 1: QUẢN LÝ ĐỀ (QUIZ CRUD)
     * ========================================================== */

    async getQuizzesByConversation(conversationId: string, userId: string) {
        await this.assertConversationOwnership(conversationId, userId);

        return await this.prisma.quiz.findMany({
            where: {
                conversation_id: conversationId,
                user_id: userId,
            },
            orderBy: { created_at: 'desc' },
            include: {
                questions: {
                    orderBy: { order_index: 'asc' },
                },
                source_deck: {
                    select: { name: true },
                },
            },
        });
    }

    async getQuizById(quizId: string, userId: string) {
        return await this.assertQuizOwnership(quizId, userId);
    }

    async createQuizWithQuestions(
        userId: string,
        conversationId: string,
        quizData: {
            title: string;
            description?: string | null;
            time_limit_sec?: number | null;
            source?: string;
            source_deck_id?: string | null;
        },
        questionsData: QuestionCreatePayload[]
    ) {
        await this.assertConversationOwnership(conversationId, userId);

        return await this.prisma.$transaction(async (tx) => {
            const createdQuiz = await tx.quiz.create({
                data: {
                    conversation_id: conversationId,
                    user_id: userId,
                    title: quizData.title,
                    description: quizData.description ?? null,
                    time_limit_sec: quizData.time_limit_sec ?? null,
                    source: quizData.source ?? 'manual',
                    source_deck_id: quizData.source_deck_id ?? null,
                },
            });

            if (questionsData.length > 0) {
                await tx.quizQuestion.createMany({
                    data: questionsData.map((q, index) => ({
                        ...(isValidUuid(q.id) ? { id: q.id } : {}),
                        quiz_id: createdQuiz.id,
                        question_type: q.question_type,
                        order_index: q.order_index ?? index,
                        question_text: q.question_text,
                        image_url: q.image_url ?? null,
                        audio_url: q.audio_url ?? null,
                        points: q.points,
                        options: q.options ?? Prisma.DbNull,
                        sample_answer: q.sample_answer ?? null,
                        grading_criteria: q.grading_criteria ?? [],
                        explanation: q.explanation ?? null,
                    })),
                });
            }

            return await tx.quiz.findUniqueOrThrow({
                where: { id: createdQuiz.id },
                include: {
                    questions: {
                        orderBy: { order_index: 'asc' },
                    },
                    source_deck: {
                        select: { name: true },
                    },
                },
            });
        });
    }

    async updateQuizWithQuestions(
        quizId: string,
        userId: string,
        quizData: {
            title: string;
            description?: string | null;
            time_limit_sec?: number | null;
        },
        questionsData: QuestionCreatePayload[]
    ) {
        const existingQuiz = await this.assertQuizOwnership(quizId, userId);
        const existingIds = new Set(existingQuiz.questions.map((q) => q.id));
        const now = new Date();

        return await this.prisma.$transaction(async (tx) => {
            await tx.quiz.update({
                where: { id: quizId },
                data: {
                    title: quizData.title,
                    description: quizData.description ?? null,
                    time_limit_sec: quizData.time_limit_sec ?? null,
                    updated_at: now,
                },
            });

            const keptQuestionIds: string[] = [];
            for (const q of questionsData) {
                if (isValidUuid(q.id) && existingIds.has(q.id)) {
                    keptQuestionIds.push(q.id);
                }
            }

            const idsToDelete = [...existingIds].filter(
                (id) => !keptQuestionIds.includes(id)
            );
            if (idsToDelete.length > 0) {
                await tx.quizQuestion.deleteMany({
                    where: {
                        quiz_id: quizId,
                        id: { in: idsToDelete },
                    },
                });
            }

            for (let index = 0; index < questionsData.length; index++) {
                const q = questionsData[index];
                const orderIndex = q.order_index ?? index;

                if (isValidUuid(q.id) && existingIds.has(q.id)) {
                    await tx.quizQuestion.update({
                        where: { id: q.id },
                        data: {
                            question_type: q.question_type,
                            order_index: orderIndex,
                            question_text: q.question_text,
                            image_url: q.image_url ?? null,
                            audio_url: q.audio_url ?? null,
                            points: q.points,
                            options: q.options ?? Prisma.DbNull,
                            sample_answer: q.sample_answer ?? null,
                            grading_criteria: q.grading_criteria ?? [],
                            explanation: q.explanation ?? null,
                            updated_at: now,
                        },
                    });
                } else {
                    await tx.quizQuestion.create({
                        data: {
                            ...(isValidUuid(q.id) ? { id: q.id } : {}),
                            quiz_id: quizId,
                            question_type: q.question_type,
                            order_index: orderIndex,
                            question_text: q.question_text,
                            image_url: q.image_url ?? null,
                            audio_url: q.audio_url ?? null,
                            points: q.points,
                            options: q.options ?? Prisma.DbNull,
                            sample_answer: q.sample_answer ?? null,
                            grading_criteria: q.grading_criteria ?? [],
                            explanation: q.explanation ?? null,
                        },
                    });
                }
            }

            return await tx.quiz.findUniqueOrThrow({
                where: { id: quizId },
                include: {
                    questions: {
                        orderBy: { order_index: 'asc' },
                    },
                    source_deck: {
                        select: { name: true },
                    },
                },
            });
        });
    }

    async deleteQuiz(quizId: string, userId: string): Promise<void> {
        await this.assertQuizOwnership(quizId, userId);
        await this.prisma.quiz.delete({
            where: { id: quizId },
        });
    }

    /* ==========================================================
     * NHÓM 2: LÀM BÀI & LƯU NHÁP (ATTEMPT EXECUTION)
     * ========================================================== */

    async getAttemptsByQuizId(quizId: string, userId: string) {
        await this.assertQuizOwnership(quizId, userId);

        return await this.prisma.quizAttempt.findMany({
            where: {
                quiz_id: quizId,
                user_id: userId,
            },
            orderBy: { started_at: 'desc' },
            include: {
                answers: true,
            },
        });
    }

    async getAttemptByIdWithDetails(attemptId: string, userId: string) {
        return await this.assertAttemptOwnership(attemptId, userId);
    }

    async createAttemptWithEmptyAnswers(
        userId: string,
        quizId: string,
        maxScore: number,
        config: Prisma.InputJsonValue,
        questionIds: string[]
    ) {
        return await this.prisma.$transaction(async (tx) => {
            const attempt = await tx.quizAttempt.create({
                data: {
                    quiz_id: quizId,
                    user_id: userId,
                    status: AttemptStatusEnum.in_progress,
                    score: 0,
                    max_score: maxScore,
                    time_spent_sec: 0,
                    config,
                },
            });

            if (questionIds.length > 0) {
                await tx.quizAttemptAnswer.createMany({
                    data: questionIds.map((questionId) => ({
                        attempt_id: attempt.id,
                        question_id: questionId,
                        selected_option_ids: [],
                        text_answer: '',
                        is_flagged: false,
                        evaluation_status: EvaluationStatusEnum.pending,
                        points_earned: 0,
                        matched_points: [],
                        missing_points: [],
                        ai_feedback: null,
                    })),
                });
            }

            return await tx.quizAttempt.findUniqueOrThrow({
                where: { id: attempt.id },
                include: {
                    answers: true,
                },
            });
        });
    }

    async upsertAttemptAnswer(
        attemptId: string,
        questionId: string,
        data: {
            selected_option_ids: Prisma.InputJsonValue;
            text_answer: string | null;
            is_flagged: boolean;
        }
    ) {
        const now = new Date();
        return await this.prisma.quizAttemptAnswer.upsert({
            where: {
                attempt_id_question_id: {
                    attempt_id: attemptId,
                    question_id: questionId,
                },
            },
            create: {
                attempt_id: attemptId,
                question_id: questionId,
                selected_option_ids: data.selected_option_ids,
                text_answer: data.text_answer,
                is_flagged: data.is_flagged,
                evaluation_status: EvaluationStatusEnum.pending,
                points_earned: 0,
                matched_points: [],
                missing_points: [],
                ai_feedback: null,
                answered_at: now,
                updated_at: now,
            },
            update: {
                selected_option_ids: data.selected_option_ids,
                text_answer: data.text_answer,
                is_flagged: data.is_flagged,
                answered_at: now,
                updated_at: now,
            },
        });
    }

    async updateAttemptProgress(attemptId: string, timeSpentSec: number) {
        return await this.prisma.quizAttempt.update({
            where: { id: attemptId },
            data: {
                time_spent_sec: Math.max(0, Math.floor(timeSpentSec)),
            },
        });
    }

    /* ==========================================================
     * NHÓM 3: CHẤM ĐIỂM & NỘP BÀI (GRADING ENGINE)
     * ========================================================== */

    async saveSubmittedAttempt(
        attemptId: string,
        timeSpentSec: number,
        score: number,
        gradedAnswers: GradedAnswerPayload[]
    ) {
        const now = new Date();

        return await this.prisma.$transaction(async (tx) => {
            for (const ans of gradedAnswers) {
                await tx.quizAttemptAnswer.upsert({
                    where: {
                        attempt_id_question_id: {
                            attempt_id: attemptId,
                            question_id: ans.question_id,
                        },
                    },
                    create: {
                        attempt_id: attemptId,
                        question_id: ans.question_id,
                        selected_option_ids: ans.selected_option_ids,
                        text_answer: ans.text_answer,
                        is_flagged: ans.is_flagged,
                        evaluation_status: ans.evaluation_status,
                        points_earned: ans.points_earned,
                        matched_points: ans.matched_points,
                        missing_points: ans.missing_points,
                        ai_feedback: ans.ai_feedback,
                        answered_at: now,
                        updated_at: now,
                    },
                    update: {
                        selected_option_ids: ans.selected_option_ids,
                        text_answer: ans.text_answer,
                        is_flagged: ans.is_flagged,
                        evaluation_status: ans.evaluation_status,
                        points_earned: ans.points_earned,
                        matched_points: ans.matched_points,
                        missing_points: ans.missing_points,
                        ai_feedback: ans.ai_feedback,
                        updated_at: now,
                    },
                });
            }

            return await tx.quizAttempt.update({
                where: { id: attemptId },
                data: {
                    status: AttemptStatusEnum.submitted,
                    score,
                    time_spent_sec: Math.max(0, Math.floor(timeSpentSec)),
                    completed_at: now,
                },
                include: {
                    answers: true,
                },
            });
        });
    }

    async updateAnswerEvaluationAndScore(
        attemptId: string,
        questionId: string,
        status: EvaluationStatusEnum,
        pointsEarned: number
    ) {
        const now = new Date();

        return await this.prisma.$transaction(async (tx) => {
            await tx.quizAttemptAnswer.upsert({
                where: {
                    attempt_id_question_id: {
                        attempt_id: attemptId,
                        question_id: questionId,
                    },
                },
                create: {
                    attempt_id: attemptId,
                    question_id: questionId,
                    selected_option_ids: [],
                    text_answer: '',
                    is_flagged: false,
                    evaluation_status: status,
                    points_earned: pointsEarned,
                    matched_points: [],
                    missing_points: [],
                    ai_feedback: null,
                    answered_at: now,
                    updated_at: now,
                },
                update: {
                    evaluation_status: status,
                    points_earned: pointsEarned,
                    updated_at: now,
                },
            });

            const allAnswers = await tx.quizAttemptAnswer.findMany({
                where: { attempt_id: attemptId },
                select: { points_earned: true },
            });

            const rawScore = allAnswers.reduce(
                (sum, a) => sum + (a.points_earned ?? 0),
                0
            );
            const roundedScore = Math.round(rawScore * 100) / 100;

            return await tx.quizAttempt.update({
                where: { id: attemptId },
                data: {
                    score: roundedScore,
                },
                include: {
                    answers: true,
                },
            });
        });
    }
}
