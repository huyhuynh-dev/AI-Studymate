import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCitationActionLabel,
  formatCitationLocationLabel,
  formatCitationTooltipLabel,
  isCsvDocumentFile,
  isPagedDocumentFile,
} from '../citation-label.helper.ts';

describe('citation-label.helper', () => {
  it('phân biệt chính xác tệp phân trang và tệp văn bản liên tục', () => {
    assert.equal(isPagedDocumentFile('slides.pdf', 'application/pdf'), true);
    assert.equal(isPagedDocumentFile('notes.md', 'text/markdown'), false);
    assert.equal(isPagedDocumentFile('metrics.csv', 'text/csv'), false);
    assert.equal(isCsvDocumentFile('metrics.csv'), true);
    assert.equal(isCsvDocumentFile('config.json'), false);
  });

  it('hiển thị đúng quy ước nhãn cho PDF, Markdown, Plain Text và CSV', () => {
    assert.equal(
      formatCitationLocationLabel({
        fileName: 'book.pdf',
        pageNumbers: [3, 4],
      }),
      'Trang 3–4',
    );

    const mdAnchor = {
      startLine: 42,
      endLine: 58,
      charStart: 500,
      charEnd: 780,
      quoteExact: 'Sample markdown text',
      headingPath: ['Chương 2', 'Gradient Descent'],
    };

    assert.equal(
      formatCitationLocationLabel({
        fileName: 'lecture.md',
        pageNumbers: [1],
        textAnchor: mdAnchor,
        headings: ['Chương 2', 'Gradient Descent'],
        variant: 'compact',
      }),
      'Dòng 42–58',
    );

    assert.equal(
      formatCitationLocationLabel({
        fileName: 'lecture.md',
        pageNumbers: [1],
        textAnchor: mdAnchor,
        headings: ['Chương 2', 'Gradient Descent'],
        variant: 'detailed',
      }),
      'Dòng 42–58 · Gradient Descent',
    );

    assert.equal(
      formatCitationLocationLabel({
        fileName: 'metrics.csv',
        textAnchor: {
          startLine: 15,
          endLine: 22,
          charStart: 120,
          charEnd: 260,
          quoteExact: '14,A,10',
        },
        variant: 'detailed',
      }),
      'Hàng 15–22',
    );

    assert.equal(
      formatCitationLocationLabel({
        fileName: 'app.log',
        textAnchor: {
          startLine: 9,
          endLine: 9,
          charStart: 80,
          charEnd: 115,
          quoteExact: 'INFO Ready',
        },
      }),
      'Dòng 9',
    );
  });

  it('không bao giờ hiện "Trang 1" cho tài liệu văn bản cũ chưa có textAnchor', () => {
    assert.equal(
      formatCitationLocationLabel({
        fileName: 'old-notes.md',
        pageNumbers: [1],
        headings: ['Introduction'],
        chunkIndex: 2,
        variant: 'detailed',
      }),
      '§ Introduction',
    );

    assert.equal(
      formatCitationLocationLabel({
        fileName: 'old-notes.md',
        pageNumbers: [1],
        headings: ['Introduction'],
        chunkIndex: 2,
        variant: 'compact',
      }),
      'Đoạn #3',
    );

    assert.equal(
      formatCitationActionLabel({
        fileName: 'old-notes.md',
        pageNumbers: [1],
      }),
      'Định vị đoạn trích',
    );

    assert.equal(
      formatCitationActionLabel({
        fileName: 'metrics.csv',
        textAnchor: {
          startLine: 4,
          endLine: 8,
          charStart: 20,
          charEnd: 90,
          quoteExact: 'row data',
        },
      }),
      'Nhảy tới Hàng 4–8',
    );

    assert.equal(
      formatCitationTooltipLabel({
        fileName: 'guide.md',
        textAnchor: {
          startLine: 10,
          endLine: 12,
          charStart: 100,
          charEnd: 140,
          quoteExact: 'text',
        },
        headings: ['Setup'],
      }),
      'Xem nguồn trong tài liệu (Dòng 10–12 · Setup)',
    );
  });
});
