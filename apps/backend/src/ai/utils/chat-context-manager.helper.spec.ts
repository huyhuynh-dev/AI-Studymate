import { describe, it, expect } from 'vitest';
import { convertToModelMessages, tool, type ModelMessage, type UIMessage } from 'ai';
import { z } from 'zod';
import {
  buildClearedToolSummariesMap,
  buildDeterministicExtractiveCompaction,
  clearOldToolResultsInModelMessages,
  estimateModelMessagesChars,
  splitMessagesForCompaction,
} from './chat-context-manager.helper.js';

function make12TurnConversation(): UIMessage[] {
  const messages: UIMessage[] = [];
  const largeText = 'Đây là nội dung tài liệu học thuật chi tiết về cây AVL và thuật toán cân bằng. '.repeat(80); // ~6,000 chars

  for (let t = 1; t <= 12; t += 1) {
    messages.push({
      id: `user-${t}`,
      role: 'user',
      parts: [{ type: 'text', text: `Câu hỏi lượt ${t}` }],
    });

    const parts: any[] = [
      {
        type: 'reasoning',
        text: `Suy luận nội bộ dài ở lượt ${t} `.repeat(30),
      },
    ];

    if (t === 1) {
      parts.push({
        type: 'tool-searchDocumentChunks',
        toolCallId: `tc-search-${t}`,
        state: 'output-available',
        input: { semanticQuery: 'cây AVL' },
        output: {
          semanticQuery: 'cây AVL',
          keywords: ['AVL'],
          totalChunks: 2,
          sources: [
            {
              documentId: 'doc-1',
              fileName: 'GT_CTDL.pdf',
              pageNumbers: [42, 43],
              chunkCount: 2,
            },
          ],
          chunks: [
            {
              citationId: 'c1',
              rank: 1,
              id: 'chunk-1',
              documentId: 'doc-1',
              fileName: 'GT_CTDL.pdf',
              chunkIndex: 1,
              pageNumbers: [42],
              headings: ['Cây AVL'],
              content: largeText,
              rrfScore: 0.9,
            },
            {
              citationId: 'c2',
              rank: 2,
              id: 'chunk-2',
              documentId: 'doc-1',
              fileName: 'GT_CTDL.pdf',
              chunkIndex: 2,
              pageNumbers: [43],
              headings: ['Phép xoay'],
              content: largeText,
              rrfScore: 0.85,
            },
          ],
        },
      });
    } else if (t === 2) {
      parts.push({
        type: 'tool-getNoteContent',
        toolCallId: `tc-note-${t}`,
        state: 'output-available',
        input: { summaryId: 'sum-1' },
        output: {
          found: true,
          summaryId: 'sum-1',
          title: 'Tóm tắt Chương 2',
          sectionOutline: ['H1: Cây tìm kiếm'],
          contentMarkdown: largeText,
          totalChars: largeText.length,
          charOffset: 0,
          truncated: false,
        },
      });
    } else if (t === 3) {
      parts.push({
        type: 'tool-getQuizContent',
        toolCallId: `tc-quiz-${t}`,
        state: 'output-available',
        input: { quizId: 'quiz-1' },
        output: {
          found: true,
          quizId: 'quiz-1',
          quizTitle: 'Kiểm tra giữa kỳ',
          examIntegrityEnforced: false,
          totalQuestions: 10,
          filteredCount: 10,
          returnedCount: 10,
          hasMore: false,
          questions: [
            {
              questionId: 'q1',
              displayNumber: 1,
              questionType: 'single_choice',
              questionText: largeText,
              points: 1,
              options: [],
            },
          ],
        },
      });
    } else if (t === 4) {
      parts.push({
        type: 'tool-createFlashcards',
        toolCallId: `tc-create-fc-${t}`,
        state: 'output-available',
        input: { count: 10 },
        output: {
          deckId: 'deck-created-4',
          deckName: 'Ôn tập Cây AVL',
          targetKind: 'new',
          savedCount: 10,
          requestedCount: 10,
          droppedCount: 0,
          types: ['basic', 'cloze'],
          documentNames: ['GT_CTDL.pdf'],
          createdAt: '2026-11-27T00:00:00.000Z',
        },
      });
    } else if (t === 5) {
      parts.push({
        type: 'tool-getDeckCards',
        toolCallId: `tc-deck-${t}`,
        state: 'output-available',
        input: { deckId: 'deck-created-4' },
        output: {
          found: true,
          deckId: 'deck-created-4',
          deckName: 'Ôn tập Cây AVL',
          totalCards: 10,
          dueCount: 5,
          filteredCount: 10,
          returnedCount: 10,
          hasMore: false,
          cards: [
            {
              cardId: 'card-1',
              cardType: 'basic',
              state: 'new',
              frontText: largeText,
              backText: largeText,
              answerHidden: false,
            },
          ],
        },
      });
    } else if (t === 6) {
      parts.push({
        type: 'tool-extractWebPage',
        toolCallId: `tc-web-${t}`,
        state: 'output-available',
        input: { urls: ['https://example.com/avl'], query: 'AVL rotation' },
        output: {
          query: 'AVL rotation',
          totalSuccess: 1,
          totalFailed: 0,
          results: [
            {
              citationId: 'w1',
              title: 'AVL Tree Guide',
              url: 'https://example.com/avl',
              domain: 'example.com',
              extractedContent: largeText,
            },
          ],
          failedResults: [],
        },
      });
    } else if (t === 11 || t === 12) {
      // 2 lượt gần nhất cũng có tool output nặng -> PHẢI giữ nguyên 100%
      parts.push({
        type: 'tool-searchDocumentChunks',
        toolCallId: `tc-recent-${t}`,
        state: 'output-available',
        input: { semanticQuery: `recent ${t}` },
        output: {
          semanticQuery: `recent ${t}`,
          keywords: ['recent'],
          totalChunks: 1,
          sources: [
            {
              documentId: 'doc-1',
              fileName: 'GT_CTDL.pdf',
              pageNumbers: [10],
              chunkCount: 1,
            },
          ],
          chunks: [
            {
              citationId: 'c1',
              rank: 1,
              id: `chunk-recent-${t}`,
              documentId: 'doc-1',
              fileName: 'GT_CTDL.pdf',
              chunkIndex: 1,
              pageNumbers: [10],
              headings: [],
              content: largeText,
              rrfScore: 0.9,
            },
          ],
        },
      });
    }

    parts.push({
      type: 'text',
      text: `Phản hồi lượt ${t}.`,
    });

    messages.push({
      id: `assistant-${t}`,
      role: 'assistant',
      parts,
    });
  }

  return messages;
}

