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
    searchRelevantChunks: ReturnType<typeof vi.fn>;
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
      searchRelevantChunks: vi.fn().mockResolvedValue([]),
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

  it('nên lưu tin nhắn user và truyền callback onSearchDocuments gọi tới RetrievalService', async () => {
    await service.handleChatStream(
      'user-1',
      'session-1',
      [
        {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'Giải thích cây AVL trong tài liệu' }],
        },
      ],
      undefined,
      ['doc-attached-1'],
    );

    expect(repoMock.getChatSessionById).toHaveBeenCalledWith('session-1', 'user-1');
    expect(repoMock.createMessage).toHaveBeenCalledWith({
      chat_session_id: 'session-1',
      role: 'user',
      content: JSON.stringify([
        { type: 'text', text: 'Giải thích cây AVL trong tài liệu' },
      ]),
      source_chunks: undefined,
    });

    expect(aiMock.executeChatStream).toHaveBeenCalledTimes(1);
    const callArgs = aiMock.executeChatStream.mock.calls[0];
    const options = callArgs[3];
    expect(options?.onSearchDocuments).toBeDefined();

    await options.onSearchDocuments({
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
  });
});
