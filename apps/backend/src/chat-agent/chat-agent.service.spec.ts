import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatAgentService } from './chat-agent.service.js';
import { ChatAgentRepoService } from '../repo/chat-agent-repo/chat-agent-repo.service.js';
import { ChatAgentAiService } from '../ai/chat-agent-ai.service.js';
import { RetrievalService } from '../documents/services/retrieval.service.js';

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
    getDocumentsFullContent: ReturnType<typeof vi.fn>;
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
      getDocumentsFullContent: vi.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatAgentService,
        { provide: ChatAgentRepoService, useValue: repoMock },
        { provide: ChatAgentAiService, useValue: aiMock },
        { provide: RetrievalService, useValue: retrievalMock },
      ],
    }).compile();

    service = module.get<ChatAgentService>(ChatAgentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('nên lấy danh mục tài liệu và truyền cả 2 callbacks (onSearchDocumentChunks & onGetDocumentsFullContent) tới ChatAgentAiService', async () => {
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

    // Kiểm tra callback Tool 1: searchDocumentChunks
    await options.onSearchDocumentChunks({
      semanticQuery: 'Định nghĩa và cơ chế tự cân bằng của cây AVL',
      keywords: ['cây AVL', 'tự cân bằng'],
    });
    expect(retrievalMock.searchRelevantChunks).toHaveBeenCalledWith({
      userId: 'user-1',
      conversationId: 'conv-1',
      semanticQuery: 'Định nghĩa và cơ chế tự cân bằng của cây AVL',
      keywords: ['cây AVL', 'tự cân bằng'],
      preferredDocumentIds: ['doc-attached-1'],
      topK: 15,
    });

    // Kiểm tra callback Tool 2: getDocumentsFullContent
    await options.onGetDocumentsFullContent({
      documentIds: ['doc-attached-1'],
      fetchAllDocuments: false,
    });
    expect(retrievalMock.getDocumentsFullContent).toHaveBeenCalledWith({
      userId: 'user-1',
      conversationId: 'conv-1',
      documentIds: ['doc-attached-1'],
      fetchAllDocuments: false,
      preferredDocumentIds: ['doc-attached-1'],
    });
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
});
