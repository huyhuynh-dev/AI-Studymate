import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SummariesService } from './summaries.service.js';
import { SummaryScope, SummaryMode, SummaryLength } from './dto/create-summary.dto.js';

describe('SummariesService', () => {
  let service: SummariesService;
  let summariesRepo: any;
  let conversationsRepo: any;
  let documentsRepo: any;
  let aiService: any;
  let storageService: any;
  let pdfExportService: any;

  beforeEach(() => {
    summariesRepo = {
      createSummary: vi.fn(),
      getSummariesByConversationId: vi.fn(),
      getSummaryById: vi.fn(),
      updateSummary: vi.fn(),
      deleteSummary: vi.fn(),
    };

    conversationsRepo = {
      getConversationById: vi.fn(),
    };

    documentsRepo = {
      getAllDocumentsByConversationId: vi.fn(),
      getDocumentById: vi.fn(),
    };

    aiService = {
      generateSummary: vi.fn(),
      refineSummary: vi.fn(),
    };

    storageService = {
      headObject: vi.fn(),
      uploadObjectBuffer: vi.fn(),
      getSignedUrlForUpload: vi.fn(),
      getSignedUrlForDownload: vi.fn(),
      deleteObject: vi.fn(),
    };

    pdfExportService = {
      convertBlockNoteToHtml: vi.fn(),
      renderHtmlToPdf: vi.fn(),
    };

    service = new SummariesService(
      summariesRepo,
      conversationsRepo,
      documentsRepo,
      aiService,
      storageService,
      pdfExportService,
    );
  });

  it('nên khởi tạo thành công', () => {
    expect(service).toBeDefined();
  });

  describe('createSummary', () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const conversationId = '22222222-2222-2222-2222-222222222222';
    const documentId = '33333333-3333-3333-3333-333333333333';

    it('nên tạo bản tóm tắt cho toàn bộ cuộc trò chuyện thành công', async () => {
      conversationsRepo.getConversationById.mockResolvedValue({ id: conversationId, user_id: userId });
      documentsRepo.getAllDocumentsByConversationId.mockResolvedValue([
        { id: documentId, file_name: 'test.pdf', ocr_status: 'done', raw_text: 'Nội dung ôn tập' },
      ]);
      aiService.generateSummary.mockResolvedValue({
        title: 'Tóm tắt bài học',
        blocks: [{ type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Tóm tắt' }] }],
      });
      summariesRepo.createSummary.mockResolvedValue({
        id: 'sum-1',
        conversation_id: conversationId,
        title: 'Tóm tắt bài học',
        content_json: [{ type: 'heading' }],
      });

      const result = await service.createSummary(userId, conversationId, {
        scope: SummaryScope.CONVERSATION,
        mode: SummaryMode.STUDY_GUIDE,
        length: SummaryLength.STANDARD,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('sum-1');
      expect(aiService.generateSummary).toHaveBeenCalled();
      expect(summariesRepo.createSummary).toHaveBeenCalled();
    });

    it('nên báo lỗi BadRequestException nếu cuộc trò chuyện chưa có tài liệu nào OCR xong', async () => {
      conversationsRepo.getConversationById.mockResolvedValue({ id: conversationId, user_id: userId });
      documentsRepo.getAllDocumentsByConversationId.mockResolvedValue([
        { id: documentId, file_name: 'test.pdf', ocr_status: 'pending', raw_text: null },
      ]);

      await expect(
        service.createSummary(userId, conversationId, {
          scope: SummaryScope.CONVERSATION,
          mode: SummaryMode.KEY_TAKEAWAYS,
          length: SummaryLength.SHORT,
        })
      ).rejects.toThrow('Chưa có tài liệu nào');
    });
  });

  describe('refineSummary', () => {
    it('nên tinh chỉnh bản tóm tắt theo chỉ dẫn người dùng', async () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const summaryId = 'sum-1';
      const conversationId = 'conv-1';

      summariesRepo.getSummaryById.mockResolvedValue({
        id: summaryId,
        conversation_id: conversationId,
        title: 'Tóm tắt cũ',
        content_json: [{ type: 'paragraph', content: [{ type: 'text', text: 'nội dung' }] }],
      });
      conversationsRepo.getConversationById.mockResolvedValue({ id: conversationId, user_id: userId });

      aiService.refineSummary.mockResolvedValue({
        title: 'Tóm tắt mới đã tinh chỉnh',
        blocks: [{ type: 'paragraph', content: [{ type: 'text', text: 'nội dung ngắn hơn' }] }],
      });

      summariesRepo.updateSummary.mockResolvedValue({
        id: summaryId,
        title: 'Tóm tắt mới đã tinh chỉnh',
        content_json: [{ type: 'paragraph' }],
      });

      const result = await service.refineSummary(userId, summaryId, {
        instruction: 'Hãy viết ngắn hơn',
      });

      expect(result).toBeDefined();
      expect(aiService.refineSummary).toHaveBeenCalled();
      expect(summariesRepo.updateSummary).toHaveBeenCalled();
    });
  });

  describe('exportPdf', () => {
    it('nên tạo và trả về link tải PDF', async () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const summaryId = 'sum-1';
      const conversationId = 'conv-1';

      summariesRepo.getSummaryById.mockResolvedValue({
        id: summaryId,
        conversation_id: conversationId,
        title: 'Tóm tắt Cấu trúc dữ liệu',
        content_json: [],
        pdf_storage_key: null,
      });
      conversationsRepo.getConversationById.mockResolvedValue({ id: conversationId, user_id: userId });

      pdfExportService.convertBlockNoteToHtml.mockReturnValue('<html></html>');
      pdfExportService.renderHtmlToPdf.mockResolvedValue(Buffer.from('PDF content'));
      storageService.uploadObjectBuffer.mockResolvedValue(undefined);
      summariesRepo.updateSummary.mockResolvedValue({});
      storageService.getSignedUrlForDownload.mockResolvedValue('https://r2.download.url/test.pdf');

      const result = await service.exportPdf(userId, summaryId);

      expect(result.downloadUrl).toBe('https://r2.download.url/test.pdf');
      expect(pdfExportService.renderHtmlToPdf).toHaveBeenCalled();
      expect(storageService.uploadObjectBuffer).toHaveBeenCalled();
    });

    it('nên xử lý an toàn khi xuất PDF cho ghi chú chưa có tiêu đề', async () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const summaryId = 'note-untitled';
      const conversationId = 'conv-1';

      summariesRepo.getSummaryById.mockResolvedValue({
        id: summaryId,
        conversation_id: conversationId,
        title: '   ',
        content_json: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nội dung ghi chú' }] }],
        pdf_storage_key: null,
      });
      conversationsRepo.getConversationById.mockResolvedValue({ id: conversationId, user_id: userId });
      pdfExportService.convertBlockNoteToHtml.mockReturnValue('<html></html>');
      pdfExportService.renderHtmlToPdf.mockResolvedValue(Buffer.from('PDF content'));
      storageService.uploadObjectBuffer.mockResolvedValue(undefined);
      summariesRepo.updateSummary.mockResolvedValue({});
      storageService.getSignedUrlForDownload.mockResolvedValue('https://r2.download.url/note.pdf');

      const result = await service.exportPdf(userId, summaryId);

      expect(result.downloadUrl).toBe('https://r2.download.url/note.pdf');
      expect(pdfExportService.convertBlockNoteToHtml).toHaveBeenCalledWith(
        'Ghi chú chưa có tiêu đề',
        expect.any(Array),
      );
      expect(storageService.getSignedUrlForDownload).toHaveBeenCalledWith(
        expect.stringContaining('Ghi-chu-hoc-tap'),
        'Ghi-chu-hoc-tap.pdf',
      );
    });
  });

  describe('createManualNote', () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const conversationId = '22222222-2222-2222-2222-222222222222';

    it('nên tạo trang ghi chú trống mà không cần tài liệu hoặc gọi AI', async () => {
      conversationsRepo.getConversationById.mockResolvedValue({ id: conversationId, user_id: userId });
      summariesRepo.createSummary.mockResolvedValue({
        id: 'note-1',
        conversation_id: conversationId,
        document_id: null,
        title: '',
        content_json: [],
      });

      const result = await service.createManualNote(userId, conversationId, {});

      expect(result.id).toBe('note-1');
      expect(aiService.generateSummary).not.toHaveBeenCalled();
      expect(documentsRepo.getAllDocumentsByConversationId).not.toHaveBeenCalled();
      expect(summariesRepo.createSummary).toHaveBeenCalledWith({
        conversation_id: conversationId,
        document_id: null,
        title: '',
        content_json: [],
      });
    });

    it('nên trim tiêu đề và lưu content_json khi người dùng truyền dữ liệu khởi tạo', async () => {
      const blocks = [{ type: 'paragraph', content: [{ type: 'text', text: 'Ý tưởng bài học' }] }];
      conversationsRepo.getConversationById.mockResolvedValue({ id: conversationId, user_id: userId });
      summariesRepo.createSummary.mockResolvedValue({
        id: 'note-2',
        conversation_id: conversationId,
        document_id: null,
        title: 'Ghi chú chương 1',
        content_json: blocks,
      });

      const result = await service.createManualNote(userId, conversationId, {
        title: '  Ghi chú chương 1  ',
        content_json: blocks,
      });

      expect(result.title).toBe('Ghi chú chương 1');
      expect(summariesRepo.createSummary).toHaveBeenCalledWith({
        conversation_id: conversationId,
        document_id: null,
        title: 'Ghi chú chương 1',
        content_json: blocks,
      });
    });

    it('nên báo NotFoundException khi cuộc trò chuyện không tồn tại hoặc sai chủ sở hữu', async () => {
      conversationsRepo.getConversationById.mockResolvedValue(null);

      await expect(
        service.createManualNote(userId, conversationId, { title: 'Test' }),
      ).rejects.toThrow('Không tìm thấy cuộc trò chuyện');
      expect(summariesRepo.createSummary).not.toHaveBeenCalled();
    });
  });

  describe('updateSummary', () => {
    it('nên vô hiệu hóa cache pdf_storage_key khi chỉ cập nhật tiêu đề ghi chú', async () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const summaryId = 'note-1';
      const conversationId = 'conv-1';

      summariesRepo.getSummaryById.mockResolvedValue({
        id: summaryId,
        conversation_id: conversationId,
        title: 'Tiêu đề cũ',
        content_json: [],
        pdf_storage_key: 'old-key.pdf',
      });
      conversationsRepo.getConversationById.mockResolvedValue({ id: conversationId, user_id: userId });
      summariesRepo.updateSummary.mockResolvedValue({
        id: summaryId,
        conversation_id: conversationId,
        title: 'Tiêu đề mới',
        content_json: [],
        pdf_storage_key: null,
      });

      await service.updateSummary(userId, summaryId, { title: '  Tiêu đề mới  ' });

      expect(summariesRepo.updateSummary).toHaveBeenCalledWith(summaryId, {
        title: 'Tiêu đề mới',
        pdf_storage_key: null,
      });
    });
  });

  describe('Note Media (R2 Embed & Upload)', () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const conversationId = '22222222-2222-2222-2222-222222222222';
    const summaryId = '33333333-3333-3333-3333-333333333333';

    beforeEach(() => {
      summariesRepo.getSummaryById.mockResolvedValue({
        id: summaryId,
        conversation_id: conversationId,
        title: 'Ghi chú đa phương tiện',
        content_json: [],
        pdf_storage_key: null,
      });
      conversationsRepo.getConversationById.mockResolvedValue({
        id: conversationId,
        user_id: userId,
      });
    });

    it('initNoteMediaUpload nên cấp Presigned PUT URL và r2:// URI hợp lệ cho image/video/audio/file', async () => {
      storageService.getSignedUrlForUpload.mockResolvedValue('https://r2.upload.url/put');

      const res = await service.initNoteMediaUpload(userId, summaryId, {
        fileName: 'so-do-bai-hoc.png',
        fileSize: 2 * 1024 * 1024,
        mimeType: 'image/png',
        mediaKind: 'image',
      });

      expect(res.uploadUrl).toBe('https://r2.upload.url/put');
      expect(res.storageKey).toMatch(
        new RegExp(`^users/${userId}/conversations/${conversationId}/summaries/${summaryId}/media/`),
      );
      expect(res.mediaUri).toBe(`r2://${res.storageKey}`);
      expect(storageService.getSignedUrlForUpload).toHaveBeenCalledWith(
        res.storageKey,
        'image/png',
        900,
      );
    });

    it('initNoteMediaUpload nên chặn định dạng nguy hiểm (html, svg) và file vượt dung lượng', async () => {
      await expect(
        service.initNoteMediaUpload(userId, summaryId, {
          fileName: 'payload.svg',
          fileSize: 1024,
          mimeType: 'image/svg+xml',
          mediaKind: 'image',
        }),
      ).rejects.toThrow('bị chặn');

      await expect(
        service.initNoteMediaUpload(userId, summaryId, {
          fileName: 'big-photo.png',
          fileSize: 12 * 1024 * 1024,
          mimeType: 'image/png',
          mediaKind: 'image',
        }),
      ).rejects.toThrow('10 MB');
    });

    it('completeNoteMediaUpload nên xác nhận R2, trả mediaUri + resolvedUrl và chặn storageKey sai prefix', async () => {
      const validKey = `users/${userId}/conversations/${conversationId}/summaries/${summaryId}/media/uuid-photo.png`;
      storageService.headObject.mockResolvedValue({
        exists: true,
        contentLength: 512000,
        contentType: 'image/png',
      });
      storageService.getSignedUrlForDownload.mockResolvedValue('https://r2.get.url/photo.png');

      const ok = await service.completeNoteMediaUpload(userId, summaryId, {
        storageKey: validKey,
        fileName: 'photo.png',
        mediaKind: 'image',
      });

      expect(ok.mediaUri).toBe(`r2://${validKey}`);
      expect(ok.resolvedUrl).toBe('https://r2.get.url/photo.png');

      await expect(
        service.completeNoteMediaUpload(userId, summaryId, {
          storageKey: `users/other-user/conversations/${conversationId}/summaries/${summaryId}/media/x.png`,
          fileName: 'x.png',
        }),
      ).rejects.toThrow('Không có quyền xác nhận');
    });

    it('completeNoteMediaUpload nên xóa tệp trên R2 nếu dung lượng thực tế vượt giới hạn', async () => {
      const validKey = `users/${userId}/conversations/${conversationId}/summaries/${summaryId}/media/uuid-big.png`;
      storageService.headObject.mockResolvedValue({
        exists: true,
        contentLength: 15 * 1024 * 1024,
        contentType: 'image/png',
      });
      storageService.deleteObject.mockResolvedValue(undefined);

      await expect(
        service.completeNoteMediaUpload(userId, summaryId, {
          storageKey: validKey,
          fileName: 'big.png',
          mediaKind: 'image',
        }),
      ).rejects.toThrow('10 MB');

      expect(storageService.deleteObject).toHaveBeenCalledWith(validKey);
    });

    it('resolveNoteMediaUrls nên ký URL hàng loạt cho tệp thuộc user và bỏ qua URI của user khác', async () => {
      const ownedKey = `users/${userId}/conversations/${conversationId}/summaries/${summaryId}/media/11111111-1111-1111-1111-111111111111-demo.mp4`;
      const foreignKey = `users/99999999-9999-9999-9999-999999999999/conversations/${conversationId}/summaries/${summaryId}/media/22222222-2222-2222-2222-222222222222-secret.png`;

      storageService.getSignedUrlForDownload.mockResolvedValue('https://r2.get.url/demo.mp4');

      const res = await service.resolveNoteMediaUrls(userId, summaryId, {
        mediaUris: [`r2://${ownedKey}`, `r2://${foreignKey}`],
      });

      expect(res.urls[`r2://${ownedKey}`]).toBe('https://r2.get.url/demo.mp4');
      expect(res.urls[`r2://${foreignKey}`]).toBeUndefined();
      expect(storageService.getSignedUrlForDownload).toHaveBeenCalledTimes(1);
    });

    it('deleteSummary nên xóa pdf_storage_key và media thuộc ghi chú này nhưng giữ media copy từ ghi chú khác', async () => {
      const ownMediaKey = `users/${userId}/conversations/${conversationId}/summaries/${summaryId}/media/a.png`;
      const otherNoteKey = `users/${userId}/conversations/${conversationId}/summaries/44444444-4444-4444-4444-444444444444/media/b.png`;

      summariesRepo.getSummaryById.mockResolvedValue({
        id: summaryId,
        conversation_id: conversationId,
        title: 'Note xóa',
        pdf_storage_key: 'pdf-key.pdf',
        content_json: [
          { type: 'image', props: { url: `r2://${ownMediaKey}` } },
          { type: 'image', props: { url: `r2://${otherNoteKey}` } },
        ],
      });
      storageService.deleteObject.mockResolvedValue(undefined);
      summariesRepo.deleteSummary.mockResolvedValue({});

      await service.deleteSummary(userId, summaryId);

      expect(storageService.deleteObject).toHaveBeenCalledWith(ownMediaKey);
      expect(storageService.deleteObject).toHaveBeenCalledWith('pdf-key.pdf');
      expect(storageService.deleteObject).not.toHaveBeenCalledWith(otherNoteKey);
      expect(summariesRepo.deleteSummary).toHaveBeenCalledWith(summaryId);
    });

    it('exportPdf nên resolve ảnh r2:// sang Presigned URL trước khi render HTML', async () => {
      const ownMediaKey = `users/${userId}/conversations/${conversationId}/summaries/${summaryId}/media/a.png`;
      summariesRepo.getSummaryById.mockResolvedValue({
        id: summaryId,
        conversation_id: conversationId,
        title: 'Note có ảnh',
        pdf_storage_key: null,
        content_json: [
          { type: 'image', props: { url: `r2://${ownMediaKey}`, caption: 'Hình 1' } },
        ],
      });
      storageService.getSignedUrlForDownload
        .mockResolvedValueOnce('https://r2.temp/a.png')
        .mockResolvedValueOnce('https://r2.download/note.pdf');
      pdfExportService.convertBlockNoteToHtml.mockReturnValue('<html></html>');
      pdfExportService.renderHtmlToPdf.mockResolvedValue(Buffer.from('pdf'));
      storageService.uploadObjectBuffer.mockResolvedValue(undefined);
      summariesRepo.updateSummary.mockResolvedValue({});

      const result = await service.exportPdf(userId, summaryId);

      expect(result.downloadUrl).toBe('https://r2.download/note.pdf');
      expect(pdfExportService.convertBlockNoteToHtml).toHaveBeenCalledWith(
        'Note có ảnh',
        [
          expect.objectContaining({
            type: 'image',
            props: expect.objectContaining({
              url: 'https://r2.temp/a.png',
            }),
          }),
        ],
      );
    });
  });
});
