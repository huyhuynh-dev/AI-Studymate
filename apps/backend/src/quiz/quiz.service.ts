import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {
    AttemptStatusEnum,
    EvaluationStatusEnum,
    Prisma,
    QuestionTypeEnum,
} from '../generated/prisma/client.js';
import { QuizAiService } from '../ai/quiz-ai.service.js';
import { DocumentsRepoService } from '../repo/documents-repo/documents-repo.service.js';
import {
    GradedAnswerPayload,
    QuestionCreatePayload,
    QuizRepoService,
} from '../repo/quiz-repo/quiz-repo.service.js';
import {
    CreateQuizDto,
    GenerateQuizWithAiDto,
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

@Injectable()
export class QuizService {
    private readonly logger = new Logger(QuizService.name);

    constructor(
        private readonly quizRepo: QuizRepoService,
        private readonly quizAiService: QuizAiService,
        private readonly documentsRepo: DocumentsRepoService
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

    async generateWithAI(
        userId: string,
        conversationId: string,
        dto: GenerateQuizWithAiDto
    ): Promise<QuizResponse> {
        const docs =
            await this.documentsRepo.getAllDocumentsByConversationId(
                conversationId,
                userId
            );

        const selectedDocs =
            dto.documentIds && dto.documentIds.length > 0
                ? docs.filter((doc) => dto.documentIds!.includes(doc.id))
                : docs;
        const readyDocs = selectedDocs.filter(
            (d) => d.ocr_status === 'done' && d.raw_text && d.raw_text.trim()
        );

        if (readyDocs.length === 0) {
            throw new BadRequestException(
                dto.documentIds && dto.documentIds.length > 0
                    ? 'Không có tài liệu nào trong số các tài liệu bạn chọn đã được xử lý hoàn tất nội dung. Vui lòng kiểm tra lại hoặc chọn tài liệu khác.'
                    : 'Chưa có tài liệu nào trong không gian học tập được xử lý hoàn tất. Vui lòng tải lên hoặc chờ tài liệu xử lý xong trước khi tạo đề bằng AI.'
            );
        }

        const contextText = readyDocs
            .map((doc, idx) => {
                const header = doc.file_name
                    ? `=== TÀI LIỆU ${idx + 1}: ${doc.file_name} ===`
                    : `=== TÀI LIỆU ${idx + 1} ===`;
                return `${header}\n${doc.raw_text!.trim()}\n`;
            })
            .join('\n\n');

        const count = Math.max(1, Math.min(30, Number(dto.questionCount) || 10));
        const types =
            Array.isArray(dto.types) && dto.types.length > 0
                ? dto.types
                : [QuestionTypeEnum.single_choice];

        const generated = await this.quizAiService.generateQuizFromContext({
            context: contextText,
            count,
            types,
            difficulty: dto.difficulty || 'applied',
        });

        const questionsPayload: QuestionCreatePayload[] = generated.rows.map(
            (r, index) => ({
                question_type: r.question_type as QuestionTypeEnum,
                order_index: r.order_index ?? index,
                question_text: r.question_text,
                image_url: null,
                audio_url: null,
                points: r.points,
                options: r.options
                    ? (r.options as unknown as Prisma.InputJsonValue)
                    : Prisma.DbNull,
                sample_answer: r.sample_answer ?? null,
                grading_criteria: (r.grading_criteria ??
                    []) as unknown as Prisma.InputJsonValue,
                explanation: r.explanation ?? null,
            })
        );

        const created = await this.quizRepo.createQuizWithQuestions(
            userId,
            conversationId,
            {
                title: generated.title,
                description: generated.description,
                time_limit_sec: null,
                source: 'ai',
            },
            questionsPayload
        );

        return this.mapQuizToResponse(created);
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
                    const essayResult =
                        await this.quizAiService.gradeEssayQuestion(
                            {
                                questionText: q.question_text,
                                points: q.points,
                                sampleAnswer: q.sample_answer,
                                gradingCriteria: this.parseGradingCriteria(
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
            isCorrect: Boolean(item?.isCorrect ?? item?.is_correct),
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
