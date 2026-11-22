import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { MAX_FILE_SIZE_BYTES } from '../dto/init-upload.dto.js';
import {
    extractFileNameFromContentDisposition,
    isAllowedGoogleRedirectHost,
    isValidDocxZipBuffer,
    parseGoogleDocsUrl,
    sanitizeDocxFileName,
} from '../helpers/google-docs-url.helper.js';

export interface ImportedGoogleDocBinary {
    buffer: Buffer;
    fileName: string;
    canonicalUrl: string;
    googleDocId: string;
}

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_REDIRECT_HOPS = 3;
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const PRIVATE_DOC_MESSAGE =
    'Không thể truy cập tài liệu Google Docs. Vui lòng bật quyền chia sẻ "Bất kỳ ai có đường liên kết" (Người xem) rồi thử lại.';

@Injectable()
export class GoogleDocsImportService {
    private readonly logger = new Logger(GoogleDocsImportService.name);

    async downloadPublicDocAsDocx(
        rawUrl: string,
        customFileName?: string,
    ): Promise<ImportedGoogleDocBinary> {
        const parsed = parseGoogleDocsUrl(rawUrl);
        if (!parsed.ok) {
            throw new BadRequestException(parsed.reason);
        }

        const response = await this.fetchWithSafeRedirects(parsed.exportUrl);

        if (response.status === 401 || response.status === 403) {
            throw new BadRequestException(PRIVATE_DOC_MESSAGE);
        }
        if (response.status === 404) {
            throw new BadRequestException(
                'Không tìm thấy tài liệu Google Docs. Vui lòng kiểm tra lại đường dẫn.',
            );
        }
        if (!response.ok) {
            throw new BadRequestException(
                `Google Docs trả về mã lỗi ${response.status} khi xuất tài liệu.`,
            );
        }

        const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
        if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
            throw new BadRequestException(PRIVATE_DOC_MESSAGE);
        }

        const buffer = await this.readBoundedResponseBuffer(response);
        if (!isValidDocxZipBuffer(buffer)) {
            throw new BadRequestException(
                'Tệp tải về từ Google Docs không phải định dạng DOCX hợp lệ. Vui lòng kiểm tra quyền chia sẻ công khai.',
            );
        }

        const fileName = customFileName?.trim()
            ? sanitizeDocxFileName(customFileName, parsed.documentId)
            : extractFileNameFromContentDisposition(
                  response.headers.get('content-disposition'),
                  parsed.documentId,
              );

        return {
            buffer,
            fileName,
            canonicalUrl: parsed.canonicalUrl,
            googleDocId: parsed.documentId,
        };
    }

    private async fetchWithSafeRedirects(initialUrl: string): Promise<Response> {
        let currentUrl = initialUrl;

        for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
            let response: Response;
            try {
                response = await fetch(currentUrl, {
                    method: 'GET',
                    redirect: 'manual',
                    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                    headers: {
                        'User-Agent': 'StudyMate-DocImporter/1.0',
                    },
                });
            } catch (error) {
                const errName = error instanceof Error ? error.name : '';
                if (errName === 'TimeoutError' || errName === 'AbortError') {
                    throw new BadRequestException(
                        'Quá thời gian kết nối tới Google Docs (20 giây). Vui lòng thử lại sau.',
                    );
                }
                this.logger.warn(
                    `Lỗi kết nối Google Docs (${currentUrl}): ${error instanceof Error ? error.message : String(error)}`,
                );
                throw new BadRequestException(
                    'Không thể kết nối tới Google Docs. Vui lòng kiểm tra mạng và thử lại.',
                );
            }

            if (!REDIRECT_STATUS_CODES.has(response.status)) {
                return response;
            }

            // Giải phóng stream cũ trước khi đi tiếp hop mới
            await response.body?.cancel().catch(() => undefined);

            const location = response.headers.get('location');
            if (!location) {
                throw new BadRequestException(
                    'Google Docs chuyển hướng không hợp lệ khi xuất tài liệu.',
                );
            }

            let nextUrl: URL;
            try {
                nextUrl = new URL(location, currentUrl);
            } catch {
                throw new BadRequestException(
                    'Địa chỉ chuyển hướng từ Google Docs không hợp lệ.',
                );
            }

            if (nextUrl.hostname.toLowerCase() === 'accounts.google.com') {
                throw new BadRequestException(PRIVATE_DOC_MESSAGE);
            }

            if (
                nextUrl.protocol !== 'https:' ||
                !isAllowedGoogleRedirectHost(nextUrl.hostname)
            ) {
                throw new BadRequestException(
                    'Chuyển hướng từ Google Docs trỏ tới tên miền không được phép.',
                );
            }

            currentUrl = nextUrl.toString();
        }

        throw new BadRequestException(
            'Liên kết Google Docs chuyển hướng quá nhiều lần.',
        );
    }

    private async readBoundedResponseBuffer(response: Response): Promise<Buffer> {
        const contentLengthHeader = response.headers.get('content-length');
        if (contentLengthHeader) {
            const declaredBytes = Number(contentLengthHeader);
            if (Number.isFinite(declaredBytes) && declaredBytes > MAX_FILE_SIZE_BYTES) {
                await response.body?.cancel().catch(() => undefined);
                throw new BadRequestException(
                    'Dung lượng tài liệu Google Docs vượt quá giới hạn 50MB cho phép.',
                );
            }
        }

        if (!response.body || typeof response.body.getReader !== 'function') {
            const arrayBuf = await response.arrayBuffer();
            if (arrayBuf.byteLength > MAX_FILE_SIZE_BYTES) {
                throw new BadRequestException(
                    'Dung lượng tài liệu Google Docs vượt quá giới hạn 50MB cho phép.',
                );
            }
            return Buffer.from(arrayBuf);
        }

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                if (!value || value.byteLength === 0) {
                    continue;
                }
                totalBytes += value.byteLength;
                if (totalBytes > MAX_FILE_SIZE_BYTES) {
                    await reader.cancel().catch(() => undefined);
                    throw new BadRequestException(
                        'Dung lượng tài liệu Google Docs vượt quá giới hạn 50MB cho phép.',
                    );
                }
                chunks.push(value);
            }
        } finally {
            reader.releaseLock();
        }

        return Buffer.concat(chunks, totalBytes);
    }
}
