import { describe, expect, it } from 'vitest';
import { extractTextAnchorFromChunkMetadata } from '../../common/types/source-ref.types.js';
import type { DoclingChunkResult } from '../services/docling.service.js';
import {
  alignChunksToSourceText,
  formatBackendChunkLocationLabel,
  isPagedDocumentFileName,
} from './text-anchor.helper.js';

function makeChunk(
  partial: Partial<DoclingChunkResult> & { index: number; content: string },
): DoclingChunkResult {
  return {
    pageNumbers: [1],
    rawContent: partial.content,
    tokenCount: 50,
    headings: [],
    bboxes: [],
    chunkType: 'text',
    hasImage: false,
    hasTable: false,
    ...partial,
  };
}

describe('text-anchor.helper', () => {
  it('tính chính xác startLine, endLine, charStart, charEnd, quotePrefix và quoteSuffix cho Markdown', () => {
    const rawMd = [
      '# Chương 1: Giới thiệu',
      '',
      'Đoạn mở đầu về hệ điều hành.',
      '',
      '## 1.1 Deadlock',
      'Deadlock xảy ra khi 4 điều kiện Coffman thỏa mãn đồng thời.',
      'Giải thuật Banker giúp phòng tránh trạng thái không an toàn.',
    ].join('\n');

    const chunk1 = makeChunk({
      index: 0,
      content: 'Đoạn mở đầu về hệ điều hành.',
      headings: ['Chương 1: Giới thiệu'],
    });
    const chunk2 = makeChunk({
      index: 1,
      content:
        '1.1 Deadlock\nDeadlock xảy ra khi 4 điều kiện Coffman thỏa mãn đồng thời.\nGiải thuật Banker giúp phòng tránh trạng thái không an toàn.',
      rawContent:
        'Deadlock xảy ra khi 4 điều kiện Coffman thỏa mãn đồng thời.\nGiải thuật Banker giúp phòng tránh trạng thái không an toàn.',
      headings: ['Chương 1: Giới thiệu', '1.1 Deadlock'],
    });

    const anchored = alignChunksToSourceText(rawMd, [chunk1, chunk2], {
      fileName: 'os-notes.md',
      mimeType: 'text/markdown',
    });

    const a1 = extractTextAnchorFromChunkMetadata(anchored[0].metadata);
    const a2 = extractTextAnchorFromChunkMetadata(anchored[1].metadata);

    expect(a1).toBeDefined();
    expect(a1?.startLine).toBe(3);
    expect(a1?.endLine).toBe(3);
    expect(a1?.quoteExact).toBe('Đoạn mở đầu về hệ điều hành.');

    expect(a2).toBeDefined();
    expect(a2?.startLine).toBe(6);
    expect(a2?.endLine).toBe(7);
    expect(a2?.headingPath).toEqual(['Chương 1: Giới thiệu', '1.1 Deadlock']);
    expect(a2?.quotePrefix).toContain('## 1.1 Deadlock');
  });

  it('phân biệt chính xác 2 đoạn văn / log giống hệt nhau bằng con trỏ tịnh tiến', () => {
    const rawLog = [
      '2026-11-22 [ModuleA] INFO Booting service',
      'ERROR: Connection timed out after 3000ms',
      '2026-11-22 [ModuleA] INFO Retry succeeded',
      '--- separator ---',
      '2026-11-22 [ModuleB] WARN Degraded mode',
      'ERROR: Connection timed out after 3000ms',
      '2026-11-22 [ModuleB] FATAL Shutdown',
    ].join('\n');

    const c0 = makeChunk({
      index: 0,
      content: 'ERROR: Connection timed out after 3000ms',
    });
    const c1 = makeChunk({
      index: 1,
      content: 'ERROR: Connection timed out after 3000ms',
    });

    const anchored = alignChunksToSourceText(rawLog, [c0, c1], {
      fileName: 'server.log',
      mimeType: 'text/plain',
    });

    const first = extractTextAnchorFromChunkMetadata(anchored[0].metadata);
    const second = extractTextAnchorFromChunkMetadata(anchored[1].metadata);

    expect(first?.startLine).toBe(2);
    expect(first?.quotePrefix).toContain('[ModuleA]');
    expect(second?.startLine).toBe(6);
    expect(second?.quotePrefix).toContain('[ModuleB]');
  });

  it('gỡ lớp bọc synthetic code-fence khi căn chỉnh cho JSON và CSV', () => {
    const rawCsv = [
      'id,name,score',
      '1,An,9.5',
      '2,Binh,8.0',
      '3,Chi,9.0',
    ].join('\n');

    const wrappedChunk = makeChunk({
      index: 0,
      content: '# scores.csv\n\n```csv\n2,Binh,8.0\n3,Chi,9.0\n```',
      rawContent: '```csv\n2,Binh,8.0\n3,Chi,9.0\n```',
    });

    const anchored = alignChunksToSourceText(rawCsv, [wrappedChunk], {
      fileName: 'scores.csv',
      mimeType: 'text/csv',
      unwrapStructuredWrapper: true,
    });

    const anchor = extractTextAnchorFromChunkMetadata(anchored[0].metadata);
    expect(anchor?.startLine).toBe(3);
    expect(anchor?.endLine).toBe(4);
    expect(anchor?.quoteExact).toBe('2,Binh,8.0\n3,Chi,9.0');
  });

  it('định dạng nhãn vị trí đa hình cho từng loại tệp', () => {
    expect(isPagedDocumentFileName('notes.md')).toBe(false);
    expect(isPagedDocumentFileName('data.csv')).toBe(false);
    expect(isPagedDocumentFileName('slides.pdf')).toBe(true);

    expect(
      formatBackendChunkLocationLabel({
        fileName: 'slides.pdf',
        pageNumbers: [2, 3],
      }),
    ).toBe('Trang 2–3');

    expect(
      formatBackendChunkLocationLabel({
        fileName: 'notes.md',
        pageNumbers: [1],
        textAnchor: {
          startLine: 12,
          endLine: 18,
          charStart: 100,
          charEnd: 240,
          quoteExact: 'Sample',
        },
      }),
    ).toBe('Dòng 12–18');

    expect(
      formatBackendChunkLocationLabel({
        fileName: 'scores.csv',
        textAnchor: {
          startLine: 5,
          endLine: 5,
          charStart: 40,
          charEnd: 55,
          quoteExact: '4,Dung,10',
        },
      }),
    ).toBe('Hàng 5');

    expect(
      formatBackendChunkLocationLabel({
        fileName: 'legacy.txt',
        pageNumbers: [1],
        headings: ['Phần 2'],
        chunkIndex: 3,
      }),
    ).toBe('Mục: Phần 2');

    expect(
      formatBackendChunkLocationLabel({
        fileName: 'legacy.txt',
        chunkIndex: 3,
      }),
    ).toBe('Đoạn #4');
  });
});
