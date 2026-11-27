import { randomBytes } from 'node:crypto';
import { Injectable, Logger, Optional } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { estimateAiCostUsd } from './ai-pricing.config.js';

export type AgentGenAiSpanName =
  | 'invoke_agent'
  | 'chat'
  | 'execute_tool'
  | 'compaction'
  | 'hitl_approval';

export interface AgentGenAiSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: AgentGenAiSpanName;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  status: 'ok' | 'error';
  attributes: Record<string, string | number | boolean>;
}

export interface StartAgentTraceInput {
  userId?: string | null;
  conversationId?: string | null;
  chatSessionId?: string | null;
  modelName: string;
  promptVersion: string;
  uiPageType?: string | null;
  activeToolsCount: number;
}

export interface FinishAgentTraceInput {
  status: 'success' | 'approval_paused' | 'error' | 'aborted';
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  compacted?: boolean;
  errorMessage?: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function nowUnixNano(): string {
  return (BigInt(Date.now()) * 1_000_000n).toString();
}

function toUnixNanoFromMs(ms: number): string {
  return (BigInt(Math.max(0, Math.round(ms))) * 1_000_000n).toString();
}

function newHexId(byteLen: number): string {
  return randomBytes(byteLen).toString('hex');
}

export function buildOtlpExportPayload(spans: AgentGenAiSpan[]) {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            {
              key: 'service.name',
              value: { stringValue: 'studymate-backend-agent' },
            },
            {
              key: 'gen_ai.system',
              value: { stringValue: 'studymate.ai_sdk_v6' },
            },
          ],
        },
        scopeSpans: [
          {
            scope: {
              name: 'studymate.agent.telemetry',
              version: '1.0.0',
            },
            spans: spans.map((s) => ({
              traceId: s.traceId,
              spanId: s.spanId,
              ...(s.parentSpanId ? { parentSpanId: s.parentSpanId } : {}),
              name: s.name,
              kind: s.name === 'invoke_agent' ? 1 : 3,
              startTimeUnixNano: s.startTimeUnixNano,
              endTimeUnixNano: s.endTimeUnixNano,
              status: { code: s.status === 'ok' ? 1 : 2 },
              attributes: Object.entries(s.attributes).map(([k, v]) => {
                if (typeof v === 'boolean') {
                  return { key: k, value: { boolValue: v } };
                }
                if (typeof v === 'number') {
                  return Number.isInteger(v)
                    ? { key: k, value: { intValue: String(v) } }
                    : { key: k, value: { doubleValue: v } };
                }
                return { key: k, value: { stringValue: String(v) } };
              }),
            })),
          },
        ],
      },
    ],
  };
}

export class AgentTaskTraceSession {
  readonly traceId: string;
  readonly rootSpanId: string;
  private readonly startedAtMs: number;
  private readonly startNano: string;
  private readonly spans: AgentGenAiSpan[] = [];
  private stepCount = 0;
  private toolCallsCount = 0;
  private toolErrorsCount = 0;
  private hitlApprovalsCount = 0;
  private compacted = false;
  private finished = false;

  constructor(
    private readonly meta: StartAgentTraceInput,
    private readonly onComplete: (payload: {
      traceId: string;
      meta: StartAgentTraceInput;
      stepCount: number;
      toolCallsCount: number;
      toolErrorsCount: number;
      hitlApprovalsCount: number;
      compacted: boolean;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      latencyMs: number;
      status: 'success' | 'approval_paused' | 'error' | 'aborted';
      spans: AgentGenAiSpan[];
    }) => void,
  ) {
    this.traceId = newHexId(16);
    this.rootSpanId = newHexId(8);
    this.startedAtMs = Date.now();
    this.startNano = toUnixNanoFromMs(this.startedAtMs);
  }

