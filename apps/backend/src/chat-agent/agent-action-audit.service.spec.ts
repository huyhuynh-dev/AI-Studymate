import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AgentActionAuditService } from './agent-action-audit.service.js';

describe('AgentActionAuditService', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const convId = '22222222-2222-4222-8222-222222222222';

  it('ghi nhận action và hoàn tác tạo Note thủ công thành công', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const updateLog = vi.fn().mockResolvedValue({});
    const mockTx = {
      summary: { deleteMany },
      agentActionLog: { update: updateLog },
    };
    const mockPrisma = {
      agentActionLog: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'log-1',
          user_id: userId,
          conversation_id: convId,
          tool_name: 'manageNotes',
          action_name: 'create_manual',
          risk_tier: 'tier_1',
          status: 'executed',
          resource_type: 'note',
          resource_ids: ['note-1'],
          summary_text: 'Tạo ghi chú "Ôn tập"',
          before_state: null,
          after_state: { summaryId: 'note-1' },
          undoable: true,
          undone_at: null,
          expires_at: new Date(Date.now() + 60_000),
          created_at: new Date(),
        }),
      },
      $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockTx)),
    };

    const service = new AgentActionAuditService(mockPrisma as any);
    const res = await service.undoAction(userId, 'log-1');

    expect(res.ok).toBe(true);
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'note-1' } });
    expect(updateLog).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log-1' },
        data: expect.objectContaining({ status: 'undone', undoable: false }),
      }),
    );
    expect(res.syncEvents[0]).toMatchObject({
      resource: 'summary',
      action: 'deleted',
      entityId: 'note-1',
    });
  });

  it('hoàn tác delete_deck khôi phục lại bộ thẻ và danh sách flashcards kèm trạng thái SRS', async () => {
    const createDeck = vi.fn().mockResolvedValue({});
    const createManyCards = vi.fn().mockResolvedValue({ count: 1 });
    const updateLog = vi.fn().mockResolvedValue({});
    const mockTx = {
      flashcardDeck: { create: createDeck },
      flashcard: { createMany: createManyCards },
      agentActionLog: { update: updateLog },
    };
    const mockPrisma = {
      agentActionLog: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'log-deck-del',
          user_id: userId,
          conversation_id: convId,
          tool_name: 'manageFlashcards',
          action_name: 'delete_deck',
          risk_tier: 'tier_2',
          status: 'executed',
          resource_type: 'deck',
          resource_ids: ['deck-9'],
          summary_text: 'Xóa bộ thẻ Giải thuật',
          before_state: {
            deck: {
              id: 'deck-9',
              conversation_id: convId,
              name: 'Giải thuật',
              description: 'Ôn thi',
            },
            cards: [
              {
                id: 'card-1',
                card_type: 'basic',
                front_text: 'QuickSort avg?',
                back_text: 'O(n log n)',
                state: 'review',
                interval: 5,
                ease_factor: 2.6,
              },
            ],
          },
          after_state: null,
          undoable: true,
          undone_at: null,
          expires_at: new Date(Date.now() + 60_000),
          created_at: new Date(),
        }),
      },
      $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockTx)),
    };

    const service = new AgentActionAuditService(mockPrisma as any);
    const res = await service.undoAction(userId, 'log-deck-del');

    expect(res.ok).toBe(true);
    expect(createDeck).toHaveBeenCalledTimes(1);
    expect(createManyCards).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            id: 'card-1',
            deck_id: 'deck-9',
            state: 'review',
            interval: 5,
            ease_factor: 2.6,
          }),
        ],
      }),
    );
  });

  it('hoàn tác idempotent nếu log đã ở trạng thái undone và chặn user khác', async () => {
    const mockPrisma = {
      agentActionLog: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'log-done',
            user_id: userId,
            conversation_id: convId,
            status: 'undone',
            resource_type: 'note',
            resource_ids: ['n1'],
          })
          .mockResolvedValueOnce({
            id: 'log-other',
            user_id: 'other-user',
          })
          .mockResolvedValueOnce(null),
      },
    };

    const service = new AgentActionAuditService(mockPrisma as any);
    const already = await service.undoAction(userId, 'log-done');
    expect(already.ok).toBe(true);
    expect(already.alreadyUndone).toBe(true);

    await expect(service.undoAction(userId, 'log-other')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.undoAction(userId, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('hoàn tác update_content tài liệu văn bản thông qua DocumentsService và phát sync event', async () => {
    const updateLog = vi.fn().mockResolvedValue({});
    const mockPrisma = {
      agentActionLog: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'log-doc-1',
          user_id: userId,
          conversation_id: convId,
          tool_name: 'manageEditableDocument',
          action_name: 'update_content',
          risk_tier: 'tier_2',
          status: 'executed',
          resource_type: 'document',
          resource_ids: ['doc-1'],
          summary_text: 'Cập nhật notes.md',
          before_state: { documentId: 'doc-1', content: '# Old Markdown' },
          after_state: { version: 3 },
          undoable: true,
          expires_at: new Date(Date.now() + 60_000),
          created_at: new Date(),
        }),
        update: updateLog,
      },
    };
    const mockDocsService = {
      getDocumentContent: vi.fn().mockResolvedValue({
        id: 'doc-1',
        fileName: 'notes.md',
        version: 3,
      }),
      updateDocumentContent: vi.fn().mockResolvedValue({ version: 4 }),
    };

    const service = new AgentActionAuditService(
      mockPrisma as any,
      mockDocsService as any,
    );
    const res = await service.undoAction(userId, 'log-doc-1');

    expect(res.ok).toBe(true);
    expect(mockDocsService.updateDocumentContent).toHaveBeenCalledWith(
      userId,
      'doc-1',
      { content: '# Old Markdown', expectedVersion: 3 },
    );
    expect(res.syncEvents[0]).toMatchObject({
      resource: 'document',
      action: 'updated',
      entityId: 'doc-1',
      version: 4,
    });
  });
});
