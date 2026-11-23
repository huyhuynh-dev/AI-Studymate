import { BadRequestException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_FILE_SIZE_BYTES } from '../dto/init-upload.dto.js';
import { GoogleDocsImportService } from './google-docs-import.service.js';

const VALID_DOCX_BUFFER = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
const SAMPLE_GDOC_URL =
    'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/edit?usp=sharing';

describe('GoogleDocsImportService', () => {
    const service = new GoogleDocsImportService();

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('tải thành công DOCX qua redirect hợp lệ *.googleusercontent.com và trích tên RFC 5987', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(null, {
                    status: 302,
                    headers: {
                        location:
                            'https://doc-04-ab-docs.googleusercontent.com/docs/securesc/token/download',
                    },
                }),
            )
            .mockResolvedValueOnce(
                new Response(VALID_DOCX_BUFFER, {
                    status: 200,
                    headers: {
                        'content-type':
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'content-disposition':
                            "attachment; filename*=UTF-8''T%C3%A0i%20li%E1%BB%87u%20m%E1%BA%ABu.docx",
                    },
                }),
            );
        vi.stubGlobal('fetch', fetchMock);

        const result = await service.downloadPublicDocAsDocx(SAMPLE_GDOC_URL);

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.googleDocId).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz123456');
        expect(result.canonicalUrl).toBe(
            'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/edit',
        );
        expect(result.fileName).toBe('Tài liệu mẫu.docx');
        expect(Buffer.compare(result.buffer, VALID_DOCX_BUFFER)).toBe(0);
    });

    it('ném BadRequestException với hướng dẫn chia sẻ khi bị redirect sang accounts.google.com', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(
            new Response(null, {
                status: 302,
                headers: {
                    location: 'https://accounts.google.com/ServiceLogin?continue=...',
                },
            }),
        );
        vi.stubGlobal('fetch', fetchMock);

        await expect(service.downloadPublicDocAsDocx(SAMPLE_GDOC_URL)).rejects.toThrow(
            BadRequestException,
        );
    });

    it('chặn redirect tới tên miền lạ ngoài Google để chống SSRF', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(
            new Response(null, {
                status: 302,
                headers: {
                    location: 'https://internal.corp.local/secret.docx',
                },
            }),
        );
        vi.stubGlobal('fetch', fetchMock);

        await expect(service.downloadPublicDocAsDocx(SAMPLE_GDOC_URL)).rejects.toThrow(
            'tên miền không được phép',
        );
    });

    it('từ chối phản hồi text/html hoặc nội dung không có ZIP magic bytes PK', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(
            new Response('<html><body>Please sign in</body></html>', {
                status: 200,
                headers: {
                    'content-type': 'text/html; charset=utf-8',
                },
            }),
        );
        vi.stubGlobal('fetch', fetchMock);

        await expect(service.downloadPublicDocAsDocx(SAMPLE_GDOC_URL)).rejects.toThrow(
            BadRequestException,
        );
    });

    it('từ chối khi kích thước Content-Length vượt quá 50MB', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(
            new Response(VALID_DOCX_BUFFER, {
                status: 200,
                headers: {
                    'content-type':
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'content-length': String(MAX_FILE_SIZE_BYTES + 1024),
                },
            }),
        );
        vi.stubGlobal('fetch', fetchMock);

        await expect(service.downloadPublicDocAsDocx(SAMPLE_GDOC_URL)).rejects.toThrow(
            '50MB',
        );
    });
});
