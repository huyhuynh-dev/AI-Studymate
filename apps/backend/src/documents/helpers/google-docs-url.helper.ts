export type ParsedGoogleDocsUrlResult =
    | {
          ok: true;
          documentId: string;
          exportUrl: string;
          canonicalUrl: string;
      }
    | {
          ok: false;
          reason: string;
      };

const GOOGLE_DOCS_PATH_REGEX =
    /^\/document(?:\/u\/\d+)?\/d\/(?!e(?:\/|$))([a-zA-Z0-9_-]{15,128})(?:\/|$)/;
const PUBLISHED_WEB_PATH_REGEX = /^\/document(?:\/u\/\d+)?\/d\/e\//;
const FALLBACK_FILENAME_PREFIX = 'google-doc';

/**
 * Xác thực URL Google Docs an toàn (chống SSRF) và tạo URL export DOCX chuẩn OOXML.
 */
export function parseGoogleDocsUrl(rawUrl: string): ParsedGoogleDocsUrlResult {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
        return { ok: false, reason: 'Đường dẫn Google Docs không được để trống.' };
    }

    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        return {
            ok: false,
            reason: 'Đường dẫn Google Docs không hợp lệ. Vui lòng dán URL đầy đủ bắt đầu bằng https://docs.google.com/document/d/...',
        };
    }

    if (parsed.protocol !== 'https:') {
        return {
            ok: false,
            reason: 'Chỉ hỗ trợ liên kết Google Docs dùng giao thức HTTPS.',
        };
    }

    if (parsed.hostname.toLowerCase() !== 'docs.google.com') {
        return {
            ok: false,
            reason: 'Liên kết phải thuộc tên miền docs.google.com.',
        };
    }

    if (PUBLISHED_WEB_PATH_REGEX.test(parsed.pathname)) {
        return {
            ok: false,
            reason: 'Liên kết dạng "Xuất bản lên web" (/d/e/...) không hỗ trợ xuất DOCX. Vui lòng dùng liên kết chia sẻ chuẩn (/document/d/<ID>/edit).',
        };
    }

    const match = GOOGLE_DOCS_PATH_REGEX.exec(parsed.pathname);
    if (!match?.[1]) {
        return {
            ok: false,
            reason: 'Không tìm thấy Document ID hợp lệ trong đường dẫn Google Docs.',
        };
    }

    const documentId = match[1];
    return {
        ok: true,
        documentId,
        exportUrl: `https://docs.google.com/document/d/${documentId}/export?format=docx`,
        canonicalUrl: `https://docs.google.com/document/d/${documentId}/edit`,
    };
}

/**
 * Kiểm tra host redirect nằm trong whitelist an toàn của Google Export/Content CDN.
 * Từ chối accounts.google.com (đòi đăng nhập) và mọi host ngoài Google.
 */
export function isAllowedGoogleRedirectHost(hostname: string): boolean {
    const normalized = hostname.trim().toLowerCase().replace(/\.+$/, '');
    if (!normalized) {
        return false;
    }

    if (normalized === 'accounts.google.com') {
        return false;
    }

    if (normalized === 'docs.google.com' || normalized === 'drive.google.com') {
        return true;
    }

    return (
        normalized.endsWith('.googleusercontent.com') &&
        !normalized.startsWith('.') &&
        /^[a-z0-9.-]+$/.test(normalized)
    );
}

/**
 * Kiểm tra magic bytes ZIP/OOXML (PK 0x03 0x04) để từ chối HTML login/error page.
 */
export function isValidDocxZipBuffer(buffer: Buffer): boolean {
    return (
        buffer.length >= 4 &&
        buffer[0] === 0x50 &&
        buffer[1] === 0x4b &&
        buffer[2] === 0x03 &&
        buffer[3] === 0x04
    );
}

/**
 * Chuẩn hóa tên tệp DOCX an toàn, bỏ ký tự đường dẫn nguy hiểm và đảm bảo hậu tố .docx.
 */
export function sanitizeDocxFileName(
    rawName: string | null | undefined,
    fallbackId: string,
): string {
    const safeFallback = `${FALLBACK_FILENAME_PREFIX}-${fallbackId.slice(0, 8) || 'import'}.docx`;
    if (!rawName) {
        return safeFallback;
    }

    const cleaned = rawName
        .replace(/[\r\n\t]/g, ' ')
        .replace(/[\\/:*?"<>|]/g, '_')
        .trim()
        .replace(/\s+/g, ' ');

    if (!cleaned || cleaned === '.' || cleaned === '..') {
        return safeFallback;
    }

    const withoutTrailingDots = cleaned.replace(/\.+$/, '');
    if (!withoutTrailingDots) {
        return safeFallback;
    }

    const withDocxExtension = withoutTrailingDots.toLowerCase().endsWith('.docx')
        ? withoutTrailingDots
        : `${withoutTrailingDots}.docx`;

    return withDocxExtension.slice(0, 240);
}

/**
 * Trích xuất tên tệp từ Content-Disposition (hỗ trợ RFC 5987 UTF-8 cho tiếng Việt).
 */
export function extractFileNameFromContentDisposition(
    header: string | null | undefined,
    fallbackId: string,
): string {
    if (!header) {
        return sanitizeDocxFileName(null, fallbackId);
    }

    // Ưu tiên RFC 5987: filename*=UTF-8''...
    const rfc5987Match = /filename\*\s*=\s*(?:UTF-8|utf-8)?''([^;]+)/i.exec(header);
    if (rfc5987Match?.[1]) {
        const rawEncoded = rfc5987Match[1].trim().replace(/^["']|["']$/g, '');
        try {
            const decoded = decodeURIComponent(rawEncoded);
            return sanitizeDocxFileName(decoded, fallbackId);
        } catch {
            return sanitizeDocxFileName(rawEncoded, fallbackId);
        }
    }

    // Fallback chuẩn: filename="..." hoặc filename=...
    const quotedMatch = /filename\s*=\s*"([^"]+)"/i.exec(header);
    if (quotedMatch?.[1]) {
        return sanitizeDocxFileName(quotedMatch[1], fallbackId);
    }

    const unquotedMatch = /filename\s*=\s*([^;]+)/i.exec(header);
    if (unquotedMatch?.[1]) {
        return sanitizeDocxFileName(unquotedMatch[1].trim(), fallbackId);
    }

    return sanitizeDocxFileName(null, fallbackId);
}
