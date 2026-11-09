import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import {
    AttemptStatusEnum,
    EvaluationStatusEnum,
    Prisma,
    QuestionTypeEnum,
} from '../generated/prisma/client.js';
import { AiService } from '../ai/ai.service.js';
import {
    GradedAnswerPayload,
    QuestionCreatePayload,
    QuizRepoService,
} from '../repo/quiz-repo/quiz-repo.service.js';
import {
    CreateQuizDto,
    OverrideEvaluationDto,
    QuestionDraftDto,
    SaveAnswerDto,
    SaveProgressDto,
    StartAttemptDto,
    SubmitAttemptDto,
    UpdateQuizDto,
} from './dto/quiz.dto.js';

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

const ALLOWED_TAGS = new Set(['p', 'strong', 'em', 'u', 'ul', 'ol', 'li']);
const ALIGNABLE_TAGS = new Set(['p', 'ul', 'ol', 'li']);

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

interface EssayGradingOutput {
    evaluationStatus: 'correct' | 'partial' | 'incorrect';
    pointsEarned: number;
    matchedPoints: string[];
    missingPoints: string[];
    aiFeedback: string;
}

const essayGradingSchema = z.object({
    evaluationStatus: z.enum(['correct', 'partial', 'incorrect']),
    pointsEarned: z.number(),
    matchedPoints: z.array(z.string()),
    missingPoints: z.array(z.string()),
    aiFeedback: z.string(),
});

@Injectable()
export class QuizService {
    private readonly logger = new Logger(QuizService.name);

    constructor(
        private readonly quizRepo: QuizRepoService,
        private readonly aiService: AiService
    ) {}

    /* ==========================================================
     * NHÓM 1: QUẢN LÝ ĐỀ (QUIZ CRUD)
     * ========================================================== */

    async listQuizzes(
        userId: string,
        conversationId: string
    ): Promise<QuizResponse[]> {
        const quizzes = await this.quizRepo.getQuizzesByConversation(
            conversationId,
            userId
        );
        return quizzes.map((q) => this.mapQuizToResponse(q));
    }

    async getQuizById(userId: string, quizId: string): Promise<QuizResponse> {
        const quiz = await this.quizRepo.getQuizById(quizId, userId);
        return this.mapQuizToResponse(quiz);
    }

    async createQuiz(
        userId: string,
        conversationId: string,
        dto: CreateQuizDto
    ): Promise<QuizResponse> {
        const questionsPayload = this.validateAndBuildQuestions(dto.questions);

        const created = await this.quizRepo.createQuizWithQuestions(
            userId,
            conversationId,
            {
                title: dto.title.trim(),
                description: dto.description?.trim() || null,
                time_limit_sec: dto.timeLimitSec ?? null,
                source: 'manual',
            },
            questionsPayload
        );

        return this.mapQuizToResponse(created);
    }

    async updateQuiz(
        userId: string,
        quizId: string,
        dto: UpdateQuizDto
    ): Promise<QuizResponse> {
        const questionsPayload = this.validateAndBuildQuestions(dto.questions);

        const updated = await this.quizRepo.updateQuizWithQuestions(
            quizId,
            userId,
            {
                title: dto.title.trim(),
                description: dto.description?.trim() || null,
                time_limit_sec: dto.timeLimitSec ?? null,
            },
            questionsPayload
        );

        return this.mapQuizToResponse(updated);
    }

    async deleteQuiz(
        userId: string,
        quizId: string
    ): Promise<{ success: boolean; message: string }> {
        await this.quizRepo.deleteQuiz(quizId, userId);
        return {
            success: true,
            message: 'Xóa bài kiểm tra thành công',
        };
    }

    /* ==========================================================
     * NHÓM 2: LÀM BÀI & LƯU NHÁP (ATTEMPT EXECUTION)
     * ========================================================== */

