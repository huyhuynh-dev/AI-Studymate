import { describe, expect, it } from 'vitest';
import {
  parseMarkdownToBlockNoteBlocks,
  replaceOrAppendNoteSection,
  serializeBlockNoteToMarkdown,
} from './blocknote-markdown.helper.js';

describe('blocknote-markdown write & section helpers', () => {
  it('chuyển đổi Markdown đa dạng (heading, bold/italic/math, list, code, table) sang BlockNote và round-trip sạch', () => {
    const md = [
      '# Chương 1: Giới thiệu',
      '',
      'Đoạn văn có **in đậm**, *nghiêng*, `code`, và công thức $O(n \\log n)$.',
      '',
      '- Ý chính 1',
      '1. Bước một',
      '- [x] Đã xong',
      '',
      '```ts',
      'const x = 1;',
      '```',
      '',
      '| Thuật toán | Trung bình |',
      '| --- | --- |',
      '| QuickSort | O(n log n) |',
    ].join('\n');

    const blocks = parseMarkdownToBlockNoteBlocks(md);
    expect(blocks.some((b) => b.type === 'heading')).toBe(true);
    expect(blocks.some((b) => b.type === 'bulletListItem')).toBe(true);
    expect(blocks.some((b) => b.type === 'numberedListItem')).toBe(true);
    expect(blocks.some((b) => b.type === 'checkListItem')).toBe(true);
    expect(blocks.some((b) => b.type === 'codeBlock')).toBe(true);
    expect(blocks.some((b) => b.type === 'table')).toBe(true);

    const roundTrip = serializeBlockNoteToMarkdown(blocks);
    expect(roundTrip.outline).toContain('H1: Chương 1: Giới thiệu');
    expect(roundTrip.markdown).toContain('QuickSort');
    expect(roundTrip.markdown).toContain('**in đậm**');
  });

  it('replaceOrAppendNoteSection thay thế cục bộ 1 section mà bảo toàn block media r2:// ở section khác', () => {
    const existing = [
      {
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: 'Chương 1', styles: {} }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Nội dung cũ chương 1', styles: {} }],
      },
      {
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: 'Chương 2', styles: {} }],
      },
      {
        type: 'image',
        props: { url: 'r2://users/u1/image.png', caption: 'Sơ đồ hệ thống' },
      },
    ];

    const res = replaceOrAppendNoteSection(existing, {
      sectionHeading: 'Chương 1',
      markdownContent: 'Nội dung mới đã cập nhật cho chương 1.',
      mode: 'replace_section',
    });

    expect(res.matchedHeading).toBe('Chương 1');
    const serialized = serializeBlockNoteToMarkdown(res.blocks);
    expect(serialized.markdown).toContain('Nội dung mới đã cập nhật');
    expect(serialized.markdown).not.toContain('Nội dung cũ chương 1');
    expect(
      res.blocks.some(
        (b: any) =>
          b?.type === 'image' && b?.props?.url === 'r2://users/u1/image.png',
      ),
    ).toBe(true);
  });
});
