import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    AttemptStatusEnum,
    EvaluationStatusEnum,
    Prisma,
    QuestionTypeEnum,
} from '../generated/prisma/client.js';
import { QuizAiService } from '../ai/quiz-ai.service.js';
import {
    GradedAnswerPayload,
    QuizRepoService,
} from '../repo/quiz-repo/quiz-repo.service.js';
import {
    OverrideEvaluationDto,
    SubmitAttemptDto,
} from './dto/quiz.dto.js';
import {
    mapAttemptToResponse,
    normalizeShortAnswer,
    parseAttemptConfig,
    parseGradingCriteria,
    parseQuizOptions,
    sanitizeQuizHtml,
    stripHtml,
} from './quiz.helper.js';
import { QuizAttemptResponse } from './quiz.types.js';

@Injectable()
export class QuizGradingService {
    constructor(
        private readonly quizRepo: QuizRepoService,
        private readonly quizAiService: QuizAiService
    ) {}

    /* ==========================================================
     * NHÓM 3: CHẤM ĐIỂM & NỘP BÀI (GRADING ENGINE)
     * ========================================================== */

    async submitAttempt(
        userId: string,
        attemptId: string,
        dto: SubmitAttemptDto
    ): Promise<QuizAttemptResponse> {
        const attempt = await this.quizRepo.getAttemptByIdWithDetails(
            attemptId,
            userId
        );

        if (attempt.status === AttemptStatusEnum.submitted) {
            return mapAttemptToResponse(attempt);
        }

        const existingAnswersMap = new Map<
            string,
            {
                selectedOptionIds: string[];
                textAnswer: string;
                isFlagged: boolean;
            }
        >();

        for (const ans of attempt.answers) {
            existingAnswersMap.set(ans.question_id, {
                selectedOptionIds: Array.isArray(ans.selected_option_ids)
                    ? (ans.selected_option_ids as string[])
                    : [],
                textAnswer: ans.text_answer ?? '',
                isFlagged: ans.is_flagged,
            });
        }

        if (Array.isArray(dto.answers)) {
            for (const incoming of dto.answers) {
                if (!incoming.questionId) continue;
                existingAnswersMap.set(incoming.questionId, {
                    selectedOptionIds: Array.isArray(incoming.selectedOptionIds)
                        ? incoming.selectedOptionIds
                        : [],
                    textAnswer: incoming.textAnswer ?? '',
                    isFlagged: Boolean(incoming.isFlagged),
                });
            }
        }

        const config = parseAttemptConfig(
            attempt.config,
            attempt.quiz.time_limit_sec,
            attempt.quiz.questions.map((q) => q.id)
        );
        const activeQuestionIds = new Set(config.questionOrder);
        const activeQuestions = attempt.quiz.questions.filter((q) =>
            activeQuestionIds.has(q.id)
        );

        const gradedAnswers: GradedAnswerPayload[] = await Promise.all(
            activeQuestions.map(async (q) => {
                const rawAns = existingAnswersMap.get(q.id) ?? {
                    selectedOptionIds: [],
                    textAnswer: '',
                    isFlagged: false,
                };

                const sanitizedTextAnswer =
                    q.question_type === QuestionTypeEnum.essay
                        ? sanitizeQuizHtml(rawAns.textAnswer)
                        : rawAns.textAnswer.trim();

                if (q.question_type === QuestionTypeEnum.essay) {
                    const essayResult =
                        await this.quizAiService.gradeEssayQuestion(
                            {
                                questionText: q.question_text,
                                points: q.points,
                                sampleAnswer: q.sample_answer,
                                gradingCriteria: parseGradingCriteria(
                                    q.grading_criteria
                                ),
                            },
                            sanitizedTextAnswer
                        );
                    return {
                        question_id: q.id,
                        selected_option_ids: [],
                        text_answer: sanitizedTextAnswer,
                        is_flagged: rawAns.isFlagged,
                        evaluation_status: essayResult.evaluationStatus,
                        points_earned: essayResult.pointsEarned,
                        matched_points: essayResult.matchedPoints,
                        missing_points: essayResult.missingPoints,
                        ai_feedback: essayResult.aiFeedback,
                    };
                }

                const objectiveResult = this.evaluateObjectiveQuestion(q, {
                    selectedOptionIds: rawAns.selectedOptionIds,
                    textAnswer: sanitizedTextAnswer,
                });

                return {
                    question_id: q.id,
                    selected_option_ids: rawAns.selectedOptionIds,
                    text_answer: sanitizedTextAnswer,
                    is_flagged: rawAns.isFlagged,
                    evaluation_status: objectiveResult.status,
                    points_earned: objectiveResult.earned,
                    matched_points: [],
                    missing_points: [],
                    ai_feedback: null,
                };
            })
        );

        const totalScore =
            Math.round(
                gradedAnswers.reduce((sum, a) => sum + a.points_earned, 0) * 100
            ) / 100;

        const submitted = await this.quizRepo.saveSubmittedAttempt(
            attemptId,
            dto.timeSpentSec,
            totalScore,
            gradedAnswers
        );

        return mapAttemptToResponse(submitted);
    }

