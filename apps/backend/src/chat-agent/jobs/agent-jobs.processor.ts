import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createIdGenerator } from 'ai';
import { Job, Worker } from 'bullmq';
import type { Prisma } from '../../generated/prisma/client.js';
import { QuestionTypeEnum } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SummariesService } from '../../summaries/summaries.service.js';
import { SummaryLength, SummaryMode, SummaryScope } from '../../summaries/dto/create-summary.dto.js';
import { DeckService } from '../../deck-flashcard/deck/deck.service.js';
import { FlashcardAiManageService } from '../../deck-flashcard/flashcard-ai-manage.service.js';
import { QuizManageService } from '../../quiz/quiz-manage.service.js';
import {
  QuizRepoService,
  type QuestionCreatePayload,
} from '../../repo/quiz-repo/quiz-repo.service.js';
import {
  AGENT_BACKGROUND_QUEUE_NAME,
  AgentJobsQueueService,
  serializeAgentJobRow,
} from './agent-jobs-queue.service.js';
import type {
  AgentBackgroundJobPayload,
  AgentBackgroundJobResult,
  AgentBackgroundJobType,
  AgentBullMqJobData,
  AgentJobStepLog,
} from './agent-jobs.types.js';

@Injectable()
export class AgentJobsProcessor implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(AgentJobsProcessor.name);
  private worker: Worker<AgentBullMqJobData> | null = null;
  private readonly generateMsgId = createIdGenerator({ prefix: 'msg-', size: 16 });

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly queueService: AgentJobsQueueService,
    @Optional() private readonly summariesService?: SummariesService,
    @Optional() private readonly deckService?: DeckService,
    @Optional() private readonly flashcardAiManageService?: FlashcardAiManageService,
    @Optional() private readonly quizManageService?: QuizManageService,
    @Optional() private readonly quizRepo?: QuizRepoService,
  ) {}

  onModuleInit() {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.DISABLE_BULLMQ_WORKERS === 'true'
    ) {
      return;
    }

    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    const redisPassword =
      this.configService.get<string>('REDIS_PASSWORD') || undefined;

    this.worker = new Worker<AgentBullMqJobData>(
      AGENT_BACKGROUND_QUEUE_NAME,
      async (job: Job<AgentBullMqJobData>) => {
        await this.processJobById(job.data.jobId);
      },
      {
        connection: {
          url: redisUrl,
          password: redisPassword,
          maxRetriesPerRequest: null,
        },
        concurrency: 2,
        lockDuration: 600_000,
      },
    );

    this.worker.on('error', (err) => {
      this.logger.warn(
        `BullMQ Worker [${AGENT_BACKGROUND_QUEUE_NAME}] error: ${err.message}`,
      );
    });
  }

  /**
   * Thực thi job theo cơ chế Step Checkpointing:
   * - Bỏ qua các bước đã hoàn tất (`status === 'completed'`) khi retry
   * - Dừng sạch nếu người dùng đã bấm Cancel (`status === 'cancelled'`)
   * - Ghi kết quả / lỗi vào DB, phát SSE event, và tự chèn UIMessage thông báo vào chat_session gốc
   */
  async processJobById(jobId: string): Promise<void> {
    const jobRow = await this.prisma.agentBackgroundJob.findUnique({
      where: { id: jobId },
    });
    if (!jobRow) {
      this.logger.warn(`Không tìm thấy AgentBackgroundJob [${jobId}] để chạy`);
      return;
    }

    if (jobRow.status === 'cancelled' || jobRow.status === 'completed') {
      return;
    }

    const jobType = jobRow.job_type as AgentBackgroundJobType;
    const payload = (jobRow.payload_json ?? {}) as AgentBackgroundJobPayload;
    const steps: AgentJobStepLog[] = Array.isArray(jobRow.step_logs)
      ? (jobRow.step_logs as unknown as AgentJobStepLog[])
      : [];
    const result: AgentBackgroundJobResult =
      jobRow.result_json && typeof jobRow.result_json === 'object'
        ? { ...(jobRow.result_json as unknown as AgentBackgroundJobResult) }
        : {};

    const markRunning = await this.prisma.agentBackgroundJob.update({
      where: { id: jobId },
      data: {
        status: 'running',
        started_at: jobRow.started_at ?? new Date(),
        error_message: null,
      },
    });
    this.queueService.emitJobUpdate(serializeAgentJobRow(markRunning));

    const saveCheckpoint = async () => {
      const completedCount = steps.filter(
        (s) => s.status === 'completed',
      ).length;
      const progressPercent =
        steps.length > 0
          ? Math.round((completedCount / steps.length) * 100)
          : 100;

      const updated = await this.prisma.agentBackgroundJob.update({
        where: { id: jobId },
        data: {
          completed_steps: completedCount,
          progress_percent: progressPercent,
          step_logs: steps as unknown as Prisma.InputJsonValue,
          result_json: result as unknown as Prisma.InputJsonValue,
        },
      });
      this.queueService.emitJobUpdate(serializeAgentJobRow(updated));
    };

    try {
      for (const step of steps) {
        // Kiểm tra cờ hủy trước mỗi bước
        const latest = await this.prisma.agentBackgroundJob.findUnique({
          where: { id: jobId },
          select: { status: true },
        });
        if (latest?.status === 'cancelled') {
          this.logger.log(`AgentBackgroundJob [${jobId}] đã bị hủy bởi người dùng`);
          return;
        }

        if (step.status === 'completed') {
          continue;
        }

        step.status = 'running';
        step.startedAt = new Date().toISOString();
        step.error = undefined;
        await saveCheckpoint();

        try {
          await this.executeStep({
            jobType,
            step,
            userId: jobRow.user_id,
            conversationId: jobRow.conversation_id,
            title: jobRow.title,
            payload,
            result,
          });
          step.status = 'completed';
          step.finishedAt = new Date().toISOString();
          await saveCheckpoint();
        } catch (stepErr: unknown) {
          const msg =
            stepErr instanceof Error ? stepErr.message : String(stepErr);
          step.status = 'failed';
          step.finishedAt = new Date().toISOString();
          step.error = msg;
          await saveCheckpoint();
          throw stepErr;
        }
      }

      result.summary = this.buildCompletionText(jobType, jobRow.title, result);
      const completedRow = await this.prisma.agentBackgroundJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          progress_percent: 100,
          completed_steps: steps.length,
          finished_at: new Date(),
          step_logs: steps as unknown as Prisma.InputJsonValue,
          result_json: result as unknown as Prisma.InputJsonValue,
        },
      });
      this.queueService.emitJobUpdate(serializeAgentJobRow(completedRow));

      if (jobRow.chat_session_id) {
        await this.appendSessionMessageSafe(
          jobRow.chat_session_id,
          result.summary,
        );
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const failedRow = await this.prisma.agentBackgroundJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          error_message: errorMessage,
          finished_at: new Date(),
          step_logs: steps as unknown as Prisma.InputJsonValue,
          result_json: result as unknown as Prisma.InputJsonValue,
        },
      });
      this.queueService.emitJobUpdate(serializeAgentJobRow(failedRow));

      if (jobRow.chat_session_id) {
        await this.appendSessionMessageSafe(
          jobRow.chat_session_id,
          `Tác vụ nền **"${jobRow.title}"** gặp sự cố ở bước hiện tại: ${errorMessage}. Bạn có thể bấm **Thử lại từ bước lỗi** trong khay Tác vụ nền để tiếp nối các bước còn lại.`,
        );
      }
    }
  }

  private async executeStep(params: {
    jobType: AgentBackgroundJobType;
    step: AgentJobStepLog;
    userId: string;
    conversationId: string;
    title: string;
    payload: AgentBackgroundJobPayload;
    result: AgentBackgroundJobResult;
  }): Promise<void> {
    const {
      jobType,
      step,
      userId,
      conversationId,
      title,
      payload,
      result,
    } = params;
    const docIds: string[] | 'all' =
      Array.isArray(payload.documentIds) && payload.documentIds.length > 0
        ? payload.documentIds
        : 'all';

    if (jobType === 'bulk_flashcards') {
      if (step.stepKey === 'create_deck') {
        if (result.deckId) {
          step.artifactId = result.deckId;
          return;
        }
        if (!this.deckService) {
          throw new Error('DeckService chưa được khởi tạo');
        }
        const deck = await this.deckService.createDeck(userId, {
          conversationId,
          name: payload.deckName?.trim() || title,
          description: 'Bộ thẻ được tổng hợp tự động bởi tác vụ nền AI',
        });
        result.deckId = deck.id;
        result.createdCount = result.createdCount ?? 0;
        step.artifactId = deck.id;
        step.detail = `Đã tạo Deck "${deck.name}"`;
        return;
      }

      if (!this.flashcardAiManageService || !result.deckId) {
        throw new Error('Thiếu FlashcardAiManageService hoặc deckId checkpoint');
      }

      const total = Math.max(10, Math.min(200, payload.count ?? 60));
      const batchSize = 25;
      const batchIdx = Math.max(0, step.stepIndex - 1);
      const remaining = total - batchIdx * batchSize;
      const currentBatchCount = Math.max(1, Math.min(batchSize, remaining));

      const batchOut = await this.flashcardAiManageService.generateWithAi(
        userId,
        {
          conversationId,
          target: { kind: 'deck', deckId: result.deckId },
          documentIds: docIds,
          count: currentBatchCount,
          types: ['basic', 'cloze'],
          instructions: payload.instructions?.trim() || '',
        },
      );

      result.createdCount = (result.createdCount ?? 0) + batchOut.stats.saved;
      step.artifactId = result.deckId;
      step.detail = `Đã thêm ${batchOut.stats.saved} thẻ`;
      return;
    }

    if (jobType === 'bulk_quiz') {
      if (step.stepKey === 'prepare_quiz') {
        if (result.quizId) {
          step.artifactId = result.quizId;
          return;
        }
        if (!this.quizRepo) {
          throw new Error('QuizRepoService chưa được khởi tạo');
        }
        const emptyQuiz = await this.quizRepo.createQuizWithQuestions(
          userId,
          conversationId,
          {
            title: title || 'Đề kiểm tra tổng hợp AI',
            description: 'Tạo bởi tác vụ nền AI StudyMate',
            source: 'ai',
          },
          [],
        );
        result.quizId = emptyQuiz.id;
        result.createdCount = 0;
        step.artifactId = emptyQuiz.id;
        step.detail = `Đã khởi tạo Quiz "${emptyQuiz.title}"`;
        return;
      }

      if (!this.quizManageService || !this.quizRepo || !result.quizId) {
        throw new Error('Thiếu QuizManageService/QuizRepo hoặc quizId checkpoint');
      }

      const total = Math.max(5, Math.min(100, payload.count ?? 30));
      const batchSize = 15;
      const batchIdx = Math.max(0, step.stepIndex - 1);
      const currentBatchCount = Math.max(
        1,
        Math.min(batchSize, total - batchIdx * batchSize),
      );

      const generated = await this.quizManageService.generateWithAI(
        userId,
        conversationId,
        {
          documentIds: docIds === 'all' ? undefined : docIds,
          questionCount: currentBatchCount,
          types: [QuestionTypeEnum.single_choice, QuestionTypeEnum.short_answer],
          difficulty: 'applied',
        },
      );

      const questionsToAppend: QuestionCreatePayload[] = generated.questions.map(
        (q, idx) => ({
          question_type: q.type,
          order_index: (result.createdCount ?? 0) + idx,
          question_text: q.text,
          points: q.points,
          options: q.options as unknown as Prisma.InputJsonValue,
          sample_answer: q.sampleAnswer ?? null,
          grading_criteria: (q.gradingCriteria ??
            []) as unknown as Prisma.InputJsonValue,
          explanation: q.explanation ?? null,
          bloom_level: q.bloomLevel ?? null,
        }),
      );

      if (questionsToAppend.length > 0) {
        await this.quizRepo.addQuizQuestions(
          result.quizId,
          userId,
          questionsToAppend,
        );
      }
      await this.quizManageService.deleteQuiz(userId, generated.id).catch(() => {});

      result.createdCount =
        (result.createdCount ?? 0) + questionsToAppend.length;
      step.artifactId = result.quizId;
      step.detail = `Đã thêm ${questionsToAppend.length} câu hỏi`;
      return;
    }

    if (jobType === 'deep_multi_doc_summary') {
      if (step.stepKey === 'collect_sources') {
        step.detail = `Đã chuẩn bị ngữ cảnh từ ${docIds === 'all' ? 'toàn bộ tài liệu' : `${docIds.length} tài liệu`}`;
        return;
      }
      if (!this.summariesService) {
        throw new Error('SummariesService chưa được khởi tạo');
      }
      const created = await this.summariesService.createSummary(
        userId,
        conversationId,
        {
          scope:
            docIds === 'all' ? SummaryScope.CONVERSATION : SummaryScope.DOCUMENT,
          documentIds: docIds === 'all' ? undefined : docIds,
          mode: SummaryMode.STUDY_GUIDE,
          length: SummaryLength.DETAILED,
          customInstruction: payload.instructions,
        },
      );
      result.summaryId = created.id;
      step.artifactId = created.id;
      step.detail = `Đã tạo Note "${created.title}"`;
      return;
    }

    // batch_study_workflow: Summary -> Flashcards -> Quiz
    if (step.stepKey === 'step_summary') {
      if (!this.summariesService) {
        throw new Error('SummariesService chưa được khởi tạo');
      }
      const created = await this.summariesService.createSummary(
        userId,
        conversationId,
        {
          scope:
            docIds === 'all' ? SummaryScope.CONVERSATION : SummaryScope.DOCUMENT,
          documentIds: docIds === 'all' ? undefined : docIds,
          mode: SummaryMode.STUDY_GUIDE,
          length: SummaryLength.STANDARD,
          customInstruction: payload.instructions,
        },
      );
      result.summaryId = created.id;
      step.artifactId = created.id;
      step.detail = `Đã tạo Note "${created.title}"`;
      return;
    }

    if (step.stepKey === 'step_flashcards') {
      if (!this.flashcardAiManageService) {
        throw new Error('FlashcardAiManageService chưa được khởi tạo');
      }
      const cardCount = Math.max(5, Math.min(30, payload.count ?? 20));
      const deckOut = await this.flashcardAiManageService.generateWithAi(
        userId,
        {
          conversationId,
          target: { kind: 'new' },
          documentIds: docIds,
          count: cardCount,
          types: ['basic', 'cloze'],
          deckName: payload.deckName?.trim() || `${title} — Flashcards`,
          instructions: payload.instructions?.trim() || '',
        },
      );
      result.deckId = deckOut.deckId;
      result.createdCount = deckOut.stats.saved;
      step.artifactId = deckOut.deckId;
      step.detail = `Đã tạo Deck ${deckOut.stats.saved} thẻ`;
      return;
    }

    if (step.stepKey === 'step_quiz') {
      if (!this.quizManageService) {
        throw new Error('QuizManageService chưa được khởi tạo');
      }
      const quizOut = await this.quizManageService.generateWithAI(
        userId,
        conversationId,
        {
          documentIds: docIds === 'all' ? undefined : docIds,
          questionCount: Math.max(5, Math.min(20, payload.count ?? 15)),
          types: [QuestionTypeEnum.single_choice, QuestionTypeEnum.true_false],
          difficulty: 'applied',
        },
      );
      result.quizId = quizOut.id;
      step.artifactId = quizOut.id;
      step.detail = `Đã tạo Quiz ${quizOut.questions.length} câu hỏi`;
    }
  }

  private buildCompletionText(
    jobType: AgentBackgroundJobType,
    title: string,
    result: AgentBackgroundJobResult,
  ): string {
    switch (jobType) {
      case 'bulk_flashcards':
        return `Tác vụ nền **"${title}"** đã hoàn tất: tạo **${result.createdCount ?? 0} flashcards** mới trong bộ thẻ (ID: \`${result.deckId ?? ''}\`). Bạn có thể mở tab Flashcards để học ngay.`;
      case 'bulk_quiz':
        return `Tác vụ nền **"${title}"** đã hoàn tất: tạo bài kiểm tra gồm **${result.createdCount ?? 0} câu hỏi** (ID: \`${result.quizId ?? ''}\`).`;
      case 'deep_multi_doc_summary':
        return `Tác vụ nền **"${title}"** đã hoàn tất: bản ghi chú tổng hợp chuyên sâu đã được lưu vào tab Tóm tắt (ID: \`${result.summaryId ?? ''}\`).`;
      case 'batch_study_workflow':
        return `Chuỗi học tập **"${title}"** đã hoàn tất toàn bộ 3 bước (Note: \`${result.summaryId ?? ''}\`, Flashcards: \`${result.deckId ?? ''}\`, Quiz: \`${result.quizId ?? ''}\`).`;
    }
  }

  private async appendSessionMessageSafe(
    chatSessionId: string,
    text: string,
  ): Promise<void> {
    try {
      const msgId = this.generateMsgId();
      const uiMsg = {
        id: msgId,
        role: 'assistant',
        parts: [{ type: 'text', text }],
      };
      await this.prisma.message.create({
        data: {
          id: msgId,
          chat_session_id: chatSessionId,
          role: 'assistant',
          message_json: uiMsg as unknown as Prisma.InputJsonValue,
          source_chunks: [],
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Không thể chèn thông báo hoàn tất job vào chatSession=${chatSessionId}: ${msg}`,
      );
    }
  }

  async onApplicationShutdown() {
    if (this.worker) {
      await this.worker.close().catch(() => {});
    }
  }
}