    async listAttempts(
        userId: string,
        quizId: string
    ): Promise<QuizAttemptResponse[]> {
        const attempts = await this.quizRepo.getAttemptsByQuizId(quizId, userId);
        return attempts.map((a) => this.mapAttemptToResponse(a));
    }

    async startAttempt(
        userId: string,
        quizId: string,
        dto: StartAttemptDto
    ): Promise<QuizAttemptResponse> {
        const quiz = await this.quizRepo.getQuizById(quizId, userId);
        const allQuestionIds = new Set(quiz.questions.map((q) => q.id));

        const requestedOrder = Array.isArray(dto.config?.questionOrder)
            ? dto.config.questionOrder.filter((id) => allQuestionIds.has(id))
            : [];

        const questionOrder =
            requestedOrder.length > 0
                ? requestedOrder
                : quiz.questions.map((q) => q.id);

        const maxScore =
            Math.round(
                quiz.questions
                    .filter((q) => questionOrder.includes(q.id))
                    .reduce((sum, q) => sum + q.points, 0) * 100
            ) / 100;

        const normalizedConfig: AttemptConfigResponse = {
            mode: dto.config?.mode === 'practice' ? 'practice' : 'exam',
            timeLimitSec:
                dto.config?.timeLimitSec !== undefined
                    ? dto.config.timeLimitSec
                    : quiz.time_limit_sec,
            questionOrder,
            optionOrder: dto.config?.optionOrder ?? {},
        };

        const created = await this.quizRepo.createAttemptWithEmptyAnswers(
            userId,
            quizId,
            maxScore,
            normalizedConfig as unknown as Prisma.InputJsonValue,
            questionOrder
        );

        return this.mapAttemptToResponse(created);
    }

    async saveAnswer(
        userId: string,
        attemptId: string,
        questionId: string,
        dto: SaveAnswerDto
    ): Promise<{ success: boolean }> {
        const attempt = await this.quizRepo.getAttemptByIdWithDetails(
            attemptId,
            userId
        );

        if (attempt.status !== AttemptStatusEnum.in_progress) {
            throw new BadRequestException(
                'Lượt làm bài đã kết thúc, không thể lưu nháp câu trả lời'
            );
        }

        const question = attempt.quiz.questions.find(
            (q) => q.id === questionId
        );
        if (!question) {
            throw new NotFoundException(
                'Không tìm thấy câu hỏi trong đề kiểm tra này'
            );
        }

        const sanitizedText =
            question.question_type === QuestionTypeEnum.essay
                ? sanitizeQuizHtml(dto.textAnswer)
                : (dto.textAnswer ?? '').trim();

        await this.quizRepo.upsertAttemptAnswer(attemptId, questionId, {
            selected_option_ids: Array.isArray(dto.selectedOptionIds)
                ? dto.selectedOptionIds
                : [],
            text_answer: sanitizedText,
            is_flagged: Boolean(dto.isFlagged),
        });

        return { success: true };
    }

    async saveProgress(
        userId: string,
        attemptId: string,
        dto: SaveProgressDto
    ): Promise<{ success: boolean }> {
        const attempt = await this.quizRepo.getAttemptByIdWithDetails(
            attemptId,
            userId
        );

        if (attempt.status !== AttemptStatusEnum.in_progress) {
            return { success: true };
        }

        await this.quizRepo.updateAttemptProgress(attemptId, dto.timeSpentSec);
        return { success: true };
    }

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
            return this.mapAttemptToResponse(attempt);
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

