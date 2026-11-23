import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client.js';
import { SummariesRepoService } from '../repo/summaries-repo/summaries-repo.service.js';
import { ConversationsRepoService } from '../repo/conversations-repo/conversations-repo.service.js';
import { DocumentsRepoService } from '../repo/documents-repo/documents-repo.service.js';
import { SummaryService } from '../ai/summary.service.js';
import { StorageService } from '../storage/storage.service.js';
import { PdfExportService } from './pdf-export.service.js';
import { CreateSummaryDto, SummaryScope } from './dto/create-summary.dto.js';
import { CreateManualNoteDto } from './dto/create-manual-note.dto.js';
import { UpdateSummaryDto } from './dto/update-summary.dto.js';
import { RefineSummaryDto } from './dto/refine-summary.dto.js';
import {
    CompleteNoteMediaUploadDto,
    InitNoteMediaUploadDto,
    ResolveNoteMediaUrlsDto,
} from './dto/note-media.dto.js';
import {
    buildNoteMediaPrefix,
    collectNoteMediaKeysFromBlocks,
    extractStorageKeyFromMediaUri,
    inferNoteMediaKind,
    isOwnedNoteMediaKey,
    NOTE_MEDIA_KIND_LABEL,
    NOTE_MEDIA_MAX_SIZE_BY_KIND,
    normalizeNoteMediaMime,
    toNoteMediaUri,
    validateNoteMediaFile,
} from './note-media.constants.js';

@Injectable()
export class SummariesService {
    private readonly logger = new Logger(SummariesService.name);

    constructor(
        private readonly summariesRepo: SummariesRepoService,
        private readonly conversationsRepo: ConversationsRepoService,
        private readonly documentsRepo: DocumentsRepoService,
        private readonly summaryService: SummaryService,
        private readonly storageService: StorageService,
        private readonly pdfExportService: PdfExportService,
    ) { }

    private sanitizeFileName(fileName: string): string {
        return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    }

    private extractCleanFileNameFromStorageKey(storageKey: string): string {
        const baseSegment = storageKey.split('/').pop() || 'attachment';
        const uuidPrefixPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-/;
        return baseSegment.replace(uuidPrefixPattern, '') || baseSegment;
    }

    private async resolveBlocksMediaForPdf(
        blocks: unknown[],
        userId: string,
    ): Promise<unknown[]> {
        const ownedKeys = collectNoteMediaKeysFromBlocks(blocks).filter((key) =>
            isOwnedNoteMediaKey(key, userId),
        );
        if (ownedKeys.length === 0) {
            return blocks;
        }

        const resolvedMap = new Map<string, string>();
        await Promise.all(
            ownedKeys.map(async (key) => {
                try {
                    const signedUrl = await this.storageService.getSignedUrlForDownload(
                        key,
                        undefined,
                        300,
                    );
                    resolvedMap.set(toNoteMediaUri(key), signedUrl);
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    this.logger.warn(`Không thể ký URL media [${key}] khi xuất PDF: ${msg}`);
                }
            }),
        );

        const replaceBlockMediaUris = (items: unknown[]): unknown[] =>
            items.map((item) => {
                if (!item || typeof item !== 'object') return item;
                const record = item as Record<string, unknown>;
                let nextProps = record.props;

                if (nextProps && typeof nextProps === 'object') {
                    const propsObj = nextProps as Record<string, unknown>;
                    if (typeof propsObj.url === 'string') {
                        const resolved = resolvedMap.get(propsObj.url.trim());
                        if (resolved) {
                            nextProps = { ...propsObj, url: resolved };
                        }
                    }
                }

                const nextChildren = Array.isArray(record.children)
                    ? replaceBlockMediaUris(record.children)
                    : record.children;

                return {
                    ...record,
                    ...(nextProps !== record.props ? { props: nextProps } : {}),
                    ...(nextChildren !== record.children ? { children: nextChildren } : {}),
                };
            });

        return replaceBlockMediaUris(blocks);
    }

    private async verifyConversation(conversationId: string, userId: string) {
        const conversation = await this.conversationsRepo.getConversationById(conversationId, userId);
        if (!conversation) {
            throw new NotFoundException('Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền truy cập');
        }
        return conversation;
    }

