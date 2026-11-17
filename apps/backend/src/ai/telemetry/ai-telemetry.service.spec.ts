import { describe, expect, it, vi } from 'vitest';
import { RequestContextStore } from '../../common/context/request-context.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { estimateAiCostUsd } from './ai-pricing.config.js';
import {
  AiTelemetryService,
  extractNormalizedUsage,
} from './ai-telemetry.service.js';

describe('AiTelemetryService & Pricing', () => {
  it('nên trích xuất đúng chuẩn AI SDK v6 (inputTokens/outputTokens) và fallback khi undefined', () => {
    const v6 = extractNormalizedUsage({
      inputTokens: 1200,
      outputTokens: 300,
      totalTokens: 1500,
    });
    expect(v6).toEqual({
      promptTokens: 1200,
      completionTokens: 300,
      totalTokens: 1500,
    });

    const fallback = extractNormalizedUsage(undefined, 400, 80);
    expect(fallback.promptTokens).toBe(100);
    expect(fallback.completionTokens).toBe(20);
    expect(fallback.totalTokens).toBe(120);
  });

  it('nên tính chi phí ước tính chính xác theo từng profile và miễn phí cho model local', () => {
    const reasoningCost = estimateAiCostUsd({
      profile: 'REASONING',
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    });
    expect(reasoningCost).toBe(6.25);

    const localCost = estimateAiCostUsd({
      profile: 'EMBEDDING',
      promptTokens: 500_000,
      completionTokens: 0,
    });
    expect(localCost).toBe(0);
  });

  it('nên tự động lấy userId từ RequestContextStore và ghi log không chặn khi DB lỗi', async () => {
    const createMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('DB connection temporarily unavailable'));
    const prismaMock = {
      aiUsageLog: { create: createMock },
    } as unknown as PrismaService;

    const service = new AiTelemetryService(prismaMock);
    const validUserId = '11111111-1111-4111-8111-111111111111';

    expect(() =>
      RequestContextStore.runWithUserContext(validUserId, () => {
        service.recordUsage({
          featureKey: 'QUIZ_GENERATE',
          profile: 'REASONING',
          modelName: 'cx/gpt-6-luna-medium',
          promptTokens: 1000,
          completionTokens: 500,
          latencyMs: 320,
          status: 'success',
        });
      }),
    ).not.toThrow();

    await Promise.resolve();

    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: validUserId,
        feature_key: 'QUIZ_GENERATE',
        profile: 'REASONING',
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
        status: 'success',
      }),
    });
  });
});
