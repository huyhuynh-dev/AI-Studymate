import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatAgentService } from './chat-agent.service.js';
import { ChatAgentRepoService } from '../repo/chat-agent-repo/chat-agent-repo.service.js';
import { DocumentsRepoService } from '../repo/documents-repo/documents-repo.service.js';
import { ChatAgentAiService } from '../ai/chat-agent-ai.service.js';
import { RetrievalService } from '../documents/services/retrieval.service.js';
import { SummariesService } from '../summaries/summaries.service.js';

describe('ChatAgentService', () => {
  let service: ChatAgentService;
  let repoMock: {
    getChatSessionById: ReturnType<typeof vi.fn>;
    createMessage: ReturnType<typeof vi.fn>;
    updateChatSession: ReturnType<typeof vi.fn>;
  };
  let aiMock: {
    executeChatStream: ReturnType<typeof vi.fn>;
    generateSessionTitle: ReturnType<typeof vi.fn>;
    generateFollowUpSuggestions: ReturnType<typeof vi.fn>;
  };
  let retrievalMock: {
    getAvailableDocumentsCatalog: ReturnType<typeof vi.fn>;
    searchRelevantChunks: ReturnType<typeof vi.fn>;
    getDocumentSectionOrPages: ReturnType<typeof vi.fn>;
    getDocumentsFullContent: ReturnType<typeof vi.fn>;
  };
  let summariesMock: {
    createSummary: ReturnType<typeof vi.fn>;
  };
  let documentsRepoMock: {
    getAllDocumentsByConversationId: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    repoMock = {
      getChatSessionById: vi.fn().mockResolvedValue({
        id: 'session-1',
        conversation_id: 'conv-1',
        title: 'Đoạn chat mới',
        created_at: new Date(),
      }),
      createMessage: vi.fn().mockResolvedValue({ id: 'msg-1' }),
      updateChatSession: vi.fn().mockResolvedValue({}),
    };

    aiMock = {
      executeChatStream: vi.fn().mockResolvedValue({
        toUIMessageStream: vi.fn(),
      }),
      generateSessionTitle: vi.fn().mockResolvedValue('Tiêu đề tự động'),
      generateFollowUpSuggestions: vi.fn().mockResolvedValue([
        'Phép xoay trái cây AVL thực hiện khi nào?',
        'Độ phức tạp chèn phần tử vào cây AVL là bao nhiêu?',
      ]),
    };

    retrievalMock = {
      getAvailableDocumentsCatalog: vi.fn().mockResolvedValue([
        {
          documentId: 'doc-attached-1',
          fileName: 'Giao_trinh_CTDL.pdf',
          uploadedAt: new Date(),
        },
      ]),
      searchRelevantChunks: vi.fn().mockResolvedValue([]),
      getDocumentSectionOrPages: vi.fn().mockResolvedValue({
        documentId: 'doc-attached-1',
        fileName: 'Giao_trinh_CTDL.pdf',
        pageCount: 1,
        isFullDocument: true,
        totalChunks: 0,
        chunks: [],
      }),
      getDocumentsFullContent: vi.fn().mockResolvedValue([]),
    };

    summariesMock = {
      createSummary: vi.fn().mockResolvedValue({
        id: 'summary-uuid-1',
        conversation_id: 'conv-1',
        document_id: 'doc-attached-1',
        title: 'Tóm tắt Giáo trình Cấu trúc dữ liệu',
        content_json: [],
        created_at: new Date('2026-11-05T10:00:00Z'),
      }),
    };

    documentsRepoMock = {
      getAllDocumentsByConversationId: vi.fn().mockResolvedValue([
        {
          id: 'doc-attached-1',
          file_name: 'Giao_trinh_CTDL.pdf',
          mime_type: 'application/pdf',
          file_size: 102400,
          ocr_status: 'done',
          raw_text: 'Nội dung mẫu giáo trình CTDL '.repeat(100),
          uploaded_at: new Date('2026-11-05T09:00:00Z'),
        },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatAgentService,
        { provide: ChatAgentRepoService, useValue: repoMock },
        { provide: ChatAgentAiService, useValue: aiMock },
        { provide: RetrievalService, useValue: retrievalMock },
        { provide: SummariesService, useValue: summariesMock },
        { provide: DocumentsRepoService, useValue: documentsRepoMock },
      ],
    }).compile();

    service = module.get<ChatAgentService>(ChatAgentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('nên lấy danh mục tài liệu và truyền đầy đủ các callbacks (RAG & Summary Tools) tới ChatAgentAiService', async () => {
    await service.handleChatStream(
      'user-1',
      'session-1',
      [
        {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'Tóm tắt tài liệu giúp tôi' }],
        },
      ],
      undefined,
      ['doc-attached-1'],
    );

    expect(repoMock.getChatSessionById).toHaveBeenCalledWith(
      'session-1',
      'user-1',
    );
    expect(retrievalMock.getAvailableDocumentsCatalog).toHaveBeenCalledWith(
      'user-1',
      'conv-1',
    );

    expect(aiMock.executeChatStream).toHaveBeenCalledTimes(1);
    const callArgs = aiMock.executeChatStream.mock.calls[0];
    const options = callArgs[3];
    expect(options?.availableDocuments).toHaveLength(1);
    expect(options?.onSearchDocumentChunks).toBeDefined();
    expect(options?.onGetDocumentsFullContent).toBeDefined();
    expect(options?.onGetDocumentsMetadata).toBeDefined();
    expect(options?.onCreateDocumentSummary).toBeDefined();

    // Kiểm tra callback Tool 1: searchDocumentChunks
    await options.onSearchDocumentChunks({
      semanticQuery: 'Định nghĩa và cơ chế tự cân bằng của cây AVL',
      keywords: ['cây AVL', 'tự cân bằng'],
      pageNumbers: [3],
      includeNeighbors: true,
    });
    expect(retrievalMock.searchRelevantChunks).toHaveBeenCalledWith({
      userId: 'user-1',
      conversationId: 'conv-1',
      semanticQuery: 'Định nghĩa và cơ chế tự cân bằng của cây AVL',
      keywords: ['cây AVL', 'tự cân bằng'],
      preferredDocumentIds: ['doc-attached-1'],
      pageNumbers: [3],
      pageRange: undefined,
      includeNeighbors: true,
      topK: 15,
    });

    // Kiểm tra callback Tool 2: getDocumentSectionOrPages
    expect(options?.onGetDocumentSectionOrPages).toBeDefined();
    await options.onGetDocumentSectionOrPages({
      documentId: 'doc-attached-1',
      pageNumbers: [1, 2],
    });
    expect(retrievalMock.getDocumentSectionOrPages).toHaveBeenCalledWith({
      userId: 'user-1',
      conversationId: 'conv-1',
      documentId: 'doc-attached-1',
      pageNumbers: [1, 2],
      headingKeyword: undefined,
    });

    // Kiểm tra callback Tool 3: getConversationDocumentsMetadata
    const metadataResult = await options.onGetDocumentsMetadata();
    expect(
      documentsRepoMock.getAllDocumentsByConversationId,
    ).toHaveBeenCalledWith('conv-1', 'user-1');
    expect(metadataResult.totalDocuments).toBe(1);
    expect(metadataResult.readyDocumentsCount).toBe(1);
    expect(metadataResult.documents[0].fileName).toBe('Giao_trinh_CTDL.pdf');
    expect(metadataResult.documents[0].isAttached).toBe(true);

    // Kiểm tra callback Tool 5: createDocumentSummary (sử dụng đúng model đang chọn)
    const summaryResult = await options.onCreateDocumentSummary({
      scope: 'document',
      documentIds: ['doc-attached-1'],
      mode: 'study_guide',
      length: 'standard',
      customInstruction: 'Tập trung vào cây AVL',
    });
    expect(summariesMock.createSummary).toHaveBeenCalledWith(
      'user-1',
      'conv-1',
      expect.objectContaining({
        scope: 'document',
        documentId: 'doc-attached-1',
        documentIds: ['doc-attached-1'],
        mode: 'study_guide',
        length: 'standard',
        customInstruction: 'Tập trung vào cây AVL',
        modelName: 'cx/gpt-6-luna-medium',
      }),
    );
    expect(summaryResult.summaryId).toBe('summary-uuid-1');
    expect(summaryResult.title).toBe('Tóm tắt Giáo trình Cấu trúc dữ liệu');
  });

  it('nên xác thực quyền truy cập phiên và gọi generateFollowUpSuggestions từ ChatAgentAiService', async () => {
    const result = await service.generateFollowUpSuggestions(
      'user-1',
      'session-1',
      {
        lastAssistantResponse: 'Cây AVL là cây nhị phân tìm kiếm tự cân bằng.',
        lastUserQuestion: 'Cây AVL là gì?',
      },
    );

    expect(repoMock.getChatSessionById).toHaveBeenCalledWith(
      'session-1',
      'user-1',
    );
    expect(aiMock.generateFollowUpSuggestions).toHaveBeenCalledWith(
      'Cây AVL là cây nhị phân tìm kiếm tự cân bằng.',
      'Cây AVL là gì?',
    );
    expect(result).toEqual({
      suggestions: [
        'Phép xoay trái cây AVL thực hiện khi nào?',
        'Độ phức tạp chèn phần tử vào cây AVL là bao nhiêu?',
      ],
    });
  });

  it('nên định tuyến đúng Model và tham số khi người dùng chọn Flash + Nhanh', async () => {
    await service.handleChatStream(
      'user-1',
      'session-1',
      [
        {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'Tra cứu nhanh' }],
        },
      ],
      undefined,
      [],
      {
        modelId: 'studymate-flash',
        effort: 'low',
      },
    );

    expect(aiMock.executeChatStream).toHaveBeenCalled();
    const calls = aiMock.executeChatStream.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall).toBeDefined();
    const options = lastCall?.[3];
    expect(options?.chatConfig).toEqual({
      modelName: 'cx/gpt-5.6-luna-low',
      temperature: 0.2,
      maxOutputTokens: 1024,
      topK: 10,
    });
  });

  it('nên định tuyến đúng Model và tham số khi người dùng chọn Pro + Suy luận sâu', async () => {
    await service.handleChatStream(
      'user-1',
      'session-1',
      [
        {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'Giải bài tập khó' }],
        },
      ],
      undefined,
      [],
      {
        modelId: 'studymate-pro',
        effort: 'high',
      },
    );

    expect(aiMock.executeChatStream).toHaveBeenCalled();
    const proCalls = aiMock.executeChatStream.mock.calls;
    const proLastCall = proCalls[proCalls.length - 1];
    expect(proLastCall).toBeDefined();
    const proOptions = proLastCall?.[3];
    expect(proOptions?.chatConfig).toEqual({
      modelName: 'cx/gpt-5.6-terra-high',
      temperature: 0.2,
      maxOutputTokens: 4096,
      topK: 20,
    });
  });

  it('createChatUIMessageStream nên cấu hình toUIMessageStream chuẩn Vercel và lưu tin nhắn AI khi hoàn thành', async () => {
    let capturedOptions: any = null;
    const fakeStreamResult = {
      toUIMessageStream: vi.fn().mockImplementation((options) => {
        capturedOptions = options;
        return 'mocked-stream';
      }),
      tracker: {
        getCollectedChunkIds: () => new Set(['chunk-uuid-1', 'chunk-uuid-2']),
        getAllCitations: () => [
          {
            citationId: 'c1',
            chunkId: 'chunk-uuid-1',
            documentId: 'doc-attached-1',
            fileName: 'Giao_trinh_CTDL.pdf',
            pageNumbers: [1],
            headings: [],
            content: 'Nội dung trích dẫn',
          },
        ],
      },
    };

    const originalMessages = [
      {
        id: 'msg-u1',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'Xin chào' }],
      },
    ];

    const stream = service.createChatUIMessageStream({
      streamResult: fakeStreamResult,
      chatSessionId: 'session-1',
      originalMessages,
    });

    expect(stream).toBe('mocked-stream');
    expect(fakeStreamResult.toUIMessageStream).toHaveBeenCalledTimes(1);
    expect(capturedOptions).toBeDefined();
    expect(capturedOptions.originalMessages).toEqual(originalMessages);
    expect(typeof capturedOptions.generateMessageId).toBe('function');
    expect(typeof capturedOptions.onFinish).toBe('function');

    // Giả lập callback onFinish được Vercel AI SDK gọi khi hoàn tất stream
    const assistantResponseMessage = {
      id: 'msg-ai-1',
      role: 'assistant' as const,
      parts: [
        { type: 'step-start' as const },
        { type: 'text' as const, text: 'Chào bạn, tôi là StudyMate AI!' },
      ],
    };

    // Spy hàm saveUIMessage
    const saveSpy = vi.spyOn(service, 'saveUIMessage').mockResolvedValue({} as any);

    await capturedOptions.onFinish({
      responseMessage: assistantResponseMessage,
      isAborted: false,
    });

    expect(saveSpy).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        id: 'msg-ai-1',
        metadata: {
          citations: [
            expect.objectContaining({
              citationId: 'c1',
              chunkId: 'chunk-uuid-1',
            }),
          ],
        },
      }),
      ['chunk-uuid-1', 'chunk-uuid-2'],
    );
  });
});