    private async verifySummary(summaryId: string, userId: string) {
        const summary = await this.summariesRepo.getSummaryById(summaryId);
        if (!summary) {
            throw new NotFoundException('Không tìm thấy bản tóm tắt');
        }
        await this.verifyConversation(summary.conversation_id, userId);
        return summary;
    }

    /**
     * Tạo tóm tắt mới bằng AI
     */
    async createSummary(
        userId: string,
        conversationId: string,
        dto: CreateSummaryDto,
    ) {
        await this.verifyConversation(conversationId, userId);

        let documentTexts: Array<{ fileName?: string; text: string }> = [];
        let sectionInfo = '';
        let targetDocumentId: string | null = null;

        if (dto.scope === SummaryScope.CONVERSATION) {
            // Lấy toàn bộ tài liệu đã xử lý thành công trong cuộc trò chuyện
            const docs = await this.documentsRepo.getAllDocumentsByConversationId(conversationId, userId);
            const readyDocs = docs.filter((d) => d.ocr_status === 'done' && d.raw_text && d.raw_text.trim());

            if (readyDocs.length === 0) {
                throw new BadRequestException(
                    'Chưa có tài liệu nào trong cuộc trò chuyện được xử lý OCR hoàn tất. Vui lòng chờ tài liệu xử lý xong trước khi tóm tắt.',
                );
            }

            documentTexts = readyDocs.map((d) => ({
                fileName: d.file_name,
                text: d.raw_text!,
            }));
        } else if (dto.scope === SummaryScope.DOCUMENT) {
            const requestedIds = Array.isArray(dto.documentIds) && dto.documentIds.length > 0
                ? dto.documentIds
                : dto.documentId
                    ? [dto.documentId]
                    : [];

            if (requestedIds.length === 0) {
                throw new BadRequestException('Vui lòng chọn tài liệu cần tóm tắt');
            }

            if (requestedIds.length === 1) {
                const doc = await this.documentsRepo.getDocumentById(requestedIds[0], userId);
                if (!doc) {
                    throw new NotFoundException('Không tìm thấy tài liệu được chỉ định');
                }

                if (doc.ocr_status !== 'done' || !doc.raw_text || !doc.raw_text.trim()) {
                    throw new BadRequestException(
                        'Tài liệu này chưa được trích xuất văn bản hoàn tất (đang xử lý hoặc thất bại). Vui lòng thử lại sau.',
                    );
                }

                targetDocumentId = doc.id;
                documentTexts = [{ fileName: doc.file_name, text: doc.raw_text }];
            } else {
                // Trường hợp người dùng yêu cầu gộp nhiều tài liệu cụ thể (A, B, ...) vào chung 1 bản tóm tắt
                const fetchedDocs = await Promise.all(
                    requestedIds.map((id) => this.documentsRepo.getDocumentById(id, userId)),
                );
                const validDocs = fetchedDocs.filter(
                    (d): d is NonNullable<typeof d> =>
                        Boolean(d && d.ocr_status === 'done' && d.raw_text && d.raw_text.trim()),
                );

                if (validDocs.length === 0) {
                    throw new BadRequestException(
                        'Không tìm thấy tài liệu hợp lệ hoặc các tài liệu được chọn chưa hoàn tất trích xuất văn bản OCR.',
                    );
                }

                targetDocumentId = validDocs.length === 1 ? validDocs[0].id : null;
                documentTexts = validDocs.map((d) => ({
                    fileName: d.file_name,
                    text: d.raw_text!,
                }));
            }
        } else if (dto.scope === SummaryScope.SECTION) {
            const sectionDocId = dto.documentId || (Array.isArray(dto.documentIds) ? dto.documentIds[0] : undefined);
            // Vùng chọn cụ thể (trang hoặc văn bản tự nhập)
            if (dto.sectionRange?.customText?.trim()) {
                documentTexts = [{
                    fileName: 'Đoạn trích người dùng chỉ định',
                    text: dto.sectionRange.customText.trim(),
                }];
                sectionInfo = 'Văn bản được người dùng trích xuất trực tiếp';
            } else if (sectionDocId) {
                const doc = await this.documentsRepo.getDocumentById(sectionDocId, userId);
                if (!doc || doc.ocr_status !== 'done' || !doc.raw_text) {
                    throw new BadRequestException('Không tìm thấy tài liệu hợp lệ để trích xuất vùng chọn');
                }
                targetDocumentId = doc.id;

                if (dto.sectionRange?.fromPage || dto.sectionRange?.toPage) {
                    const from = dto.sectionRange.fromPage || 1;
                    const to = dto.sectionRange.toPage ? `đến trang ${dto.sectionRange.toPage}` : 'trở đi';
                    sectionInfo = `Tập trung phân tích từ trang ${from} ${to} của tài liệu "${doc.file_name}"`;
                }

                documentTexts = [{ fileName: doc.file_name, text: doc.raw_text }];
            } else {
                throw new BadRequestException('Vui lòng cung cấp tài liệu hoặc đoạn văn bản cần tóm tắt vùng chọn');
            }
        }

        // Gọi AI sinh BlockNote JSON blocks
        const aiResult = await this.summaryService.generateSummary({
            documentTexts,
            mode: dto.mode,
            length: dto.length,
            scope: dto.scope,
            sectionInfo,
            customInstruction: dto.customInstruction,
            ...(dto.modelName ? { modelName: dto.modelName } : {}),
        });

        // Lưu bản ghi vào PostgreSQL
        const summary = await this.summariesRepo.createSummary({
            conversation_id: conversationId,
            document_id: targetDocumentId,
            title: aiResult.title,
            content_json: aiResult.blocks as any,
        });

        return summary;
    }

