import {
    Body,
    Controller,
    Delete,
    Get,
    Logger,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Put,
    Req,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
    CreateQuizDto,
    GenerateQuizWithAiDto,
    OverrideEvaluationDto,
    SaveAnswerDto,
    SaveProgressDto,
    StartAttemptDto,
    SubmitAttemptDto,
    UpdateQuizDto,
} from './dto/quiz.dto.js';
import {
    QuizAttemptResponse,
    QuizResponse,
    QuizService,
} from './quiz.service.js';

@Controller('quiz')
@UseGuards(JwtAuthGuard)
export class QuizController {
    private readonly logger = new Logger(QuizController.name);

    constructor(private readonly quizService: QuizService) {}

    private getUserId(req: Request): string {
        const user = req.user as { userId?: string; sub?: string } | undefined;
        const userId = user?.userId || user?.sub;
        if (!userId) {
            throw new UnauthorizedException('Người dùng chưa được xác thực');
        }
        return userId;
    }

    /* ==========================================================
     * NHÓM 1: QUẢN LÝ ĐỀ (QUIZ CRUD)
     * ========================================================== */

    @Get('conversations/:conversationId/quizzes')
    async listQuizzes(
        @Req() req: Request,
        @Param('conversationId', new ParseUUIDPipe()) conversationId: string
    ): Promise<QuizResponse[]> {
        return this.quizService.listQuizzes(
            this.getUserId(req),
            conversationId
        );
    }

    @Get('quizzes/:quizId')
    async getQuizById(
        @Req() req: Request,
        @Param('quizId', new ParseUUIDPipe()) quizId: string
    ): Promise<QuizResponse> {
        return this.quizService.getQuizById(this.getUserId(req), quizId);
    }

    @Post('conversations/:conversationId/quizzes')
    async createQuiz(
        @Req() req: Request,
        @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
        @Body() dto: CreateQuizDto
    ): Promise<QuizResponse> {
        return this.quizService.createQuiz(
            this.getUserId(req),
            conversationId,
            dto
        );
    }

    @Put('quizzes/:quizId')
    async updateQuiz(
        @Req() req: Request,
        @Param('quizId', new ParseUUIDPipe()) quizId: string,
        @Body() dto: UpdateQuizDto
    ): Promise<QuizResponse> {
        return this.quizService.updateQuiz(this.getUserId(req), quizId, dto);
    }

    @Delete('quizzes/:quizId')
    async deleteQuiz(
        @Req() req: Request,
        @Param('quizId', new ParseUUIDPipe()) quizId: string
    ): Promise<{ success: boolean; message: string }> {
        return this.quizService.deleteQuiz(this.getUserId(req), quizId);
    }

    @Post('conversations/:conversationId/quizzes/generate')
    async generateWithAI(
        @Req() req: Request,
        @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
        @Body() dto: GenerateQuizWithAiDto
    ): Promise<QuizResponse> {
        const userId = this.getUserId(req);
        this.logger.log(
            `[POST /quiz/conversations/${conversationId}/quizzes/generate] User ${userId} yêu cầu tạo đề AI | Số câu: ${dto.questionCount}, Loại: [${dto.types?.join(', ')}], Độ khó: ${dto.difficulty}, Tài liệu chọn: ${dto.documentIds?.length ? `${dto.documentIds.length} file` : 'tất cả'}`
        );
        return this.quizService.generateWithAI(
            userId,
            conversationId,
            dto
        );
    }

    /* ==========================================================
     * NHÓM 2: LÀM BÀI & LƯU NHÁP (ATTEMPT EXECUTION)
     * ========================================================== */

    @Get('quizzes/:quizId/attempts')
    async listAttempts(
        @Req() req: Request,
        @Param('quizId', new ParseUUIDPipe()) quizId: string
    ): Promise<QuizAttemptResponse[]> {
        return this.quizService.listAttempts(this.getUserId(req), quizId);
    }

    @Post('quizzes/:quizId/attempts')
    async startAttempt(
        @Req() req: Request,
        @Param('quizId', new ParseUUIDPipe()) quizId: string,
        @Body() dto: StartAttemptDto
    ): Promise<QuizAttemptResponse> {
        return this.quizService.startAttempt(this.getUserId(req), quizId, dto);
    }

    @Put('attempts/:attemptId/answers/:questionId')
    async saveAnswer(
        @Req() req: Request,
        @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
        @Param('questionId', new ParseUUIDPipe()) questionId: string,
        @Body() dto: SaveAnswerDto
    ): Promise<{ success: boolean }> {
        return this.quizService.saveAnswer(
            this.getUserId(req),
            attemptId,
            questionId,
            dto
        );
    }

    @Patch('attempts/:attemptId/progress')
    async saveProgress(
        @Req() req: Request,
        @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
        @Body() dto: SaveProgressDto
    ): Promise<{ success: boolean }> {
        return this.quizService.saveProgress(
            this.getUserId(req),
            attemptId,
            dto
        );
    }

    /* ==========================================================
     * NHÓM 3: CHẤM ĐIỂM & NỘP BÀI (GRADING ENGINE)
     * ========================================================== */

    @Post('attempts/:attemptId/submit')
    async submitAttempt(
        @Req() req: Request,
        @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
        @Body() dto: SubmitAttemptDto
    ): Promise<QuizAttemptResponse> {
        return this.quizService.submitAttempt(
            this.getUserId(req),
            attemptId,
            dto
        );
    }

    @Patch('attempts/:attemptId/answers/:questionId/evaluation')
    async overrideEvaluation(
        @Req() req: Request,
        @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
        @Param('questionId', new ParseUUIDPipe()) questionId: string,
        @Body() dto: OverrideEvaluationDto
    ): Promise<QuizAttemptResponse> {
        return this.quizService.overrideEvaluation(
            this.getUserId(req),
            attemptId,
            questionId,
            dto
        );
    }
}
