import { describe, it, expect } from 'vitest';
import {
  isDirectTextIngestionDocument,
  isEditableTextDocument,
  prepareTextForHybridChunking,
  resolveCanonicalMimeType,
  sliceUtf8Preview,
} from './editable-document.constants.js';

describe('editable-document.constants', () => {
  describe('resolveCanonicalMimeType', () => {
    it('chuẩn hóa chính xác khi trình duyệt gửi MIME generic (application/octet-stream hoặc rỗng)', () => {
      expect(resolveCanonicalMimeType('README.md', 'application/octet-stream')).toBe(
        'text/markdown',
      );
      expect(resolveCanonicalMimeType('config.yml', '')).toBe('application/yaml');
      expect(resolveCanonicalMimeType('settings.toml', 'text/plain')).toBe(
        'application/toml',
      );
      expect(resolveCanonicalMimeType('server.log', 'text/plain')).toBe('text/plain');
      expect(resolveCanonicalMimeType('notes.json', 'text/plain')).toBe(
        'application/json',
      );
      expect(resolveCanonicalMimeType('index.html', 'text/html; charset=utf-8')).toBe(
        'text/html',
      );
    });

    it('từ chối các tệp thực thi hoặc phần mở rộng không được hỗ trợ', () => {
      expect(resolveCanonicalMimeType('malware.exe', 'application/octet-stream')).toBeNull();
      expect(resolveCanonicalMimeType('script.sh', 'text/plain')).toBeNull();
    });
  });

  describe('isEditableTextDocument & isDirectTextIngestionDocument', () => {
    it('nhận diện đúng các tệp văn bản/đánh dấu và loại trừ PDF/ảnh', () => {
      expect(isEditableTextDocument('text/markdown', 'guide.md')).toBe(true);
      expect(isEditableTextDocument('text/plain', 'notes.txt')).toBe(true);
      expect(isEditableTextDocument('application/json', 'data.json')).toBe(true);
      expect(isEditableTextDocument('text/csv', 'scores.csv')).toBe(true);
      expect(isDirectTextIngestionDocument('text/html', 'page.htm')).toBe(true);

      expect(isEditableTextDocument('application/pdf', 'lecture.pdf')).toBe(false);
      expect(isEditableTextDocument('image/png', 'diagram.png')).toBe(false);
    });
  });

  describe('prepareTextForHybridChunking', () => {
    it('loại bỏ script/style và giữ heading/list khi tiền xử lý HTML cho Docling', () => {
      const html =
        '<html><head><style>body{color:red}</style><script>alert(1)</script></head><body><h1>Chương 1</h1><p>Nội dung &amp; ví dụ</p><ul><li>Mục A</li></ul></body></html>';

      const prepared = prepareTextForHybridChunking(html, 'text/html', 'lesson.html');

      expect(prepared.isHtml).toBe(true);
      expect(prepared.chunkInputMarkdown).not.toContain('alert(1)');
      expect(prepared.chunkInputMarkdown).not.toContain('color:red');
      expect(prepared.chunkInputMarkdown).toContain('# Chương 1');
      expect(prepared.chunkInputMarkdown).toContain('Nội dung & ví dụ');
      expect(prepared.chunkInputMarkdown).toContain('- Mục A');
    });

    it('tự động format JSON minified thành block dễ băm cho Docling', () => {
      const prepared = prepareTextForHybridChunking(
        '{"course":"AI","topics":["RAG","NLP"]}',
        'application/json',
        'syllabus.json',
      );

      expect(prepared.chunkInputMarkdown).toContain('# syllabus.json');
      expect(prepared.chunkInputMarkdown).toContain('```json');
      expect(prepared.chunkInputMarkdown).toContain('"course": "AI"');
    });
  });

  describe('sliceUtf8Preview', () => {
    it('cắt an toàn chuỗi tiếng Việt UTF-8 mà không tạo ký tự lỗi ở cuối', () => {
      const text = 'Xin chào Việt Nam — Trình soạn thảo StudyMate!';
      const buf = Buffer.from(text, 'utf-8');
      const sliced = sliceUtf8Preview(buf, 11);

      expect(sliced.includes('\uFFFD')).toBe(false);
      expect(sliced.length).toBeGreaterThan(0);
    });
  });
});
