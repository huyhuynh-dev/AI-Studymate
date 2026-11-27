import { describe, it, expect } from 'vitest';
import type { UIMessage } from 'ai';
import type { ResolvedWorkspaceContext } from '../prompts/workspace-context.types.js';
import {
  extractRecentSingleTurnDocumentId,
  hasResolvedClarificationInCurrentChain,
  resolveArtifactSourceTarget,
} from './clarification-policy.helper.js';

const DOC_A = '11111111-1111-4111-8111-111111111111';
const DOC_B = '22222222-2222-4222-8222-222222222222';
const DOC_C = '33333333-3333-4333-8333-333333333333';

const AVAILABLE_DOCS = [
  { documentId: DOC_A, fileName: 'Chuong1.pdf' },
  { documentId: DOC_B, fileName: 'Chuong2.pdf' },
  { documentId: DOC_C, fileName: 'BaiTap.pdf' },
];

function makeBaseWorkspaceContext(
  overrides?: Partial<ResolvedWorkspaceContext>,
): ResolvedWorkspaceContext {
  return {
    location: {
      pageType: 'conversation',
      conversationId: 'conv-1',
      activeTab: 'documents',
    },
    inventory: {
      documentsCount: 3,
      readyDocumentsCount: 3,
      notesCount: 0,
      decksCount: 0,
      quizzesCount: 0,
    },
    guards: {
      examIntegrityGuard: false,
      hideFlashcardAnswerGuard: false,
    },
    ...overrides,
  };
}

