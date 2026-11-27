import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToModelMessages } from 'ai';
import {
  AgentTelemetryService,
  buildOtlpExportPayload,
} from './agent-telemetry.service.js';
import { ChatAgentAiService } from '../chat-agent-ai.service.js';

describe('AgentTelemetryService & HITL Approval Reconciliation', () => {
  afterEach(() => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    vi.restoreAllMocks();
  });

  it('ghi 1 trace hoàn chỉnh vào bảng agent_traces với spans chuẩn gen_ai.*', async () => {
    const createTrace = vi.fn().mockResolvedValue({ id: 'row-1' });
    const mockPrisma = { agentTrace: { create: createTrace } };
    const telemetry = new AgentTelemetryService(mockPrisma as any);

    const session = telemetry.startTaskTrace({
      userId: '11111111-1111-4111-8111-111111111111',
      conversationId: '22222222-2222-4222-8222-222222222222',
      chatSessionId: '33333333-3333-4333-8333-333333333333',
      modelName: 'cx/gpt-6-luna-medium',
      promptVersion: 'v4.0',
      uiPageType: 'conversation',
      activeToolsCount: 17,
    });

    session.recordCompactionSpan({
      compactedTurns: 4,
      tokensBefore: 25000,
      tokensAfter: 4000,
      usedFallback: false,
    });
    session.recordStepSpan({
      stepNumber: 1,
      inputTokens: 1200,
      outputTokens: 300,
      cacheReadTokens: 800,
      finishReason: 'tool-calls',
    });
    session.recordToolSpan({
      toolName: 'manageNotes',
      toolCallId: 'tc-1',
      riskTier: 'tier_1',
      outcome: 'ok',
    });
    session.finish({
      status: 'success',
      inputTokens: 1200,
      outputTokens: 300,
      cacheReadTokens: 800,
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(createTrace).toHaveBeenCalledTimes(1);
    const saved = createTrace.mock.calls[0][0].data;
    expect(saved.prompt_version).toBe('v4.0');
    expect(saved.compacted).toBe(true);
    expect(saved.step_count).toBe(1);
    expect(saved.tool_calls_count).toBe(1);
    expect(saved.cache_read_tokens).toBe(800);
    expect(Array.isArray(saved.spans_json)).toBe(true);
    expect(saved.spans_json[0].name).toBe('invoke_agent');
    expect(saved.spans_json[0].attributes['gen_ai.agent.name']).toBe(
      'studymate-tutor',
    );
  });

  it('xuất payload OTLP JSON chuẩn khi OTEL_EXPORTER_OTLP_ENDPOINT được cấu hình và fail-open nếu lỗi', async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318/v1/traces';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Connection refused'));

    const telemetry = new AgentTelemetryService(undefined);
    const session = telemetry.startTaskTrace({
      modelName: 'cx/gpt-6-luna-medium',
      promptVersion: 'v4.0',
      activeToolsCount: 17,
    });
    session.finish({ status: 'success' });

    await new Promise((r) => setTimeout(r, 10));
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const otlp = buildOtlpExportPayload([
      {
        traceId: 'a'.repeat(32),
        spanId: 'b'.repeat(16),
        name: 'invoke_agent',
        startTimeUnixNano: '1000',
        endTimeUnixNano: '2000',
        status: 'ok',
        attributes: { 'gen_ai.agent.name': 'studymate-tutor' },
      },
    ]);
    expect(otlp.resourceSpans[0].scopeSpans[0].spans[0].name).toBe(
      'invoke_agent',
    );
  });

  it('ChatAgentAiService.sanitizePendingToolCalls chuyển approval-requested bị bỏ qua thành output-denied hợp lệ với convertToModelMessages', async () => {
    const aiSvc = new ChatAgentAiService({} as any, {} as any);
    const incoming: any[] = [
      {
        id: 'u1',
        role: 'user',
        parts: [{ type: 'text', text: 'Xóa note A đi' }],
      },
      {
        id: 'a1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-manageNotes',
            toolCallId: 'tc-del-1',
            state: 'approval-requested',
            input: { action: 'delete_note', summaryId: 'sum-1' },
            approval: { id: 'appr-1' },
          },
        ],
      },
      {
        id: 'u2',
        role: 'user',
        parts: [{ type: 'text', text: 'Thôi đừng xóa nữa, giải thích bài tập đi' }],
      },
    ];

    const sanitized = aiSvc.sanitizePendingToolCalls(incoming);
    expect((sanitized[1].parts[0] as any).state).toBe('output-denied');
    expect((sanitized[1].parts[0] as any).approval.approved).toBe(false);

    const modelMsgs = await convertToModelMessages(sanitized);
    expect(modelMsgs.length).toBeGreaterThanOrEqual(4);
    expect(
      modelMsgs.some(
        (m) =>
          m.role === 'tool' &&
          Array.isArray(m.content) &&
          m.content.some((p: any) => p.type === 'tool-approval-response'),
      ),
    ).toBe(true);
  });
});
