import { describe, it, expect } from 'vitest';
import {
  computeChunkContentHash,
  computeIncrementalChunkPlan,
  type ExistingChunkForDiff,
  type IncomingChunkForDiff,
} from './chunk-diff.helper.js';

describe('chunk-diff.helper (Phương án 2)', () => {
  const makeIncoming = (
    index: number,
    content: string,
    headings: string[] = ['Chương 1'],
  ): IncomingChunkForDiff => ({
    chunkIndex: index,
    pageNumbers: [1],
    content,
    rawContent: content,
    tokenCount: Math.max(1, content.split(/\s+/).length),
    headings,
  });

  const makeExisting = (
    id: string,
    index: number,
    content: string,
    headings: string[] = ['Chương 1'],
    withHash = true,
  ): ExistingChunkForDiff => ({
    id,
    chunkIndex: index,
    contentHash: withHash
      ? computeChunkContentHash({ content, headings })
      : null,
    content,
    headings,
  });

  it('tái sử dụng 100% chunk UUID cũ và không gọi chèn/xóa khi nội dung không đổi', () => {
    const existing = [
      makeExisting('uuid-1', 0, 'Đoạn văn thứ nhất'),
      makeExisting('uuid-2', 1, 'Đoạn văn thứ hai'),
    ];
    const incoming = [
      makeIncoming(0, '  Đoạn văn thứ nhất\r\n'),
      makeIncoming(1, 'Đoạn văn thứ hai'),
    ];

    const plan = computeIncrementalChunkPlan(existing, incoming);

    expect(plan.stats).toEqual({
      totalIncoming: 2,
      reusedCount: 2,
      insertedCount: 0,
      deletedCount: 0,
    });
    expect(plan.keptChunks.map((k) => k.existingId)).toEqual([
      'uuid-1',
      'uuid-2',
    ]);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toDeleteIds).toEqual([]);
  });

  it('chỉ chèn mới và xóa chunk ở giữa khi người dùng sửa một đoạn duy nhất', () => {
    const existing = [
      makeExisting('uuid-a', 0, 'Phần mở đầu'),
      makeExisting('uuid-b', 1, 'Nội dung cũ ở giữa'),
      makeExisting('uuid-c', 2, 'Phần kết luận'),
    ];
    const incoming = [
      makeIncoming(0, 'Phần mở đầu'),
      makeIncoming(1, 'Nội dung mới đã chỉnh sửa'),
      makeIncoming(2, 'Phần kết luận'),
    ];

    const plan = computeIncrementalChunkPlan(existing, incoming);

    expect(plan.stats).toEqual({
      totalIncoming: 3,
      reusedCount: 2,
      insertedCount: 1,
      deletedCount: 1,
    });
    expect(plan.keptChunks.map((k) => k.existingId)).toEqual([
      'uuid-a',
      'uuid-c',
    ]);
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.toInsert[0]).toMatchObject({
      chunkIndex: 1,
      chunk: expect.objectContaining({ content: 'Nội dung mới đã chỉnh sửa' }),
    });
    expect(plan.toDeleteIds).toEqual(['uuid-b']);
  });

  it('bảo toàn UUID và cập nhật chunkIndex mới khi chèn thêm đoạn vào đầu tài liệu', () => {
    const existing = [
      makeExisting('uuid-0', 0, 'Đoạn A'),
      makeExisting('uuid-1', 1, 'Đoạn B'),
    ];
    const incoming = [
      makeIncoming(0, 'Đoạn mới chèn đầu'),
      makeIncoming(1, 'Đoạn A'),
      makeIncoming(2, 'Đoạn B'),
    ];

    const plan = computeIncrementalChunkPlan(existing, incoming);

    expect(plan.stats).toEqual({
      totalIncoming: 3,
      reusedCount: 2,
      insertedCount: 1,
      deletedCount: 0,
    });
    expect(plan.keptChunks).toEqual([
      expect.objectContaining({
        existingId: 'uuid-0',
        previousChunkIndex: 0,
        chunkIndex: 1,
      }),
      expect.objectContaining({
        existingId: 'uuid-1',
        previousChunkIndex: 1,
        chunkIndex: 2,
      }),
    ]);
    expect(plan.toInsert.map((i) => i.chunkIndex)).toEqual([0]);
  });

  it('khớp các chunk có nội dung trùng lặp theo đúng thứ tự FIFO', () => {
    const existing = [
      makeExisting('dup-first', 0, 'Dòng lặp giống nhau'),
      makeExisting('mid', 1, 'Đoạn riêng'),
      makeExisting('dup-second', 2, 'Dòng lặp giống nhau'),
    ];
    const incoming = [
      makeIncoming(0, 'Dòng lặp giống nhau'),
      makeIncoming(1, 'Dòng lặp giống nhau'),
    ];

    const plan = computeIncrementalChunkPlan(existing, incoming);

    expect(plan.keptChunks.map((k) => k.existingId)).toEqual([
      'dup-first',
      'dup-second',
    ]);
    expect(plan.toDeleteIds).toEqual(['mid']);
  });

  it('tính toán content_hash dự phòng cho các chunk cũ trước migration (contentHash = null)', () => {
    const existing = [makeExisting('legacy-uuid', 0, 'Nội dung PDF cũ', ['Mục 1'], false)];
    const incoming = [makeIncoming(0, 'Nội dung PDF cũ', ['Mục 1'])];

    const plan = computeIncrementalChunkPlan(existing, incoming);

    expect(plan.keptChunks.map((k) => k.existingId)).toEqual(['legacy-uuid']);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toDeleteIds).toEqual([]);
  });

  it('đưa toàn bộ chunk cũ vào danh sách xóa khi tài liệu bị xóa trắng nội dung', () => {
    const existing = [
      makeExisting('u-1', 0, 'Chunk 1'),
      makeExisting('u-2', 1, 'Chunk 2'),
    ];

    const plan = computeIncrementalChunkPlan(existing, []);

    expect(plan.keptChunks).toEqual([]);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toDeleteIds).toEqual(['u-1', 'u-2']);
  });
});
