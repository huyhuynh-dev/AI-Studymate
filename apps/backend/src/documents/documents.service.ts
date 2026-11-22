import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { StorageService } from '../storage/storage.service.js';
import { DocumentsRepoService, DocumentResponse } from '../repo/documents-repo/documents-repo.service.js';
import { DocumentAssetsRepoService } from '../repo/document-assets-repo/document-assets-repo.service.js';
import { ConversationsRepoService } from '../repo/conversations-repo/conversations-repo.service.js';
import { DocumentsQueueService } from './services/documents-queue.service.js';
import { InitUploadDto, MAX_FILE_SIZE_BYTES } from './dto/init-upload.dto.js';
import { CompleteUploadDto } from './dto/complete-upload.dto.js';
import { UpdateDocumentContentDto } from './dto/update-document-content.dto.js';
import {
    MAX_EDITABLE_TEXT_BYTES,
    MAX_READONLY_PREVIEW_BYTES,
    isEditableTextDocument,
    prepareTextForHybridChunking,
    resolveCanonicalMimeType,
    sliceUtf8Preview,
} from './constants/editable-document.constants.js';

@Injectable()
export class DocumentsService {
    private readonly logger = new Logger(DocumentsService.name);

    constructor(
        private readonly storageService: StorageService,
        private readonly documentsRepo: DocumentsRepoService,
        private readonly documentAssetsRepo: DocumentAssetsRepoService,
        private readonly conversationsRepo: ConversationsRepoService,
        private readonly documentsQueueService: DocumentsQueueService,
    ) { }

    private sanitizeFileName(fileName: string): string {
        return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    }

    async initUpload(
        userId: string,
        dto: InitUploadDto
    ): Promise<{ documentId: string; storageKey: string; uploadUrl: string; mimeType: string }> {
        const canonicalMime = resolveCanonicalMimeType(dto.fileName, dto.mimeType);
        if (!canonicalMime) {
            throw new BadRequestException(
                'Định dạng tệp hoặc phần mở rộng không được hỗ trợ. Vui lòng kiểm tra lại tên tệp.'
            );
        }

        // Kiểm tra quyền sở hữu conversation
        const conversation = await this.conversationsRepo.getConversationById(dto.conversationId, userId);
        if (!conversation) {
            throw new NotFoundException('Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền truy cập');
        }

        const documentId = randomUUID();
        const safeName = this.sanitizeFileName(dto.fileName);
        const storageKey = `users/${userId}/conversations/${dto.conversationId}/${documentId}-${safeName}`;

        const uploadUrl = await this.storageService.getSignedUrlForUpload(storageKey, canonicalMime);

        return {
            documentId,
            storageKey,
            uploadUrl,
            mimeType: canonicalMime,
        };
    }

    async completeUpload(
        userId: string,
        documentId: string,
        dto: CompleteUploadDto
    ): Promise<DocumentResponse> {
        const canonicalMime = resolveCanonicalMimeType(dto.fileName, dto.mimeType);
        if (!canonicalMime) {
            throw new BadRequestException(
                'Định dạng tệp hoặc phần mở rộng không được hỗ trợ.'
            );
        }

        // Kiểm tra quyền sở hữu conversation
        const conversation = await this.conversationsRepo.getConversationById(dto.conversationId, userId);
        if (!conversation) {
            throw new NotFoundException('Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền truy cập');
        }

        // Lớp xác thực 2: Kiểm tra sự tồn tại thực tế của file trên Cloudflare R2
        const head = await this.storageService.headObject(dto.storageKey);
        if (!head.exists) {
            throw new BadRequestException('Tệp chưa được tải lên hệ thống lưu trữ hoặc quá trình tải lên bị gián đoạn');
        }

        // Kiểm tra dung lượng thực tế trên R2
        if (head.contentLength && head.contentLength > MAX_FILE_SIZE_BYTES) {
            await this.storageService.deleteObject(dto.storageKey).catch((e) =>
                this.logger.error(`Không thể xóa file vượt dung lượng trên R2: ${e.message}`)
            );
            throw new BadRequestException('Dung lượng tệp thực tế vượt quá giới hạn 50MB cho phép');
        }

        const finalSize = head.contentLength ? BigInt(head.contentLength) : BigInt(dto.fileSize);

        // Lưu bản ghi Document vào cơ sở dữ liệu
        const document = await this.documentsRepo.createDocument({
            id: documentId,
            conversation_id: dto.conversationId,
            user_id: userId,
            file_name: dto.fileName,
            mime_type: canonicalMime,
            file_size: finalSize,
            storage_key: dto.storageKey,
            ocr_status: 'pending',
            embed_status: 'pending',
            content_version: 1,
            indexed_version: 0,
            uploaded_at: new Date(),
        });

        // Đẩy job xử lý văn bản vào BullMQ queue
        await this.documentsQueueService.addProcessingJob({
            documentId: document.id,
            mimeType: document.mime_type,
            storageKey: document.storage_key,
            fileName: document.file_name,
        });

        return document;
    }

