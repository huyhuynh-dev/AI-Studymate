import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {
  AgentJobsQueueService,
  buildInitialStepLogs,
} from './agent-jobs-queue.service.js';
import { AgentJobsProcessor } from './agent-jobs.processor.js';
import type { AgentJobStepLog } from './agent-jobs.types.js';

describe('AgentJobsQueueService & AgentJobsProcessor (KB7)', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const convId = '22222222-2222-4222-8222-222222222222';
  const sessionId = '33333333-3333-4333-8333-333333333333';

  it('buildInitialStepLogs chia batch chính xác cho bulk_flashcards (60 thẻ -> 1 tạo deck + 3 batch)', () => {
    const steps = buildInitialStepLogs('bulk_flashcards', { count: 60 });
    expect(steps).toHaveLength(4);
    expect(steps[0].stepKey).toBe('create_deck');
    expect(steps[1].label).toContain('25 thẻ');
    expect(steps[3].label).toContain('10 thẻ');
  });

  it('retryFromCheckpoint giữ nguyên các bước completed và Processor chỉ chạy tiếp bước failed còn lại', async () => {
    let storedJob: any = {
      id: 'job-ckpt-1',
      user_id: userId,
      conversation_id: convId,
      chat_session_id: sessionId,
      job_type: 'bulk_flashcards',
      title: '100 Flashcards DSA',
      status: 'queued',
      progress_percent: 0,
      total_steps: 3,
      completed_steps: 0,
      step_logs: [
        {
          stepIndex: 0,
          stepKey: 'create_deck',
          label: 'Tạo Deck',
          status: 'pending',
        },
        {
          stepIndex: 1,
          stepKey: 'batch_cards_1',
          label: 'Batch 1',
          status: 'pending',
        },
        {
          stepIndex: 2,
          stepKey: 'batch_cards_2',
          label: 'Batch 2',
          status: 'pending',
        },
      ] satisfies AgentJobStepLog[],
      payload_json: { count: 50, deckName: 'DSA 50' },
      result_json: null,
      error_message: null,
      bullmq_job_id: null,
      started_at: null,
      finished_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const messageCreates: any[] = [];
    const mockPrisma = {
      agentBackgroundJob: {
        findUnique: vi.fn(async () => storedJob),
        update: vi.fn(async ({ data }: { data: any }) => {
          storedJob = { ...storedJob, ...data, updated_at: new Date() };
          return storedJob;
        }),
      },
      message: {
        create: vi.fn(async ({ data }: { data: any }) => {
          messageCreates.push(data);
          return data;
        }),
      },
    };

    const mockDeckService = {
      createDeck: vi.fn().mockResolvedValue({ id: 'deck-new-1', name: 'DSA 50' }),
    };

    let callNum = 0;
    const mockFlashcardAiManage = {
      generateWithAi: vi.fn(async () => {
        callNum += 1;
        if (callNum === 2) {
          throw new Error('Transient LLM rate limit');
        }
        return {
          deckId: 'deck-new-1',
          deckName: 'DSA 50',
          cards: [],
          stats: { requested: 25, saved: 25, dropped: 0, truncatedDocuments: 0 },
        };
      }),
    };

    const queueService = new AgentJobsQueueService(
      mockPrisma as any,
      new ConfigService({}),
    );
    const updates: string[] = [];
    const unsubscribe = queueService.subscribeUserJobs(userId, (dto) => {
      updates.push(`${dto.status}:${dto.progressPercent}`);
    });

    const processor = new AgentJobsProcessor(
      mockPrisma as any,
      new ConfigService({}),
      queueService,
      undefined,
      mockDeckService as any,
      mockFlashcardAiManage as any,
    );

    // Lần chạy 1: tạo deck xong, batch 1 xong, batch 2 fail
    await processor.processJobById('job-ckpt-1');
    expect(storedJob.status).toBe('failed');
    expect(storedJob.completed_steps).toBe(2);
    expect(storedJob.result_json.deckId).toBe('deck-new-1');
    expect(storedJob.result_json.createdCount).toBe(25);
    expect(mockDeckService.createDeck).toHaveBeenCalledTimes(1);
    expect(mockFlashcardAiManage.generateWithAi).toHaveBeenCalledTimes(2);

    // Retry từ checkpoint
    const retried = await queueService.retryFromCheckpoint(userId, 'job-ckpt-1');
    expect(retried.status).toBe('queued');
    expect(retried.stepLogs[0].status).toBe('completed');
    expect(retried.stepLogs[1].status).toBe('completed');
    expect(retried.stepLogs[2].status).toBe('pending');

    // Lần chạy 2: không tạo lại Deck và không chạy lại batch 1!
    await processor.processJobById('job-ckpt-1');
    expect(storedJob.status).toBe('completed');
    expect(storedJob.progress_percent).toBe(100);
    expect(storedJob.result_json.createdCount).toBe(50);
    expect(mockDeckService.createDeck).toHaveBeenCalledTimes(1);
    expect(mockFlashcardAiManage.generateWithAi).toHaveBeenCalledTimes(3);
    expect(messageCreates.length).toBe(2); // 1 fail msg + 1 completion msg
    expect(updates.some((u) => u.startsWith('completed:100'))).toBe(true);
    unsubscribe();
  });

  it('hủy tác vụ dừng trước khi chạy bước tiếp theo', async () => {
    let storedJob: any = {
      id: 'job-cancel-1',
      user_id: userId,
      conversation_id: convId,
      chat_session_id: null,
      job_type: 'deep_multi_doc_summary',
      title: 'Báo cáo sâu',
      status: 'queued',
      progress_percent: 0,
      total_steps: 2,
      completed_steps: 0,
      step_logs: buildInitialStepLogs('deep_multi_doc_summary', {}),
      payload_json: {},
      result_json: null,
      error_message: null,
      bullmq_job_id: null,
      started_at: null,
      finished_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const mockPrisma = {
      agentBackgroundJob: {
        findUnique: vi.fn(async () => storedJob),
        update: vi.fn(async ({ data }: { data: any }) => {
          storedJob = { ...storedJob, ...data };
          return storedJob;
        }),
      },
    };
    const queueService = new AgentJobsQueueService(
      mockPrisma as any,
      new ConfigService({}),
    );
    const cancelled = await queueService.cancelJob(userId, 'job-cancel-1');
    expect(cancelled.status).toBe('cancelled');

    const mockSummaries = { createSummary: vi.fn() };
    const processor = new AgentJobsProcessor(
      mockPrisma as any,
      new ConfigService({}),
      queueService,
      mockSummaries as any,
    );
    await processor.processJobById('job-cancel-1');
    expect(mockSummaries.createSummary).not.toHaveBeenCalled();
  });
});
