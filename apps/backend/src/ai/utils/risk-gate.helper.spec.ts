import { describe, expect, it } from 'vitest';
import {
  MAX_ACTIVE_TOOLS_BUDGET,
  buildUnifiedTextDiffPreview,
  evaluateToolRiskTier,
  requiresUserApproval,
  resolveActiveToolsForTurn,
} from './risk-gate.helper.js';

describe('risk-gate.helper', () => {
  describe('evaluateToolRiskTier & requiresUserApproval', () => {
    it('phân loại đúng Tier 0, Tier 1, Tier 2 cho manageNotes', () => {
      expect(evaluateToolRiskTier('manageNotes', { action: 'create_manual' })).toBe('tier_1');
      expect(evaluateToolRiskTier('manageNotes', { action: 'update_section' })).toBe('tier_1');
      expect(requiresUserApproval('manageNotes', { action: 'create_manual' })).toBe(false);

      expect(evaluateToolRiskTier('manageNotes', { action: 'delete_note' })).toBe('tier_2');
      expect(evaluateToolRiskTier('manageNotes', { action: 'batch_reorganize' })).toBe('tier_2');
      expect(evaluateToolRiskTier('manageNotes', { action: 'replace_content' })).toBe('tier_2');
      expect(requiresUserApproval('manageNotes', { action: 'delete_note' })).toBe(true);
    });

    it('phân loại đúng ngưỡng số lượng cho manageFlashcards', () => {
      expect(
        evaluateToolRiskTier('manageFlashcards', {
          action: 'add_cards',
          cards: [{ frontText: 'a', backText: 'b' }],
        }),
      ).toBe('tier_1');

      expect(
        evaluateToolRiskTier('manageFlashcards', {
          action: 'add_cards',
          cards: Array.from({ length: 6 }, () => ({ frontText: 'a', backText: 'b' })),
        }),
      ).toBe('tier_2');

      expect(
        evaluateToolRiskTier('manageFlashcards', {
          action: 'move_cards',
          cardIds: ['c1'],
        }),
      ).toBe('tier_1');

      expect(
        evaluateToolRiskTier('manageFlashcards', {
          action: 'move_cards',
          cardIds: ['c1', 'c2'],
        }),
      ).toBe('tier_2');

      expect(
        requiresUserApproval('manageFlashcards', { action: 'merge_duplicates' }),
      ).toBe(true);
    });

    it('phân loại đúng manageQuiz, manageEditableDocument, manageWorkspaceAndJobs', () => {
      expect(evaluateToolRiskTier('manageQuiz', { action: 'update_metadata' })).toBe('tier_1');
      expect(evaluateToolRiskTier('manageQuiz', { action: 'delete_quiz' })).toBe('tier_2');

      expect(evaluateToolRiskTier('manageEditableDocument', { action: 'read_content' })).toBe('tier_0');
      expect(evaluateToolRiskTier('manageEditableDocument', { action: 'save_as_new_document' })).toBe('tier_1');
      expect(evaluateToolRiskTier('manageEditableDocument', { action: 'update_content' })).toBe('tier_2');

      expect(evaluateToolRiskTier('manageWorkspaceAndJobs', { action: 'navigate' })).toBe('tier_0');
      expect(evaluateToolRiskTier('manageWorkspaceAndJobs', { action: 'update_preferences' })).toBe('tier_1');
      expect(evaluateToolRiskTier('manageWorkspaceAndJobs', { action: 'enqueue_background_job' })).toBe('tier_1');
      expect(requiresUserApproval('manageWorkspaceAndJobs', { action: 'undo_action' })).toBe(false);
    });
  });

  describe('buildUnifiedTextDiffPreview', () => {
    it('tạo unified diff sạch với số dòng thêm/xóa chính xác', () => {
      const before = '# Chương 1\nĐoạn cũ 1\nGiữ nguyên';
      const after = '# Chương 1\nĐoạn mới 1\nĐoạn mới 2\nGiữ nguyên';

      const preview = buildUnifiedTextDiffPreview(before, after, 40);
      expect(preview.removedLines).toBe(1);
      expect(preview.addedLines).toBe(2);
      expect(preview.truncated).toBe(false);
      expect(preview.diffText).toContain('- Đoạn cũ 1');
      expect(preview.diffText).toContain('+ Đoạn mới 1');
      expect(preview.diffText).toContain('+ Đoạn mới 2');
    });
  });

  describe('resolveActiveToolsForTurn', () => {
    const base12 = [
      'askUserQuestion',
      'searchDocumentChunks',
      'getDocumentSectionOrPages',
      'createDocumentSummary',
      'createFlashcards',
      'createQuiz',
      'getNoteContent',
      'getQuizContent',
      'getDeckCards',
      'searchWorkspaceResources',
      'searchInternet',
      'extractWebPage',
    ];
    const superdoc5 = [
      'superdoc_inspect',
      'superdoc_perform_action',
      'superdoc_stream_text',
      'superdoc_api_search',
      'superdoc_api_call',
    ];
    const phase4Five = [
      'manageNotes',
      'manageFlashcards',
      'manageQuiz',
      'manageEditableDocument',
      'manageWorkspaceAndJobs',
    ];

    it('giữ đủ 17 tools ở chế độ thường (< 20)', () => {
      const result = resolveActiveToolsForTurn({
        registeredToolNames: [...base12, ...phase4Five],
        hasActiveWordDocument: false,
      });
      expect(result).toHaveLength(17);
      expect(result.length).toBeLessThanOrEqual(MAX_ACTIVE_TOOLS_BUDGET);
    });

    it('giữ <= 17 tools khi mở Word ở tác vụ chung và giữ <= 19 khi mở Word + nhắc Flashcard/Quiz', () => {
      const wordGeneral = resolveActiveToolsForTurn({
        registeredToolNames: [...base12, ...superdoc5, ...phase4Five],
        hasActiveWordDocument: true,
        lastUserMessageText: 'Kiểm tra lỗi diễn đạt chương 2 giúp mình',
      });
      expect(wordGeneral).toHaveLength(17);
      expect(wordGeneral).toContain('superdoc_api_search');
      expect(wordGeneral).not.toContain('manageEditableDocument');

      const wordWithQuiz = resolveActiveToolsForTurn({
        registeredToolNames: [...base12, ...superdoc5, ...phase4Five],
        hasActiveWordDocument: true,
        lastUserMessageText: 'Tạo thêm flashcard và kiểm tra quiz từ tài liệu này',
      });
      expect(wordWithQuiz).toHaveLength(19);
      expect(wordWithQuiz).toContain('manageFlashcards');
      expect(wordWithQuiz).toContain('manageQuiz');
      expect(wordWithQuiz).not.toContain('superdoc_api_search');
      expect(wordWithQuiz.length).toBeLessThanOrEqual(MAX_ACTIVE_TOOLS_BUDGET);
    });
  });
});
