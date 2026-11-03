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
});
