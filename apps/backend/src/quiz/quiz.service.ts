import { Injectable, Logger } from '@nestjs/common';
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
import { QuizManageService } from './quiz-manage.service.js';
import { QuizAttemptService } from './quiz-attempt.service.js';
import { QuizGradingService } from './quiz-grading.service.js';
import {
    AttemptAnswerResponse,
    AttemptConfigResponse,
    QuizAttemptResponse,
    QuizOptionItem,
    QuizQuestionResponse,
    QuizResponse,
} from './quiz.types.js';
import {
    sanitizeQuizHtml,
    stripHtml,
    normalizeShortAnswer,
    parseQuizOptions,
    parseGradingCriteria,
    parseAttemptConfig,
    mapQuizToResponse,
    mapAttemptToResponse,
} from './quiz.helper.js';

// Re-export types and helpers for backwards compatibility
export type {
    QuizOptionItem,
    QuizQuestionResponse,
    QuizResponse,
    AttemptAnswerResponse,
    AttemptConfigResponse,
    QuizAttemptResponse,
};

export {
    sanitizeQuizHtml,
    stripHtml,
    normalizeShortAnswer,
    parseQuizOptions,
    parseGradingCriteria,
    parseAttemptConfig,
    mapQuizToResponse,
    mapAttemptToResponse,
};

/**
 * QuizService - Service điều phối trung tâm cho toàn bộ Module Quiz.
 * Đảm nhiệm vai trò Facade / Coordinator, ủy nhiệm xử lý chi tiết cho 3 service nghiệp vụ:
 * 1. QuizManageService: Quản lý đề (CRUD, validation, tạo đề bằng AI)
 * 2. QuizAttemptService: Làm bài thi & lưu nháp tiến độ
 * 3. QuizGradingService: Động cơ chấm điểm (trắc nghiệm, tự luận AI) & nộp bài
 */
@Injectable()
export class QuizService {
    private readonly logger = new Logger(QuizService.name);

    constructor(
        private readonly quizManageService: QuizManageService,
        private readonly quizAttemptService: QuizAttemptService,
        private readonly quizGradingService: QuizGradingService
    ) {}

    /* ==========================================================
     * NHÓM 1: QUẢN LÝ ĐỀ (QUIZ CRUD & TẠO ĐỀ AI)
     * ========================================================== */

    async listQuizzes(
        userId: string,
        conversationId: string
    ): Promise<QuizResponse[]> {
        return this.quizManageService.listQuizzes(userId, conversationId);
    }

    async getQuizById(userId: string, quizId: string): Promise<QuizResponse> {
        return this.quizManageService.getQuizById(userId, quizId);
    }

    async createQuiz(
        userId: string,
        conversationId: string,
        dto: CreateQuizDto
    ): Promise<QuizResponse> {
        return this.quizManageService.createQuiz(userId, conversationId, dto);
    }

    async updateQuiz(
        userId: string,
        quizId: string,
        dto: UpdateQuizDto
    ): Promise<QuizResponse> {
        return this.quizManageService.updateQuiz(userId, quizId, dto);
    }

    async deleteQuiz(
        userId: string,
        quizId: string
    ): Promise<{ success: boolean; message: string }> {
        return this.quizManageService.deleteQuiz(userId, quizId);
    }

    async generateWithAI(
        userId: string,
        conversationId: string,
        dto: GenerateQuizWithAiDto
    ): Promise<QuizResponse> {
        return this.quizManageService.generateWithAI(
            userId,
            conversationId,
            dto
        );
    }

    /* ==========================================================
     * NHÓM 2: LÀM BÀI & LƯU NHÁP (ATTEMPT EXECUTION)
     * ========================================================== */

    async listAttempts(
        userId: string,
        quizId: string
    ): Promise<QuizAttemptResponse[]> {
        return this.quizAttemptService.listAttempts(userId, quizId);
    }

    async startAttempt(
        userId: string,
        quizId: string,
        dto: StartAttemptDto
    ): Promise<QuizAttemptResponse> {
        return this.quizAttemptService.startAttempt(userId, quizId, dto);
    }

    async saveAnswer(
        userId: string,
        attemptId: string,
        questionId: string,
        dto: SaveAnswerDto
    ): Promise<{ success: boolean }> {
        return this.quizAttemptService.saveAnswer(
            userId,
            attemptId,
            questionId,
            dto
        );
    }

    async saveProgress(
        userId: string,
        attemptId: string,
        dto: SaveProgressDto
    ): Promise<{ success: boolean }> {
        return this.quizAttemptService.saveProgress(userId, attemptId, dto);
    }

    /* ==========================================================
     * NHÓM 3: CHẤM ĐIỂM & NỘP BÀI (GRADING ENGINE)
     * ========================================================== */

    async submitAttempt(
        userId: string,
        attemptId: string,
        dto: SubmitAttemptDto
    ): Promise<QuizAttemptResponse> {
        return this.quizGradingService.submitAttempt(userId, attemptId, dto);
    }

    async overrideEvaluation(
        userId: string,
        attemptId: string,
        questionId: string,
        dto: OverrideEvaluationDto
    ): Promise<QuizAttemptResponse> {
        return this.quizGradingService.overrideEvaluation(
            userId,
            attemptId,
            questionId,
            dto
        );
    }

    /* ==========================================================
     * TIỆN ÍCH HỖ TRỢ / HELPERS ỦY NHIỆM
     * ========================================================== */

    evaluateObjectiveQuestion(
        question: any,
        answer: any
    ) {
        return this.quizGradingService.evaluateObjectiveQuestion(
            question,
            answer
        );
    }

    validateAndBuildQuestions(questions: QuestionDraftDto[]) {
        return this.quizManageService.validateAndBuildQuestions(questions);
    }
}
