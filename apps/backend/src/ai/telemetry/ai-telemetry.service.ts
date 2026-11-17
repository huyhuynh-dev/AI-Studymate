import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RequestContextStore } from '../../common/context/request-context.js';
import { estimateAiCostUsd } from './ai-pricing.config.js';

export interface RawAiUsageLike {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  tokens?: number;
}

export interface RecordAiUsageInput {
  userId?: string | null;
  featureKey: string;
  profile: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  latencyMs: number;
  status: 'success' | 'error';
  errorMessage?: string | null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function estimateTokensFromChars(charCount: number): number {
  if (!Number.isFinite(charCount) || charCount <= 0) return 0;
  return Math.max(1, Math.ceil(charCount / 4));
}

export function extractNormalizedUsage(
  usage?: RawAiUsageLike | null,
  fallbackInputChars = 0,
  fallbackOutputChars = 0,
): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  const rawPrompt =
    usage?.inputTokens ?? usage?.promptTokens ?? usage?.tokens ?? undefined;
  const rawCompletion =
    usage?.outputTokens ?? usage?.completionTokens ?? undefined;

  const promptTokens =
    typeof rawPrompt === 'number' && Number.isFinite(rawPrompt)
      ? Math.max(0, Math.round(rawPrompt))
      : estimateTokensFromChars(fallbackInputChars);

  const completionTokens =
    typeof rawCompletion === 'number' && Number.isFinite(rawCompletion)
      ? Math.max(0, Math.round(rawCompletion))
      : estimateTokensFromChars(fallbackOutputChars);

  const rawTotal = usage?.totalTokens;
  const totalTokens =
    typeof rawTotal === 'number' && Number.isFinite(rawTotal) && rawTotal > 0
      ? Math.round(rawTotal)
      : promptTokens + completionTokens;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

export function resolveModelName(model: unknown, fallback = 'unknown'): string {
  if (typeof model === 'string' && model.trim()) {
    return model.trim().slice(0, 120);
  }
  if (model && typeof model === 'object') {
    const record = model as { modelId?: unknown; id?: unknown };
    if (typeof record.modelId === 'string' && record.modelId.trim()) {
      return record.modelId.trim().slice(0, 120);
    }
    if (typeof record.id === 'string' && record.id.trim()) {
      return record.id.trim().slice(0, 120);
    }
  }
  return fallback.slice(0, 120);
}

@Injectable()
export class AiTelemetryService {
  private readonly logger = new Logger(AiTelemetryService.name);

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  getCurrentUserId(): string | undefined {
    return RequestContextStore.getCurrentUserId();
  }

  recordUsage(input: RecordAiUsageInput): void {
    if (!this.prisma) {
      return;
    }

    const promptTokens = Math.max(0, Math.round(input.promptTokens));
    const completionTokens = Math.max(0, Math.round(input.completionTokens));
    const totalTokens =
      input.totalTokens !== undefined
        ? Math.max(0, Math.round(input.totalTokens))
        : promptTokens + completionTokens;

    const resolvedUserId = input.userId ?? this.getCurrentUserId() ?? null;
    const validUserId =
      resolvedUserId && UUID_REGEX.test(resolvedUserId) ? resolvedUserId : null;

    const estimatedCostUsd = estimateAiCostUsd({
      profile: input.profile,
      promptTokens,
      completionTokens,
    });

    void this.persistLog({
      user_id: validUserId,
      feature_key: input.featureKey.slice(0, 60),
      profile: input.profile.slice(0, 30),
      model_name: input.modelName.slice(0, 120),
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_cost_usd: estimatedCostUsd,
      latency_ms: Math.max(0, Math.round(input.latencyMs)),
      status: input.status,
      error_message: input.errorMessage
        ? input.errorMessage.slice(0, 1000)
        : null,
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Không thể ghi ai_usage_logs: ${msg}`);
    });
  }

  private async persistLog(data: {
    user_id: string | null;
    feature_key: string;
    profile: string;
    model_name: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number;
    latency_ms: number;
    status: string;
    error_message: string | null;
  }): Promise<void> {
    if (!this.prisma) return;
    await this.prisma.aiUsageLog.create({ data });
  }
}
