import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { SummariesRepoService } from '../repo/summaries-repo/summaries-repo.service.js';
import { ConversationsRepoService } from '../repo/conversations-repo/conversations-repo.service.js';
import { DocumentsRepoService } from '../repo/documents-repo/documents-repo.service.js';
import { AiService } from '../ai/ai.service.js';
import { StorageService } from '../storage/storage.service.js';
import { PdfExportService } from './pdf-export.service.js';
import { CreateSummaryDto, SummaryScope } from './dto/create-summary.dto.js';
import { UpdateSummaryDto } from './dto/update-summary.dto.js';
import { RefineSummaryDto } from './dto/refine-summary.dto.js';

@Injectable()
export class SummariesService {
    private readonly logger = new Logger(SummariesService.name);

    constructor(
        private readonly summariesRepo: SummariesRepoService,
        private readonly conversationsRepo: ConversationsRepoService,
        private readonly documentsRepo: DocumentsRepoService,
        private readonly aiService: AiService,
        private readonly storageService: StorageService,
        private readonly pdfExportService: PdfExportService,
    ) { }

    private sanitizeFileName(fileName: string): string {
        return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
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
     * Tạo tóm tắt mới bằng AI (Model gemini-3.6-flash)
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
            if (!dto.documentId) {
                throw new BadRequestException('Vui lòng chọn tài liệu cần tóm tắt');
            }

            const doc = await this.documentsRepo.getDocumentById(dto.documentId, userId);
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
        } else if (dto.scope === SummaryScope.SECTION) {
            // Vùng chọn cụ thể (trang hoặc văn bản tự nhập)
            if (dto.sectionRange?.customText?.trim()) {
                documentTexts = [{
                    fileName: 'Đoạn trích người dùng chỉ định',
                    text: dto.sectionRange.customText.trim(),
                }];
                sectionInfo = 'Văn bản được người dùng trích xuất trực tiếp';
            } else if (dto.documentId) {
                const doc = await this.documentsRepo.getDocumentById(dto.documentId, userId);
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
        const aiResult = await this.aiService.generateSummary({
            documentTexts,
            mode: dto.mode,
            length: dto.length,
            scope: dto.scope,
            sectionInfo,
            customInstruction: dto.customInstruction,
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
     * Lưu chỉnh sửa tóm tắt (Auto-save)
     */
    async updateSummary(userId: string, summaryId: string, dto: UpdateSummaryDto) {
        await this.verifySummary(summaryId, userId);

        const updateData: any = {};
        if (dto.title !== undefined) {
            updateData.title = dto.title.trim();
        }
        if (dto.content_json !== undefined) {
            updateData.content_json = dto.content_json;
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

        const aiResult = await this.aiService.refineSummary(currentBlocks, dto.instruction);

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

        // Nếu đã có PDF được sinh trước đó và file tồn tại trên R2
        if (summary.pdf_storage_key) {
            const head = await this.storageService.headObject(summary.pdf_storage_key);
            if (head.exists) {
                const downloadUrl = await this.storageService.getSignedUrlForDownload(
                    summary.pdf_storage_key,
                    `${this.sanitizeFileName(summary.title)}.pdf`,
                );
                return { downloadUrl };
            }
        }

        // Sinh mới file PDF
        const blocks = summary.content_json as any[];
        const html = this.pdfExportService.convertBlockNoteToHtml(summary.title, blocks);
        const pdfBuffer = await this.pdfExportService.renderHtmlToPdf(html);

        const safeTitle = this.sanitizeFileName(summary.title).slice(0, 50);
        const storageKey = `users/${userId}/conversations/${summary.conversation_id}/summaries/${summary.id}-${safeTitle}.pdf`;

        await this.storageService.uploadObjectBuffer(storageKey, pdfBuffer, 'application/pdf');

        await this.summariesRepo.updateSummary(summary.id, {
            pdf_storage_key: storageKey,
        });

        const downloadUrl = await this.storageService.getSignedUrlForDownload(
            storageKey,
            `${this.sanitizeFileName(summary.title)}.pdf`,
        );

        return { downloadUrl };
    }

    /**
     * Xóa bản tóm tắt
     */
    async deleteSummary(userId: string, summaryId: string) {
        const summary = await this.verifySummary(summaryId, userId);

        if (summary.pdf_storage_key) {
            await this.storageService.deleteObject(summary.pdf_storage_key).catch((err) => {
                this.logger.warn(`Không thể xóa PDF trên R2 [${summary.pdf_storage_key}]: ${err.message}`);
            });
        }

        await this.summariesRepo.deleteSummary(summaryId);

        return {
            success: true,
            message: 'Đã xóa bản tóm tắt thành công',
        };
    }
}
