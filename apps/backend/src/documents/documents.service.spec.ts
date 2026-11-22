import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DocumentsService } from './documents.service.js';
import type { StorageService } from '../storage/storage.service.js';
import type { DocumentsRepoService } from '../repo/documents-repo/documents-repo.service.js';
import type { DocumentAssetsRepoService } from '../repo/document-assets-repo/document-assets-repo.service.js';
import type { ConversationsRepoService } from '../repo/conversations-repo/conversations-repo.service.js';
import type { DocumentsQueueService } from './services/documents-queue.service.js';
import type { GoogleDocsImportService } from './services/google-docs-import.service.js';
import {
  DOCX_MIME_TYPE,
  MAX_EDITABLE_TEXT_BYTES,
  ODT_MIME_TYPE,
} from './constants/editable-document.constants.js';

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
  let googleDocsImportService: {
    downloadPublicDocAsDocx: ReturnType<typeof vi.fn>;
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
      createDocument: vi.fn().mockImplementation((data) => ({
        ...baseDoc,
        ...data,
        file_size: Number(data.file_size ?? 0),
      })),
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
    googleDocsImportService = {
      downloadPublicDocAsDocx: vi.fn().mockResolvedValue({
        buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
        fileName: 'Đề cương môn học.docx',
        canonicalUrl: 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQr/edit',
        googleDocId: '1AbCdEfGhIjKlMnOpQr',
      }),
    };

    service = new DocumentsService(
      storageService as unknown as StorageService,
      documentsRepo as unknown as DocumentsRepoService,
      {} as unknown as DocumentAssetsRepoService,
      conversationsRepo as unknown as ConversationsRepoService,
      documentsQueueService as unknown as DocumentsQueueService,
      googleDocsImportService as unknown as GoogleDocsImportService,
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

  it('DOCX Optimistic Locking: getOverwriteUrl và completeOverwrite khớp version thì cập nhật nguyên tử, lệch version trả 409', async () => {
    documentsRepo.getDocumentById.mockResolvedValueOnce({
      ...baseDoc,
      file_name: 'report.docx',
      mime_type: DOCX_MIME_TYPE,
      content_version: 2,
    });

    const overwriteUrl = await service.getOverwriteUrl('user-1', 'doc-1', {
      expectedVersion: 2,
    });
    expect(overwriteUrl).toEqual({ uploadUrl: 'https://r2.signed/put' });

    documentsRepo.getDocumentById.mockResolvedValueOnce({
      ...baseDoc,
      file_name: 'report.docx',
      mime_type: DOCX_MIME_TYPE,
      content_version: 3,
    });
    await expect(
      service.getOverwriteUrl('user-1', 'doc-1', { expectedVersion: 2 }),
    ).rejects.toThrow(ConflictException);

    documentsRepo.getDocumentById.mockResolvedValueOnce({
      ...baseDoc,
      file_name: 'report.docx',
      mime_type: DOCX_MIME_TYPE,
      ocr_status: 'done',
      content_version: 2,
    });
    const updated = await service.completeOverwrite('user-1', 'doc-1', {
      expectedVersion: 2,
    });
    expect(documentsRepo.updateDocumentWithOptimisticLock).toHaveBeenCalledWith(
      'doc-1',
      'user-1',
      2,
      expect.objectContaining({
        content_version: 3,
        ocr_status: 'done',
        embed_status: 'pending',
      }),
    );
    expect(updated.content_version).toBe(3);

    documentsRepo.getDocumentById
      .mockResolvedValueOnce({
        ...baseDoc,
        file_name: 'report.docx',
        mime_type: DOCX_MIME_TYPE,
        content_version: 2,
      })
      .mockResolvedValueOnce({
        ...baseDoc,
        file_name: 'report.docx',
        mime_type: DOCX_MIME_TYPE,
        content_version: 4,
      });
    documentsRepo.updateDocumentWithOptimisticLock.mockResolvedValueOnce(null);

    await expect(
      service.completeOverwrite('user-1', 'doc-1', { expectedVersion: 2 }),
    ).rejects.toThrow(ConflictException);
  });

  it('importGoogleDoc: tải DOCX công khai, upload R2 với doc_metadata nguồn Google Docs và đẩy BullMQ job', async () => {
    const res = await service.importGoogleDoc('user-1', {
      conversationId: 'conv-1',
      url: 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQr/edit',
    });

    expect(googleDocsImportService.downloadPublicDocAsDocx).toHaveBeenCalledWith(
      'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQr/edit',
      undefined,
    );
    expect(storageService.uploadObjectBuffer).toHaveBeenCalledWith(
      expect.stringContaining('.docx'),
      expect.any(Buffer),
      DOCX_MIME_TYPE,
    );
    expect(documentsRepo.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        file_name: 'Đề cương môn học.docx',
        mime_type: DOCX_MIME_TYPE,
        doc_metadata: {
          source_type: 'google_docs',
          source_url: 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQr/edit',
          google_doc_id: '1AbCdEfGhIjKlMnOpQr',
        },
      }),
    );
    expect(documentsQueueService.addProcessingJob).toHaveBeenCalledTimes(1);
    expect(res.mime_type).toBe(DOCX_MIME_TYPE);
  });

  it('importGoogleDoc: dọn R2 object nếu lưu PostgreSQL thất bại', async () => {
    documentsRepo.createDocument.mockRejectedValueOnce(new Error('DB write failure'));

    await expect(
      service.importGoogleDoc('user-1', {
        conversationId: 'conv-1',
        url: 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQr/edit',
      }),
    ).rejects.toThrow('DB write failure');

    expect(storageService.deleteObject).toHaveBeenCalledTimes(1);
  });

  it('getDocumentPreview: trả về rawText đã trích xuất và readOnlyReason cho .doc / .odt', async () => {
    documentsRepo.getDocumentById.mockResolvedValueOnce({
      ...baseDoc,
      file_name: 'tai-lieu.odt',
      mime_type: ODT_MIME_TYPE,
      raw_text: '# Tiêu đề\nNội dung trích xuất bởi Docling',
      page_count: 2,
    });

    const preview = await service.getDocumentPreview('user-1', 'doc-1');

    expect(preview.fileName).toBe('tai-lieu.odt');
    expect(preview.rawText).toContain('Nội dung trích xuất bởi Docling');
    expect(preview.readOnlyReason).toContain('.odt');
  });
});