    async overrideEvaluation(
        userId: string,
        attemptId: string,
        questionId: string,
        dto: OverrideEvaluationDto
    ): Promise<QuizAttemptResponse> {
        const attempt = await this.quizRepo.getAttemptByIdWithDetails(
            attemptId,
            userId
        );

        const question = attempt.quiz.questions.find(
            (q) => q.id === questionId
        );
        if (!question) {
            throw new NotFoundException(
                'Không tìm thấy câu hỏi trong đề kiểm tra này'
            );
        }

        const statusMap: Record<
            OverrideEvaluationDto['status'],
            EvaluationStatusEnum
        > = {
            correct: EvaluationStatusEnum.correct,
            partial: EvaluationStatusEnum.partial,
            incorrect: EvaluationStatusEnum.incorrect,
        };

        const targetStatus = statusMap[dto.status];
        const pointsEarned =
            targetStatus === EvaluationStatusEnum.correct
                ? question.points
                : targetStatus === EvaluationStatusEnum.partial
                  ? Math.round((question.points / 2) * 100) / 100
                  : 0;

        const updatedAttempt =
            await this.quizRepo.updateAnswerEvaluationAndScore(
                attemptId,
                questionId,
                targetStatus,
                pointsEarned
            );

        return mapAttemptToResponse(updatedAttempt);
    }

    /* ==========================================================
     * LOGIC CHẤM ĐIỂM KHÁCH QUAN & TỰ LUẬN (LLM)
     * ========================================================== */

    evaluateObjectiveQuestion(
        question: {
            question_type: QuestionTypeEnum;
            points: number;
            options: Prisma.JsonValue | null;
            sample_answer: string | null;
        },
        answer: {
            selectedOptionIds: string[];
            textAnswer: string;
        }
    ): { status: EvaluationStatusEnum; earned: number } {
        if (question.question_type === QuestionTypeEnum.short_answer) {
            const plain = stripHtml(answer.textAnswer);
            if (!plain) {
                return { status: EvaluationStatusEnum.incorrect, earned: 0 };
            }
            const accepted = (question.sample_answer ?? '')
                .split('|')
                .map(normalizeShortAnswer)
                .filter(Boolean);
            const isMatch = accepted.includes(normalizeShortAnswer(plain));
            return isMatch
                ? {
                      status: EvaluationStatusEnum.correct,
                      earned: question.points,
                  }
                : { status: EvaluationStatusEnum.incorrect, earned: 0 };
        }

        const picked = new Set(answer.selectedOptionIds ?? []);
        if (picked.size === 0) {
            return { status: EvaluationStatusEnum.incorrect, earned: 0 };
        }

        const options = parseQuizOptions(question.options) ?? [];
        const correctIds = new Set(
            options.filter((o) => o.isCorrect).map((o) => o.id)
        );

        const rightCount = [...picked].filter((id) =>
            correctIds.has(id)
        ).length;
        const wrongCount = picked.size - rightCount;

        if (wrongCount === 0 && rightCount === correctIds.size && correctIds.size > 0) {
            return {
                status: EvaluationStatusEnum.correct,
                earned: question.points,
            };
        }

        if (question.question_type === QuestionTypeEnum.multiple_choice) {
            const ratio = Math.max(
                0,
                (rightCount - wrongCount) / Math.max(1, correctIds.size)
            );
            if (ratio > 0) {
                return {
                    status: EvaluationStatusEnum.partial,
                    earned: Math.round(question.points * ratio * 100) / 100,
                };
            }
        }

        return { status: EvaluationStatusEnum.incorrect, earned: 0 };
    }
}