        const config = this.parseAttemptConfig(
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
                    const essayResult = await this.gradeEssayQuestion(
                        q,
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

        return this.mapAttemptToResponse(submitted);
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

        return this.mapAttemptToResponse(updatedAttempt);
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

        const options = this.parseQuizOptions(question.options) ?? [];
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

    async gradeEssayQuestion(
        question: {
            question_text: string;
            points: number;
            sample_answer: string | null;
            grading_criteria: Prisma.JsonValue;
        },
        htmlAnswer: string
    ): Promise<{
        evaluationStatus: EvaluationStatusEnum;
        pointsEarned: number;
        matchedPoints: string[];
        missingPoints: string[];
        aiFeedback: string;
    }> {
        const plainAnswer = stripHtml(htmlAnswer);
        const criteria = this.parseGradingCriteria(question.grading_criteria);
        const samplePlain = stripHtml(question.sample_answer);

        if (!plainAnswer) {
            return {
                evaluationStatus: EvaluationStatusEnum.incorrect,
                pointsEarned: 0,
                matchedPoints: [],
                missingPoints: criteria,
                aiFeedback: 'Bạn chưa viết câu trả lời cho câu này.',
            };
        }

        const questionPlain = stripHtml(question.question_text);
        const systemPrompt =
            'Bạn là trợ lý học tập AI chuyên chấm điểm câu hỏi tự luận cho sinh viên. ' +
            'Hãy chấm điểm công bằng, khách quan dựa trên đáp án mẫu và tiêu chí chấm điểm được cung cấp. ' +
            'Phân loại chính xác các ý người học đã đạt được vào matchedPoints và các ý còn thiếu vào missingPoints. ' +
            'Đưa ra nhận xét ngắn gọn, mang tính xây dựng bằng tiếng Việt trong aiFeedback.';

        const userPrompt = [
            `CÂU HỎI (${question.points} điểm):`,
            questionPlain,
            '',
            `ĐÁP ÁN MẪU:`,
            samplePlain || '(Không có đáp án mẫu cụ thể)',
            '',
            `CÁC TIÊU CHÍ CHẤM ĐIỂM (${criteria.length} ý):`,
            criteria.length > 0
                ? criteria.map((c, idx) => `${idx + 1}. ${c}`).join('\n')
                : '(Đánh giá dựa theo mức độ khớp ý với đáp án mẫu)',
            '',
            `BÀI LÀM CỦA NGƯỜI HỌC:`,
            plainAnswer,
            '',
            `YÊU CẦU ĐẦU RA:`,
            `- evaluationStatus: 'correct' (đạt >= 80% yêu cầu), 'partial' (đạt một phần từ 25% đến dưới 80%), hoặc 'incorrect' (sai hoặc lạc đề).`,
            `- pointsEarned: Điểm đạt được trong khoảng từ 0 đến ${question.points} (làm tròn tối đa 2 chữ số thập phân).`,
            `- matchedPoints: Danh sách các ý/tiêu chí người học đã trình bày đúng.`,
            `- missingPoints: Danh sách các ý/tiêu chí người học còn thiếu hoặc trình bày sai.`,
            `- aiFeedback: Nhận xét súc tích (1-3 câu) bằng tiếng Việt chỉ rõ điểm tốt và điểm cần bổ sung.`,
        ].join('\n');

        try {
            const { object } =
                await this.aiService.generateObjectForTask<EssayGradingOutput>(
                    'SUMMARIZE',
                    {
                        schema: essayGradingSchema,
                        system: systemPrompt,
                        prompt: userPrompt,
                        temperature: 0.2,
                    }
                );

            const clampedPoints = Math.min(
                question.points,
                Math.max(0, Math.round((object.pointsEarned ?? 0) * 100) / 100)
            );

            const statusMap: Record<
                EssayGradingOutput['evaluationStatus'],
                EvaluationStatusEnum
            > = {
                correct: EvaluationStatusEnum.correct,
                partial: EvaluationStatusEnum.partial,
                incorrect: EvaluationStatusEnum.incorrect,
            };

            return {
                evaluationStatus:
                    statusMap[object.evaluationStatus] ??
                    EvaluationStatusEnum.incorrect,
                pointsEarned: clampedPoints,
                matchedPoints: Array.isArray(object.matchedPoints)
                    ? object.matchedPoints
                    : [],
                missingPoints: Array.isArray(object.missingPoints)
                    ? object.missingPoints
                    : [],
                aiFeedback:
                    object.aiFeedback?.trim() ||
                    'Đã hoàn tất chấm điểm câu trả lời tự luận.',
            };
        } catch (error) {
            this.logger.warn(
                `Chấm tự luận bằng LLM gặp lỗi, chuyển sang chấm dự phòng theo tiêu chí: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            return this.fallbackGradeEssay(
                question.points,
                plainAnswer,
                samplePlain,
                criteria
            );
        }
    }

    private fallbackGradeEssay(
        maxPoints: number,
        plainAnswer: string,
        samplePlain: string,
        criteria: string[]
    ): {
        evaluationStatus: EvaluationStatusEnum;
        pointsEarned: number;
        matchedPoints: string[];
        missingPoints: string[];
        aiFeedback: string;
    } {
        const lowerAnswer = plainAnswer.toLowerCase();
        const effectiveCriteria =
            criteria.length > 0
                ? criteria
                : samplePlain
                  ? [samplePlain]
                  : [];

        if (effectiveCriteria.length === 0) {
            return {
                evaluationStatus: EvaluationStatusEnum.partial,
                pointsEarned: Math.round((maxPoints / 2) * 100) / 100,
                matchedPoints: [],
                missingPoints: [],
                aiFeedback:
                    'Bài viết đã được ghi nhận. Bạn có thể đối chiếu với đáp án mẫu để tự điều chỉnh điểm.',
            };
        }

        const matched: string[] = [];
        const missing: string[] = [];

        for (const crit of effectiveCriteria) {
            const words = crit
                .toLowerCase()
                .replace(/[^\p{L}\p{N}\s]/gu, '')
                .split(/\s+/)
                .filter((w) => w.length > 3);
            const hitCount = words.filter((w) => lowerAnswer.includes(w)).length;
            if (words.length === 0 || hitCount / words.length >= 0.5) {
                matched.push(crit);
            } else {
                missing.push(crit);
            }
        }

        const ratio = matched.length / effectiveCriteria.length;
        const evaluationStatus =
            ratio >= 0.8
                ? EvaluationStatusEnum.correct
                : ratio >= 0.3
                  ? EvaluationStatusEnum.partial
                  : EvaluationStatusEnum.incorrect;

        const pointsEarned =
            evaluationStatus === EvaluationStatusEnum.correct
                ? maxPoints
                : evaluationStatus === EvaluationStatusEnum.partial
                  ? Math.round(
                        maxPoints * Math.min(0.75, Math.max(0.25, ratio)) * 100
                    ) / 100
                  : 0;

        const aiFeedback =
            evaluationStatus === EvaluationStatusEnum.correct
                ? 'Bài viết nêu đủ các ý cốt lõi và diễn đạt rõ ràng.'
                : evaluationStatus === EvaluationStatusEnum.partial
                  ? `Bạn đã nắm được ý chính, nhưng còn thiếu: ${missing
                        .join('; ')
                        .toLowerCase()}.`
                  : 'Câu trả lời chưa bám sát yêu cầu. Hãy xem lại đáp án mẫu và các ý chính bên dưới.';

        return {
            evaluationStatus,
            pointsEarned,
            matchedPoints: matched,
            missingPoints: missing,
            aiFeedback,
        };
    }

    /* ==========================================================
     * VALIDATION & DATA MAPPERS
     * ========================================================== */

    private validateAndBuildQuestions(
        questions: QuestionDraftDto[]
    ): QuestionCreatePayload[] {
        if (!Array.isArray(questions) || questions.length === 0) {
            throw new BadRequestException(
                'Đề kiểm tra cần có ít nhất 1 câu hỏi'
            );
        }

        return questions.map((q, index) => {
            const sanitizedText = sanitizeQuizHtml(q.text);
            if (!stripHtml(sanitizedText) && !q.imageUrl) {
                throw new BadRequestException(
                    `Câu hỏi số ${index + 1} chưa có nội dung`
                );
            }

            let optionsJson:
                | Prisma.InputJsonValue
                | Prisma.NullableJsonNullValueInput = Prisma.DbNull;

            if (
                q.type === QuestionTypeEnum.single_choice ||
                q.type === QuestionTypeEnum.multiple_choice ||
                q.type === QuestionTypeEnum.true_false
            ) {
                const validOptions = (q.options ?? [])
                    .map((o) => ({
                        id: o.id,
                        text: o.text.trim(),
                        isCorrect: Boolean(o.isCorrect),
                    }))
                    .filter((o) => o.text.length > 0);

                if (validOptions.length < 2) {
                    throw new BadRequestException(
                        `Câu hỏi số ${index + 1} cần ít nhất 2 phương án trả lời`
                    );
                }
                if (!validOptions.some((o) => o.isCorrect)) {
                    throw new BadRequestException(
                        `Câu hỏi số ${index + 1} cần chọn ít nhất 1 đáp án đúng`
                    );
                }
                optionsJson = validOptions as unknown as Prisma.InputJsonValue;
            }

            let sampleAnswer: string | null = null;
            if (q.type === QuestionTypeEnum.short_answer) {
                sampleAnswer = q.sampleAnswer?.trim() || null;
                if (!sampleAnswer) {
                    throw new BadRequestException(
                        `Câu trả lời ngắn số ${index + 1} cần có đáp án mẫu`
                    );
                }
            } else if (q.type === QuestionTypeEnum.essay) {
                sampleAnswer = q.sampleAnswer
                    ? sanitizeQuizHtml(q.sampleAnswer)
                    : null;
            }

            const gradingCriteria = Array.isArray(q.gradingCriteria)
                ? q.gradingCriteria.map((c) => c.trim()).filter(Boolean)
                : [];

            return {
                id: q.id,
                question_type: q.type,
                order_index: index,
                question_text: sanitizedText,
                image_url: q.imageUrl?.trim() || null,
                audio_url: q.audioUrl?.trim() || null,
                points: Number(q.points) > 0 ? Number(q.points) : 1,
                options: optionsJson,
                sample_answer: sampleAnswer,
                grading_criteria:
                    gradingCriteria as unknown as Prisma.InputJsonValue,
                explanation: q.explanation
                    ? sanitizeQuizHtml(q.explanation)
                    : null,
            };
        });
    }

    private parseQuizOptions(raw: Prisma.JsonValue | null): QuizOptionItem[] | null {
        if (!Array.isArray(raw)) return null;
        return raw.map((item: any, idx: number) => ({
            id: typeof item?.id === 'string' ? item.id : String(idx + 1),
            text: typeof item?.text === 'string' ? item.text : '',
            isCorrect: Boolean(item?.isCorrect),
        }));
    }

    private parseGradingCriteria(raw: Prisma.JsonValue | null): string[] {
        if (!Array.isArray(raw)) return [];
        return raw
            .filter((item): item is string => typeof item === 'string')
            .map((s) => s.trim())
            .filter(Boolean);
    }

    private parseAttemptConfig(
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
                    questionOrder.length > 0
                        ? questionOrder
                        : fallbackQuestionIds,
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

    private mapQuizToResponse(quiz: any): QuizResponse {
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
                    options: this.parseQuizOptions(q.options),
                    sampleAnswer: q.sample_answer ?? null,
                    gradingCriteria: this.parseGradingCriteria(
                        q.grading_criteria
                    ),
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

    private mapAttemptToResponse(attempt: any): QuizAttemptResponse {
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
                matchedPoints: this.parseGradingCriteria(a.matched_points),
                missingPoints: this.parseGradingCriteria(a.missing_points),
                aiFeedback: a.ai_feedback ?? null,
            };
        }

        const fallbackIds = Object.keys(answersMap);
        const config = this.parseAttemptConfig(
            attempt.config,
            null,
            fallbackIds
        );

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
}
