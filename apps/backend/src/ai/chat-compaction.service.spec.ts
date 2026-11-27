import { describe, it, expect, vi } from 'vitest';
import type { ModelMessage, UIMessage } from 'ai';
import { ChatCompactionService } from './chat-compaction.service.js';

function makeLongHistory(turns: number, charsPerTurn: number): {
  modelMessages: ModelMessage[];
  uiMessages: UIMessage[];
} {
  const modelMessages: ModelMessage[] = [];
  const uiMessages: UIMessage[] = [];
  const filler = 'Kiến thức môn học về hệ phân tán và cơ sở dữ liệu. '.repeat(
    Math.ceil(charsPerTurn / 52),
  );

  for (let i = 1; i <= turns; i += 1) {
    const uText = `Câu hỏi ${i}: ${filler}`;
    const aText = `Trả lời ${i}: ${filler}`;
    uiMessages.push({
      id: `u-${i}`,
      role: 'user',
      parts: [{ type: 'text', text: uText }],
    });
    uiMessages.push({
      id: `a-${i}`,
      role: 'assistant',
      parts: [{ type: 'text', text: aText }],
    });
    modelMessages.push({ role: 'user', content: uText });
    modelMessages.push({ role: 'assistant', content: aText });
  }
  return { modelMessages, uiMessages };
}

describe('ChatCompactionService', () => {
  it('không gọi AiService khi tổng token dưới ngưỡng 24k', async () => {
    const aiMock = { generateTextForFeature: vi.fn() };
    const svc = new ChatCompactionService(aiMock as any);

    const { modelMessages, uiMessages } = makeLongHistory(5, 200);
    const res = await svc.compactIfNeeded({
      chatSessionId: 'sess-short',
      modelMessages,
      uiMessages,
    });

    expect(res.compacted).toBe(false);
    expect(res.fromCache).toBe(false);
    expect(aiMock.generateTextForFeature).not.toHaveBeenCalled();
  });

  it('kích hoạt FAST compaction khi vượt ngưỡng và tái sử dụng LRU cache ở lượt kế tiếp', async () => {
    const aiMock = {
      generateTextForFeature: vi.fn().mockResolvedValue({
        text: '**Mục tiêu:** Ôn thi\n**Artifact:** deckId=deck-99',
      }),
    };
    const svc = new ChatCompactionService(aiMock as any);

    // 7 lượt * ~20k chars ≈ 140k chars (~35k tokens > 24k)
    const { modelMessages, uiMessages } = makeLongHistory(7, 10_000);
    const first = await svc.compactIfNeeded({
      chatSessionId: 'sess-long',
      modelMessages,
      uiMessages,
    });

    expect(first.compacted).toBe(true);
    expect(first.fromCache).toBe(false);
    expect(first.usedFallback).toBe(false);
    expect(first.compactedTurns).toBe(3);
    expect(aiMock.generateTextForFeature).toHaveBeenCalledTimes(1);
    expect(aiMock.generateTextForFeature).toHaveBeenCalledWith(
      'CHAT_COMPACTION',
      expect.objectContaining({
        maxSummaryChars: 3000,
      }),
    );
    expect(String(first.messages[0]?.content)).toContain('deckId=deck-99');

    // Lượt thứ 8 ngắn: phải HIT cache 0ms và không gọi lại AiService
    const nextUi: UIMessage[] = [
      ...uiMessages,
      { id: 'u-8', role: 'user', parts: [{ type: 'text', text: 'Câu hỏi nối tiếp?' }] },
    ];
    const nextModel: ModelMessage[] = [
      ...modelMessages,
      { role: 'user', content: 'Câu hỏi nối tiếp?' },
    ];

    const second = await svc.compactIfNeeded({
      chatSessionId: 'sess-long',
      modelMessages: nextModel,
      uiMessages: nextUi,
    });

    expect(second.compacted).toBe(true);
    expect(second.fromCache).toBe(true);
    expect(aiMock.generateTextForFeature).toHaveBeenCalledTimes(1);
    expect(second.messages[0]).toEqual(first.messages[0]);
  });

  it('fallback về extractive compaction tất định nếu model FAST gặp lỗi', async () => {
    const aiMock = {
      generateTextForFeature: vi
        .fn()
        .mockRejectedValue(new Error('Provider rate limit')),
    };
    const svc = new ChatCompactionService(aiMock as any);

    const { modelMessages, uiMessages } = makeLongHistory(6, 12_000);
    const res = await svc.compactIfNeeded({
      chatSessionId: 'sess-fallback',
      modelMessages,
      uiMessages,
    });

    expect(res.compacted).toBe(true);
    expect(res.usedFallback).toBe(true);
    expect(String(res.messages[0]?.content)).toContain('<compacted_conversation_history');
  });

  it('giới hạn bộ nhớ cache ở mức 200 session theo LRU', async () => {
    const aiMock = {
      generateTextForFeature: vi.fn().mockResolvedValue({ text: 'Summary' }),
    };
    const svc = new ChatCompactionService(aiMock as any);
    const { modelMessages, uiMessages } = makeLongHistory(6, 200);

    for (let i = 0; i < 205; i += 1) {
      await svc.compactIfNeeded({
        chatSessionId: `sess-${i}`,
        modelMessages,
        uiMessages,
        triggerTokens: 10,
      });
    }

    expect(svc.getCacheSize()).toBe(200);
  });
});
