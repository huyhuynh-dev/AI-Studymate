import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { EvaluationStatusEnum } from '../generated/prisma/client.js';
import { AiService } from './ai.service.js';

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
     * Chuẩn bị dữ liệu và gọi LLM (qua AiService) để chấm điểm câu hỏi tự luận.
     * Tự động dự phòng chấm theo từ khóa tiêu chí (fallback) nếu kết nối gặp sự cố.
     */
    async gradeEssayQuestion(
        question: GradeEssayInput,
        htmlAnswer: string
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
                    'QUIZ_AGENT',
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

    fallbackGradeEssay(
        maxPoints: number,
        plainAnswer: string,
        samplePlain: string,
        criteria: string[]
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
}