    /**
     * Tạo trang ghi chú thủ công mới cho cuộc trò chuyện (không cần tài liệu / AI)
     */
    async createManualNote(
        userId: string,
        conversationId: string,
        dto: CreateManualNoteDto,
    ) {
        await this.verifyConversation(conversationId, userId);

        const title = (dto.title ?? '').trim();
        const contentJson = Array.isArray(dto.content_json) ? dto.content_json : [];

        return this.summariesRepo.createSummary({
            conversation_id: conversationId,
            document_id: null,
            title,
            content_json: contentJson as Prisma.InputJsonValue,
        });
    }

    /**
     * Lấy danh sách tóm tắt của một cuộc trò chuyện
     */
    async getSummariesByConversation(userId: string, conversationId: string) {
        await this.verifyConversation(conversationId, userId);
        return await this.summariesRepo.getSummariesByConversationId(conversationId);
    }

    /**
     * Lấy chi tiết một bản tóm tắt
     */
    async getSummaryById(userId: string, summaryId: string) {
        return await this.verifySummary(summaryId, userId);
    }

    /**
     * Lưu chỉnh sửa tóm tắt / ghi chú (Auto-save)
     */
    async updateSummary(userId: string, summaryId: string, dto: UpdateSummaryDto) {
        await this.verifySummary(summaryId, userId);

        const updateData: Prisma.SummaryUpdateInput = {};
        if (dto.title !== undefined) {
            updateData.title = dto.title.trim();
            updateData.pdf_storage_key = null;
        }
        if (dto.content_json !== undefined) {
            updateData.content_json = dto.content_json as Prisma.InputJsonValue;
            // Xóa pdf_storage_key cũ vì nội dung đã thay đổi
            updateData.pdf_storage_key = null;
        }

        return await this.summariesRepo.updateSummary(summaryId, updateData);
    }

    /**
     * Tinh chỉnh tóm tắt theo chỉ dẫn người dùng (Yêu cầu AI chỉnh lại)
     */
    async refineSummary(userId: string, summaryId: string, dto: RefineSummaryDto) {
        const summary = await this.verifySummary(summaryId, userId);

        const currentBlocks = summary.content_json as any[];
        if (!currentBlocks || !Array.isArray(currentBlocks)) {
            throw new BadRequestException('Nội dung tóm tắt hiện tại không hợp lệ để tinh chỉnh');
        }

        const aiResult = await this.summaryService.refineSummary(currentBlocks, dto.instruction);

        const updated = await this.summariesRepo.updateSummary(summaryId, {
            title: aiResult.title || summary.title,
            content_json: aiResult.blocks as any,
            pdf_storage_key: null, // Đánh dấu PDF cũ đã lỗi thời
        });

        return updated;
    }

