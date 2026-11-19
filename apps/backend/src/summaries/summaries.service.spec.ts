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
});
