import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { streamText } from 'ai';
import { ChatAgentService } from './chat-agent.service.js';
import { WORKSPACE_SYNC_CHUNK_TYPE } from './workspace-sync.types.js';
import type { WorkspaceSyncChannel } from './workspace-sync.channel.js';
import { ChatAgentRepoService } from '../repo/chat-agent-repo/chat-agent-repo.service.js';
import { DocumentsRepoService } from '../repo/documents-repo/documents-repo.service.js';
import { ChatAgentAiService } from '../ai/chat-agent-ai.service.js';
import { RetrievalService } from '../documents/services/retrieval.service.js';
import { SummariesService } from '../summaries/summaries.service.js';
import { FlashcardAiManageService } from '../deck-flashcard/flashcard-ai-manage.service.js';
import { QuizService } from '../quiz/quiz.service.js';
import { QuestionTypeEnum } from '../generated/prisma/client.js';
import { TavilyService } from '../search/tavily.service.js';
import { SuperDocRuntimeService } from '../documents/services/superdoc-runtime.service.js';
import { WorkspaceContextHydratorService } from './workspace-context-hydrator.service.js';

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
  let flashcardAiManageMock: {
    generateWithAi: ReturnType<typeof vi.fn>;
  };
  let quizServiceMock: {
    generateWithAI: ReturnType<typeof vi.fn>;
    generateFromDeck: ReturnType<typeof vi.fn>;
  };
  let documentsRepoMock: {
    getAllDocumentsByConversationId: ReturnType<typeof vi.fn>;
  };
  let tavilyMock: {
    search: ReturnType<typeof vi.fn>;
    extract: ReturnType<typeof vi.fn>;
  };
  let superdocRuntimeMock: {
    assertOwnedDocxDocument: ReturnType<typeof vi.fn>;
    getToolkit: ReturnType<typeof vi.fn>;
    validateToolCallPolicy: ReturnType<typeof vi.fn>;
    runWithDocumentSession: ReturnType<typeof vi.fn>;
  };
  let hydratorMock: {
    hydrate: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    tavilyMock = {
      search: vi.fn().mockResolvedValue({
        query: 'test query',
        totalResults: 1,
        results: [
          {
            title: 'Test Web Result',
            url: 'https://example.com/test',
            domain: 'example.com',
            contentSnippet: 'Test content snippet',
            previewSnippet: 'Test preview snippet',
          },
        ],
      }),
      extract: vi.fn().mockResolvedValue({
        query: 'test extract query',
        totalSuccess: 1,
        totalFailed: 0,
        results: [
          {
            title: 'Extracted Article',
            url: 'https://example.com/article',
            domain: 'example.com',
            extractedContent: 'Full article text markdown...',
            previewSnippet: 'Article preview snippet',
          },
        ],
        failedResults: [],
      }),
    };
    superdocRuntimeMock = {
      assertOwnedDocxDocument: vi.fn().mockResolvedValue({
        id: 'doc-word-1',
        file_name: 'Bao_cao_thuc_tap.docx',
        mime_type:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
      getToolkit: vi.fn().mockResolvedValue({
        systemPrompt: 'SuperDoc core toolkit instructions',
        tools: [
          {
            name: 'superdoc_inspect',
            description: 'Inspect Word document snapshot',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'superdoc_perform_action',
            description: 'Perform Word document edit',
            inputSchema: { type: 'object', properties: { action: { type: 'string' } } },
          },
        ],
      }),
      validateToolCallPolicy: vi.fn((_toolName, args, changeMode) => ({
        allowed: true,
        normalizedArgs: { ...args, changeMode },
      })),
      runWithDocumentSession: vi.fn().mockImplementation(async ({ fn }) => {
        if (typeof fn === 'function') {
          const mockDoc = {
            blocks: { list: vi.fn().mockResolvedValue({ revision: 'rev-1' }) },
            query: {
              match: vi.fn().mockResolvedValue({
                items: [
                  {
                    address: { blockId: 'b1' },
                    target: {
                      start: { blockId: 'b1', offset: 0 },
                      end: { blockId: 'b1', offset: 5 },
                    },
                  },
                ],
              }),
            },
            replace: vi.fn().mockResolvedValue({
              receipt: { success: true, revision: 'rev-2' },
            }),
            insert: vi.fn().mockResolvedValue({
              receipt: { success: true, revision: 'rev-2' },
            }),
            create: {
              paragraph: vi.fn().mockResolvedValue({
                receipt: { success: true, revision: 'rev-2' },
              }),
            },
          };
          const mockToolkit = {
            dispatch: vi.fn().mockResolvedValue({
              status: 'ok',
              intent: 'insert_table',
              changeMode: 'tracked',
              preSnapshot: { revision: 'rev-1' },
              postSnapshot: { revision: 'rev-2' },
            }),
          };
          let mutated = false;
          const res = await fn({
            doc: mockDoc,
            toolkit: mockToolkit,
            documentId: 'doc-word-1',
            fileName: 'Bao_cao_thuc_tap.docx',
            changeMode: 'tracked',
            markMutated: () => {
              mutated = true;
            },
          });
          return { ...res, mutated };
        }
        return {
          payload: {
            status: 'ok',
            intent: 'insert_table',
            changeMode: 'tracked',
            preSnapshot: { revision: 'rev-1' },
            postSnapshot: { revision: 'rev-2' },
          },
          mutated: true,
        };
      }),
    };
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

    flashcardAiManageMock = {
      generateWithAi: vi.fn().mockResolvedValue({
        deckId: 'deck-uuid-1',
        deckName: 'Ôn tập Cây AVL',
        deckDescription: 'Bộ thẻ ôn tập cân bằng cây AVL',
        cards: [{ id: 'card-1' }, { id: 'card-2' }],
        stats: {
          requested: 10,
          saved: 2,
          dropped: 0,
          truncatedDocuments: 0,
        },
      }),
    };

    quizServiceMock = {
      generateWithAI: vi.fn().mockResolvedValue({
        id: 'quiz-uuid-1',
        conversationId: 'conv-1',
        title: 'Đề kiểm tra Cây AVL',
        description: 'Đề kiểm tra kiến thức cây AVL',
        timeLimitSec: null,
        sourceDeckId: null,
        sourceDeckName: null,
        source: 'ai',
        questions: [{ id: 'q-1' }, { id: 'q-2' }],
        createdAt: '2026-11-16T10:30:00.000Z',
        updatedAt: '2026-11-16T10:30:00.000Z',
      }),
      generateFromDeck: vi.fn().mockResolvedValue({
        id: 'quiz-uuid-deck-1',
        conversationId: 'conv-1',
        title: 'Bài kiểm tra: Ôn tập Cây AVL',
        description: 'Tạo tự động từ bộ thẻ Flashcard',
        timeLimitSec: null,
        sourceDeckId: '11111111-2222-3333-4444-555555555555',
        sourceDeckName: 'Ôn tập Cây AVL',
        source: 'flashcard',
        questions: [{ id: 'qd-1' }, { id: 'qd-2' }, { id: 'qd-3' }],
        createdAt: '2026-11-16T10:31:00.000Z',
        updatedAt: '2026-11-16T10:31:00.000Z',
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
        { provide: FlashcardAiManageService, useValue: flashcardAiManageMock },
        { provide: QuizService, useValue: quizServiceMock },
        { provide: DocumentsRepoService, useValue: documentsRepoMock },
        { provide: TavilyService, useValue: tavilyMock },
        { provide: SuperDocRuntimeService, useValue: superdocRuntimeMock },
        {
          provide: WorkspaceContextHydratorService,
          useValue: (hydratorMock = {
            hydrate: vi.fn().mockResolvedValue({
              location: {
                pageType: 'conversation',
                conversationId: 'conv-1',
                activeTab: 'documents',
              },
              inventory: {
                documentsCount: 1,
                readyDocumentsCount: 1,
                notesCount: 0,
                decksCount: 0,
                quizzesCount: 0,
              },
              guards: {
                examIntegrityGuard: false,
                hideFlashcardAnswerGuard: false,
              },
            }),
          }),
        },
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
      topK: 8,
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

    // Kiểm tra callback Tool: onSearchInternet & onExtractWebPage
    expect(options?.onSearchInternet).toBeDefined();
    await options.onSearchInternet({ query: 'GraphRAG architecture' });
    expect(tavilyMock.search).toHaveBeenCalledWith({ query: 'GraphRAG architecture' });

    expect(options?.onExtractWebPage).toBeDefined();
    await options.onExtractWebPage({
      urls: ['https://arxiv.org/abs/2404.16130'],
      query: 'community detection',
    });
    expect(tavilyMock.extract).toHaveBeenCalledWith({
      urls: ['https://arxiv.org/abs/2404.16130'],
      query: 'community detection',
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

    // Kiểm tra callback Tool 6: createFlashcards
    expect(options?.onCreateFlashcards).toBeDefined();
    const flashcardResult = await options.onCreateFlashcards({
      documentIds: ['doc-attached-1'],
      count: 10,
      types: ['basic', 'cloze'],
      deckName: 'Ôn tập Cây AVL',
      instructions: 'Tập trung phép xoay cây',
    });
    expect(flashcardAiManageMock.generateWithAi).toHaveBeenCalledWith(
      'user-1',
      {
        conversationId: 'conv-1',
        target: { kind: 'new' },
        documentIds: ['doc-attached-1'],
        count: 10,
        types: ['basic', 'cloze'],
        instructions: 'Tập trung phép xoay cây',
        deckName: 'Ôn tập Cây AVL',
      },
    );
    expect(flashcardResult.deckId).toBe('deck-uuid-1');
    expect(flashcardResult.deckName).toBe('Ôn tập Cây AVL');
    expect(flashcardResult.savedCount).toBe(2);
    expect(flashcardResult.requestedCount).toBe(10);
    expect(flashcardResult.targetKind).toBe('new');
    expect(flashcardResult.documentNames).toEqual(['Giao_trinh_CTDL.pdf']);

    // Kiểm tra callback Tool 7: createQuiz (từ tài liệu AI) kèm bloomPreset
    expect(options?.onCreateQuiz).toBeDefined();
    const quizResult = await options.onCreateQuiz({
      documentIds: ['doc-attached-1'],
      questionCount: 10,
      types: ['single_choice', 'essay'],
      difficulty: 'applied',
      bloomPreset: 'exam_prep',
    });
    expect(quizServiceMock.generateWithAI).toHaveBeenCalledWith(
      'user-1',
      'conv-1',
      {
        documentIds: ['doc-attached-1'],
        questionCount: 10,
        types: [QuestionTypeEnum.single_choice, QuestionTypeEnum.essay],
        difficulty: 'applied',
        bloomPreset: 'exam_prep',
      },
    );
    expect(quizResult.quizId).toBe('quiz-uuid-1');
    expect(quizResult.title).toBe('Đề kiểm tra Cây AVL');
    expect(quizResult.source).toBe('ai');
    expect(quizResult.questionCount).toBe(2);
    expect(quizResult.requestedCount).toBe(10);
    expect(quizResult.documentNames).toEqual(['Giao_trinh_CTDL.pdf']);
  });

  it('onCreateQuiz nên chuyển sang generateFromDeck khi nhận deckId là UUID hợp lệ', async () => {
    await service.handleChatStream(
      'user-1',
      'session-1',
      [
        {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'Tạo đề kiểm tra từ bộ thẻ này' }],
        },
      ],
      undefined,
      [],
    );

    const options = aiMock.executeChatStream.mock.calls[0]?.[3];
    const existingDeckUuid = '11111111-2222-3333-4444-555555555555';
    const result = await options.onCreateQuiz({
      deckId: existingDeckUuid,
      questionCount: 12,
      types: ['single_choice', 'true_false', 'essay'],
      difficulty: 'basic',
    });

    expect(quizServiceMock.generateFromDeck).toHaveBeenCalledWith(
      'user-1',
      'conv-1',
      {
        deckId: existingDeckUuid,
        questionCount: 12,
        types: [QuestionTypeEnum.single_choice, QuestionTypeEnum.true_false],
      },
    );
    expect(result.quizId).toBe('quiz-uuid-deck-1');
    expect(result.source).toBe('flashcard');
    expect(result.questionCount).toBe(3);
    expect(result.documentNames).toEqual(['Ôn tập Cây AVL']);
  });

  it('onCreateFlashcards nên fallback về tất cả tài liệu và hỗ trợ thêm vào deckId hợp lệ', async () => {
    await service.handleChatStream(
      'user-1',
      'session-1',
      [
        {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'Thêm 5 thẻ type_in vào bộ thẻ cũ' }],
        },
      ],
      undefined,
      [],
    );

    const options = aiMock.executeChatStream.mock.calls[0]?.[3];
    const existingDeckUuid = '11111111-2222-3333-4444-555555555555';
    const result = await options.onCreateFlashcards({
      count: 5,
      types: ['type_in'],
      deckId: existingDeckUuid,
    });

    expect(flashcardAiManageMock.generateWithAi).toHaveBeenCalledWith(
      'user-1',
      {
        conversationId: 'conv-1',
        target: { kind: 'deck', deckId: existingDeckUuid },
        documentIds: 'all',
        count: 5,
        types: ['type_in'],
        instructions: '',
        deckName: undefined,
      },
    );
    expect(result.targetKind).toBe('deck');
    expect(result.types).toEqual(['type_in']);
    expect(result.documentNames).toEqual(['Giao_trinh_CTDL.pdf']);
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
      topK: 5,
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
      topK: 12,
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
            sourceType: 'document',
            citationId: 'c1',
            chunkId: 'chunk-uuid-1',
            documentId: 'doc-attached-1',
            fileName: 'Giao_trinh_CTDL.pdf',
            pageNumbers: [1],
            headings: [],
            content: 'Nội dung trích dẫn',
          },
          {
            sourceType: 'web',
            citationId: 'w1',
            title: 'GraphRAG',
            url: 'https://arxiv.org/abs/2404.16130',
            domain: 'arxiv.org',
            previewSnippet: 'GraphRAG summary',
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
    expect(typeof capturedOptions.messageMetadata).toBe('function');

    // Kiểm tra messageMetadata trả về citations khi part.type === 'finish'
    const finishMetadata = capturedOptions.messageMetadata({
      part: { type: 'finish' },
    });
    expect(finishMetadata).toEqual({
      citations: [
        expect.objectContaining({
          citationId: 'c1',
          chunkId: 'chunk-uuid-1',
        }),
        expect.objectContaining({
          citationId: 'w1',
          title: 'GraphRAG',
          url: 'https://arxiv.org/abs/2404.16130',
        }),
      ],
    });

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
            expect.objectContaining({
              citationId: 'w1',
              title: 'GraphRAG',
              url: 'https://arxiv.org/abs/2404.16130',
            }),
          ],
        },
      }),
      ['chunk-uuid-1', 'chunk-uuid-2'],
    );
  });

  it('nên phát sự kiện WorkspaceSyncEvent sau khi các tool Summary, Flashcard và Quiz lưu DB thành công (và không phát nếu lỗi)', async () => {
    const streamResult = await service.handleChatStream(
      'user-1',
      'session-1',
      [
        {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'Tạo ghi chú, flashcard và quiz' }],
        },
      ],
      undefined,
      ['doc-attached-1'],
    );

    const syncChannel = (
      streamResult as { workspaceSyncChannel?: WorkspaceSyncChannel }
    ).workspaceSyncChannel;
    expect(syncChannel).toBeDefined();

    const emitted: unknown[] = [];
    syncChannel!.attach((event) => emitted.push(event));

    const options = aiMock.executeChatStream.mock.calls[0]?.[3];

    // 1. Summary created
    await options.onCreateDocumentSummary({
      scope: 'document',
      documentIds: ['doc-attached-1'],
      mode: 'study_guide',
      length: 'standard',
    });

    // 2. Flashcards created (new deck) & updated (existing deck)
    await options.onCreateFlashcards({
      documentIds: ['doc-attached-1'],
      count: 10,
      types: ['basic', 'cloze'],
    });
    await options.onCreateFlashcards({
      count: 5,
      types: ['type_in'],
      deckId: '11111111-2222-3333-4444-555555555555',
    });

    // 3. Quiz created (generateWithAI & generateFromDeck)
    await options.onCreateQuiz({
      documentIds: ['doc-attached-1'],
      questionCount: 10,
      types: ['single_choice'],
      difficulty: 'applied',
    });
    await options.onCreateQuiz({
      deckId: '11111111-2222-3333-4444-555555555555',
      questionCount: 6,
      types: ['single_choice'],
      difficulty: 'basic',
    });

    expect(emitted).toEqual([
      expect.objectContaining({
        resource: 'summary',
        action: 'created',
        conversationId: 'conv-1',
        entityId: 'summary-uuid-1',
        title: 'Tóm tắt Giáo trình Cấu trúc dữ liệu',
      }),
      expect.objectContaining({
        resource: 'flashcard',
        action: 'created',
        conversationId: 'conv-1',
        entityId: 'deck-uuid-1',
        targetKind: 'new',
        title: 'Ôn tập Cây AVL',
        count: 2,
      }),
      expect.objectContaining({
        resource: 'flashcard',
        action: 'updated',
        conversationId: 'conv-1',
        entityId: 'deck-uuid-1',
        targetKind: 'deck',
        title: 'Ôn tập Cây AVL',
        count: 2,
      }),
      expect.objectContaining({
        resource: 'quiz',
        action: 'created',
        conversationId: 'conv-1',
        entityId: 'quiz-uuid-1',
        title: 'Đề kiểm tra Cây AVL',
        count: 2,
      }),
      expect.objectContaining({
        resource: 'quiz',
        action: 'created',
        conversationId: 'conv-1',
        entityId: 'quiz-uuid-deck-1',
        title: 'Bài kiểm tra: Ôn tập Cây AVL',
        count: 3,
      }),
    ]);

    // 4. Lỗi DB -> tuyệt đối không phát sự kiện
    const countBeforeError = emitted.length;
    summariesMock.createSummary.mockRejectedValueOnce(new Error('DB write failed'));
    flashcardAiManageMock.generateWithAi.mockRejectedValueOnce(
      new Error('DB write failed'),
    );
    quizServiceMock.generateWithAI.mockRejectedValueOnce(
      new Error('DB write failed'),
    );

    await expect(
      options.onCreateDocumentSummary({
        scope: 'document',
        documentIds: ['doc-attached-1'],
      }),
    ).rejects.toThrow('DB write failed');
    await expect(options.onCreateFlashcards({ count: 5 })).rejects.toThrow(
      'DB write failed',
    );
    await expect(options.onCreateQuiz({ questionCount: 5 })).rejects.toThrow(
      'DB write failed',
    );

    expect(emitted).toHaveLength(countBeforeError);
  });

  it('createChatUIMessageStream với stream thực tế của AI SDK nên chèn transient data-workspace-sync và vẫn lưu DB trong onFinish kèm citations', async () => {
    const syncResult = await service.handleChatStream(
      'user-1',
      'session-1',
      [
        {
          id: 'msg-u1',
          role: 'user',
          parts: [{ type: 'text', text: 'Tạo ghi chú giúp tôi' }],
        },
      ],
      undefined,
      ['doc-attached-1'],
    );
    const syncChannel = (
      syncResult as { workspaceSyncChannel?: WorkspaceSyncChannel }
    ).workspaceSyncChannel!;

    // Tạo mock LanguageModel v3 tối thiểu cho streamText thực tế của AI SDK v6
    const fakeModel = {
      specificationVersion: 'v3',
      provider: 'test',
      modelId: 'test-model',
      supportedUrls: {},
      doStream: vi.fn().mockResolvedValue({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: 'txt-1' });
            syncChannel.emit({
              resource: 'summary',
              action: 'created',
              conversationId: 'conv-1',
              entityId: 'summary-live-1',
              title: 'Ghi chú Live',
              occurredAt: '2026-11-22T06:10:00.000Z',
            });
            controller.enqueue({
              type: 'text-delta',
              id: 'txt-1',
              delta: 'Đã tạo ghi chú xong.',
            });
            controller.enqueue({ type: 'text-end', id: 'txt-1' });
            controller.enqueue({
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: {
                inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 5, text: 5, reasoning: 0 },
              },
            });
            controller.close();
          },
        }),
      }),
    };

    const realStreamResult = streamText({
      model: fakeModel as any,
      prompt: 'Tạo ghi chú',
    });

    Object.assign(realStreamResult, {
      workspaceSyncChannel: syncChannel,
      tracker: {
        getCollectedChunkIds: () => new Set(['chunk-1']),
        getAllCitations: () => [
          {
            sourceType: 'document',
            citationId: 'c1',
            chunkId: 'chunk-1',
            documentId: 'doc-attached-1',
            fileName: 'Giao_trinh_CTDL.pdf',
            pageNumbers: [1],
            headings: [],
          },
        ],
      },
    });

    const saveSpy = vi
      .spyOn(service, 'saveUIMessage')
      .mockResolvedValue({} as any);

    const uiStream = service.createChatUIMessageStream({
      streamResult: realStreamResult,
      chatSessionId: 'session-1',
      originalMessages: [
        {
          id: 'msg-u1',
          role: 'user',
          parts: [{ type: 'text', text: 'Tạo ghi chú giúp tôi' }],
        },
      ],
    });

    const reader = uiStream.getReader();
    const emittedChunks: Array<{ type: string; [key: string]: unknown }> = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      emittedChunks.push(value as unknown as { type: string });
    }

    const syncChunks = emittedChunks.filter(
      (c) => c.type === WORKSPACE_SYNC_CHUNK_TYPE,
    );
    expect(syncChunks).toHaveLength(1);
    expect(syncChunks[0]).toEqual({
      type: WORKSPACE_SYNC_CHUNK_TYPE,
      transient: true,
      data: {
        resource: 'summary',
        action: 'created',
        conversationId: 'conv-1',
        entityId: 'summary-live-1',
        title: 'Ghi chú Live',
        occurredAt: '2026-11-22T06:10:00.000Z',
      },
    });

    // Chunk start luôn đứng trước chunk đồng bộ
    const startIdx = emittedChunks.findIndex((c) => c.type === 'start');
    const syncIdx = emittedChunks.findIndex(
      (c) => c.type === WORKSPACE_SYNC_CHUNK_TYPE,
    );
    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(syncIdx).toBeGreaterThan(startIdx);

    // Đảm bảo onFinish của inner stream vẫn lưu UIMessage vào DB kèm citations & không dính transient data
    expect(saveSpy).toHaveBeenCalledTimes(1);
    const savedMsg = saveSpy.mock.calls[0]?.[1];
    expect(savedMsg?.id).toMatch(/^msg-/);
    expect(
      savedMsg?.parts.some((p) => p.type === WORKSPACE_SYNC_CHUNK_TYPE),
    ).toBe(false);
    expect(saveSpy.mock.calls[0]?.[2]).toEqual(['chunk-1']);
  });

  it('khi có activeWordContext nên bind SuperDoc tools và phát sự kiện workspace-sync word-document khi có mutation', async () => {
    const syncResult = await service.handleChatStream(
      'user-1',
      'session-1',
      [
        {
          id: 'msg-word-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Viết lại đoạn đang chọn hay hơn' }],
        },
      ],
      undefined,
      [],
      {
        activeWordContext: {
          documentId: 'doc-word-1',
          changeMode: 'tracked',
          selectedText: 'Đoạn văn mẫu ban đầu',
        },
      },
    );

    expect(superdocRuntimeMock.assertOwnedDocxDocument).toHaveBeenCalledWith(
      'user-1',
      'doc-word-1',
    );
    expect(superdocRuntimeMock.getToolkit).toHaveBeenCalledWith('tracked');

    const aiOptions = aiMock.executeChatStream.mock.calls[0]?.[3] as {
      activeWordDocument?: {
        documentId: string;
        fileName: string;
        changeMode: string;
        selectedText?: string;
      };
      superdocToolkitMeta?: {
        documentId: string;
        fileName: string;
      };
      onSuperDocInspect?: (input: Record<string, unknown>) => Promise<unknown>;
      onSuperDocStreamText?: (input: {
        mode: 'replace' | 'append';
        anchor: string | null;
        text: string;
      }) => Promise<unknown>;
      onSuperDocPerformAction?: (
        input: Record<string, unknown>,
      ) => Promise<unknown>;
    };

    expect(aiOptions.activeWordDocument).toMatchObject({
      documentId: 'doc-word-1',
      fileName: 'Bao_cao_thuc_tap.docx',
      changeMode: 'tracked',
      selectedText: 'Đoạn văn mẫu ban đầu',
    });
    expect(aiOptions.superdocToolkitMeta).toMatchObject({
      documentId: 'doc-word-1',
      fileName: 'Bao_cao_thuc_tap.docx',
    });

    const syncChannel = (
      syncResult as { workspaceSyncChannel?: WorkspaceSyncChannel }
    ).workspaceSyncChannel!;
    const emitted: unknown[] = [];
    const detach = syncChannel.attach((ev) => emitted.push(ev));

    await aiOptions.onSuperDocInspect?.({ countsOnly: true });
    expect(emitted).toHaveLength(0);

    await aiOptions.onSuperDocStreamText?.({
      mode: 'append',
      anchor: null,
      text: 'Đoạn văn mới stream',
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      resource: 'word-document',
      action: 'updated',
      conversationId: 'conv-1',
      entityId: 'doc-word-1',
      title: 'Bao_cao_thuc_tap.docx',
      changeMode: 'tracked',
      count: 1,
      requiresSnapshotReload: false,
    });

    await aiOptions.onSuperDocPerformAction?.({
      action: 'insert_table',
    });
    detach();

    expect(emitted).toHaveLength(2);
    expect(emitted[1]).toMatchObject({
      resource: 'word-document',
      action: 'updated',
      conversationId: 'conv-1',
      entityId: 'doc-word-1',
      title: 'Bao_cao_thuc_tap.docx',
      changeMode: 'tracked',
      count: 2,
      requiresSnapshotReload: true,
    });
  });

  it('nên trả lỗi policy và không chạy session hay phát sync nếu validateToolCallPolicy từ chối', async () => {
    superdocRuntimeMock.validateToolCallPolicy.mockReturnValueOnce({
      allowed: false,
      code: 'CHANGE_MODE_REQUIRED',
      message: 'Hành động không hỗ trợ tracked changes.',
    });

    const syncResult = await service.handleChatStream(
      'user-1',
      'session-1',
      [
        {
          id: 'msg-word-2',
          role: 'user',
          parts: [{ type: 'text', text: 'Chỉnh sửa tiêu đề' }],
        },
      ],
      undefined,
      [],
      {
        activeWordContext: {
          documentId: 'doc-word-1',
          changeMode: 'tracked',
        },
      },
    );

    const syncChannel = (
      syncResult as { workspaceSyncChannel?: WorkspaceSyncChannel }
    ).workspaceSyncChannel!;
    const emitted: unknown[] = [];
    const detach = syncChannel.attach((ev) => emitted.push(ev));

    const aiOptions = aiMock.executeChatStream.mock.calls[0]?.[3] as {
      onSuperDocPerformAction?: (
        input: Record<string, unknown>,
      ) => Promise<unknown>;
    };

    const result = await aiOptions.onSuperDocPerformAction?.({
      action: 'unsupported_direct_action',
    });
    detach();

    expect(result).toEqual({
      status: 'failed',
      error: {
        code: 'CHANGE_MODE_REQUIRED',
        message: 'Hành động không hỗ trợ tracked changes.',
      },
    });
    expect(superdocRuntimeMock.runWithDocumentSession).not.toHaveBeenCalled();
    expect(emitted).toHaveLength(0);
  });

  it('nên hydrate uiContext và truyền workspaceContext sang ChatAgentAiService mà không làm bẩn UIMessage lưu DB', async () => {
    const incomingMessages = [
      {
        id: 'u-ctx-1',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'Giải thích trang này giúp mình' }],
      },
    ];

    await service.handleChatStream(
      'user-1',
      'session-1',
      incomingMessages,
      undefined,
      [],
      {
        uiContext: {
          schemaVersion: 1,
          location: {
            pageType: 'conversation',
            conversationId: 'conv-1',
            activeTab: 'documents',
          },
          documents: {
            viewMode: 'viewer',
            filterType: 'all',
            totalCount: 1,
            visibleCount: 1,
            viewingDocument: {
              documentId: 'doc-attached-1',
              fileName: 'Giao_trinh_CTDL.pdf',
              viewerKind: 'pdf',
              currentPage: 5,
            },
          },
        },
      },
    );

    expect(hydratorMock.hydrate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        conversationId: 'conv-1',
      }),
    );

    const aiOptions = aiMock.executeChatStream.mock.calls[0]?.[3] as {
      workspaceContext?: { location?: { activeTab?: string } };
    };
    expect(aiOptions.workspaceContext?.location?.activeTab).toBe('documents');

    const savedPayload = repoMock.createMessage.mock.calls[0]?.[0] as {
      message_json?: { parts?: Array<{ text?: string }> };
    };
    expect(savedPayload.message_json?.parts?.[0]?.text).toBe(
      'Giải thích trang này giúp mình',
    );
  });
});