    /**
     * Xuất tóm tắt ra file PDF và trả về link tải
     */
    async exportPdf(userId: string, summaryId: string): Promise<{ downloadUrl: string }> {
        const summary = await this.verifySummary(summaryId, userId);
        const trimmedTitle = summary.title.trim();
        const displayTitle = trimmedTitle || 'Ghi chú chưa có tiêu đề';
        const safeBaseName =
            this.sanitizeFileName(trimmedTitle || 'Ghi-chu-hoc-tap') || 'Ghi-chu-hoc-tap';
        const downloadFileName = `${safeBaseName}.pdf`;

        // Nếu đã có PDF được sinh trước đó và file tồn tại trên R2
        if (summary.pdf_storage_key) {
            const head = await this.storageService.headObject(summary.pdf_storage_key);
            if (head.exists) {
                const downloadUrl = await this.storageService.getSignedUrlForDownload(
                    summary.pdf_storage_key,
                    downloadFileName,
                );
                return { downloadUrl };
            }
        }

        // Sinh mới file PDF
        const rawBlocks = Array.isArray(summary.content_json) ? summary.content_json : [];
        const resolvedBlocks = await this.resolveBlocksMediaForPdf(rawBlocks, userId);
        const html = this.pdfExportService.convertBlockNoteToHtml(displayTitle, resolvedBlocks);
        const pdfBuffer = await this.pdfExportService.renderHtmlToPdf(html);

        const safeTitle = safeBaseName.slice(0, 50);
        const storageKey = `users/${userId}/conversations/${summary.conversation_id}/summaries/${summary.id}-${safeTitle}.pdf`;

        await this.storageService.uploadObjectBuffer(storageKey, pdfBuffer, 'application/pdf');

        await this.summariesRepo.updateSummary(summary.id, {
            pdf_storage_key: storageKey,
        });

        const downloadUrl = await this.storageService.getSignedUrlForDownload(
            storageKey,
            downloadFileName,
        );

        return { downloadUrl };
    }

    /**
     * Khởi tạo Presigned PUT URL để upload media đính kèm vào trang ghi chú trên Cloudflare R2
     */
    async initNoteMediaUpload(
        userId: string,
        summaryId: string,
        dto: InitNoteMediaUploadDto,
    ): Promise<{
        uploadUrl: string;
        storageKey: string;
        mediaUri: string;
        mimeType: string;
        mediaKind: string;
    }> {
        const summary = await this.verifySummary(summaryId, userId);

        const validation = validateNoteMediaFile({
            fileName: dto.fileName,
            fileSize: dto.fileSize,
            mimeType: dto.mimeType,
            requestedKind: dto.mediaKind,
        });

        if (!validation.ok) {
            throw new BadRequestException(validation.message);
        }

        const safeName = this.sanitizeFileName(dto.fileName).slice(0, 120) || 'file';
        const prefix = buildNoteMediaPrefix(userId, summary.conversation_id, summary.id);
        const storageKey = `${prefix}${randomUUID()}-${safeName}`;

        const uploadUrl = await this.storageService.getSignedUrlForUpload(
            storageKey,
            validation.mimeType,
            900,
        );

        return {
            uploadUrl,
            storageKey,
            mediaUri: toNoteMediaUri(storageKey),
            mimeType: validation.mimeType,
            mediaKind: validation.mediaKind,
        };
    }

