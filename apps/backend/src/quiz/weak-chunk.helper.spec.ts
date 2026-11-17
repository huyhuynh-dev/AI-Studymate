import { describe, expect, it } from 'vitest';
import { aggregateWeakChunkSignals } from './weak-chunk.helper.js';

describe('weak-chunk.helper', () => {
  it('returns empty summary when there are no failed questions or leech flashcards', () => {
    const res = aggregateWeakChunkSignals([], []);
    expect(res).toEqual({
      hasWeakAreas: false,
      weakChunkIds: [],
      weakChunkCount: 0,
      incorrectQuizCount: 0,
      leechCardCount: 0,
      topWeakTopics: [],
      topMissingPoints: [],
      priorFailedQuestions: [],
    });
  });

  it('aggregates and ranks weak chunks from both quiz errors and leech flashcards', () => {
    const res = aggregateWeakChunkSignals(
      [
        {
          question_id: 'q-1',
          evaluation_status: 'incorrect',
          missing_points: ['Thiếu điều kiện biên', 'Chưa nêu độ phức tạp'],
          question: {
            id: 'q-1',
            question_text: '<p>Giải thích <strong>Binary Search</strong>?</p>',
            source_refs: [
              {
                documentId: 'doc-1',
                fileName: 'DSA.pdf',
                chunkId: 'chk-1',
                chunkIndex: 1,
                headings: ['Tìm kiếm nhị phân'],
              },
            ],
          },
        },
        {
          question_id: 'q-2',
          evaluation_status: 'partial',
          missing_points: ['Thiếu điều kiện biên'],
          question: {
            id: 'q-2',
            question_text: '<p>So sánh QuickSort và MergeSort</p>',
            source_refs: [
              {
                documentId: 'doc-1',
                fileName: 'DSA.pdf',
                chunkId: 'chk-2',
                chunkIndex: 4,
                headings: ['Sắp xếp'],
              },
            ],
          },
        },
      ],
      [
        {
          id: 'card-1',
          front_text: 'Điều kiện áp dụng Binary Search?',
          ease_factor: 1.6,
          state: 'relearning',
          source_refs: [
            {
              documentId: 'doc-1',
              fileName: 'DSA.pdf',
              chunkId: 'chk-1',
              chunkIndex: 1,
              headings: ['Tìm kiếm nhị phân'],
            },
          ],
          reviews: [{ id: 'rev-1' }, { id: 'rev-2' }],
        },
      ],
      1,
    );

    expect(res.hasWeakAreas).toBe(true);
    expect(res.weakChunkIds).toEqual(['chk-1']);
    expect(res.weakChunkCount).toBe(2);
    expect(res.incorrectQuizCount).toBe(2);
    expect(res.leechCardCount).toBe(1);
    expect(res.topWeakTopics[0]).toBe('Tìm kiếm nhị phân');
    expect(res.topMissingPoints[0]).toBe('Thiếu điều kiện biên');
    expect(res.priorFailedQuestions).toContain('Giải thích Binary Search ?');
  });
});
