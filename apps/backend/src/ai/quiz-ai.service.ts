import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { EvaluationStatusEnum } from '../generated/prisma/client.js';
import { AiService } from './ai.service.js';
import {
  type AIQuestionType,
  type GeneratedQuiz,
  type QuizQuestionInsert,
  buildQuizSchema,
  partitionQuestions,
  toQuizQuestionInserts,
} from './schemas/quiz-ai.schema.js';
import {
  QUIZ_DIFFICULTY,
  type QuizDifficulty,
  buildQuizSystemPrompt,
} from './prompts/templates/quiz.prompt.js';

export { QUIZ_DIFFICULTY, type QuizDifficulty, buildQuizSystemPrompt };

export interface GradeEssayInput {
  questionText: string;
  points: number;
  sampleAnswer?: string | null;
  gradingCriteria?: string[] | null;
}

export interface GradeEssayResult {
  evaluationStatus: EvaluationStatusEnum;
  pointsEarned: number;
  matchedPoints: string[];
  missingPoints: string[];
  aiFeedback: string;
}

interface EssayGradingOutput {
  evaluationStatus: 'correct' | 'partial' | 'incorrect';
  pointsEarned: number;
  matchedPoints: string[];
  missingPoints: string[];
  aiFeedback: string;
}

export const essayGradingSchema = z.object({
  evaluationStatus: z.enum(['correct', 'partial', 'incorrect']),
  pointsEarned: z.number(),
  matchedPoints: z.array(z.string()),
  missingPoints: z.array(z.string()),
  aiFeedback: z.string(),
});

export interface GenerateQuizFromContextInput {
  context: string;
  count: number;
  types: AIQuestionType[];
  difficulty: QuizDifficulty;
  quizId?: string;
}

export interface GenerateQuizFromContextResult {
  title: string;
  description: string;
  rows: QuizQuestionInsert[];
  rejected: { index: number; problems: string[] }[];
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

@Injectable()
export class QuizAiService {
  private readonly logger = new Logger(QuizAiService.name);

  constructor(private readonly aiService: AiService) {}

  /**
   * Sinh đề kiểm tra (tiêu đề, mô tả, danh sách câu hỏi) từ văn bản tài liệu bằng model QUIZ_GENERATE.
   * Thực hiện kiểm định chất lượng qua partitionQuestions và chuyển sang dòng DB qua toQuizQuestionInserts.
   */
  async generateQuizFromContext(
    args: GenerateQuizFromContextInput,
  ): Promise<GenerateQuizFromContextResult> {
    const startTime = Date.now();
    this.logger.log(
      `[generateQuizFromContext] Bắt đầu gọi model QUIZ_GENERATE sinh đề từ ngữ cảnh (${args.context.length} ký tự). Yêu cầu: ${args.count} câu, types: [${args.types.join(', ')}], độ khó: ${args.difficulty}`,
    );

    const schema = buildQuizSchema(args.types);

    const { object } =
      await this.aiService.generateObjectForFeature<GeneratedQuiz>(
        'QUIZ_GENERATE',
        {
          context: args.context,
          count: args.count,
          types: args.types,
          difficulty: args.difficulty,
        },
        {
          schema,
          schemaName: 'QuizGeneration',
          schemaDescription:
            'Đề kiểm tra và danh sách câu hỏi sinh từ tài liệu học tập',
        },
      );

    const llmDuration = Date.now() - startTime;
    const rawQuestions = Array.isArray(object?.questions)
      ? object.questions
      : [];

    this.logger.log(
      `[generateQuizFromContext] Model phản hồi sau ${llmDuration}ms: tiêu đề "${object?.title}", nhận được ${rawQuestions.length} câu hỏi thô từ AI`,
    );

    const { valid, rejected } = partitionQuestions(rawQuestions);

    if (rejected.length > 0) {
      this.logger.warn(
        `[generateQuizFromContext] Đã loại ${rejected.length} câu hỏi không đạt chuẩn chất lượng: ${JSON.stringify(
          rejected,
        )}`,
      );
    }

    this.logger.log(
      `[generateQuizFromContext] Kết quả kiểm định chất lượng: ${valid.length} câu hợp lệ, ${rejected.length} câu bị loại`,
    );

    if (valid.length === 0) {
      this.logger.error(
        `[generateQuizFromContext] Không có câu hỏi nào đạt chuẩn sau khi kiểm định từ ${rawQuestions.length} câu AI sinh ra`,
      );
      throw new BadRequestException(
        'Không thể sinh câu hỏi hợp lệ từ nội dung tài liệu hiện tại. Vui lòng thử lại hoặc kiểm tra lại nội dung tài liệu.',
      );
    }

    const rows = toQuizQuestionInserts(valid.slice(0, args.count), {
      quizId: args.quizId,
    });

    this.logger.log(
      `[generateQuizFromContext] Đã chuyển đổi thành công ${rows.length} câu hỏi sang định dạng DB và HTML TipTap (Tổng thời gian xử lý AI: ${Date.now() - startTime}ms)`,
    );

    return {
      title: object?.title?.trim() || 'Đề ôn tập do AI tạo',
      description:
        object?.description?.trim() ||
        'Được tạo tự động từ tài liệu trong không gian học tập.',
      rows,
      rejected,
    };
  }

  /**
   * Chuẩn bị dữ liệu và gọi LLM (qua AiService) để chấm điểm câu hỏi tự luận.
   * Tự động dự phòng chấm theo từ khóa tiêu chí (fallback) nếu kết nối gặp sự cố.
   */
  async gradeEssayQuestion(
    question: GradeEssayInput,
    htmlAnswer: string,
  ): Promise<GradeEssayResult> {
    const plainAnswer = stripHtml(htmlAnswer);
    const criteria = Array.isArray(question.gradingCriteria)
      ? question.gradingCriteria.map((c) => c.trim()).filter(Boolean)
      : [];
    const samplePlain = stripHtml(question.sampleAnswer);

    if (!plainAnswer) {
      return {
        evaluationStatus: EvaluationStatusEnum.incorrect,
        pointsEarned: 0,
        matchedPoints: [],
        missingPoints: criteria,
        aiFeedback: 'Bạn chưa viết câu trả lời cho câu này.',
      };
    }

    const questionPlain = stripHtml(question.questionText);

    try {
      const { object } =
        await this.aiService.generateObjectForFeature<EssayGradingOutput>(
          'ESSAY_GRADE',
          {
            questionPlain,
            points: question.points,
            samplePlain,
            criteria,
            plainAnswer,
          },
          {
            schema: essayGradingSchema,
          },
        );

      const clampedPoints = Math.min(
        question.points,
        Math.max(0, Math.round((object.pointsEarned ?? 0) * 100) / 100),
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
        }`,
      );
      return this.fallbackGradeEssay(
        question.points,
        plainAnswer,
        samplePlain,
        criteria,
      );
    }
  }

  fallbackGradeEssay(
    maxPoints: number,
    plainAnswer: string,
    samplePlain: string,
    criteria: string[],
  ): GradeEssayResult {
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
              maxPoints * Math.min(0.75, Math.max(0.25, ratio)) * 100,
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
}
