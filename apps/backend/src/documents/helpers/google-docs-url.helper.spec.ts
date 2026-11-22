import { describe, expect, it } from 'vitest';
import {
    extractFileNameFromContentDisposition,
    isAllowedGoogleRedirectHost,
    isValidDocxZipBuffer,
    parseGoogleDocsUrl,
    sanitizeDocxFileName,
} from './google-docs-url.helper.js';

describe('google-docs-url.helper', () => {
    describe('parseGoogleDocsUrl', () => {
        it('trích xuất đúng documentId, exportUrl và canonicalUrl từ link /edit hợp lệ', () => {
            const result = parseGoogleDocsUrl(
                'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/edit?usp=sharing',
            );

            expect(result).toEqual({
                ok: true,
                documentId: '1AbCdEfGhIjKlMnOpQrStUvWxYz123456',
                exportUrl:
                    'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/export?format=docx',
                canonicalUrl:
                    'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/edit',
            });
        });

        it('hỗ trợ URL có phân đoạn tài khoản /document/u/0/d/<id>', () => {
            const result = parseGoogleDocsUrl(
                '  https://docs.google.com/document/u/2/d/1ZyXwVuTsRqPoNmLkJhGfEdCbA_98765/view  ',
            );

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.documentId).toBe('1ZyXwVuTsRqPoNmLkJhGfEdCbA_98765');
            }
        });

        it('từ chối URL HTTP, localhost hoặc IP nội bộ để chống SSRF', () => {
            expect(
                parseGoogleDocsUrl('http://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit').ok,
            ).toBe(false);
            expect(
                parseGoogleDocsUrl('https://169.254.169.254/latest/meta-data/').ok,
            ).toBe(false);
            expect(
                parseGoogleDocsUrl('https://localhost:3000/document/d/1AbCdEfGhIjKlMnOp/edit').ok,
            ).toBe(false);
            expect(
                parseGoogleDocsUrl('https://evil-docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit').ok,
            ).toBe(false);
        });

        it('từ chối liên kết Publish-to-Web (/d/e/...) không xuất được DOCX', () => {
            const result = parseGoogleDocsUrl(
                'https://docs.google.com/document/d/e/2PACX-1vSomeLongPublishedToken/pub',
            );
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.reason).toContain('/d/e/');
            }
        });
    });

    describe('isAllowedGoogleRedirectHost', () => {
        it('chỉ cho phép docs/drive.google.com và *.googleusercontent.com, chặn accounts.google.com và host lạ', () => {
            expect(isAllowedGoogleRedirectHost('docs.google.com')).toBe(true);
            expect(isAllowedGoogleRedirectHost('drive.google.com')).toBe(true);
            expect(
                isAllowedGoogleRedirectHost('doc-0k-12-docs.googleusercontent.com'),
            ).toBe(true);
            expect(isAllowedGoogleRedirectHost('accounts.google.com')).toBe(false);
            expect(isAllowedGoogleRedirectHost('evilgoogleusercontent.com')).toBe(false);
            expect(isAllowedGoogleRedirectHost('127.0.0.1')).toBe(false);
        });
    });

    describe('isValidDocxZipBuffer', () => {
        it('nhận diện đúng ZIP magic bytes PK 03 04 và từ chối HTML fallback', () => {
            expect(isValidDocxZipBuffer(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14]))).toBe(true);
            expect(isValidDocxZipBuffer(Buffer.from('<html>Sign in</html>'))).toBe(false);
            expect(isValidDocxZipBuffer(Buffer.from([0x50, 0x4b]))).toBe(false);
        });
    });

    describe('extractFileNameFromContentDisposition & sanitizeDocxFileName', () => {
        it('giải mã tên tiếng Việt theo RFC 5987 và giữ đuôi .docx', () => {
            const header =
                "attachment; filename=\"fallback.docx\"; filename*=UTF-8''%C4%90%E1%BB%81%20c%C6%B0%C6%A1ng%20%C3%B4n%20t%E1%BA%ADp.docx";
            expect(extractFileNameFromContentDisposition(header, '1234567890abcdef')).toBe(
                'Đề cương ôn tập.docx',
            );
        });

        it('tự thêm .docx nếu tiêu đề người dùng không có phần mở rộng và thay ký tự nguy hiểm', () => {
            expect(sanitizeDocxFileName('Ghi chú / Chương 1: Ôn thi', 'docid1234')).toBe(
                'Ghi chú _ Chương 1_ Ôn thi.docx',
            );
        });
    });
});
