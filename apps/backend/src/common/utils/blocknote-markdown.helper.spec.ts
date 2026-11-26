import { describe, it, expect } from 'vitest';
import {
  MAX_NOTE_CONTENT_CHARS,
  extractNoteSectionOrSlice,
  serializeBlockNoteToMarkdown,
} from './blocknote-markdown.helper.js';
import { htmlToCleanText } from './text.utils.js';

describe('blocknote-markdown.helper & htmlToCleanText', () => {
  describe('serializeBlockNoteToMarkdown', () => {
    it('chuyển đổi đầy đủ các loại block BlockNote và che URL media an toàn', () => {
      const blocks = [
        {
          type: 'heading',
          props: { level: 1 },
          content: [{ type: 'text', text: 'Chương 1: Cây nhị phân', styles: null }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Định nghĩa ', styles: null },
            { type: 'text', text: 'quan trọng', styles: { bold: true } },
            { type: 'text', text: ' với công thức ', styles: null },
            { type: 'math', content: 'O(\\log n)' },
            { type: 'text', text: ' xem thêm ', styles: null },
            {
              type: 'link',
              href: 'https://example.com/avl',
              content: [{ type: 'text', text: 'tại đây', styles: null }],
            },
          ],
        },
        {
          type: 'bulletListItem',
          content: [{ type: 'text', text: 'Mục cha', styles: null }],
          children: [
            {
              type: 'checkListItem',
              props: { checked: true },
              content: [{ type: 'text', text: 'Mục con đã xong', styles: null }],
            },
          ],
        },
        {
          type: 'numberedListItem',
          props: { start: 2 },
          content: [{ type: 'text', text: 'Bước tiếp theo', styles: null }],
        },
        {
          type: 'toggleListItem',
          content: [{ type: 'text', text: 'Ví dụ mở rộng', styles: null }],
        },
        {
          type: 'quote',
          content: [{ type: 'text', text: 'Ghi nhớ cốt lõi', styles: null }],
        },
        {
          type: 'codeBlock',
          props: { language: 'ts' },
          content: 'const balance = leftHeight - rightHeight;',
        },
        {
          type: 'table',
          content: {
            type: 'tableContent',
            rows: [
              { cells: ['Thuật toán', 'Độ phức tạp'] },
              {
                cells: [
                  [{ type: 'text', text: 'AVL', styles: { bold: true } }],
                  'O(log n)',
                ],
              },
            ],
          },
        },
        {
          type: 'mathBlock',
          content: 'h(T) <= 1.44 \\log_2(n + 2)',
        },
        {
          type: 'diagram',
          content: 'graph TD\nA --> B',
        },
        { type: 'divider' },
        {
          type: 'image',
          props: {
            url: 'https://private-r2.internal/secret-key.png?X-Amz-Signature=secret',
            caption: 'Sơ đồ xoay cây',
            name: 'avl.png',
          },
        },
        {
          type: 'file',
          props: {
            url: 'studymate-media://user-1/note-1/secret.pdf',
            name: 'tai-lieu-dinh-kem.pdf',
          },
        },
        {
          type: 'heading',
          props: { level: 2 },
          content: [{ type: 'text', text: 'Ví dụ minh họa', styles: null }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Chèn nút 10 vào cây.', styles: null }],
        },
      ];

      const parsed = serializeBlockNoteToMarkdown(blocks);

      expect(parsed.outline).toEqual([
        'H1: Chương 1: Cây nhị phân',
        'H2: Ví dụ minh họa',
      ]);
      expect(parsed.sections).toHaveLength(2);
      expect(parsed.markdown).toContain('# Chương 1: Cây nhị phân');
      expect(parsed.markdown).toContain(
        '**quan trọng** với công thức $O(\\log n)$ xem thêm [tại đây](https://example.com/avl)',
      );
      expect(parsed.markdown).toContain('- Mục cha');
      expect(parsed.markdown).toContain('  - [x] Mục con đã xong');
      expect(parsed.markdown).toContain('2. Bước tiếp theo');
      expect(parsed.markdown).toContain('> Ghi nhớ cốt lõi');
      expect(parsed.markdown).toContain('```ts\nconst balance = leftHeight - rightHeight;\n```');
      expect(parsed.markdown).toContain('| Thuật toán | Độ phức tạp |');
      expect(parsed.markdown).toContain('| **AVL** | O(log n) |');
      expect(parsed.markdown).toContain('$$\nh(T) <= 1.44 \\log_2(n + 2)\n$$');
      expect(parsed.markdown).toContain('```mermaid\ngraph TD\nA --> B\n```');
      expect(parsed.markdown).toContain('---');
      expect(parsed.markdown).toContain('[Image: Sơ đồ xoay cây]');
      expect(parsed.markdown).toContain('[File: tai-lieu-dinh-kem.pdf]');
      expect(parsed.markdown).not.toContain('X-Amz-Signature');
      expect(parsed.markdown).not.toContain('studymate-media://');
    });

    it('xử lý an toàn JSON rỗng hoặc sai định dạng', () => {
      expect(serializeBlockNoteToMarkdown(null)).toEqual({
        markdown: '',
        outline: [],
        sections: [],
      });
      expect(serializeBlockNoteToMarkdown({ invalid: true })).toEqual({
        markdown: '',
        outline: [],
        sections: [],
      });
    });
  });

  describe('extractNoteSectionOrSlice', () => {
    it('lọc đúng section theo sectionKeyword và hỗ trợ phân trang khi vượt ngưỡng ký tự', () => {
      const blocks = [
        {
          type: 'heading',
          props: { level: 1 },
          content: 'Phần 1: Lý thuyết',
        },
        {
          type: 'paragraph',
          content: 'Nội dung lý thuyết ngắn gọn.',
        },
        {
          type: 'heading',
          props: { level: 2 },
          content: 'Ví dụ thực tế',
        },
        {
          type: 'paragraph',
          content: 'Dòng ví dụ số 1\n'.repeat(800),
        },
      ];

      const parsed = serializeBlockNoteToMarkdown(blocks);

      const sectionResult = extractNoteSectionOrSlice(parsed, {
        sectionKeyword: 'Ví dụ',
        maxChars: 500,
      });

      expect(sectionResult.matchedSection).toBe('Ví dụ thực tế');
      expect(sectionResult.contentMarkdown).toContain('## Ví dụ thực tế');
      expect(sectionResult.contentMarkdown).not.toContain('Phần 1: Lý thuyết');
      expect(sectionResult.truncated).toBe(true);
      expect(sectionResult.nextCharOffset).toBeGreaterThan(0);
      expect(sectionResult.contentMarkdown.length).toBeLessThanOrEqual(500);

      const defaultSlice = extractNoteSectionOrSlice(parsed);
      expect(defaultSlice.contentMarkdown.length).toBeLessThanOrEqual(
        MAX_NOTE_CONTENT_CHARS,
      );
    });
  });

  describe('htmlToCleanText', () => {
    it('giữ cấu trúc dòng cho list/paragraph, giữ nguyên cloze {{...}} và cắt gọn theo maxChars', () => {
      const html =
        '<p>Câu hỏi <strong>chính</strong>:</p><ul><li>Ý 1 &amp; 2</li><li>Cloze: {{c1::Binary Search}}</li></ul>';
      const cleaned = htmlToCleanText(html);

      expect(cleaned).toContain('Câu hỏi chính:');
      expect(cleaned).toContain('- Ý 1 & 2');
      expect(cleaned).toContain('- Cloze: {{c1::Binary Search}}');

      const truncated = htmlToCleanText(html, 20);
      expect(truncated.length).toBeLessThanOrEqual(20);
      expect(truncated.endsWith('…')).toBe(true);
    });
  });
});