  recordCompactionSpan(params: {
    compactedTurns: number;
    tokensBefore: number;
    tokensAfter: number;
    usedFallback: boolean;
  }): void {
    this.compacted = true;
    const now = nowUnixNano();
    this.spans.push({
      traceId: this.traceId,
      spanId: newHexId(8),
      parentSpanId: this.rootSpanId,
      name: 'compaction',
      startTimeUnixNano: now,
      endTimeUnixNano: now,
      status: 'ok',
      attributes: {
        'studymate.compacted_turns': params.compactedTurns,
        'studymate.tokens_before': params.tokensBefore,
        'studymate.tokens_after': params.tokensAfter,
        'studymate.used_fallback': params.usedFallback,
      },
    });
  }

  recordStepSpan(params: {
    stepNumber: number;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    finishReason?: string;
    durationMs?: number;
  }): void {
    this.stepCount += 1;
    const endMs = Date.now();
    const startMs =
      typeof params.durationMs === 'number'
        ? Math.max(this.startedAtMs, endMs - Math.max(1, params.durationMs))
        : endMs;
    this.spans.push({
      traceId: this.traceId,
      spanId: newHexId(8),
      parentSpanId: this.rootSpanId,
      name: 'chat',
      startTimeUnixNano: toUnixNanoFromMs(startMs),
      endTimeUnixNano: toUnixNanoFromMs(endMs),
      status: 'ok',
      attributes: {
        'gen_ai.request.model': this.meta.modelName,
        'studymate.step_index': params.stepNumber,
        'gen_ai.usage.input_tokens': params.inputTokens ?? 0,
        'gen_ai.usage.output_tokens': params.outputTokens ?? 0,
        'gen_ai.usage.cache_read_input_tokens': params.cacheReadTokens ?? 0,
        ...(params.finishReason
          ? { 'gen_ai.response.finish_reason': params.finishReason }
          : {}),
      },
    });
  }

  recordToolSpan(params: {
    toolName: string;
    toolCallId: string;
    riskTier: string;
    outcome: 'ok' | 'error' | 'approval_requested' | 'denied';
    durationMs?: number;
  }): void {
    this.toolCallsCount += 1;
    if (params.outcome === 'error') {
      this.toolErrorsCount += 1;
    }
    if (params.outcome === 'approval_requested') {
      this.hitlApprovalsCount += 1;
    }
    const endMs = Date.now();
    const startMs =
      typeof params.durationMs === 'number'
        ? Math.max(this.startedAtMs, endMs - Math.max(1, params.durationMs))
        : endMs;

    this.spans.push({
      traceId: this.traceId,
      spanId: newHexId(8),
      parentSpanId: this.rootSpanId,
      name:
        params.outcome === 'approval_requested'
          ? 'hitl_approval'
          : 'execute_tool',
      startTimeUnixNano: toUnixNanoFromMs(startMs),
      endTimeUnixNano: toUnixNanoFromMs(endMs),
      status: params.outcome === 'error' ? 'error' : 'ok',
      attributes: {
        'gen_ai.tool.name': params.toolName,
        'gen_ai.tool.call.id': params.toolCallId,
        'studymate.risk_tier': params.riskTier,
        'studymate.outcome': params.outcome,
      },
    });
  }

  finish(input: FinishAgentTraceInput): void {
    if (this.finished) return;
    this.finished = true;

    const finishedAtMs = Date.now();
    const latencyMs = Math.max(1, finishedAtMs - this.startedAtMs);
    if (input.compacted) {
      this.compacted = true;
    }

    const rootSpan: AgentGenAiSpan = {
      traceId: this.traceId,
      spanId: this.rootSpanId,
      name: 'invoke_agent',
      startTimeUnixNano: this.startNano,
      endTimeUnixNano: toUnixNanoFromMs(finishedAtMs),
      status: input.status === 'error' ? 'error' : 'ok',
      attributes: {
        'gen_ai.agent.name': 'studymate-tutor',
        'gen_ai.request.model': this.meta.modelName,
        ...(this.meta.conversationId
          ? { 'gen_ai.conversation.id': this.meta.conversationId }
          : {}),
        'studymate.prompt_version': this.meta.promptVersion,
        ...(this.meta.uiPageType
          ? { 'studymate.ui_page': this.meta.uiPageType }
          : {}),
        'studymate.active_tools_count': this.meta.activeToolsCount,
        'studymate.step_count': this.stepCount,
        'studymate.compacted': this.compacted,
        'studymate.status': input.status,
      },
    };

    this.onComplete({
      traceId: this.traceId,
      meta: this.meta,
      stepCount: this.stepCount,
      toolCallsCount: this.toolCallsCount,
      toolErrorsCount: this.toolErrorsCount,
      hitlApprovalsCount: this.hitlApprovalsCount,
      compacted: this.compacted,
      inputTokens: Math.max(0, Math.round(input.inputTokens ?? 0)),
      outputTokens: Math.max(0, Math.round(input.outputTokens ?? 0)),
      cacheReadTokens: Math.max(0, Math.round(input.cacheReadTokens ?? 0)),
      latencyMs,
      status: input.status,
      spans: [rootSpan, ...this.spans],
    });
  }
}

