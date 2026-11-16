import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentIngestionProcessor } from './document-ingestion.processor.js';
import type { ConfigService } from '@nestjs/config';
import type { StorageService } from '../../storage/storage.service.js';
import type { DocumentsRepoService } from '../../repo/documents-repo/documents-repo.service.js';
import type { DocumentChunksRepoService } from '../../repo/document-chunks-repo/document-chunks-repo.service.js';
import type { DocumentAssetsRepoService } from '../../repo/document-assets-repo/document-assets-repo.service.js';
import type { EmbeddingService } from '../../ai/embedding.service.js';
import type { VisionService } from '../../ai/vision.service.js';
import type { DoclingService } from './docling.service.js';
import type { DocumentsQueueService } from './documents-queue.service.js';
import type { Job } from 'bullmq';
import type { DocumentJobData } from './documents-queue.service.js';

describe('DocumentIngestionProcessor', () => {
  let processor: DocumentIngestionProcessor;
  let storageService: {
    getObjectBuffer: ReturnType<typeof vi.fn>;
    uploadObjectBuffer: ReturnType<typeof vi.fn>;
  };
  let documentsRepo: {
    findRawDocumentById: ReturnType<typeof vi.fn>;
    findCompletedDocumentByHash: ReturnType<typeof vi.fn>;
    updateDocumentById: ReturnType<typeof vi.fn>;
    findIncompleteDocuments: ReturnType<typeof vi.fn>;
  };
  let documentChunksRepo: {
    replaceChunksWithEmbeddings: ReturnType<typeof vi.fn>;
    cloneChunksFromDocument: ReturnType<typeof vi.fn>;
    findChunkRecordsByDocumentId: ReturnType<typeof vi.fn>;
  };
  let documentAssetsRepo: {
    replaceDocumentAssets: ReturnType<typeof vi.fn>;
    linkAssetsToChunksBySelfRef: ReturnType<typeof vi.fn>;
    linkAssetsToChunksById: ReturnType<typeof vi.fn>;
    findAssetsByDocumentId: ReturnType<typeof vi.fn>;
  };
  let embeddingService: {
    embedBatch: ReturnType<typeof vi.fn>;
  };
  let visionService: {
    analyzeAndChunkImage: ReturnType<typeof vi.fn>;
    composeEnrichedMarkdown: ReturnType<typeof vi.fn>;
  };
  let doclingService: {
    convertDocument: ReturnType<typeof vi.fn>;
    chunkFromDoclingJson: ReturnType<typeof vi.fn>;
    chunkMarkdownHybrid: ReturnType<typeof vi.fn>;
    enrichChunksWithDoclingJson: ReturnType<typeof vi.fn>;
    extractTocFromMarkdown: ReturnType<typeof vi.fn>;
  };
  let documentsQueueService: {
    addProcessingJob: ReturnType<typeof vi.fn>;
  };

  const mockDocument = {
    id: 'doc-1',
    conversation_id: 'conv-1',
    user_id: 'user-1',
    file_name: 'test.pdf',
    mime_type: 'application/pdf',
    file_size: BigInt(1024),
    storage_key: 'users/user-1/conversations/conv-1/doc-1-test.pdf',
    ocr_status: 'pending',
    embed_status: 'pending',
  };

  beforeEach(() => {
    storageService = {
      getObjectBuffer: vi.fn().mockResolvedValue(Buffer.from('file-binary')),
      uploadObjectBuffer: vi.fn().mockResolvedValue(undefined),
    };
    documentsRepo = {
      findRawDocumentById: vi.fn().mockResolvedValue(mockDocument),
      findCompletedDocumentByHash: vi.fn().mockResolvedValue(null),
      updateDocumentById: vi.fn().mockResolvedValue(mockDocument),
      findIncompleteDocuments: vi.fn().mockResolvedValue([]),
    };
    documentChunksRepo = {
      replaceChunksWithEmbeddings: vi.fn().mockResolvedValue([
        {
          id: 'chunk-uuid-1',
          chunkIndex: 0,
          pageNumbers: [1],
          content: '# Chapter 1\nSample text',
          hasImage: true,
          metadata: { self_refs: ['#/pictures/0'] },
        },
      ]),
      cloneChunksFromDocument: vi.fn().mockResolvedValue(2),
      findChunkRecordsByDocumentId: vi.fn().mockResolvedValue([]),
    };
    documentAssetsRepo = {
      replaceDocumentAssets: vi.fn().mockResolvedValue([
        {
          id: 'asset-uuid-1',
          document_id: 'doc-1',
          chunk_id: null,
          asset_type: 'chart',
          self_ref: '#/pictures/0',
          page_no: 1,
          bbox: { l: 0, t: 0, r: 50, b: 50 },
          storage_key: 'key',
          caption: 'Figure 1',
          vlm_description: 'Mô tả biểu đồ tiếng Việt',
        },
      ]),
      linkAssetsToChunksBySelfRef: vi.fn().mockResolvedValue(undefined),
      linkAssetsToChunksById: vi.fn().mockResolvedValue(undefined),
      findAssetsByDocumentId: vi.fn().mockResolvedValue([]),
    };
    embeddingService = {
      embedBatch: vi
        .fn()
        .mockResolvedValue([
          { index: 0, values: Array.from({ length: 768 }, () => 0.1) },
        ]),
    };
    visionService = {
      analyzeAndChunkImage: vi.fn(),
      composeEnrichedMarkdown: vi.fn(),
    };
    doclingService = {
      convertDocument: vi.fn(),
      chunkFromDoclingJson: vi.fn(),
      chunkMarkdownHybrid: vi.fn(),
      enrichChunksWithDoclingJson: vi.fn((chunks) => chunks),
      extractTocFromMarkdown: vi.fn().mockReturnValue([]),
    };
    documentsQueueService = {
      addProcessingJob: vi.fn(),
    };

    const configService = {
      get: vi.fn(),
    } as unknown as ConfigService;

    processor = new DocumentIngestionProcessor(
      configService,
      storageService as unknown as StorageService,
      documentsRepo as unknown as DocumentsRepoService,
      documentChunksRepo as unknown as DocumentChunksRepoService,
      documentAssetsRepo as unknown as DocumentAssetsRepoService,
      embeddingService as unknown as EmbeddingService,
      visionService as unknown as VisionService,
      doclingService as unknown as DoclingService,
      documentsQueueService as unknown as DocumentsQueueService,
    );
  });

  const invokeJob = async (data: DocumentJobData) => {
    await (
      processor as unknown as {
        processIngestionJob: (job: Job<DocumentJobData>) => Promise<void>;
      }
    ).processIngestionJob({ data } as Job<DocumentJobData>);
  };

  it('processes structured PDF via Docling Convert + json_docling HybridChunker + Asset linking (Option 3A)', async () => {
    doclingService.convertDocument.mockResolvedValue({
      mdContent: '# Chapter 1\nSample text\n![Img](#/pictures/0)',
      sanitizedJsonContent: { pages: { '1': {} }, pictures: [] },
      pageCount: 1,
      docMetadata: {
        toc: [{ text: 'Chapter 1', level: 1, page_no: 1 }],
        processing_time: 1.5,
        total_tables: 0,
        total_pictures: 1,
      },
      extractedPictures: [
        {
          index: 0,
          selfRef: '#/pictures/0',
          assetType: 'chart',
          pageNo: 1,
          bbox: { l: 0, t: 0, r: 50, b: 50 },
          caption: 'Figure 1',
          vlmDescription: 'Mô tả biểu đồ tiếng Việt',
          mimeType: 'image/png',
          buffer: Buffer.from('cropped-png'),
        },
      ],
    });

    doclingService.chunkFromDoclingJson.mockResolvedValue([
      {
        index: 0,
        pageNumbers: [1],
        content: '# Chapter 1\nSample text',
        rawContent: 'Sample text',
        tokenCount: 10,
        headings: ['Chapter 1'],
        chunkType: 'mixed',
        hasImage: true,
        hasTable: false,
        metadata: { self_refs: ['#/pictures/0'] },
      },
    ]);

    await invokeJob({
      documentId: 'doc-1',
      mimeType: 'application/pdf',
      storageKey: mockDocument.storage_key,
      fileName: 'test.pdf',
    });

    expect(doclingService.convertDocument).toHaveBeenCalledTimes(1);
    expect(doclingService.chunkFromDoclingJson).toHaveBeenCalledTimes(1);
    expect(storageService.uploadObjectBuffer).toHaveBeenCalledTimes(2); // 1 .docling.json + 1 cropped picture
    expect(documentAssetsRepo.replaceDocumentAssets).toHaveBeenCalledTimes(1);
    expect(
      documentAssetsRepo.linkAssetsToChunksBySelfRef,
    ).toHaveBeenCalledTimes(1);
    expect(documentsRepo.updateDocumentById).toHaveBeenLastCalledWith(
      'doc-1',
      expect.objectContaining({
        embed_status: 'done',
        processing_error: null,
      }),
    );
  });

  it('links assets via fallback page_no and caption/vlmDescription when self_refs do not directly match', async () => {
    doclingService.convertDocument.mockResolvedValue({
      mdContent: '# Page 2\nFigure 2: Depth-First Search Tree',
      sanitizedJsonContent: { pages: { '1': {}, '2': {} }, pictures: [] },
      pageCount: 2,
      docMetadata: {
        toc: [{ text: 'Page 2', level: 1, page_no: 2 }],
        processing_time: 2.0,
        total_tables: 0,
        total_pictures: 1,
      },
      extractedPictures: [
        {
          index: 1,
          selfRef: '#/pictures/1',
          assetType: 'diagram',
          pageNo: 2,
          bbox: { l: 10, t: 10, r: 100, b: 100 },
          caption: 'Figure 2: Depth-First Search Tree',
          vlmDescription: 'Sơ đồ cây tìm kiếm theo chiều sâu DFS',
          mimeType: 'image/png',
          buffer: Buffer.from('cropped-png-2'),
        },
      ],
    });

    documentAssetsRepo.replaceDocumentAssets.mockResolvedValue([
      {
        id: 'asset-uuid-2',
        document_id: 'doc-1',
        chunk_id: null,
        asset_type: 'diagram',
        self_ref: '#/pictures/1',
        page_no: 2,
        bbox: { l: 10, t: 10, r: 100, b: 100 },
        storage_key: 'key-2',
        caption: 'Figure 2: Depth-First Search Tree',
        vlm_description: 'Sơ đồ cây tìm kiếm theo chiều sâu DFS',
      },
    ]);

    doclingService.chunkFromDoclingJson.mockResolvedValue([
      {
        index: 0,
        pageNumbers: [2],
        content: '# Page 2\nFigure 2: Depth-First Search Tree',
        rawContent: 'Figure 2: Depth-First Search Tree',
        tokenCount: 12,
        headings: ['Page 2'],
        chunkType: 'text',
        hasImage: false,
        hasTable: false,
        metadata: { self_refs: [] },
      },
    ]);

    documentChunksRepo.replaceChunksWithEmbeddings.mockResolvedValue([
      {
        id: 'chunk-uuid-page-2',
        chunkIndex: 0,
        pageNumbers: [2],
        content: '# Page 2\nFigure 2: Depth-First Search Tree',
        hasImage: false,
        metadata: { self_refs: [] },
      },
    ]);

    await invokeJob({
      documentId: 'doc-1',
      mimeType: 'application/pdf',
      storageKey: mockDocument.storage_key,
      fileName: 'test.pdf',
    });

    expect(
      documentAssetsRepo.linkAssetsToChunksBySelfRef,
    ).toHaveBeenCalledWith(
      'doc-1',
      new Map([['#/pictures/1', 'chunk-uuid-page-2']]),
    );
    expect(documentAssetsRepo.linkAssetsToChunksById).toHaveBeenCalledWith(
      'doc-1',
      new Map([['asset-uuid-2', 'chunk-uuid-page-2']]),
    );
  });

  it('bypasses Docling Convert for .md/.txt files and only calls chunkMarkdownHybrid', async () => {
    documentsRepo.findRawDocumentById.mockResolvedValue({
      ...mockDocument,
      file_name: 'notes.md',
      mime_type: 'text/markdown',
    });
    storageService.getObjectBuffer.mockResolvedValue(
      Buffer.from('# Title\nMarkdown body', 'utf-8'),
    );
    doclingService.chunkMarkdownHybrid.mockResolvedValue([
      {
        index: 0,
        pageNumbers: [1],
        content: '# Title\nMarkdown body',
        rawContent: 'Markdown body',
        tokenCount: 6,
      },
    ]);

    await invokeJob({
      documentId: 'doc-1',
      mimeType: 'text/markdown',
      storageKey: 'key.md',
      fileName: 'notes.md',
    });

    expect(doclingService.convertDocument).not.toHaveBeenCalled();
    expect(doclingService.chunkMarkdownHybrid).toHaveBeenCalledWith(
      '# Title\nMarkdown body',
      'notes.md',
    );
    expect(embeddingService.embedBatch).toHaveBeenCalledWith([
      '# Title\nMarkdown body',
    ]);
  });

  it('processes image files via VisionService Single-Pass without calling Docling', async () => {
    documentsRepo.findRawDocumentById.mockResolvedValue({
      ...mockDocument,
      file_name: 'diagram.png',
      mime_type: 'image/png',
    });
    visionService.analyzeAndChunkImage.mockResolvedValue({
      image_category: 'diagram_chart',
      title_or_topic: 'Sơ đồ kiến trúc hệ thống',
      extracted_markdown: 'Node A -> Node B',
      visual_description: 'Sơ đồ gồm 2 khối kết nối bằng mũi tên.',
      contains_table: false,
      contains_formula_or_code: false,
      chunks: [
        {
          content: '# Sơ đồ kiến trúc hệ thống\nNode A -> Node B',
          raw_content: 'Node A -> Node B',
          headings: ['Sơ đồ kiến trúc hệ thống'],
          chunk_type: 'image_desc',
          has_table: false,
          has_image: true,
        },
      ],
    });
    visionService.composeEnrichedMarkdown.mockReturnValue(
      '# Sơ đồ kiến trúc hệ thống\n\nNode A -> Node B',
    );

    await invokeJob({
      documentId: 'doc-1',
      mimeType: 'image/png',
      storageKey: 'key.png',
      fileName: 'diagram.png',
    });

    expect(visionService.analyzeAndChunkImage).toHaveBeenCalledTimes(1);
    expect(doclingService.convertDocument).not.toHaveBeenCalled();
    expect(doclingService.chunkMarkdownHybrid).not.toHaveBeenCalled();
    expect(documentAssetsRepo.replaceDocumentAssets).toHaveBeenCalledWith(
      'doc-1',
      [
        expect.objectContaining({
          chunkId: 'chunk-uuid-1',
          assetType: 'diagram_chart',
          storageKey: mockDocument.storage_key,
          vlmDescription: 'Sơ đồ gồm 2 khối kết nối bằng mũi tên.',
        }),
      ],
    );
  });
});
