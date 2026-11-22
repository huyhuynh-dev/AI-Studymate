import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DocumentsService } from './documents.service.js';
import type { StorageService } from '../storage/storage.service.js';
import type { DocumentsRepoService } from '../repo/documents-repo/documents-repo.service.js';
import type { DocumentAssetsRepoService } from '../repo/document-assets-repo/document-assets-repo.service.js';
import type { ConversationsRepoService } from '../repo/conversations-repo/conversations-repo.service.js';
import type { DocumentsQueueService } from './services/documents-queue.service.js';
import { MAX_EDITABLE_TEXT_BYTES } from './constants/editable-document.constants.js';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let storageService: {
    getSignedUrlForUpload: ReturnType<typeof vi.fn>;
    headObject: ReturnType<typeof vi.fn>;
    getObjectBuffer: ReturnType<typeof vi.fn>;
    uploadObjectBuffer: ReturnType<typeof vi.fn>;
    deleteObject: ReturnType<typeof vi.fn>;
  };
  let documentsRepo: {
    getDocumentById: ReturnType<typeof vi.fn>;
    createDocument: ReturnType<typeof vi.fn>;
    updateDocument: ReturnType<typeof vi.fn>;
    updateDocumentWithOptimisticLock: ReturnType<typeof vi.fn>;
  };
  let conversationsRepo: {
    getConversationById: ReturnType<typeof vi.fn>;
  };
  let documentsQueueService: {
    addProcessingJob: ReturnType<typeof vi.fn>;
    enqueueContentReindexJob: ReturnType<typeof vi.fn>;
  };

  const baseDoc = {
    id: 'doc-1',
    conversation_id: 'conv-1',
    user_id: 'user-1',
    file_name: 'notes.md',
    mime_type: 'text/markdown',
    file_size: 24,
    file_hash: null as string | null,
    storage_key: 'users/user-1/conversations/conv-1/doc-1-notes.md',
    ocr_status: 'done',
    embed_status: 'done',
    content_version: 1,
    indexed_version: 1,
    sync_error: null,
    updated_at: new Date('2026-11-22T10:00:00Z'),
  };

  beforeEach(() => {
    storageService = {
      getSignedUrlForUpload: vi.fn().mockResolvedValue('https://r2.signed/put'),
      headObject: vi.fn().mockResolvedValue({ exists: true, contentLength: 2048 }),
      getObjectBuffer: vi.fn().mockResolvedValue(Buffer.from('# Xin chào\nNội dung', 'utf-8')),
      uploadObjectBuffer: vi.fn().mockResolvedValue(undefined),
      deleteObject: vi.fn().mockResolvedValue(undefined),
    };
    documentsRepo = {
      getDocumentById: vi.fn().mockResolvedValue(baseDoc),
      createDocument: vi.fn(),
      updateDocument: vi.fn().mockImplementation((_id, _uid, patch) => ({
        ...baseDoc,
        ...patch,
      })),
      updateDocumentWithOptimisticLock: vi
        .fn()
        .mockImplementation((_id, _uid, _ver, patch) => ({
          ...baseDoc,
          ...patch,
          file_size: Number(patch.file_size ?? baseDoc.file_size),
        })),
    };
    conversationsRepo = {
      getConversationById: vi.fn().mockResolvedValue({ id: 'conv-1' }),
    };
    documentsQueueService = {
      addProcessingJob: vi.fn().mockResolvedValue(undefined),
      enqueueContentReindexJob: vi.fn().mockResolvedValue(undefined),
    };

    service = new DocumentsService(
      storageService as unknown as StorageService,
      documentsRepo as unknown as DocumentsRepoService,
      {} as unknown as DocumentAssetsRepoService,
      conversationsRepo as unknown as ConversationsRepoService,
      documentsQueueService as unknown as DocumentsQueueService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('initUpload chuẩn hóa MIME khi tải tệp .md với application/octet-stream', async () => {
    const res = await service.initUpload('user-1', {
      conversationId: 'conv-1',
      fileName: 'lecture-notes.md',
      fileSize: 512,
      mimeType: 'application/octet-stream',
    });

    expect(res.mimeType).toBe('text/markdown');
    expect(storageService.getSignedUrlForUpload).toHaveBeenCalledWith(
      expect.stringContaining('lecture-notes.md'),
      'text/markdown',
    );
  });

  it('getDocumentContent trả về nội dung UTF-8 đầy đủ khi tệp <= 2MB và chuyển sang readOnly khi > 2MB', async () => {
    const normalRes = await service.getDocumentContent('user-1', 'doc-1');
    expect(normalRes.readOnly).toBe(false);
    expect(normalRes.isTruncated).toBe(false);
    expect(normalRes.content).toBe('# Xin chào\nNội dung');

    const oversizedBuf = Buffer.alloc(MAX_EDITABLE_TEXT_BYTES + 1024, 'a');
    storageService.getObjectBuffer.mockResolvedValueOnce(oversizedBuf);
    const largeRes = await service.getDocumentContent('user-1', 'doc-1');
    expect(largeRes.readOnly).toBe(true);
    expect(largeRes.isTruncated).toBe(true);
    expect(largeRes.content.length).toBeLessThan(oversizedBuf.length);
  });

  it('getDocumentContent từ chối định dạng PDF không phải văn bản thuần', async () => {
    documentsRepo.getDocumentById.mockResolvedValueOnce({
      ...baseDoc,
      file_name: 'slides.pdf',
      mime_type: 'application/pdf',
    });

    await expect(service.getDocumentContent('user-1', 'doc-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('updateDocumentContent đẩy lên R2, tăng version, giữ ocr_status=done và debounce re-index 4000ms', async () => {
    const res = await service.updateDocumentContent('user-1', 'doc-1', {
      content: '# Cập nhật\nNội dung mới',
      expectedVersion: 1,
    });

    expect(res.unchanged).toBe(false);
    expect(res.version).toBe(2);
    expect(storageService.uploadObjectBuffer).toHaveBeenCalledTimes(1);
    expect(documentsRepo.updateDocumentWithOptimisticLock).toHaveBeenCalledWith(
      'doc-1',
      'user-1',
      1,
      expect.objectContaining({
        content_version: 2,
        ocr_status: 'done',
        embed_status: 'pending',
      }),
    );
    expect(documentsQueueService.enqueueContentReindexJob).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        targetVersion: 2,
        isReindex: true,
      }),
      { delayMs: 4000 },
    );
  });

  it('updateDocumentContent bỏ qua hàng đợi (short-circuit) khi SHA-256 trùng khớp', async () => {
    const content = '# Nội dung giữ nguyên';
    const hash = createHash('sha256').update(Buffer.from(content, 'utf-8')).digest('hex');
    documentsRepo.getDocumentById.mockResolvedValueOnce({
      ...baseDoc,
      file_hash: hash,
      content_version: 3,
      indexed_version: 3,
      ocr_status: 'done',
      embed_status: 'done',
    });

    const res = await service.updateDocumentContent('user-1', 'doc-1', {
      content,
      expectedVersion: 3,
    });

    expect(res.unchanged).toBe(true);
    expect(storageService.uploadObjectBuffer).not.toHaveBeenCalled();
    expect(documentsQueueService.enqueueContentReindexJob).not.toHaveBeenCalled();
  });

  it('updateDocumentContent ném 409 Conflict khi expectedVersion lệch phiên bản', async () => {
    documentsRepo.getDocumentById.mockResolvedValueOnce({
      ...baseDoc,
      content_version: 5,
    });

    await expect(
      service.updateDocumentContent('user-1', 'doc-1', {
        content: 'Nội dung mới',
        expectedVersion: 4,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('completeOverwrite (PDF Phương án 2): tăng content_version, giữ ocr_status=done và xếp lịch re-index debounced', async () => {
    documentsRepo.getDocumentById.mockResolvedValueOnce({
      ...baseDoc,
      file_name: 'chapter1.pdf',
      mime_type: 'application/pdf',
      ocr_status: 'done',
      embed_status: 'done',
      content_version: 2,
      indexed_version: 2,
    });

    await service.completeOverwrite('user-1', 'doc-1');

    expect(documentsRepo.updateDocument).toHaveBeenCalledWith(
      'doc-1',
      'user-1',
      expect.objectContaining({
        content_version: 3,
        ocr_status: 'done',
        embed_status: 'pending',
      }),
    );
    expect(documentsQueueService.enqueueContentReindexJob).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        targetVersion: 3,
        isReindex: true,
      }),
      { delayMs: 4000 },
    );
  });
});
