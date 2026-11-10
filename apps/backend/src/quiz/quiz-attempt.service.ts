import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    AttemptStatusEnum,
    Prisma,
    QuestionTypeEnum,
} from '../generated/prisma/client.js';
import { QuizRepoService } from '../repo/quiz-repo/quiz-repo.service.js';
import {
    SaveAnswerDto,
    SaveProgressDto,
    StartAttemptDto,
} from './dto/quiz.dto.js';
import {
    mapAttemptToResponse,
    sanitizeQuizHtml,
} from './quiz.helper.js';
import {
    AttemptConfigResponse,
    QuizAttemptResponse,
} from './quiz.types.js';

@Injectable()
export class QuizAttemptService {
    constructor(private readonly quizRepo: QuizRepoService) {}

    /* ==========================================================
     * NHÓM 2: LÀM BÀI & LƯU NHÁP (ATTEMPT EXECUTION)
     * ========================================================== */

    async listAttempts(
        userId: string,
        quizId: string
    ): Promise<QuizAttemptResponse[]> {
        const attempts = await this.quizRepo.getAttemptsByQuizId(quizId, userId);
        return attempts.map((a) => mapAttemptToResponse(a));
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

        return mapAttemptToResponse(created);
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
}