    async getDocumentsByConversation(
        userId: string,
        conversationId: string
    ): Promise<DocumentResponse[]> {
        const conversation = await this.conversationsRepo.getConversationById(conversationId, userId);
        if (!conversation) {
            throw new NotFoundException('Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền truy cập');
        }

        return await this.documentsRepo.getAllDocumentsByConversationId(conversationId, userId);
    }

    async getDocumentById(userId: string, documentId: string): Promise<DocumentResponse> {
        const doc = await this.documentsRepo.getDocumentById(documentId, userId);
        if (!doc) {
            throw new NotFoundException('Không tìm thấy tài liệu hoặc bạn không có quyền truy cập');
        }
        return doc;
    }

    async getDownloadUrl(userId: string, documentId: string, inline = false): Promise<{ downloadUrl: string }> {
        const doc = await this.getDocumentById(userId, documentId);
        const downloadUrl = await this.storageService.getSignedUrlForDownload(
            doc.storage_key,
            inline ? undefined : doc.file_name
        );
        return { downloadUrl };
    }

    async getOverwriteUrl(userId: string, documentId: string): Promise<{ uploadUrl: string }> {
        const doc = await this.getDocumentById(userId, documentId);
        const uploadUrl = await this.storageService.getSignedUrlForUpload(
            doc.storage_key,
            doc.mime_type
        );
        return { uploadUrl };
    }

    async completeOverwrite(userId: string, documentId: string): Promise<DocumentResponse> {
        const doc = await this.getDocumentById(userId, documentId);

        const head = await this.storageService.headObject(doc.storage_key);
        if (!head.exists) {
            throw new BadRequestException('Tệp chưa được lưu lên hệ thống lưu trữ hoặc quá trình lưu bị gián đoạn');
        }

        if (head.contentLength && head.contentLength > MAX_FILE_SIZE_BYTES) {
            throw new BadRequestException('Dung lượng tệp sau khi chỉnh sửa vượt quá giới hạn 50MB cho phép');
        }

        const updatedSize = head.contentLength ? BigInt(head.contentLength) : BigInt(doc.file_size);
        const wasAlreadyExtracted = doc.ocr_status === 'done';
        const nextVersion = (doc.content_version ?? 1) + 1;

        // Phương án 2: Giữ ocr_status='done' nếu tài liệu đã extract trước đó để RAG Search không bị gián đoạn
        const updatedDoc = await this.documentsRepo.updateDocument(documentId, userId, {
            file_size: updatedSize,
            content_version: nextVersion,
            ocr_status: wasAlreadyExtracted ? 'done' : 'pending',
            embed_status: 'pending',
            processing_error: null,
            sync_error: null,
        });

        if (typeof this.documentsQueueService.enqueueContentReindexJob === 'function') {
            await this.documentsQueueService.enqueueContentReindexJob(
                {
                    documentId: updatedDoc.id,
                    mimeType: updatedDoc.mime_type,
                    storageKey: updatedDoc.storage_key,
                    fileName: updatedDoc.file_name,
                    targetVersion: nextVersion,
                    isReindex: wasAlreadyExtracted,
                },
                { delayMs: wasAlreadyExtracted ? 4000 : 0 },
            );
        } else {
            await this.documentsQueueService.addProcessingJob({
                documentId: updatedDoc.id,
                mimeType: updatedDoc.mime_type,
                storageKey: updatedDoc.storage_key,
                fileName: updatedDoc.file_name,
                targetVersion: nextVersion,
                isReindex: wasAlreadyExtracted,
            });
        }

        return updatedDoc;
    }

    async getDocumentContent(userId: string, documentId: string) {
        const doc = await this.getDocumentById(userId, documentId);

        if (!isEditableTextDocument(doc.mime_type, doc.file_name)) {
            throw new BadRequestException(
                'Định dạng tài liệu này không hỗ trợ đọc/sửa dưới dạng văn bản thuần hoặc Markdown'
            );
        }

        const buffer = await this.storageService.getObjectBuffer(doc.storage_key);
        const actualByteSize = buffer.length;
        const isTooLarge = actualByteSize > MAX_EDITABLE_TEXT_BYTES;

        return {
            id: doc.id,
            fileName: doc.file_name,
            mimeType: doc.mime_type,
            fileSize: actualByteSize,
            content: isTooLarge
                ? sliceUtf8Preview(buffer, MAX_READONLY_PREVIEW_BYTES)
                : buffer.toString('utf-8'),
            version: doc.content_version ?? 1,
            indexedVersion: doc.indexed_version ?? 0,
            ocrStatus: doc.ocr_status,
            embedStatus: doc.embed_status,
            syncError: doc.sync_error ?? null,
            readOnly: isTooLarge,
            readOnlyReason: isTooLarge
                ? 'Tệp vượt quá giới hạn chỉnh sửa trực tiếp (2 MB) nên đang mở ở chế độ chỉ đọc (hiển thị trước 200 KB đầu).'
                : null,
            isTruncated: isTooLarge,
            updatedAt: doc.updated_at,
        };
    }

