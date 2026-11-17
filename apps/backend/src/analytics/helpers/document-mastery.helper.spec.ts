import { describe, expect, it } from 'vitest';
import {
  CardStateEnum,
  EvaluationStatusEnum,
} from '../../generated/prisma/client.js';
import type {
  AnalyticsChunkIndexRow,
  AnalyticsFlashcardRow,
  AnalyticsQuizAnswerRow,
} from '../../repo/analytics-repo/analytics-repo.service.js';
import {
  computeDocumentMastery,
  extractTocItems,
} from './document-mastery.helper.js';

describe('document-mastery.helper', () => {
  const docId = 'doc-os-1';
  const convId = 'conv-os-1';

  const chunks: AnalyticsChunkIndexRow[] = [
    {
      id: 'chk-1',
      documentId: docId,
      chunkIndex: 0,
      headings: ['Chương 1: Tổng quan OS'],
      pageNumbers: [1, 2],
    },
    {
      id: 'chk-2',
      documentId: docId,
      chunkIndex: 1,
      headings: ['Chương 2: Lập lịch CPU'],
      pageNumbers: [12],
    },
    {
      id: 'chk-3',
      documentId: docId,
      chunkIndex: 2,
      headings: ['Chương 3: Deadlock', '3.1 Điều kiện cần'],
      pageNumbers: [26],
    },
    {
      id: 'chk-4',
      documentId: docId,
      chunkIndex: 3,
      headings: ['Chương 4: Bộ nhớ ảo'],
      pageNumbers: [42],
    },
  ];

  const docMetadata = {
    toc: [
      { text: 'Chương 1: Tổng quan OS', level: 1, page_no: 1 },
      { text: 'Chương 2: Lập lịch CPU', level: 1, page_no: 10 },
      { text: 'Chương 3: Deadlock', level: 1, page_no: 25 },
      { text: '3.1 Điều kiện cần', level: 2, page_no: 26 },
      { text: 'Chương 4: Bộ nhớ ảo', level: 1, page_no: 40 },
    ],
  };

  it('extractTocItems computes accurate page ranges and falls back to chunk headings if toc is empty', () => {
    const seeds = extractTocItems(docMetadata, 55, chunks);
    expect(seeds).toHaveLength(5);
    expect(seeds[0]).toMatchObject({ startPage: 1, endPage: 9 });
    expect(seeds[2]).toMatchObject({ startPage: 25, endPage: 39 });
    expect(seeds[3]).toMatchObject({ startPage: 26, endPage: 39 });
    expect(seeds[4]).toMatchObject({ startPage: 40, endPage: 55 });

    const fallback = extractTocItems(null, 55, chunks);
    expect(fallback.map((f) => f.text)).toEqual([
      'Chương 1: Tổng quan OS',
      'Chương 2: Lập lịch CPU',
      'Chương 3: Deadlock',
      'Chương 4: Bộ nhớ ảo',
    ]);
  });

  it('computes mastered, weak, and unstudied sections cleanly without marking unreviewed sections 0%', () => {
    const quizAnswers: AnalyticsQuizAnswerRow[] = [
      // Chương 1: Đúng 100%
      {
        questionId: 'q-1',
        evaluationStatus: EvaluationStatusEnum.correct,
        pointsEarned: 1,
        missingPoints: [],
        answeredAt: new Date(),
        question: {
          id: 'q-1',
          questionText: '<p>Kernel là gì?</p>',
          points: 1,
          bloomLevel: 'remember',
          sourceRefs: [
            { documentId: docId, fileName: 'OS.pdf', chunkId: 'chk-1', pageNumbers: [1] },
          ],
        },
      },
      // Chương 3 (3.1 Điều kiện cần): Sai & thiếu ý
      {
        questionId: 'q-2',
        evaluationStatus: EvaluationStatusEnum.incorrect,
        pointsEarned: 0,
        missingPoints: ['Thiếu điều kiện Circular Wait'],
        answeredAt: new Date(),
        question: {
          id: 'q-2',
          questionText: '<p>Nêu 4 điều kiện Coffman</p>',
          points: 2,
          bloomLevel: 'understand',
          sourceRefs: [
            { documentId: docId, fileName: 'OS.pdf', chunkId: 'chk-3', pageNumbers: [26] },
          ],
        },
      },
    ];

    const flashcards: AnalyticsFlashcardRow[] = [
      // Chương 1: Đã thuộc (review, interval=30, ease=2.6)
      {
        id: 'f-1',
        deckId: 'd-1',
        deckName: 'OS Deck',
        conversationId: convId,
        frontText: 'Kernel',
        state: CardStateEnum.review,
        interval: 30,
        easeFactor: 2.6,
        dueDate: new Date(),
        lastReviewedAt: new Date(),
        sourceRefs: [
          { documentId: docId, fileName: 'OS.pdf', chunkId: 'chk-1', pageNumbers: [2] },
        ],
        againCount: 0,
      },
      // Chương 3: Thẻ khó (relearning, againCount=3)
      {
        id: 'f-2',
        deckId: 'd-1',
        deckName: 'OS Deck',
        conversationId: convId,
        frontText: 'Circular Wait',
        state: CardStateEnum.relearning,
        interval: 1,
        easeFactor: 1.5,
        dueDate: new Date(),
        lastReviewedAt: new Date(),
        sourceRefs: [
          { documentId: docId, fileName: 'OS.pdf', chunkId: 'chk-3', pageNumbers: [26] },
        ],
        againCount: 3,
      },
      // Chương 4: Thẻ mới (state = 'new', chưa từng ôn -> chương vẫn là unstudied!)
      {
        id: 'f-3',
        deckId: 'd-1',
        deckName: 'OS Deck',
        conversationId: convId,
        frontText: 'Page Fault',
        state: CardStateEnum.new,
        interval: 0,
        easeFactor: 2.5,
        dueDate: new Date(),
        lastReviewedAt: null,
        sourceRefs: [
          { documentId: docId, fileName: 'OS.pdf', chunkId: 'chk-4', pageNumbers: [42] },
        ],
        againCount: 0,
      },
    ];

    const mastery = computeDocumentMastery({
      documentId: docId,
      conversationId: convId,
      fileName: 'OS.pdf',
      pageCount: 55,
      docMetadata,
      chunks,
      latestQuizAnswers: quizAnswers,
      flashcards,
    });

    expect(mastery.totalSections).toBe(5);
    expect(mastery.sections[0].status).toBe('mastered');
    expect(mastery.sections[0].masteryScore).toBeGreaterThanOrEqual(80);

    expect(mastery.sections[1].status).toBe('unstudied');
    expect(mastery.sections[1].masteryScore).toBeNull();

    // Mục 3.1 Điều kiện cần (index 3)
    expect(mastery.sections[3].status).toBe('weak');
    expect(mastery.sections[3].masteryScore).toBeLessThan(55);
    expect(mastery.sections[3].missingPoints).toEqual(['Thiếu điều kiện Circular Wait']);
    expect(mastery.sections[3].chunkIds).toEqual(['chk-3']);
    expect(mastery.sections[3].leechCount).toBe(1);

    // Mục Chương 4 chỉ có thẻ `new` chưa ôn -> vẫn unstudied, masteryScore = null
    expect(mastery.sections[4].status).toBe('unstudied');
    expect(mastery.sections[4].cardTotal).toBe(1);
    expect(mastery.sections[4].cardReviewed).toBe(0);
    expect(mastery.sections[4].masteryScore).toBeNull();

    expect(mastery.studiedSectionsCount).toBe(2);
    expect(mastery.weakSectionsCount).toBe(1);
    expect(mastery.masteredSectionsCount).toBe(1);
  });

  it('handles un-OCRed documents, null source_refs legacy items, deep heading nesting on same page, and 0.55/0.45 score fusion', () => {
    const emptyMastery = computeDocumentMastery({
      documentId: 'doc-empty',
      conversationId: convId,
      fileName: 'Pending.pdf',
      pageCount: null,
      docMetadata: null,
      chunks: [],
      latestQuizAnswers: [],
      flashcards: [],
    });
    expect(emptyMastery.totalSections).toBe(0);
    expect(emptyMastery.overallMasteryScore).toBeNull();
    expect(emptyMastery.overallStatus).toBe('unstudied');

    // Deep heading matching & null sourceRefs tolerance + exact 0.55 Quiz + 0.45 Flashcard fusion
    const nestedMastery = computeDocumentMastery({
      documentId: docId,
      conversationId: convId,
      fileName: 'OS.pdf',
      pageCount: 55,
      docMetadata,
      chunks,
      latestQuizAnswers: [
        {
          questionId: 'q-null-ref',
          evaluationStatus: EvaluationStatusEnum.incorrect,
          pointsEarned: 0,
          missingPoints: [],
          answeredAt: new Date(),
          question: {
            id: 'q-null-ref',
            questionText: '<p>Legacy</p>',
            points: 1,
            bloomLevel: null,
            sourceRefs: null,
          },
        },
        {
          questionId: 'q-deep',
          evaluationStatus: EvaluationStatusEnum.partial,
          pointsEarned: 1,
          missingPoints: [],
          answeredAt: new Date(),
          question: {
            id: 'q-deep',
            questionText: '<p>Điều kiện cần?</p>',
            points: 2,
            bloomLevel: 'understand',
            sourceRefs: [
              // Không truyền chunkId/headings, chỉ truyền pageNumbers: [26] -> phải rơi vào sub-heading cấp 2 (3.1 Điều kiện cần)
              { documentId: docId, fileName: 'OS.pdf', pageNumbers: [26] },
            ],
          },
        },
      ],
      flashcards: [
        {
          id: 'fc-deep',
          deckId: 'd-1',
          deckName: 'OS Deck',
          conversationId: convId,
          frontText: 'Coffman 4 conditions',
          state: CardStateEnum.review,
          interval: 28,
          easeFactor: 2.5,
          dueDate: new Date(),
          lastReviewedAt: new Date(),
          sourceRefs: [
            { documentId: docId, fileName: 'OS.pdf', pageNumbers: [26] },
          ],
          againCount: 0,
        },
      ],
    });

    // Chương 3 (index 2) vs 3.1 Điều kiện cần (index 3) đều cover trang 26; index 3 có level=2 sâu hơn nên nhận bài này
    expect(nestedMastery.sections[2].status).toBe('unstudied');
    const secDeep = nestedMastery.sections[3];
    // Quiz = 50% (1/2); Flashcard (review, interval=28, ease=2.5, again=0): round(62 + 28*1 + 0.4*18) = round(97.2) = 97
    // Combined = round(50 * 0.55 + 97 * 0.45) = round(27.5 + 43.65) = 71 -> developing
    expect(secDeep.quizTotal).toBe(1);
    expect(secDeep.cardReviewed).toBe(1);
    expect(secDeep.masteryScore).toBe(71);
    expect(secDeep.status).toBe('developing');
  });
});