function makeDummyTools(): Record<string, any> {
  const passThrough = () =>
    tool({
      description: 'dummy',
      inputSchema: z.object({}).passthrough(),
    });
  return {
    searchDocumentChunks: passThrough(),
    getNoteContent: passThrough(),
    getQuizContent: passThrough(),
    createFlashcards: passThrough(),
    getDeckCards: passThrough(),
    extractWebPage: passThrough(),
  };
}

describe('chat-context-manager.helper', () => {
  it('nén >85% tool đọc nặng ở các lượt cũ, giữ nguyên 2 lượt cuối, giữ createFlashcards & không mutate UIMessage gốc', async () => {
    const uiMessages = make12TurnConversation();
    const snapshotBefore = JSON.stringify(uiMessages);

    const clearedMap = buildClearedToolSummariesMap(uiMessages, 2);
    expect(clearedMap.has('tc-search-1')).toBe(true);
    expect(clearedMap.has('tc-note-2')).toBe(true);
    expect(clearedMap.has('tc-quiz-3')).toBe(true);
    expect(clearedMap.has('tc-deck-5')).toBe(true);
    expect(clearedMap.has('tc-web-6')).toBe(true);

    // Không nén createFlashcards và 2 lượt cuối
    expect(clearedMap.has('tc-create-fc-4')).toBe(false);
    expect(clearedMap.has('tc-recent-11')).toBe(false);
    expect(clearedMap.has('tc-recent-12')).toBe(false);

    const baseModelMessages = await convertToModelMessages(uiMessages, {
      tools: makeDummyTools(),
    });
    const charsBefore = estimateModelMessagesChars(baseModelMessages);

    const result = clearOldToolResultsInModelMessages(
      baseModelMessages,
      clearedMap,
    );
    const charsAfter = estimateModelMessagesChars(result.messages);

    // Không mutate đầu vào UIMessage gốc
    expect(JSON.stringify(uiMessages)).toBe(snapshotBefore);

    expect(result.clearedToolCount).toBe(5);
    expect(result.prunedReasoningCount).toBe(11);
    expect(charsAfter).toBeLessThan(charsBefore * 0.45);

    // Kiểm tra bất biến ghép cặp tool-call <-> tool-result (không bao giờ gây AI_MissingToolResultsError)
    const callIds = new Set<string>();
    for (const msg of result.messages) {
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        for (const p of msg.content) {
          if (p.type === 'tool-call') callIds.add(p.toolCallId);
        }
      } else if (msg.role === 'tool' && Array.isArray(msg.content)) {
        for (const p of msg.content) {
          if (p.type === 'tool-result') callIds.delete(p.toolCallId);
        }
      } else if (msg.role === 'user') {
        expect(callIds.size).toBe(0);
      }
    }
    expect(callIds.size).toBe(0);

    // 2 lượt cuối giữ nguyên nội dung raw lớn
    const recentToolMsg = result.messages.find(
      (m) =>
        m.role === 'tool' &&
        Array.isArray(m.content) &&
        m.content.some((p) => p.type === 'tool-result' && p.toolCallId === 'tc-recent-11'),
    );
    expect(recentToolMsg).toBeDefined();
    const recentOut = JSON.stringify(recentToolMsg);
    expect(recentOut).toContain('Đây là nội dung tài liệu học thuật');
  });

  it('splitMessagesForCompaction luôn cắt tại ranh giới user và giữ nguyên 4 lượt gần nhất', async () => {
    const uiMessages = make12TurnConversation();
    const baseModelMessages = await convertToModelMessages(uiMessages, {
      tools: makeDummyTools(),
    });

    const split = splitMessagesForCompaction(baseModelMessages, uiMessages, 4);
    expect(split).not.toBeNull();
    expect(split!.olderTurnCount).toBe(8);
    expect(split!.boundaryMessageId).toBe('user-8');
    expect(split!.recentMessages[0]?.role).toBe('user');

    // Kiểm tra không xẻ đôi tool-call / tool-result ở cuối olderMessages
    const pendingCallIds = new Set<string>();
    for (const m of split!.olderMessages) {
      if (m.role === 'assistant' && Array.isArray(m.content)) {
        for (const p of m.content) {
          if (p.type === 'tool-call') pendingCallIds.add(p.toolCallId);
        }
      } else if (m.role === 'tool' && Array.isArray(m.content)) {
        for (const p of m.content) {
          if (p.type === 'tool-result') pendingCallIds.delete(p.toolCallId);
        }
      }
    }
    expect(pendingCallIds.size).toBe(0);

    // Fallback tất định giữ nguyên artifact IDs
    const fallbackSummary = buildDeterministicExtractiveCompaction(
      split!.olderMessages,
    );
    expect(fallbackSummary).toContain('deck-created-4');
  });

  it('splitMessagesForCompaction trả null khi số lượt <= keepRecentTurns', () => {
    const shortModel: ModelMessage[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ];
    const shortUi: UIMessage[] = [
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
      { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'hello' }] },
    ];
    expect(splitMessagesForCompaction(shortModel, shortUi, 4)).toBeNull();
  });
});
