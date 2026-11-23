import { createHash } from 'node:crypto';

export type ChunkTypeValue =
  | 'text'
  | 'table'
  | 'code'
  | 'formula'
  | 'image_desc'
  | 'mixed';

export interface ExistingChunkForDiff {
  id: string;
  chunkIndex: number;
  contentHash: string | null;
  content: string;
  headings: string[];
}

export interface IncomingChunkForDiff {
  chunkIndex: number;
  pageNumbers: number[];
  content: string;
  rawContent?: string;
  tokenCount?: number;
  headings?: string[];
  bboxes?: unknown[];
  chunkType?: ChunkTypeValue;
  hasImage?: boolean;
  hasTable?: boolean;
  metadata?: Record<string, unknown>;
}

export interface KeptChunkPlanItem {
  existingId: string;
  previousChunkIndex: number;
  chunkIndex: number;
  contentHash: string;
  chunk: IncomingChunkForDiff;
}

export interface InsertChunkPlanItem {
  chunkIndex: number;
  contentHash: string;
  chunk: IncomingChunkForDiff;
}

export interface IncrementalChunkPlan {
  keptChunks: KeptChunkPlanItem[];
  toInsert: InsertChunkPlanItem[];
  toDeleteIds: string[];
  stats: {
    totalIncoming: number;
    reusedCount: number;
    insertedCount: number;
    deletedCount: number;
  };
}

function normalizeHeadings(headings?: string[] | null): string[] {
  if (!Array.isArray(headings)) {
    return [];
  }
  return headings
    .map((heading) => (typeof heading === 'string' ? heading.trim() : ''))
    .filter((heading) => heading.length > 0);
}

/**
 * Tạo content-addressed hash chuẩn hóa cho một DocumentChunk dựa trên headings + nội dung văn bản.
 * Bảo đảm không nhạy cảm với khác biệt xuống dòng CRLF/LF hay khoảng trắng đầu/cuối.
 */
export function computeChunkContentHash(input: {
  content: string;
  headings?: string[] | null;
}): string {
  const normalizedContent = (input.content ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  const normalizedHeadings = normalizeHeadings(input.headings);

  return createHash('sha256')
    .update(
      JSON.stringify({
        h: normalizedHeadings,
        c: normalizedContent,
      }),
    )
    .digest('hex');
}

/**
 * Phương án 2: Content-Addressed Incremental Chunk Diffing (FIFO Queue Matching).
 * - Các chunk có cùng `content_hash` sẽ tái sử dụng lại đúng `id` (UUID) và vector 768 chiều cũ,
 *   qua đó bảo toàn tham chiếu `chunkId` trong Flashcard.source_refs, QuizQuestion.source_refs, Message.source_chunks,
 *   TOC Mastery Heatmap & Weak-Chunk Quiz, đồng thời cắt giảm chi phí gọi Embedding API về O(Δ).
 * - Trường hợp nhiều chunk có nội dung giống hệt nhau được ghép theo thứ tự FIFO để giữ thứ tự tự nhiên.
 */
export function computeIncrementalChunkPlan(
  existingChunks: ExistingChunkForDiff[],
  incomingChunks: IncomingChunkForDiff[],
): IncrementalChunkPlan {
  const sortedExisting = [...existingChunks].sort(
    (a, b) => a.chunkIndex - b.chunkIndex,
  );

  const hashQueues = new Map<string, ExistingChunkForDiff[]>();
  for (const existing of sortedExisting) {
    const hash =
      existing.contentHash && existing.contentHash.length === 64
        ? existing.contentHash
        : computeChunkContentHash({
            content: existing.content,
            headings: existing.headings,
          });

    const queue = hashQueues.get(hash);
    if (queue) {
      queue.push(existing);
    } else {
      hashQueues.set(hash, [existing]);
    }
  }

  const keptChunks: KeptChunkPlanItem[] = [];
  const toInsert: InsertChunkPlanItem[] = [];

  for (let targetIndex = 0; targetIndex < incomingChunks.length; targetIndex += 1) {
    const rawChunk = incomingChunks[targetIndex];
    const normalizedChunk: IncomingChunkForDiff = {
      ...rawChunk,
      chunkIndex: targetIndex,
    };
    const contentHash = computeChunkContentHash({
      content: normalizedChunk.content,
      headings: normalizedChunk.headings,
    });

    const queue = hashQueues.get(contentHash);
    const matched = queue && queue.length > 0 ? queue.shift() : undefined;

    if (matched) {
      keptChunks.push({
        existingId: matched.id,
        previousChunkIndex: matched.chunkIndex,
        chunkIndex: targetIndex,
        contentHash,
        chunk: normalizedChunk,
      });
    } else {
      toInsert.push({
        chunkIndex: targetIndex,
        contentHash,
        chunk: normalizedChunk,
      });
    }
  }

  const toDeleteIds: string[] = [];
  for (const queue of hashQueues.values()) {
    for (const remaining of queue) {
      toDeleteIds.push(remaining.id);
    }
  }

  return {
    keptChunks,
    toInsert,
    toDeleteIds,
    stats: {
      totalIncoming: incomingChunks.length,
      reusedCount: keptChunks.length,
      insertedCount: toInsert.length,
      deletedCount: toDeleteIds.length,
    },
  };
}
