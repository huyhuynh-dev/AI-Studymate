import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveStructuredTextCitation,
  resolveTextSegmentsCitation,
  stripMarkdownForPlainMatch,
} from '../text-anchor-resolver.ts';

describe('text-anchor-resolver', () => {
  it('resolveStructuredTextCitation định vị chuẩn 4 tầng từ khớp chính xác tới lịch sử đã xóa', () => {
    const baseText = [
      'level=INFO module=auth message="User login start"',
      'level=ERROR module=auth message="Connection timed out"',
      'level=INFO module=billing message="Invoice created"',
      'level=ERROR module=billing message="Connection timed out"',
      'level=INFO module=worker message="Job completed"',
    ].join('\n');

    const exactTarget = {
      documentId: 'doc-1',
      fileName: 'app.log',
      nonce: 1,
      textAnchor: {
        startLine: 4,
        endLine: 4,
        charStart: baseText.indexOf('level=ERROR module=billing'),
        charEnd:
          baseText.indexOf('level=ERROR module=billing') +
          'level=ERROR module=billing message="Connection timed out"'.length,
        quoteExact: 'level=ERROR module=billing message="Connection timed out"',
        quotePrefix: 'Invoice created"\n',
        quoteSuffix: '\nlevel=INFO module=worker',
      },
    };

    const t1 = resolveStructuredTextCitation(baseText, exactTarget);
    assert.equal(t1?.tier, 1);
    assert.equal(t1?.startLine, 4);

    // Chèn thêm 3 dòng mới ở đầu tệp -> vị trí cũ lệch dòng -> kích hoạt Tầng 2 phân biệt nhờ quotePrefix/quoteSuffix
    const shiftedText = ['// Header 1', '// Header 2', '// Header 3', baseText].join('\n');
    const targetSecondRepeat = {
      documentId: 'doc-1',
      fileName: 'app.log',
      nonce: 2,
      textAnchor: {
        startLine: 4,
        endLine: 4,
        charStart: 100,
        charEnd: 138,
        quoteExact: 'message="Connection timed out"',
        quotePrefix: 'module=billing ',
        quoteSuffix: '\nlevel=INFO module=worker',
      },
    };
    const t2 = resolveStructuredTextCitation(shiftedText, targetSecondRepeat);
    assert.equal(t2?.tier, 2);
    assert.equal(t2?.startLine, 7);

    // Sửa đổi một phần câu -> giữ heading hoặc cụm con -> kích hoạt Tầng 3
    const editedPartialText = [
      '# Billing Alerts',
      'level=WARN module=billing message="Connection timed out with retry backoff enabled in EU region"',
    ].join('\n');
    const partialTarget = {
      documentId: 'doc-1',
      fileName: 'alerts.md',
      nonce: 3,
      headings: ['Billing Alerts'],
      textAnchor: {
        startLine: 2,
        endLine: 2,
        charStart: 18,
        charEnd: 110,
        quoteExact:
          'level=ERROR module=billing message="Connection timed out before failover completed"',
      },
    };
    const t3 = resolveStructuredTextCitation(editedPartialText, partialTarget);
    assert.equal(t3?.tier, 3);
    assert.ok(t3?.startLine && t3.startLine >= 1);

    // Xóa hoàn toàn đoạn trích -> kích hoạt Tầng 4
    const deletedText = 'Totally unrelated document text now.';
    const t4 = resolveStructuredTextCitation(deletedText, exactTarget);
    assert.equal(t4?.tier, 4);
    assert.equal(t4?.startLine, null);
  });

  it('resolveTextSegmentsCitation ánh xạ chuẩn quote Markdown qua ProseMirror segments bất chấp inline markup', () => {
    assert.equal(
      stripMarkdownForPlainMatch('**Gradient Descent** tối ưu hóa [hàm mất mát](https://a.test) `L(w)`').trim(),
      'Gradient Descent tối ưu hóa hàm mất mát L(w)',
    );

    const segments = [
      { text: 'Chương 1: Tối ưu hóa', from: 1, to: 21, isBlockStart: true, isHeading: true },
      { text: 'Đoạn giới thiệu ban đầu về mô hình tuyến tính.', from: 23, to: 69, isBlockStart: true },
      { text: 'Thuật toán Gradient Descent', from: 71, to: 98, isBlockStart: true },
      { text: ' cập nhật trọng số ngược hướng gradient của hàm mất mát.', from: 98, to: 155, isBlockStart: false },
    ];

    const resExact = resolveTextSegmentsCitation(segments, 200, {
      documentId: 'doc-md',
      fileName: 'ml.md',
      nonce: 1,
      textAnchor: {
        startLine: 5,
        endLine: 5,
        charStart: 70,
        charEnd: 165,
        quoteExact:
          '**Thuật toán Gradient Descent** cập nhật trọng số ngược hướng gradient của hàm mất mát.',
        quotePrefix: 'mô hình tuyến tính.\n\n',
      },
    });

    assert.ok(resExact && (resExact.tier === 1 || resExact.tier === 2));
    assert.equal(resExact?.from, 71);
    assert.equal(resExact?.to, 154);

    const resDeleted = resolveTextSegmentsCitation(segments, 200, {
      documentId: 'doc-md',
      fileName: 'ml.md',
      nonce: 2,
      rawContent: 'Đoạn văn này đã bị người dùng xóa khỏi tài liệu Markdown.',
    });
    assert.equal(resDeleted?.tier, 4);
    assert.equal(resDeleted?.from, null);
  });
});