@Injectable()
export class AgentTelemetryService {
  private readonly logger = new Logger(AgentTelemetryService.name);

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  startTaskTrace(meta: StartAgentTraceInput): AgentTaskTraceSession {
    return new AgentTaskTraceSession(meta, (completed) => {
      void this.persistAndExport(completed).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Không thể ghi agent_traces: ${msg}`);
      });
    });
  }

  private parseOtlpHeaders(raw?: string): Record<string, string> {
    if (!raw?.trim()) return {};
    const headers: Record<string, string> = {};
    for (const pair of raw.split(',')) {
      const idx = pair.indexOf('=');
      if (idx <= 0) continue;
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      if (key && val) {
        headers[key] = val;
      }
    }
    return headers;
  }

  private async persistAndExport(payload: {
    traceId: string;
    meta: StartAgentTraceInput;
    stepCount: number;
    toolCallsCount: number;
    toolErrorsCount: number;
    hitlApprovalsCount: number;
    compacted: boolean;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    latencyMs: number;
    status: string;
    spans: AgentGenAiSpan[];
  }): Promise<void> {
    const validUserId =
      payload.meta.userId && UUID_REGEX.test(payload.meta.userId)
        ? payload.meta.userId
        : null;
    const validConvId =
      payload.meta.conversationId && UUID_REGEX.test(payload.meta.conversationId)
        ? payload.meta.conversationId
        : null;
    const validSessionId =
      payload.meta.chatSessionId && UUID_REGEX.test(payload.meta.chatSessionId)
        ? payload.meta.chatSessionId
        : null;

    const estimatedCostUsd = estimateAiCostUsd({
      profile: 'REASONING',
      promptTokens: payload.inputTokens,
      completionTokens: payload.outputTokens,
    });

    if (this.prisma?.agentTrace) {
      await this.prisma.agentTrace.create({
        data: {
          trace_id: payload.traceId,
          user_id: validUserId,
          conversation_id: validConvId,
          chat_session_id: validSessionId,
          model_name: payload.meta.modelName.slice(0, 120),
          prompt_version: payload.meta.promptVersion.slice(0, 40),
          ui_page_type: payload.meta.uiPageType?.slice(0, 40) ?? null,
          step_count: payload.stepCount,
          tool_calls_count: payload.toolCallsCount,
          tool_errors_count: payload.toolErrorsCount,
          hitl_approvals_count: payload.hitlApprovalsCount,
          compacted: payload.compacted,
          input_tokens: payload.inputTokens,
          output_tokens: payload.outputTokens,
          cache_read_tokens: payload.cacheReadTokens,
          estimated_cost_usd: estimatedCostUsd,
          latency_ms: payload.latencyMs,
          status: payload.status.slice(0, 20),
          spans_json: payload.spans as unknown as Prisma.InputJsonValue,
        },
      });
    }

    const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
    if (otlpEndpoint) {
      const otlpPayload = buildOtlpExportPayload(payload.spans);
      const customHeaders = this.parseOtlpHeaders(
        process.env.OTEL_EXPORTER_OTLP_HEADERS,
      );
      await fetch(otlpEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...customHeaders,
        },
        body: JSON.stringify(otlpPayload),
        signal: AbortSignal.timeout(5000),
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Không thể gửi OTLP trace tới [${otlpEndpoint}]: ${msg}`);
      });
    }
  }
}