    async updateDocumentContent(
        userId: string,
        documentId: string,
        dto: UpdateDocumentContentDto,
    ) {
        const doc = await this.getDocumentById(userId, documentId);

        if (!isEditableTextDocument(doc.mime_type, doc.file_name)) {
            throw new BadRequestException(
                'Định dạng tài liệu này không hỗ trợ chỉnh sửa văn bản trực tiếp'
            );
        }

        const buffer = Buffer.from(dto.content, 'utf-8');
        if (buffer.length > MAX_EDITABLE_TEXT_BYTES) {
            throw new BadRequestException(
                'Dung lượng nội dung sau chỉnh sửa vượt quá giới hạn 2 MB cho phép chỉnh sửa trên trình duyệt'
            );
        }

        const currentVersion = doc.content_version ?? 1;
        if (dto.expectedVersion !== currentVersion) {
            throw new ConflictException({
                message: 'Tài liệu đã được cập nhật ở phiên bản khác. Vui lòng tải lại trước khi lưu.',
                currentVersion,
            });
        }

        const sha256 = createHash('sha256').update(buffer).digest('hex');
        const currentIndexedVersion = doc.indexed_version ?? 0;

        if (
            doc.file_hash === sha256 &&
            doc.ocr_status === 'done' &&
            doc.embed_status === 'done' &&
            currentIndexedVersion >= currentVersion
        ) {
            return {
                document: doc,
                version: currentVersion,
                indexedVersion: currentIndexedVersion,
                unchanged: true,
                embedStatus: doc.embed_status,
            };
        }

        const canonicalMime =
            resolveCanonicalMimeType(doc.file_name, doc.mime_type) ?? doc.mime_type;

        await this.storageService.uploadObjectBuffer(
            doc.storage_key,
            buffer,
            canonicalMime,
        );

        const { extractedRawText } = prepareTextForHybridChunking(
            dto.content,
            canonicalMime,
            doc.file_name,
        );

        const nextVersion = currentVersion + 1;
        const wasAlreadyExtracted = doc.ocr_status === 'done';

        const updatedDoc = await this.documentsRepo.updateDocumentWithOptimisticLock(
            documentId,
            userId,
            currentVersion,
            {
                file_size: BigInt(buffer.length),
                file_hash: sha256,
                raw_text: extractedRawText,
                content_version: nextVersion,
                ocr_status: wasAlreadyExtracted ? 'done' : 'pending',
                embed_status: 'pending',
                processing_error: null,
                sync_error: null,
            },
        );

        if (!updatedDoc) {
            const latestDoc = await this.documentsRepo.getDocumentById(documentId, userId);
            throw new ConflictException({
                message: 'Tài liệu đã có bản lưu mới hơn trong lúc ghi dữ liệu. Vui lòng tải lại.',
                currentVersion: latestDoc?.content_version ?? currentVersion + 1,
            });
        }

        await this.documentsQueueService.enqueueContentReindexJob(
            {
                documentId: updatedDoc.id,
                mimeType: updatedDoc.mime_type,
                storageKey: updatedDoc.storage_key,
                fileName: updatedDoc.file_name,
                targetVersion: nextVersion,
                isReindex: wasAlreadyExtracted,
            },
            { delayMs: 4000 },
        );

        return {
            document: updatedDoc,
            version: nextVersion,
            indexedVersion: updatedDoc.indexed_version ?? 0,
            unchanged: false,
            embedStatus: updatedDoc.embed_status,
        };
    }

    async deleteDocument(
        userId: string,
        documentId: string
    ): Promise<{ success: boolean; message: string }> {
        const doc = await this.getDocumentById(userId, documentId);
        const assets = await this.documentAssetsRepo.findAssetsByDocumentId(documentId);

        const keysToDelete = new Set<string>([doc.storage_key]);
        if (doc.docling_json_key) {
            keysToDelete.add(doc.docling_json_key);
        }
        for (const asset of assets) {
            if (asset.storage_key) {
                keysToDelete.add(asset.storage_key);
            }
        }

        // Xóa file gốc, file .docling.json và các ảnh crop trên R2
        for (const key of keysToDelete) {
            await this.storageService.deleteObject(key).catch((e) =>
                this.logger.warn(`Không thể xóa object trên R2 [${key}]: ${e.message}`)
            );
        }

        // Xóa bản ghi trong DB (Prisma cascade xóa chunks & assets liên quan)
        await this.documentsRepo.deleteDocument(documentId, userId);

        return {
            success: true,
            message: 'Đã xóa tài liệu thành công',
        };
    }
}