    /**
     * Xác nhận tệp media đã upload lên Cloudflare R2 thành công và trả về URL hiển thị ngay
     */
    async completeNoteMediaUpload(
        userId: string,
        summaryId: string,
        dto: CompleteNoteMediaUploadDto,
    ): Promise<{
        mediaUri: string;
        resolvedUrl: string;
        fileSize: number;
        mimeType: string;
    }> {
        const summary = await this.verifySummary(summaryId, userId);
        const storageKey = dto.storageKey.trim();
        const expectedPrefix = buildNoteMediaPrefix(userId, summary.conversation_id, summary.id);

        if (
            !storageKey.startsWith(expectedPrefix) ||
            storageKey.includes('..') ||
            storageKey.includes('\\')
        ) {
            throw new ForbiddenException('Không có quyền xác nhận tệp đính kèm này');
        }

        const head = await this.storageService.headObject(storageKey);
        if (!head.exists) {
            throw new BadRequestException(
                'Tệp chưa được tải lên hệ thống lưu trữ hoặc quá trình tải lên bị gián đoạn',
            );
        }

        const normalizedMime = normalizeNoteMediaMime(head.contentType ?? '', dto.fileName);
        const effectiveKind = dto.mediaKind ?? inferNoteMediaKind(normalizedMime);
        const maxAllowedBytes = NOTE_MEDIA_MAX_SIZE_BY_KIND[effectiveKind];

        if (head.contentLength && head.contentLength > maxAllowedBytes) {
            await this.storageService.deleteObject(storageKey).catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.warn(`Không thể xóa tệp vượt dung lượng [${storageKey}]: ${msg}`);
            });
            const maxMb = Math.round(maxAllowedBytes / (1024 * 1024));
            throw new BadRequestException(
                `${NOTE_MEDIA_KIND_LABEL[effectiveKind]} vượt quá giới hạn dung lượng thực tế (${maxMb} MB)`,
            );
        }

        const resolvedUrl = await this.storageService.getSignedUrlForDownload(
            storageKey,
            undefined,
            3600,
        );

        return {
            mediaUri: toNoteMediaUri(storageKey),
            resolvedUrl,
            fileSize: head.contentLength ?? 0,
            mimeType: head.contentType ?? normalizedMime ?? 'application/octet-stream',
        };
    }

    /**
     * Cấp Presigned GET URL hàng loạt cho các URI r2:// nằm trong ghi chú khi mở lại
     */
    async resolveNoteMediaUrls(
        userId: string,
        summaryId: string,
        dto: ResolveNoteMediaUrlsDto,
    ): Promise<{ urls: Record<string, string>; expiresIn: number }> {
        await this.verifySummary(summaryId, userId);

        const uniqueUris = Array.from(
            new Set(
                dto.mediaUris
                    .map((uri) => (typeof uri === 'string' ? uri.trim() : ''))
                    .filter(Boolean),
            ),
        );

        const expiresIn = 3600;
        const urls: Record<string, string> = {};

        await Promise.all(
            uniqueUris.map(async (uri) => {
                const storageKey = extractStorageKeyFromMediaUri(uri);
                if (!storageKey || !isOwnedNoteMediaKey(storageKey, userId)) {
                    return;
                }

                try {
                    const fileName = dto.download
                        ? this.extractCleanFileNameFromStorageKey(storageKey)
                        : undefined;
                    urls[uri] = await this.storageService.getSignedUrlForDownload(
                        storageKey,
                        fileName,
                        expiresIn,
                    );
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    this.logger.warn(`Không thể tạo signed URL cho [${storageKey}]: ${msg}`);
                }
            }),
        );

        return { urls, expiresIn };
    }

    /**
     * Xóa bản tóm tắt / ghi chú và dọn sạch các tệp đính kèm thuộc phạm vi ghi chú trên R2
     */
    async deleteSummary(userId: string, summaryId: string) {
        const summary = await this.verifySummary(summaryId, userId);

        const noteMediaPrefix = buildNoteMediaPrefix(
            userId,
            summary.conversation_id,
            summary.id,
        );
        const mediaKeys = collectNoteMediaKeysFromBlocks(
            summary.content_json,
            noteMediaPrefix,
        );

        const keysToDelete = new Set<string>(mediaKeys);
        if (summary.pdf_storage_key) {
            keysToDelete.add(summary.pdf_storage_key);
        }

        if (keysToDelete.size > 0) {
            await Promise.allSettled(
                Array.from(keysToDelete).map(async (key) => {
                    try {
                        await this.storageService.deleteObject(key);
                    } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : String(err);
                        this.logger.warn(`Không thể xóa đối tượng trên R2 [${key}]: ${msg}`);
                    }
                }),
            );
        }

        await this.summariesRepo.deleteSummary(summaryId);

        return {
            success: true,
            message: 'Đã xóa bản tóm tắt thành công',
        };
    }
}
