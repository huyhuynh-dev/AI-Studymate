import {
    BadRequestException,
    Injectable,
    Logger,
    Optional,
} from '@nestjs/common';
import {
    computeBloomQuota,
    resolveBloomPreset,
} from '../common/types/bloom.types.js';
import { Prisma, QuestionTypeEnum } from '../generated/prisma/client.js';
import { QuizAiService } from '../ai/quiz-ai.service.js';
import type { QuizQuestionInsert } from '../ai/schemas/quiz-ai.schema.js';
import { packChunkedDocuments } from '../ai/utils/chunk-context.helper.js';
import { DeckFlashcardRepoService } from '../repo/deck-flashcard-repo/deck-flashcard-repo.service.js';
import { DocumentChunksRepoService } from '../repo/document-chunks-repo/document-chunks-repo.service.js';
import { DocumentsRepoService } from '../repo/documents-repo/documents-repo.service.js';
import {
    QuestionCreatePayload,
    QuizRepoService,
} from '../repo/quiz-repo/quiz-repo.service.js';
import {
    CreateQuizDto,
    GenerateQuizWithAiDto,
    GenerateTargetedQuizDto,
    QuestionDraftDto,
    UpdateQuizDto,
} from './dto/quiz.dto.js';
import {
    mapQuizToResponse,
    sanitizeQuizHtml,
    stripHtml,
} from './quiz.helper.js';
import { QuizResponse, WeakAreasSummaryResponse } from './quiz.types.js';
import { aggregateWeakChunkSignals } from './weak-chunk.helper.js';

const MAX_QUIZ_CONTEXT_CHARS = 200_000;

@Injectable()
export class QuizManageService {
    private readonly logger = new Logger(QuizManageService.name);

    constructor(
        private readonly quizRepo: QuizRepoService,
        private readonly quizAiService: QuizAiService,
        private readonly documentsRepo: DocumentsRepoService,
        private readonly documentChunksRepo: DocumentChunksRepoService,
        @Optional()
        private readonly deckFlashcardRepo?: DeckFlashcardRepoService
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
        return quizzes.map((q) => mapQuizToResponse(q));
    }

    async getQuizById(userId: string, quizId: string): Promise<QuizResponse> {
        const quiz = await this.quizRepo.getQuizById(quizId, userId);
        return mapQuizToResponse(quiz);
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

        return mapQuizToResponse(created);
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

        return mapQuizToResponse(updated);
    }

    async deleteQuiz(
        userId: string,
        quizId: string
    ): Promise<{ success: boolean; message: string }> {
        await this.quizRepo.deleteQuiz(quizId, userId);
        return {
            success: true,
            message: 'Đã xóa bài kiểm tra thành công',
        };
    }

