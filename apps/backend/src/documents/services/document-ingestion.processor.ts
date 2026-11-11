import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { Job, Worker } from 'bullmq';
import { Prisma } from '../../generated/prisma/client.js';
import type { Document } from '../../generated/prisma/client.js';
import { StorageService } from '../../storage/storage.service.js';
import { DocumentsRepoService } from '../../repo/documents-repo/documents-repo.service.js';
import {
  DocumentChunksRepoService,
  type InsertedChunkRecord,
} from '../../repo/document-chunks-repo/document-chunks-repo.service.js';
import {
  DocumentAssetsRepoService,
  type CreateDocumentAssetInput,
} from '../../repo/document-assets-repo/document-assets-repo.service.js';
import { EmbeddingService } from '../../ai/embedding.service.js';
import { VisionService } from '../../ai/vision.service.js';
import {
  DoclingService,
  type DoclingChunkResult,
  type ExtractedDoclingPicture,
} from './docling.service.js';
import {
  DOCUMENT_QUEUE_NAME,
  type DocumentJobData,
  DocumentsQueueService,
} from './documents-queue.service.js';

@Injectable()
export class DocumentIngestionProcessor
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(DocumentIngestionProcessor.name);
  private worker: Worker<DocumentJobData>;

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly documentsRepo: DocumentsRepoService,
    private readonly documentChunksRepo: DocumentChunksRepoService,
    private readonly documentAssetsRepo: DocumentAssetsRepoService,
    private readonly embeddingService: EmbeddingService,
    private readonly visionService: VisionService,
    private readonly doclingService: DoclingService,
    private readonly documentsQueueService: DocumentsQueueService,
  ) {}

  onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    const redisPassword =
      this.configService.get<string>('REDIS_PASSWORD') || undefined;

    this.worker = new Worker<DocumentJobData>(
      DOCUMENT_QUEUE_NAME,
      async (job: Job<DocumentJobData>) => {
        await this.processIngestionJob(job);
      },
      {
        connection: {
          url: redisUrl,
          password: redisPassword,
          maxRetriesPerRequest: null,
        },
        concurrency: 3,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(
        `Job xử lý tài liệu [${job.data.documentId}] hoàn tất thành công`,
      );
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Job xử lý tài liệu [${job?.data?.documentId}] thất bại: ${err.message}`,
      );
    });

    this.worker.on('error', (err) => {
      this.logger.warn(`BullMQ Ingestion Worker error: ${err.message}`);
    });

    this.logger.log(
      `BullMQ Ingestion Worker cho [${DOCUMENT_QUEUE_NAME}] đã sẵn sàng lắng nghe`,
    );

    void this.recoverIncompleteDocuments();
  }

  private async recoverIncompleteDocuments(): Promise<void> {
    try {
      const incompleteDocs = await this.documentsRepo.findIncompleteDocuments();
      if (incompleteDocs.length === 0) return;

      this.logger.log(
        `Phát hiện ${incompleteDocs.length} tài liệu chưa hoàn tất xử lý từ phiên trước, tiến hành đẩy lại vào hàng đợi...`,
      );

      for (const doc of incompleteDocs) {
        await this.documentsQueueService.addProcessingJob({
          documentId: doc.id,
          mimeType: doc.mime_type,
          storageKey: doc.storage_key,
          fileName: doc.file_name,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Không thể phục hồi các tài liệu đang chờ xử lý: ${message}`,
      );
    }
  }

  private async processIngestionJob(job: Job<DocumentJobData>): Promise<void> {
    const { documentId, mimeType, storageKey, fileName } = job.data;

    if (!documentId || !storageKey || !mimeType) {
      throw new Error(
        'Dữ liệu công việc không hợp lệ: thiếu documentId, storageKey hoặc mimeType',
      );
    }

    const doc = await this.documentsRepo.findRawDocumentById(documentId);
    if (!doc) {
      this.logger.warn(
        `Không tìm thấy tài liệu [${documentId}] trong CSDL (có thể đã bị xóa), bỏ qua xử lý`,
      );
      return;
    }

    const effectiveFileName = fileName || doc.file_name || 'document';
    this.logger.log(
      `Bắt đầu pipeline xử lý tài liệu [${documentId}] (MIME: ${mimeType}, File: ${effectiveFileName})`,
    );

    try {
      // 1. Đánh dấu bắt đầu bước trích xuất
      await this.documentsRepo.updateDocumentById(documentId, {
        ocr_status: 'processing',
        processing_error: null,
      });

      // 2. Tải buffer từ R2 đúng 1 lần duy nhất và tính SHA-256 file_hash
      const buffer = await this.storageService.getObjectBuffer(storageKey);
      const fileHash = createHash('sha256').update(buffer).digest('hex');

      // 3. Kiểm tra trùng lặp file_hash trong cùng conversation_id
      const reused = await this.tryReuseDuplicateDocument(doc, fileHash);
      if (reused) {
        this.logger.log(
          `Tái sử dụng thành công dữ liệu từ tài liệu trùng file_hash [${fileHash}] cho [${documentId}]`,
        );
        return;
      }

      // 4. Phân nhánh xử lý theo loại tệp
      if (this.isImageDocument(mimeType, effectiveFileName)) {
        await this.processImageDocument(
          doc,
          buffer,
          fileHash,
          mimeType,
          effectiveFileName,
        );
      } else if (this.isPlainTextOrMarkdown(mimeType, effectiveFileName)) {
        await this.processPlainTextOrMarkdownDocument(
          doc,
          buffer,
          fileHash,
          effectiveFileName,
        );
      } else {
        await this.processStructuredDocument(
          doc,
          buffer,
          fileHash,
          effectiveFileName,
        );
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Lỗi không xác định trong quá trình xử lý tài liệu';
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Lỗi xử lý tài liệu [${documentId}]: ${message}`,
        stack,
      );

      await this.documentsRepo.updateDocumentById(documentId, {
        ocr_status: 'failed',
        embed_status: 'failed',
        processing_error: message,
      });

      throw error;
    }
  }

  /**
   * Kiểm tra và tái sử dụng kết quả nếu trong cùng conversation đã có tài liệu trùng SHA-256
   */
  private async tryReuseDuplicateDocument(
    doc: Document,
    fileHash: string,
  ): Promise<boolean> {
    const existingDoc = await this.documentsRepo.findCompletedDocumentByHash(
      doc.conversation_id,
      doc.user_id,
      fileHash,
      doc.id,
    );

    if (!existingDoc) {
      return false;
    }

    const copiedChunks = await this.documentChunksRepo.cloneChunksFromDocument(
      existingDoc.id,
      doc.id,
    );

    const existingAssets =
      await this.documentAssetsRepo.findAssetsByDocumentId(existingDoc.id);
    if (existingAssets.length > 0) {
      await this.documentAssetsRepo.replaceDocumentAssets(
        doc.id,
        existingAssets.map((a) => ({
          assetType: a.asset_type,
          selfRef: a.self_ref,
          pageNo: a.page_no,
          bbox: a.bbox as Prisma.InputJsonValue | null,
          storageKey: a.storage_key,
          caption: a.caption,
          vlmDescription: a.vlm_description,
        })),
      );
    }

    await this.documentsRepo.updateDocumentById(doc.id, {
      file_hash: fileHash,
      raw_text: existingDoc.raw_text,
      page_count: existingDoc.page_count,
      docling_json_key: existingDoc.docling_json_key,
      doc_metadata:
        (existingDoc.doc_metadata as Prisma.InputJsonValue) ?? Prisma.DbNull,
      ocr_status: 'done',
      embed_status: 'done',
      processing_error: null,
    });

    this.logger.log(
      `Đã sao chép ${copiedChunks} chunks và ${existingAssets.length} assets từ tài liệu [${existingDoc.id}] sang [${doc.id}]`,
    );
    return true;
  }

  /**
   * TRƯỜNG HỢP 2: Xử lý tệp Hình ảnh qua Vision LLM Single-Pass + Zod Schema
   */
  private async processImageDocument(
    doc: Document,
    buffer: Buffer,
    fileHash: string,
    mimeType: string,
    fileName: string,
  ): Promise<void> {
    this.logger.log(
      `[Nhánh Ảnh] Gửi hình ảnh [${doc.id}] (${fileName}) tới Vision LLM (Single-Pass OCR + Mô tả + Chunking)...`,
    );

    const visionOutput = await this.visionService.analyzeAndChunkImage(
      buffer,
      mimeType,
      fileName,
    );
    const enrichedMarkdown =
      this.visionService.composeEnrichedMarkdown(visionOutput);

    const docMetadata: Record<string, unknown> = {
      image_category: visionOutput.image_category,
      title_or_topic: visionOutput.title_or_topic,
      contains_table: visionOutput.contains_table,
      contains_formula_or_code: visionOutput.contains_formula_or_code,
      toc: [
        {
          text: visionOutput.title_or_topic,
          level: 1,
          page_no: 1,
        },
      ],
      processing_time: 0,
      total_tables: visionOutput.contains_table ? 1 : 0,
      total_pictures: 1,
    };

    const chunks: DoclingChunkResult[] = visionOutput.chunks.map(
      (chunk, idx) => ({
        index: idx,
        pageNumbers: [1],
        content: chunk.content.trim(),
        rawContent: chunk.raw_content.trim(),
        tokenCount: Math.max(1, Math.ceil(chunk.content.length / 4)),
        headings: chunk.headings,
        chunkType: chunk.chunk_type,
        hasTable: chunk.has_table,
        hasImage: chunk.has_image,
        metadata: {
          self_refs: ['#/pictures/0'],
          image_category: visionOutput.image_category,
        },
      }),
    );

    await this.documentsRepo.updateDocumentById(doc.id, {
      file_hash: fileHash,
      raw_text: enrichedMarkdown,
      page_count: 1,
      doc_metadata: docMetadata as Prisma.InputJsonValue,
      ocr_status: 'done',
      embed_status: chunks.length > 0 ? 'processing' : 'done',
      processing_error: null,
    });

    const insertedChunks = await this.embedAndSaveChunks(doc.id, chunks);

    await this.documentAssetsRepo.replaceDocumentAssets(doc.id, [
      {
        chunkId: insertedChunks[0]?.id ?? null,
        assetType: visionOutput.image_category,
        selfRef: '#/pictures/0',
        pageNo: 1,
        bbox: null,
        storageKey: doc.storage_key,
        caption: visionOutput.title_or_topic,
        vlmDescription: visionOutput.visual_description.trim() || null,
      },
    ]);

    await this.documentsRepo.updateDocumentById(doc.id, {
      embed_status: 'done',
      processing_error: null,
    });

    this.logger.log(
      `[Nhánh Ảnh] Hoàn tất xử lý ảnh [${doc.id}]: đã lưu ${insertedChunks.length} chunks và 1 asset`,
    );
  }

  /**
   * TRƯỜNG HỢP 1A: Xử lý tệp .md / .txt
   * Đọc trực tiếp UTF-8 để lưu raw_text (bỏ qua API Convert của Docling) và chỉ gọi API HybridChunker.
   */
  private async processPlainTextOrMarkdownDocument(
    doc: Document,
    buffer: Buffer,
    fileHash: string,
    fileName: string,
  ): Promise<void> {
    this.logger.log(
      `[Nhánh MD/TXT] Đọc trực tiếp UTF-8 cho [${doc.id}] (${fileName}) và băm qua Docling HybridChunker...`,
    );

    const rawText = buffer.toString('utf-8').replace(/\r\n/g, '\n').trim();
    const toc = this.doclingService.extractTocFromMarkdown(rawText);

    const docMetadata: Record<string, unknown> = {
      toc,
      processing_time: 0,
      total_tables: 0,
      total_pictures: 0,
    };

    await this.documentsRepo.updateDocumentById(doc.id, {
      file_hash: fileHash,
      raw_text: rawText,
      page_count: 1,
      doc_metadata: docMetadata as Prisma.InputJsonValue,
      ocr_status: 'done',
      embed_status: rawText.length > 0 ? 'processing' : 'done',
      processing_error: null,
    });

    if (rawText.length === 0) {
      return;
    }

    const rawChunks = await this.doclingService.chunkMarkdownHybrid(
      rawText,
      fileName,
    );
    const normalizedChunks = rawChunks.map((c) => ({
      ...c,
      pageNumbers: c.pageNumbers.length > 0 ? c.pageNumbers : [1],
    }));

    const insertedChunks = await this.embedAndSaveChunks(
      doc.id,
      normalizedChunks,
    );

    await this.documentsRepo.updateDocumentById(doc.id, {
      embed_status: 'done',
      processing_error: null,
    });

    this.logger.log(
      `[Nhánh MD/TXT] Hoàn tất xử lý [${doc.id}]: đã lưu ${insertedChunks.length} chunks`,
    );
  }

  /**
   * TRƯỜNG HỢP 1B (Cách 3A): Xử lý tệp tài liệu có cấu trúc (PDF, DOCX, PPTX, XLSX, CSV...)
   * Bước 1: Convert qua Docling (lấy md_content + json_content + ảnh crop + VLM Tiếng Việt).
   * Bước 2: Truyền json_docling nhẹ sang API HybridChunker (không chạy lại OCR/VLM lần 2).
   * Bước 3: Tạo Vector Embedding, lưu document_chunks và ánh xạ chunk_id vào document_assets.
   */
  private async processStructuredDocument(
    doc: Document,
    buffer: Buffer,
    fileHash: string,
    fileName: string,
  ): Promise<void> {
    this.logger.log(
      `[Nhánh Tài liệu] Bước 1: Gửi [${doc.id}] (${fileName}) tới Docling Convert...`,
    );

    const conversion = await this.doclingService.convertDocument(
      buffer,
      fileName,
    );

    // Upload file .docling.json (đã xóa chuỗi base64 nặng) lên R2
    let doclingJsonKey: string | null = null;
    if (conversion.sanitizedJsonContent) {
      doclingJsonKey = `users/${doc.user_id}/conversations/${doc.conversation_id}/docling/${doc.id}.docling.json`;
      const jsonBuffer = Buffer.from(
        JSON.stringify(conversion.sanitizedJsonContent),
        'utf-8',
      );
      await this.storageService.uploadObjectBuffer(
        doclingJsonKey,
        jsonBuffer,
        'application/json',
      );
    }

    // Upload các ảnh crop (pictures) lên R2 và lưu vào bảng document_assets
    if (conversion.extractedPictures.length > 0) {
      await this.uploadAndSaveExtractedPictures(
        doc,
        conversion.extractedPictures,
      );
    }

    const hasContentForChunking =
      conversion.mdContent.length > 0 ||
      Boolean(conversion.sanitizedJsonContent);

    await this.documentsRepo.updateDocumentById(doc.id, {
      file_hash: fileHash,
      raw_text: conversion.mdContent,
      page_count: conversion.pageCount,
      docling_json_key: doclingJsonKey,
      doc_metadata: conversion.docMetadata as Prisma.InputJsonValue,
      ocr_status: 'done',
      embed_status: hasContentForChunking ? 'processing' : 'done',
      processing_error: null,
    });

    if (!hasContentForChunking) {
      this.logger.log(
        `[Nhánh Tài liệu] Tài liệu [${doc.id}] không có nội dung để chunk, hoàn tất.`,
      );
      return;
    }

    // Bước 2: Chuyển tiếp json_docling sang HybridChunker (Cách 3A - Luồng chính bắt buộc)
    this.logger.log(
      `[Nhánh Tài liệu] Bước 2: Phân đoạn HybridChunker (Cách 3A - json_docling) cho [${doc.id}]...`,
    );

    let chunks: DoclingChunkResult[] = [];
    if (conversion.sanitizedJsonContent) {
      try {
        chunks = await this.doclingService.chunkFromDoclingJson(
          conversion.sanitizedJsonContent,
          fileName,
        );
      } catch (err: unknown) {
        this.logger.warn(
          `[Nhánh Tài liệu] Lỗi khi chunk qua json_docling cho [${doc.id}], kích hoạt fallback sang Markdown: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Dự phòng an toàn (Fallback): Chỉ khi json_docling thất bại hoặc trả về 0 chunks
    if (chunks.length === 0 && conversion.mdContent.length > 0) {
      this.logger.log(
        `[Nhánh Tài liệu] Chạy fallback chunking qua Markdown cho [${doc.id}]...`,
      );
      chunks = await this.doclingService.chunkMarkdownHybrid(
        conversion.mdContent,
        fileName,
      );
    }

    // Bước 3: Tạo Embedding, lưu document_chunks và liên kết chunk_id sang document_assets
    const insertedChunks = await this.embedAndSaveChunks(doc.id, chunks);
    await this.linkInsertedChunksToAssets(doc.id, insertedChunks);

    await this.documentsRepo.updateDocumentById(doc.id, {
      embed_status: 'done',
      processing_error: null,
    });

    this.logger.log(
      `[Nhánh Tài liệu] Hoàn tất toàn bộ pipeline cho [${doc.id}]: ${conversion.pageCount} trang, ${insertedChunks.length} chunks, ${conversion.extractedPictures.length} assets`,
    );
  }

  private async uploadAndSaveExtractedPictures(
    doc: Document,
    pictures: ExtractedDoclingPicture[],
  ): Promise<void> {
    const assetInputs: CreateDocumentAssetInput[] = [];

    for (const pic of pictures) {
      const ext = this.extensionFromImageMime(pic.mimeType);
      const assetKey = `users/${doc.user_id}/conversations/${doc.conversation_id}/assets/${doc.id}/picture-${pic.index}.${ext}`;

      await this.storageService.uploadObjectBuffer(
        assetKey,
        pic.buffer,
        pic.mimeType,
      );

      assetInputs.push({
        assetType: pic.assetType,
        selfRef: pic.selfRef,
        pageNo: pic.pageNo,
        bbox: (pic.bbox as Prisma.InputJsonValue) ?? null,
        storageKey: assetKey,
        caption: pic.caption,
        vlmDescription: pic.vlmDescription,
      });
    }

    await this.documentAssetsRepo.replaceDocumentAssets(doc.id, assetInputs);
  }

  private async embedAndSaveChunks(
    documentId: string,
    chunks: DoclingChunkResult[],
  ): Promise<InsertedChunkRecord[]> {
    if (chunks.length === 0) {
      return [];
    }

    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await this.embeddingService.embedBatch(chunkTexts);

    const chunksWithEmbeddings = chunks.map((chunk, idx) => ({
      chunkIndex: chunk.index,
      pageNumbers: chunk.pageNumbers,
      content: chunk.content,
      rawContent: chunk.rawContent,
      tokenCount: chunk.tokenCount,
      headings: chunk.headings,
      bboxes: chunk.bboxes,
      chunkType: chunk.chunkType,
      hasImage: chunk.hasImage,
      hasTable: chunk.hasTable,
      metadata: chunk.metadata,
      embedding: embeddings[idx].values,
    }));

    return await this.documentChunksRepo.replaceChunksWithEmbeddings(
      documentId,
      chunksWithEmbeddings,
    );
  }

  private async linkInsertedChunksToAssets(
    documentId: string,
    insertedChunks: InsertedChunkRecord[],
  ): Promise<void> {
    const selfRefToChunkId = new Map<string, string>();

    for (const record of insertedChunks) {
      const refs = record.metadata?.self_refs;
      if (!Array.isArray(refs)) continue;

      for (const ref of refs) {
        if (
          typeof ref === 'string' &&
          ref.startsWith('#/pictures/') &&
          !selfRefToChunkId.has(ref)
        ) {
          selfRefToChunkId.set(ref, record.id);
        }
      }
    }

    if (selfRefToChunkId.size > 0) {
      await this.documentAssetsRepo.linkAssetsToChunksBySelfRef(
        documentId,
        selfRefToChunkId,
      );
    }
  }

  private isImageDocument(mimeType: string, fileName: string): boolean {
    const lowerMime = mimeType.toLowerCase();
    if (lowerMime.startsWith('image/')) return true;

    const lowerName = fileName.toLowerCase();
    return (
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.webp')
    );
  }

  private isPlainTextOrMarkdown(mimeType: string, fileName: string): boolean {
    const lowerMime = mimeType.toLowerCase();
    const lowerName = fileName.toLowerCase();

    if (
      lowerMime === 'text/markdown' ||
      lowerMime === 'text/x-markdown' ||
      lowerName.endsWith('.md') ||
      lowerName.endsWith('.markdown')
    ) {
      return true;
    }

    if (lowerMime === 'text/plain' && !lowerName.endsWith('.csv')) {
      return true;
    }

    return lowerName.endsWith('.txt');
  }

  private extensionFromImageMime(mimeType: string): string {
    const lower = mimeType.toLowerCase();
    if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
    if (lower.includes('webp')) return 'webp';
    return 'png';
  }

  async onApplicationShutdown() {
    if (this.worker) {
      await this.worker.close().catch(() => {});
      this.logger.log(
        `BullMQ Ingestion Worker cho [${DOCUMENT_QUEUE_NAME}] đã đóng kết nối`,
      );
    }
  }
}
