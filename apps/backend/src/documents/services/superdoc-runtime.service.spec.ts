import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getActionDispositions } from '@superdoc/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCX_MIME_TYPE } from '../constants/editable-document.constants.js';
import {
  ADVERTISED_SUPERDOC_TOOLS,
  SuperDocRuntimeService,
  asSuperDocReceipt,
  didSuperDocReceiptMutate,
  extractSuperDocSdkError,
} from './superdoc-runtime.service.js';

describe('SuperDocRuntimeService', () => {
  let service: SuperDocRuntimeService;
  let storageService: { getObjectBuffer: ReturnType<typeof vi.fn> };
  let documentsRepo: { getDocumentById: ReturnType<typeof vi.fn> };

  const docxRecord = {
    id: 'doc-word-1',
    user_id: 'user-1',
    conversation_id: 'conv-1',
    file_name: 'De_cuong_on_tap.docx',
    mime_type: DOCX_MIME_TYPE,
    storage_key: 'docs/de-cuong.docx',
  };

  beforeEach(() => {
    storageService = {
      getObjectBuffer: vi.fn().mockResolvedValue(Buffer.from('r2-docx-bytes')),
    };
    documentsRepo = {
      getDocumentById: vi.fn().mockResolvedValue(docxRecord),
    };
    service = new SuperDocRuntimeService(
      storageService as any,
      documentsRepo as any,
    );
  });

  afterEach(async () => {
    await service.dispose();
  });

  describe('receipt & error helpers', () => {
    it('nên phát hiện đúng có thay đổi tài liệu qua revision trong receipt', () => {
      expect(
        didSuperDocReceiptMutate(
          asSuperDocReceipt({
            status: 'ok',
            preSnapshot: { revision: 'rev-1' },
            postSnapshot: { revision: 'rev-2' },
          }),
          { action: 'insert_paragraph' },
        ),
      ).toBe(true);

      expect(
        didSuperDocReceiptMutate(
          asSuperDocReceipt({
            status: 'ok',
            preSnapshot: { revision: 'rev-1' },
            postSnapshot: { revision: 'rev-1' },
          }),
          { action: 'insert_paragraph' },
        ),
      ).toBe(false);

      expect(
        didSuperDocReceiptMutate(
          asSuperDocReceipt({ status: 'aborted' }),
          { action: 'insert_paragraph' },
        ),
      ).toBe(false);

      expect(
        didSuperDocReceiptMutate(
          asSuperDocReceipt({ status: 'ok' }),
          { action: 'insert_paragraph', dryRun: true },
        ),
      ).toBe(false);
    });

    it('nên trích xuất mã và thông điệp lỗi chuẩn hóa từ SDK error', () => {
      expect(
        extractSuperDocSdkError({ code: 'NOT_FOUND', message: 'Không thấy' }),
      ).toEqual({ code: 'NOT_FOUND', message: 'Không thấy' });

      expect(extractSuperDocSdkError('Unexpected failure')).toEqual({
        code: 'SUPERDOC_ERROR',
        message: 'Unexpected failure',
      });
    });
  });

  describe('validateToolCallPolicy', () => {
    it('nên từ chối công cụ không nằm trong danh sách được cấp phép', () => {
      const result = service.validateToolCallPolicy(
        'superdoc_unknown_tool',
        { action: 'anything' },
        'tracked',
      );
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('TOOL_NOT_ADVERTISED');
      }
    });

    it('nên từ chối khi superdoc_perform_action thiếu tên action', () => {
      const result = service.validateToolCallPolicy(
        'superdoc_perform_action',
        {},
        'tracked',
      );
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('INVALID_ARGUMENT');
      }
    });

    it('ở chế độ tracked nên ép changeMode=tracked cho action hỗ trợ và cho phép comment direct', () => {
      const dispositions = getActionDispositions();
      const nonStreaming = new Set([
        'insert_paragraphs',
        'insert_heading',
        'replace_text',
        'rewrite_block',
        'fill_placeholders',
      ]);
      const firstTrackedAction = Object.entries(dispositions).find(
        ([name, d]) => d === 'tracked' && !nonStreaming.has(name),
      )?.[0];
      expect(firstTrackedAction).toBeDefined();

      const trackedRes = service.validateToolCallPolicy(
        'superdoc_perform_action',
        { action: firstTrackedAction!, changeMode: 'direct' },
        'tracked',
      );
      expect(trackedRes).toEqual({
        allowed: true,
        normalizedArgs: {
          action: firstTrackedAction!,
          changeMode: 'tracked',
        },
      });

      const commentRes = service.validateToolCallPolicy(
        'superdoc_perform_action',
        { action: 'add_comments', changeMode: 'direct' },
        'tracked',
      );
      expect(commentRes).toEqual({
        allowed: true,
        normalizedArgs: {
          action: 'add_comments',
          changeMode: 'direct',
        },
      });
    });

    it('ở chế độ tracked nên chặn action chỉ hỗ trợ direct không nằm trong allowlist', () => {
      const dispositions = getActionDispositions();
      const nonTrackedAction = Object.entries(dispositions).find(
        ([name, d]) =>
          d !== 'tracked' &&
          name !== 'add_comments' &&
          name !== 'comment_paragraphs' &&
          name !== 'reply_to_comment' &&
          name !== 'resolve_comments',
      )?.[0];

      if (!nonTrackedAction) {
        return;
      }

      const rejected = service.validateToolCallPolicy(
        'superdoc_perform_action',
        { action: nonTrackedAction },
        'tracked',
      );
      expect(rejected.allowed).toBe(false);
      if (!rejected.allowed) {
        expect(rejected.code).toBe('CHANGE_MODE_REQUIRED');
      }
    });

    it('ở chế độ direct nên tôn trọng thao tác trực tiếp', () => {
      const res = service.validateToolCallPolicy(
        'superdoc_perform_action',
        { action: 'insert_table' },
        'direct',
      );
      expect(res).toEqual({
        allowed: true,
        normalizedArgs: {
          action: 'insert_table',
          changeMode: 'direct',
        },
      });
    });

    it('nên quảng bá đủ 5 công cụ Full preset và chặn rewrite_block / doc.replace để ép dùng superdoc_stream_text', () => {
      expect(Array.from(ADVERTISED_SUPERDOC_TOOLS).sort()).toEqual([
        'superdoc_api_call',
        'superdoc_api_search',
        'superdoc_inspect',
        'superdoc_perform_action',
        'superdoc_stream_text',
      ]);

      const blockedAction = service.validateToolCallPolicy(
        'superdoc_perform_action',
        { action: 'rewrite_block', targetText: 'A', newText: 'B' },
        'tracked',
      );
      expect(blockedAction.allowed).toBe(false);
      if (!blockedAction.allowed) {
        expect(blockedAction.code).toBe('STREAM_TEXT_REQUIRED');
      }

      const blockedApi = service.validateToolCallPolicy(
        'superdoc_api_call',
        { operationId: 'doc.replace', args: {} },
        'direct',
      );
      expect(blockedApi.allowed).toBe(false);
      if (!blockedApi.allowed) {
        expect(blockedApi.code).toBe('STREAM_TEXT_REQUIRED');
      }

      const bibTracked = service.validateToolCallPolicy(
        'superdoc_api_call',
        { operationId: 'doc.citations.bibliography.insert', args: {} },
        'tracked',
      );
      expect(bibTracked.allowed).toBe(false);
      if (!bibTracked.allowed) {
        expect(bibTracked.code).toBe('DIRECT_MODE_REQUIRED');
      }

      const batchNormalized = service.validateToolCallPolicy(
        'superdoc_api_call',
        {
          changeMode: 'tracked',
          calls: [
            { operationId: 'doc.citations.sources.insert', args: {} },
            { operationId: 'doc.tables.insertRow', args: {} },
          ],
        },
        'tracked',
      );
      expect(batchNormalized).toEqual({
        allowed: true,
        normalizedArgs: {
          calls: [
            {
              operationId: 'doc.citations.sources.insert',
              args: {},
              changeMode: 'direct',
            },
            {
              operationId: 'doc.tables.insertRow',
              args: {},
              changeMode: 'tracked',
            },
          ],
        },
      });
    });
  });

  describe('working snapshot staging & fallback', () => {
    it('nên từ chối nếu không tìm thấy tài liệu hoặc không phải DOCX', async () => {
      documentsRepo.getDocumentById.mockResolvedValueOnce(null);
      await expect(
        service.assertOwnedDocxDocument('user-1', 'missing-id'),
      ).rejects.toThrow(NotFoundException);

      documentsRepo.getDocumentById.mockResolvedValueOnce({
        ...docxRecord,
        file_name: 'notes.pdf',
        mime_type: 'application/pdf',
      });
      await expect(
        service.assertOwnedDocxDocument('user-1', 'doc-pdf'),
      ).rejects.toThrow(BadRequestException);
    });

    it('nên stage snapshot từ client, ưu tiên đọc lại và xóa về R2 khi clearWorkingSnapshot', async () => {
      const stagedBytes = Buffer.from('browser-dirty-docx-bytes');
      const staged = await service.stageClientWorkingSnapshot(
        'user-1',
        'doc-word-1',
        stagedBytes,
      );

      expect(staged.staged).toBe(true);
      expect(staged.byteLength).toBe(stagedBytes.length);

      const active = await service.getWorkingSnapshotBuffer(
        'user-1',
        'doc-word-1',
      );
      expect(active.buffer.equals(stagedBytes)).toBe(true);
      expect(active.hasUnpersistedChanges).toBe(false);
      expect(storageService.getObjectBuffer).not.toHaveBeenCalled();

      await service.clearWorkingSnapshot('user-1', 'doc-word-1');
      const fallback = await service.getWorkingSnapshotBuffer(
        'user-1',
        'doc-word-1',
      );
      expect(fallback.buffer.toString()).toBe('r2-docx-bytes');
      expect(storageService.getObjectBuffer).toHaveBeenCalledWith(
        'docs/de-cuong.docx',
      );
    });
  });
});
