import { describe, expect, it, vi } from 'vitest';
import { WorkspaceMutationService } from './workspace-mutation.service.js';

describe('WorkspaceMutationService', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const convId = '22222222-2222-4222-8222-222222222222';
  const sessionId = '33333333-3333-4333-8333-333333333333';

  it('khóa Exam Integrity Guard trên manageQuiz khi có lượt thi IN_PROGRESS trong DB', async () => {
    const mockAudit = { recordAction: vi.fn() };
    const mockQuizRepo = {
      findActiveInProgressExamAttempt: vi
        .fn()
        .mockResolvedValue({ id: 'attempt-1', status: 'in_progress' }),
      assertQuizOwnership: vi.fn(),
      deleteQuiz: vi.fn(),
    };

    const service = new WorkspaceMutationService(
      mockAudit as any,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockQuizRepo as any,
    );

    const out = await service.executeManageQuiz(
      { userId, conversationId: convId, chatSessionId: sessionId },
      { action: 'delete_quiz', quizId: 'quiz-1' },
      'tc-1',
    );

    expect(out.ok).toBe(false);
    expect(out.blockedReason).toBe('blocked_exam_integrity');
    expect(mockQuizRepo.deleteQuiz).not.toHaveBeenCalled();
    expect(mockAudit.recordAction).not.toHaveBeenCalled();
  });

  it('manageNotes create_manual lưu Note, ghi AuditLog và phát WorkspaceSyncEvent', async () => {
    const mockAudit = {
      recordAction: vi.fn().mockResolvedValue({ id: 'log-note-1' }),
    };
    const mockSummariesService = {
      createManualNote: vi.fn().mockResolvedValue({
        id: 'note-1',
        title: 'Sorting Notes',
        conversation_id: convId,
      }),
    };
    const mockSummariesRepo = {};
    const emit = vi.fn();

    const service = new WorkspaceMutationService(
      mockAudit as any,
      mockSummariesService as any,
      mockSummariesRepo as any,
    );

    const out = await service.executeManageNotes(
      {
        userId,
        conversationId: convId,
        chatSessionId: sessionId,
        syncNotifier: { emit },
      },
      {
        action: 'create_manual',
        title: 'Sorting Notes',
        markdownContent: '# QuickSort\nTrung bình $O(n \\log n)$',
      },
      'tc-2',
    );

    expect(out.ok).toBe(true);
    expect(out.actionLogId).toBe('log-note-1');
    expect(out.undoable).toBe(true);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'summary',
        action: 'created',
        entityId: 'note-1',
      }),
    );
  });

  it('manageEditableDocument update_content tạo Unified Diff, cập nhật file với optimistic lock và ghi before_state', async () => {
    const mockAudit = {
      recordAction: vi.fn().mockResolvedValue({ id: 'log-doc-update' }),
    };
    const mockDocsService = {
      getDocumentContent: vi.fn().mockResolvedValue({
        id: 'doc-md-1',
        fileName: 'notes.md',
        version: 2,
        content: '# Chương 2\nCâu văn lủng củng.\nKết luận.',
      }),
      updateDocumentContent: vi.fn().mockResolvedValue({ version: 3 }),
    };
    const emit = vi.fn();

    const service = new WorkspaceMutationService(
      mockAudit as any,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockDocsService as any,
    );

    const out = await service.executeManageEditableDocument(
      {
        userId,
        conversationId: convId,
        chatSessionId: sessionId,
        syncNotifier: { emit },
      },
      {
        action: 'update_content',
        documentId: 'doc-md-1',
        replaceSnippet: {
          oldSnippet: 'Câu văn lủng củng.',
          newSnippet: 'Câu văn mạch lạc và rõ ý hơn.',
        },
      },
      'tc-3',
    );

    expect(out.ok).toBe(true);
    expect(out.version).toBe(3);
    expect(out.diffPreview).toContain('- Câu văn lủng củng.');
    expect(out.diffPreview).toContain('+ Câu văn mạch lạc và rõ ý hơn.');
    expect(mockDocsService.updateDocumentContent).toHaveBeenCalledWith(
      userId,
      'doc-md-1',
      expect.objectContaining({ expectedVersion: 2 }),
    );
    expect(mockAudit.recordAction).toHaveBeenCalledWith(
      expect.objectContaining({
        riskTier: 'tier_2',
        beforeState: expect.objectContaining({
          documentId: 'doc-md-1',
          content: '# Chương 2\nCâu văn lủng củng.\nKết luận.',
        }),
      }),
    );
  });

  it('manageWorkspaceAndJobs update_preferences lưu theme + ngôn ngữ và phát theme_changed action', async () => {
    const mockAudit = {
      recordAction: vi.fn().mockResolvedValue({ id: 'log-pref-1' }),
    };
    const mockUsers = {
      getProfile: vi.fn().mockResolvedValue({
        daily_goal_minutes: 15,
        preferences: { theme: 'system', aiResponseLanguage: 'auto' },
      }),
      updateProfile: vi.fn().mockResolvedValue({
        daily_goal_minutes: 15,
        preferences: { theme: 'dark', aiResponseLanguage: 'vi' },
      }),
    };
    const emit = vi.fn();
    const emitAction = vi.fn();

    const service = new WorkspaceMutationService(
      mockAudit as any,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockUsers as any,
    );

    const out = await service.executeManageWorkspaceAndJobs(
      {
        userId,
        conversationId: convId,
        chatSessionId: sessionId,
        syncNotifier: { emit, emitAction },
      },
      {
        action: 'update_preferences',
        theme: 'dark',
        aiResponseLanguage: 'vi',
      },
      'tc-4',
    );

    expect(out.ok).toBe(true);
    expect(out.preferences).toEqual({
      theme: 'dark',
      aiResponseLanguage: 'vi',
      dailyGoalMinutes: 15,
    });
    expect(emitAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'theme_changed', theme: 'dark' }),
    );
  });
});