describe('clarification-policy.helper', () => {
  describe('resolveArtifactSourceTarget (6-tier deterministic resolution)', () => {
    it('Bậc 0: trả empty_workspace khi không có tài liệu ready', () => {
      const res = resolveArtifactSourceTarget({
        toolKind: 'flashcards',
        availableDocuments: [],
      });
      expect(res.status).toBe('empty_workspace');
    });

    it('Bậc 1: ưu tiên explicit documentIds hợp lệ và bỏ qua ID lạ', () => {
      const res = resolveArtifactSourceTarget({
        toolKind: 'quiz',
        explicitDocumentIds: ['unknown-id', DOC_B, DOC_B],
        availableDocuments: AVAILABLE_DOCS,
        attachedDocumentIds: [DOC_A],
      });
      expect(res).toEqual({
        status: 'resolved',
        documentIds: [DOC_B],
        resolutionKind: 'explicit',
      });
    });

    it('OQ1-A: summary với scope="conversation" nhưng user chỉ nói mơ hồ "Tóm tắt giúp mình" và có >= 2 file -> vẫn hỏi làm rõ', () => {
      const messages: UIMessage[] = [
        {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'Tóm tắt giúp mình' }],
        },
      ];
      const res = resolveArtifactSourceTarget({
        toolKind: 'summary',
        explicitConversationScope: true,
        availableDocuments: AVAILABLE_DOCS,
        messages,
      });
      expect(res.status).toBe('needs_clarification');
      if (res.status === 'needs_clarification') {
        expect(res.candidates).toHaveLength(3);
      }
    });

    it('OQ1-A: summary với scope="conversation" và user nói rõ "tóm tắt tất cả tài liệu" -> chạy luôn', () => {
      const messages: UIMessage[] = [
        {
          id: 'u1',
          role: 'user',
          parts: [
            { type: 'text', text: 'Hãy tóm tắt tất cả tài liệu trong phiên' },
          ],
        },
      ];
      const res = resolveArtifactSourceTarget({
        toolKind: 'summary',
        explicitConversationScope: true,
        availableDocuments: AVAILABLE_DOCS,
        messages,
      });
      expect(res).toEqual({
        status: 'resolved',
        documentIds: [DOC_A, DOC_B, DOC_C],
        resolutionKind: 'explicit_conversation_all',
      });
    });

    it('Bậc 2: ưu tiên attachedDocumentIds hơn viewingDocument', () => {
      const ctx = makeBaseWorkspaceContext({
        documentsView: {
          viewMode: 'viewer',
          viewingDocument: {
            documentId: DOC_B,
            fileName: 'Chuong2.pdf',
            viewerKind: 'pdf',
          },
        },
      });
      const res = resolveArtifactSourceTarget({
        toolKind: 'flashcards',
        availableDocuments: AVAILABLE_DOCS,
        attachedDocumentIds: [DOC_C],
        workspaceContext: ctx,
      });
      expect(res).toEqual({
        status: 'resolved',
        documentIds: [DOC_C],
        resolutionKind: 'attached',
      });
    });

    it('Bậc 3: giải mã từ viewingDocument đang mở trên UI hoặc sidePanel', () => {
      const ctxViewing = makeBaseWorkspaceContext({
        documentsView: {
          viewMode: 'viewer',
          viewingDocument: {
            documentId: DOC_B,
            fileName: 'Chuong2.pdf',
            viewerKind: 'pdf',
          },
        },
      });
      expect(
        resolveArtifactSourceTarget({
          toolKind: 'flashcards',
          availableDocuments: AVAILABLE_DOCS,
          workspaceContext: ctxViewing,
        }),
      ).toEqual({
        status: 'resolved',
        documentIds: [DOC_B],
        resolutionKind: 'viewing',
      });

      const ctxSidePanel = makeBaseWorkspaceContext({
        location: {
          pageType: 'conversation',
          conversationId: 'conv-1',
          activeTab: 'quiz',
        },
        sidePanel: {
          documentId: DOC_A,
          fileName: 'Chuong1.pdf',
          pageNo: 4,
        },
      });
      expect(
        resolveArtifactSourceTarget({
          toolKind: 'quiz',
          availableDocuments: AVAILABLE_DOCS,
          workspaceContext: ctxSidePanel,
        }),
      ).toEqual({
        status: 'resolved',
        documentIds: [DOC_A],
        resolutionKind: 'viewing',
      });
    });

    it('Bậc 4: tự chạy luôn khi chỉ có duy nhất 1 tài liệu ready', () => {
      const res = resolveArtifactSourceTarget({
        toolKind: 'quiz',
        availableDocuments: [{ documentId: DOC_A, fileName: 'Chuong1.pdf' }],
      });
      expect(res).toEqual({
        status: 'resolved',
        documentIds: [DOC_A],
        resolutionKind: 'single_doc',
      });
    });

    it('Bậc 5: tự dùng tài liệu duy nhất vừa thao tác ở lượt ngay trước', () => {
      const messages: UIMessage[] = [
        {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'Giải thích trang 5 Chương 2' }],
        },
        {
          id: 'a1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-getDocumentSectionOrPages',
              toolCallId: 'tc-1',
              state: 'output-available',
              input: { documentId: DOC_B, pageNumbers: [5] },
              output: { documentId: DOC_B, fileName: 'Chuong2.pdf', chunks: [] },
            } as any,
            { type: 'text', text: 'Trang 5 trình bày cây AVL...' },
          ],
        },
        {
          id: 'u2',
          role: 'user',
          parts: [{ type: 'text', text: 'Tạo flashcard giúp mình' }],
        },
      ];

      expect(
        extractRecentSingleTurnDocumentId(messages, new Set([DOC_A, DOC_B, DOC_C])),
      ).toBe(DOC_B);

      const res = resolveArtifactSourceTarget({
        toolKind: 'flashcards',
        availableDocuments: AVAILABLE_DOCS,
        messages,
      });
      expect(res).toEqual({
        status: 'resolved',
        documentIds: [DOC_B],
        resolutionKind: 'recent_turn',
      });
    });

    it('Nguồn mơ hồ (>= 2 file, không mở/attach/recent, chưa hỏi) -> trả needs_clarification kèm đủ candidates', () => {
      const res = resolveArtifactSourceTarget({
        toolKind: 'flashcards',
        availableDocuments: AVAILABLE_DOCS,
        messages: [
          {
            id: 'u1',
            role: 'user',
            parts: [{ type: 'text', text: 'Tạo flashcard giúp mình' }],
          },
        ],
      });
      expect(res.status).toBe('needs_clarification');
      if (res.status === 'needs_clarification') {
        expect(res.missingField).toBe('documentIds');
        expect(res.candidates).toEqual(AVAILABLE_DOCS);
      }
    });
  });

  describe('Anti-Repeat Clarification Isolation', () => {
    it('trả true khi client vừa submit câu trả lời cho askUserQuestion', () => {
      const messages: UIMessage[] = [
        {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'Tạo flashcard giúp mình' }],
        },
        {
          id: 'a1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-askUserQuestion',
              toolCallId: 'ask-1',
              state: 'output-available',
              input: { questions: [{ id: 'doc', question: 'Chọn tài liệu?' }] },
              output: { answers: [{ id: 'doc', answer: 'Tất cả tài liệu trong phiên' }] },
            } as any,
          ],
        },
      ];
      expect(hasResolvedClarificationInCurrentChain(messages)).toBe(true);
      const res = resolveArtifactSourceTarget({
        toolKind: 'flashcards',
        availableDocuments: AVAILABLE_DOCS,
        messages,
      });
      expect(res).toEqual({
        status: 'resolved',
        documentIds: [DOC_A, DOC_B, DOC_C],
        resolutionKind: 'anti_repeat_all',
      });
    });

    it('trả true khi người dùng bỏ qua widget askUserQuestion và nhắn tiếp "cứ làm mặc định đi"', () => {
      const messages: UIMessage[] = [
        {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'Tạo quiz giúp mình' }],
        },
        {
          id: 'a1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-askUserQuestion',
              toolCallId: 'ask-1',
              state: 'output-available',
              input: { questions: [{ id: 'doc', question: 'Chọn tài liệu?' }] },
              output: { skipped: true },
            } as any,
          ],
        },
        {
          id: 'u2',
          role: 'user',
          parts: [{ type: 'text', text: 'cứ làm mặc định đi' }],
        },
      ];
      expect(hasResolvedClarificationInCurrentChain(messages)).toBe(true);
    });

    it('KHÔNG rò rỉ Anti-Repeat từ yêu cầu cũ đã hoàn tất sang một yêu cầu mới hoàn toàn', () => {
      const messages: UIMessage[] = [
        {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'Tạo flashcard giúp mình' }],
        },
        {
          id: 'a1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-askUserQuestion',
              toolCallId: 'ask-1',
              state: 'output-available',
              input: { questions: [{ id: 'doc', question: 'Chọn tài liệu?' }] },
              output: { answers: [{ id: 'doc', answer: 'Chuong1.pdf' }] },
            } as any,
            {
              type: 'tool-createFlashcards',
              toolCallId: 'fc-1',
              state: 'output-available',
              input: { documentIds: [DOC_A] },
              output: { deckId: 'deck-1', status: 'created' },
            } as any,
            { type: 'text', text: 'Mình đã tạo xong bộ thẻ rồi nhé!' },
          ],
        },
        {
          id: 'u2',
          role: 'user',
          parts: [{ type: 'text', text: 'Bây giờ tạo quiz giúp mình' }],
        },
      ];

      expect(hasResolvedClarificationInCurrentChain(messages)).toBe(false);
    });
  });
});
