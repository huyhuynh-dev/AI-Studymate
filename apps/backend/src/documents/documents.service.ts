import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StorageService } from '../storage/storage.service.js';
import { DocumentsRepoService, DocumentResponse } from '../repo/documents-repo/documents-repo.service.js';
import { ConversationsRepoService } from '../repo/conversations-repo/conversations-repo.service.js';
import { DocumentsQueueService } from './documents-queue.service.js';
import { InitUploadDto, MAX_FILE_SIZE_BYTES } from './dto/init-upload.dto.js';
import { CompleteUploadDto } from './dto/complete-upload.dto.js';

@Injectable()
export class DocumentsService {
    private readonly logger = new Logger(DocumentsService.name);

    constructor(
        private readonly storageService: StorageService,
        private readonly documentsRepo: DocumentsRepoService,
        private readonly conversationsRepo: ConversationsRepoService,
        private readonly documentsQueueService: DocumentsQueueService,
    ) { }

    private sanitizeFileName(fileName: string): string {
        return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    }

    async initUpload(
        userId: string,
        dto: InitUploadDto
    ): Promise<{ documentId: string; storageKey: string; uploadUrl: string }> {
        // Kiểm tra quyền sở hữu conversation
        const conversation = await this.conversationsRepo.getConversationById(dto.conversationId, userId);
        if (!conversation) {
            throw new NotFoundException('Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền truy cập');
        }

        const documentId = randomUUID();
        const safeName = this.sanitizeFileName(dto.fileName);
        const storageKey = `users/${userId}/conversations/${dto.conversationId}/${documentId}-${safeName}`;

        const uploadUrl = await this.storageService.getSignedUrlForUpload(storageKey, dto.mimeType);

        return {
            documentId,
            storageKey,
            uploadUrl,
        };
    }

    async completeUpload(
        userId: string,
        documentId: string,
        dto: CompleteUploadDto
    ): Promise<DocumentResponse> {
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
            mime_type: dto.mimeType,
            file_size: finalSize,
            storage_key: dto.storageKey,
            ocr_status: 'pending',
            embed_status: 'pending',
            uploaded_at: new Date(),
        });

        // Đẩy job xử lý văn bản vào BullMQ queue
        await this.documentsQueueService.addProcessingJob({
            documentId: document.id,
            mimeType: document.mime_type,
            storageKey: document.storage_key,
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

        return await this.documentsRepo.updateDocument(documentId, userId, {
            file_size: updatedSize,
        });
    }

    async deleteDocument(
        userId: string,
        documentId: string
    ): Promise<{ success: boolean; message: string }> {
        const doc = await this.getDocumentById(userId, documentId);

        // Xóa file trên R2
        await this.storageService.deleteObject(doc.storage_key).catch((e) =>
            this.logger.warn(`Không thể xóa object trên R2 [${doc.storage_key}]: ${e.message}`)
        );

        // Xóa bản ghi trong DB (Prisma cascade xóa chunks liên quan)
        await this.documentsRepo.deleteDocument(documentId, userId);

        return {
            success: true,
            message: 'Đã xóa tài liệu thành công',
        };
    }
}