    async generateWithAI(
        userId: string,
        conversationId: string,
        dto: GenerateQuizWithAiDto
    ): Promise<QuizResponse> {
        const startTime = Date.now();
        this.logger.log(
            `[generateWithAI] Bắt đầu xử lý tạo đề bằng AI cho conversation ${conversationId} (User: ${userId})`
        );

        const docs =
            await this.documentsRepo.getAllDocumentsByConversationId(
                conversationId,
                userId
            );

        this.logger.log(
            `[generateWithAI] Tổng số tài liệu tìm thấy trong conversation: ${docs.length}`
        );

        const selectedDocs =
            dto.documentIds && dto.documentIds.length > 0
                ? docs.filter((doc) => dto.documentIds!.includes(doc.id))
                : docs;

        if (dto.documentIds && dto.documentIds.length > 0) {
            this.logger.log(
                `[generateWithAI] Lọc theo ${dto.documentIds.length} tài liệu được chỉ định -> còn ${selectedDocs.length} tài liệu khớp`
            );
        }

        const readyDocs = selectedDocs.filter(
            (d) => d.ocr_status === 'done' && d.raw_text && d.raw_text.trim()
        );

        this.logger.log(
            `[generateWithAI] Số tài liệu hoàn tất OCR sẵn sàng sử dụng: ${readyDocs.length}/${selectedDocs.length} (${readyDocs.map((d) => d.file_name || d.id).join(', ') || 'không có'})`
        );

        if (readyDocs.length === 0) {
            this.logger.warn(
                `[generateWithAI] Không có tài liệu nào hoàn tất OCR để tạo đề (conversation: ${conversationId})`
            );
            throw new BadRequestException(
                dto.documentIds && dto.documentIds.length > 0
                    ? 'Không có tài liệu nào trong số các tài liệu bạn chọn đã được xử lý hoàn tất nội dung. Vui lòng kiểm tra lại hoặc chọn tài liệu khác.'
                    : 'Chưa có tài liệu nào trong không gian học tập được xử lý hoàn tất. Vui lòng tải lên hoặc chờ tài liệu xử lý xong trước khi tạo đề bằng AI.'
            );
        }

        const chunkRows = await this.documentChunksRepo.findChunksByDocumentIds(
            readyDocs.map((d) => d.id),
            userId
        );
        const chunksByDocId = new Map<string, typeof chunkRows>();
        for (const chunk of chunkRows) {
            const list = chunksByDocId.get(chunk.document_id) ?? [];
            list.push(chunk);
            chunksByDocId.set(chunk.document_id, list);
        }

        const packed = packChunkedDocuments(
            readyDocs.map((doc) => ({
                id: doc.id,
                fileName: doc.file_name || doc.id,
                rawText: doc.raw_text!.trim(),
                chunks: (chunksByDocId.get(doc.id) ?? []).map((c) => ({
                    id: c.id,
                    chunkIndex: c.chunk_index,
                    content: c.content,
                    rawContent: c.raw_content,
                    pageNumbers: c.page_numbers,
                    headings: c.headings,
                    bboxes: c.bboxes,
                })),
            })),
            MAX_QUIZ_CONTEXT_CHARS
        );

        const count = Math.max(1, Math.min(30, Number(dto.questionCount) || 10));
        const types =
            Array.isArray(dto.types) && dto.types.length > 0
                ? dto.types
                : [QuestionTypeEnum.single_choice];

        const resolvedPreset =
            dto.bloomPreset ??
            resolveBloomPreset(undefined, dto.difficulty || 'applied');
        const bloomQuota = computeBloomQuota(
            count,
            resolvedPreset,
            dto.bloomDistribution
        );

        this.logger.log(
            `[generateWithAI] Bloom Quota (${resolvedPreset}, ${count} câu): remember=${bloomQuota.remember}, understand=${bloomQuota.understand}, apply=${bloomQuota.apply}, analyze=${bloomQuota.analyze}`
        );

        this.logger.log(
            `[generateWithAI] Tổng hợp ngữ cảnh: ${packed.combinedContext.length} ký tự (${packed.totalChunksIncluded} chunks) từ ${readyDocs.length} tài liệu. Bắt đầu gọi QuizAiService sinh ${count} câu hỏi (Types: [${types.join(', ')}], Độ khó: ${dto.difficulty})...`
        );

        const generated = await this.quizAiService.generateQuizFromContext({
            context: packed.combinedContext,
            count,
            types,
            difficulty: dto.difficulty || 'applied',
            sourceChunkMap: packed.chunkRefMap,
            bloomQuota,
        });

        this.logger.log(
            `[generateWithAI] QuizAiService hoàn tất: tiêu đề "${generated.title}", nhận ${generated.rows.length} câu hỏi hợp lệ (bị loại: ${generated.rejected.length})`
        );

        const questionsPayload = this.toQuestionCreatePayloads(generated.rows);

        this.logger.log(
            `[generateWithAI] Đang lưu đề kiểm tra vào CSDL qua QuizRepoService (${questionsPayload.length} câu hỏi)...`
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

        const totalDuration = Date.now() - startTime;
        this.logger.log(
            `[generateWithAI] Hoàn thành tạo đề AI thành công trong ${totalDuration}ms | Quiz ID: ${created.id}, Tiêu đề: "${created.title}", Số câu hỏi: ${created.questions.length}`
        );

        return mapQuizToResponse(created);
    }

    async getWeakAreasSummary(
        userId: string,
        conversationId: string
    ): Promise<WeakAreasSummaryResponse> {
        await this.quizRepo.assertConversationOwnership(conversationId, userId);

        const [questionSignals, flashcardSignals] = await Promise.all([
            this.quizRepo.getWeakQuestionSignalsByConversation(
                conversationId,
                userId
            ),
            this.deckFlashcardRepo
                ? this.deckFlashcardRepo.getWeakFlashcardSignalsByConversation(
                      conversationId,
                      userId
                  )
                : Promise.resolve([]),
        ]);

        const aggregated = aggregateWeakChunkSignals(
            questionSignals,
            flashcardSignals
        );

        return {
            hasWeakAreas: aggregated.hasWeakAreas,
            weakChunkCount: aggregated.weakChunkCount,
            incorrectQuizCount: aggregated.incorrectQuizCount,
            leechCardCount: aggregated.leechCardCount,
            topWeakTopics: aggregated.topWeakTopics,
            topMissingPoints: aggregated.topMissingPoints,
        };
    }

    async generateTargetedQuiz(
        userId: string,
        conversationId: string,
        dto: GenerateTargetedQuizDto
    ): Promise<QuizResponse> {
        const startTime = Date.now();
        await this.quizRepo.assertConversationOwnership(conversationId, userId);

        const [questionSignals, flashcardSignals] = await Promise.all([
            this.quizRepo.getWeakQuestionSignalsByConversation(
                conversationId,
                userId
            ),
            this.deckFlashcardRepo
                ? this.deckFlashcardRepo.getWeakFlashcardSignalsByConversation(
                      conversationId,
                      userId
                  )
                : Promise.resolve([]),
        ]);

        const aggregated = aggregateWeakChunkSignals(
            questionSignals,
            flashcardSignals
        );

        const explicitChunkIds = Array.isArray(dto.chunkIds)
            ? [...new Set(dto.chunkIds.filter(Boolean))]
            : [];
        const targetChunkIds =
            explicitChunkIds.length > 0
                ? explicitChunkIds
                : aggregated.weakChunkIds;

        if (targetChunkIds.length === 0) {
            throw new BadRequestException(
                'Chưa ghi nhận vùng kiến thức yếu nào (câu làm sai hoặc thẻ khó nhớ) gắn với tài liệu trong phiên học này để tạo đề đặc trị.'
            );
        }

        const groupedDocs =
            await this.documentChunksRepo.findChunksWithNeighborsByIds(
                targetChunkIds,
                userId,
                conversationId
            );

        if (groupedDocs.length === 0) {
            throw new BadRequestException(
                'Không tìm thấy đoạn nội dung tài liệu tương ứng với vùng kiến thức yếu được chọn.'
            );
        }

        const packed = packChunkedDocuments(
            groupedDocs.map((doc) => ({
                id: doc.documentId,
                fileName: doc.fileName,
                rawText: '',
                chunks: doc.chunks,
            })),
            MAX_QUIZ_CONTEXT_CHARS
        );

        const derivedTopics =
            aggregated.topWeakTopics.length > 0
                ? aggregated.topWeakTopics
                : Array.from(
                      new Set(
                          groupedDocs
                              .flatMap((d) => d.chunks)
                              .map((c) => c.headings[c.headings.length - 1]?.trim())
                              .filter((h): h is string => Boolean(h))
                      )
                  ).slice(0, 5);

        const count = Math.max(3, Math.min(15, Number(dto.questionCount) || 8));
        const types =
            Array.isArray(dto.types) && dto.types.length > 0
                ? dto.types
                : [QuestionTypeEnum.single_choice, QuestionTypeEnum.essay];

        const preset = dto.bloomPreset ?? 'exam_prep';
        const bloomQuota = computeBloomQuota(count, preset);

        this.logger.log(
            `[generateTargetedQuiz] Conversation=${conversationId} | TargetChunks=${targetChunkIds.length} -> ExpandedChunks=${packed.totalChunksIncluded} | Bloom(${preset}): remember=${bloomQuota.remember}, understand=${bloomQuota.understand}, apply=${bloomQuota.apply}, analyze=${bloomQuota.analyze} | WeakTopics=[${derivedTopics.join(', ')}] | MissingPoints=${aggregated.topMissingPoints.length}`
        );

        const generated = await this.quizAiService.generateQuizFromContext({
            context: packed.combinedContext,
            count,
            types,
            difficulty: preset === 'familiarize' ? 'basic' : 'applied',
            sourceChunkMap: packed.chunkRefMap,
            bloomQuota,
            remediationFocus: {
                weakTopics: derivedTopics,
                missingPoints: aggregated.topMissingPoints,
                priorFailedQuestions: aggregated.priorFailedQuestions,
            },
        });

        const taggedTitle = generated.title.startsWith('[Luyện vùng yếu]')
            ? generated.title
            : `[Luyện vùng yếu] ${generated.title}`;

        const created = await this.quizRepo.createQuizWithQuestions(
            userId,
            conversationId,
            {
                title: taggedTitle.slice(0, 255),
                description: generated.description,
                time_limit_sec: null,
                source: 'ai',
            },
            this.toQuestionCreatePayloads(generated.rows)
        );

        this.logger.log(
            `[generateTargetedQuiz] Hoàn tất tạo đề đặc trị trong ${Date.now() - startTime}ms | Quiz ID: ${created.id}, Câu hỏi: ${created.questions.length}`
        );

        return mapQuizToResponse(created);
    }

    private toQuestionCreatePayloads(
        rows: QuizQuestionInsert[]
    ): QuestionCreatePayload[] {
        return rows.map((r, index) => ({
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
            bloom_level: r.bloom_level ?? null,
            source_refs:
                r.source_refs && r.source_refs.length > 0
                    ? (r.source_refs as unknown as Prisma.InputJsonValue)
                    : Prisma.DbNull,
        }));
    }

    /* ==========================================================
     * VALIDATION & BUILD QUESTIONS
     * ========================================================== */

    validateAndBuildQuestions(
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
                bloom_level: q.bloomLevel ?? null,
            };
        });
    }
}
