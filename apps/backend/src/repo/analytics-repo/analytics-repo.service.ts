import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AttemptStatusEnum,
  CardStateEnum,
  EvaluationStatusEnum,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface ConversationAccessInfo {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  dailyGoalMinutes: number;
  examDate: Date | null;
  targetScore: number | null;
}

export interface DocumentAccessInfo {
  id: string;
  conversationId: string;
  fileName: string;
  mimeType: string;
  pageCount: number | null;
  ocrStatus: string;
  docMetadata: unknown;
}

export interface SubjectConversationItem {
  id: string;
  title: string;
  updatedAt: Date;
}

export interface SubjectAccessInfo {
  id: string;
  name: string;
  color: string | null;
  dailyGoalMinutes: number;
  examDate: Date | null;
  targetScore: number | null;
  conversations: SubjectConversationItem[];
}

export interface AnalyticsFlashcardRow {
  id: string;
  deckId: string;
  deckName: string;
  conversationId: string;
  frontText: string;
  state: CardStateEnum;
  interval: number;
  easeFactor: number;
  dueDate: Date;
  lastReviewedAt: Date | null;
  sourceRefs: unknown;
  againCount: number;
}

export interface AnalyticsReviewLogRow {
  flashcardId: string;
  rating: number;
  stateBefore: CardStateEnum | null;
  timeTakenMs: number | null;
  reviewedAt: Date;
}

export interface AnalyticsQuizAnswerRow {
  questionId: string;
  evaluationStatus: EvaluationStatusEnum;
  pointsEarned: number;
  missingPoints: unknown;
  matchedPoints?: unknown;
  isFlagged?: boolean;
  answeredAt: Date | null;
  question: {
    id: string;
    questionText: string;
    points: number;
    questionType?: string;
    bloomLevel: string | null;
    sourceRefs: unknown;
  };
}

export interface AnalyticsQuizAttemptRow {
  id: string;
  quizId: string;
  quizTitle: string;
  conversationId: string;
  score: number;
  maxScore: number;
  timeSpentSec?: number;
  completedAt: Date | null;
  answers: AnalyticsQuizAnswerRow[];
}

export interface AnalyticsDocumentSummaryRow {
  id: string;
  conversationId: string;
  fileName: string;
  pageCount: number | null;
  ocrStatus: string;
  docMetadata: unknown;
}

export interface AnalyticsChunkIndexRow {
  id: string;
  documentId: string;
  chunkIndex: number;
  headings: string[];
  pageNumbers: number[];
  tokenCount?: number | null;
  bboxes?: unknown;
}

@Injectable()
export class AnalyticsRepoService {
  constructor(private readonly prisma: PrismaService) {}

  async assertConversationAccess(
    conversationId: string,
    userId: string,
  ): Promise<ConversationAccessInfo> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, user_id: userId },
      select: {
        id: true,
        title: true,
        subject_id: true,
        user: { select: { daily_goal_minutes: true } },
        subject: { select: { name: true, exam_date: true, target_score: true } },
      },
    });

    if (!conversation) {
      throw new NotFoundException(
        'Không tìm thấy phiên học hoặc bạn không có quyền truy cập',
      );
    }

    return {
      id: conversation.id,
      title: conversation.title,
      subjectId: conversation.subject_id,
      subjectName: conversation.subject.name,
      dailyGoalMinutes: conversation.user?.daily_goal_minutes ?? 15,
      examDate: conversation.subject.exam_date ?? null,
      targetScore: conversation.subject.target_score ?? null,
    };
  }

  async assertDocumentAccess(
    documentId: string,
    userId: string,
  ): Promise<DocumentAccessInfo> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, user_id: userId },
      select: {
        id: true,
        conversation_id: true,
        file_name: true,
        mime_type: true,
        page_count: true,
        ocr_status: true,
        doc_metadata: true,
      },
    });

    if (!doc) {
      throw new NotFoundException(
        'Không tìm thấy tài liệu hoặc bạn không có quyền truy cập',
      );
    }

    return {
      id: doc.id,
      conversationId: doc.conversation_id,
      fileName: doc.file_name,
      mimeType: doc.mime_type,
      pageCount: doc.page_count,
      ocrStatus: doc.ocr_status,
      docMetadata: doc.doc_metadata,
    };
  }

  async assertSubjectAccessWithConversations(
    subjectId: string,
    userId: string,
  ): Promise<SubjectAccessInfo> {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, user_id: userId },
      select: {
        id: true,
        name: true,
        color: true,
        exam_date: true,
        target_score: true,
        user: { select: { daily_goal_minutes: true } },
        conversations: {
          orderBy: { updated_at: 'desc' },
          select: {
            id: true,
            title: true,
            updated_at: true,
          },
        },
      },
    });

    if (!subject) {
      throw new NotFoundException(
        'Không tìm thấy môn học hoặc bạn không có quyền truy cập',
      );
    }

    return {
      id: subject.id,
      name: subject.name,
      color: subject.color,
      dailyGoalMinutes: subject.user?.daily_goal_minutes ?? 15,
      examDate: subject.exam_date ?? null,
      targetScore: subject.target_score ?? null,
      conversations: subject.conversations.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updated_at,
      })),
    };
  }

  async getSrsFlashcardsByConversations(
    conversationIds: string[],
    userId: string,
  ): Promise<AnalyticsFlashcardRow[]> {
    if (conversationIds.length === 0) return [];

    const [cards, againGroups] = await Promise.all([
      this.prisma.flashcard.findMany({
        where: {
          deck: {
            conversation_id: { in: conversationIds },
            user_id: userId,
          },
        },
        select: {
          id: true,
          deck_id: true,
          front_text: true,
          state: true,
          interval: true,
          ease_factor: true,
          due_date: true,
          last_reviewed_at: true,
          source_refs: true,
          deck: {
            select: {
              id: true,
              name: true,
              conversation_id: true,
            },
          },
        },
      }),
      this.prisma.flashcardReview.groupBy({
        by: ['flashcard_id'],
        where: {
          user_id: userId,
          rating: 1,
          flashcard: {
            deck: {
              conversation_id: { in: conversationIds },
              user_id: userId,
            },
          },
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const againCountMap = new Map<string, number>();
    for (const grp of againGroups) {
      againCountMap.set(grp.flashcard_id, grp._count._all);
    }

    return cards.map((card) => ({
      id: card.id,
      deckId: card.deck_id,
      deckName: card.deck.name,
      conversationId: card.deck.conversation_id,
      frontText: card.front_text,
      state: card.state,
      interval: card.interval,
      easeFactor: card.ease_factor,
      dueDate: card.due_date,
      lastReviewedAt: card.last_reviewed_at,
      sourceRefs: card.source_refs,
      againCount: againCountMap.get(card.id) ?? 0,
    }));
  }

  async getReviewLogsByConversations(
    conversationIds: string[],
    userId: string,
    sinceDate: Date,
  ): Promise<AnalyticsReviewLogRow[]> {
    if (conversationIds.length === 0) return [];

    const rows = await this.prisma.flashcardReview.findMany({
      where: {
        user_id: userId,
        reviewed_at: { gte: sinceDate },
        flashcard: {
          deck: {
            conversation_id: { in: conversationIds },
            user_id: userId,
          },
        },
      },
      select: {
        flashcard_id: true,
        rating: true,
        state_before: true,
        time_taken_ms: true,
        reviewed_at: true,
      },
      orderBy: { reviewed_at: 'desc' },
    });

    return rows.map((row) => ({
      flashcardId: row.flashcard_id,
      rating: row.rating,
      stateBefore: row.state_before,
      timeTakenMs: row.time_taken_ms,
      reviewedAt: row.reviewed_at,
    }));
  }

  async getSubmittedQuizAnalyticsByConversations(
    conversationIds: string[],
    userId: string,
  ): Promise<AnalyticsQuizAttemptRow[]> {
    if (conversationIds.length === 0) return [];

    const attempts = await this.prisma.quizAttempt.findMany({
      where: {
        user_id: userId,
        status: AttemptStatusEnum.submitted,
        quiz: {
          conversation_id: { in: conversationIds },
          user_id: userId,
        },
      },
      select: {
        id: true,
        quiz_id: true,
        score: true,
        max_score: true,
        time_spent_sec: true,
        completed_at: true,
        quiz: {
          select: {
            id: true,
            title: true,
            conversation_id: true,
          },
        },
        answers: {
          select: {
            question_id: true,
            evaluation_status: true,
            points_earned: true,
            missing_points: true,
            matched_points: true,
            is_flagged: true,
            answered_at: true,
            question: {
              select: {
                id: true,
                question_text: true,
                points: true,
                question_type: true,
                bloom_level: true,
                source_refs: true,
              },
            },
          },
        },
      },
      orderBy: { completed_at: 'desc' },
      take: 150,
    });

    return attempts.map((attempt) => ({
      id: attempt.id,
      quizId: attempt.quiz_id,
      quizTitle: attempt.quiz.title,
      conversationId: attempt.quiz.conversation_id,
      score: attempt.score,
      maxScore: attempt.max_score,
      timeSpentSec: attempt.time_spent_sec ?? 0,
      completedAt: attempt.completed_at,
      answers: attempt.answers.map((ans) => ({
        questionId: ans.question_id,
        evaluationStatus: ans.evaluation_status,
        pointsEarned: ans.points_earned,
        missingPoints: ans.missing_points,
        matchedPoints: ans.matched_points,
        isFlagged: Boolean(ans.is_flagged),
        answeredAt: ans.answered_at,
        question: {
          id: ans.question.id,
          questionText: ans.question.question_text,
          points: ans.question.points,
          questionType: ans.question.question_type,
          bloomLevel: ans.question.bloom_level,
          sourceRefs: ans.question.source_refs,
        },
      })),
    }));
  }

  async getDocumentsSummaryAndChunkIndex(
    conversationIds: string[],
    userId: string,
  ): Promise<{
    documents: AnalyticsDocumentSummaryRow[];
    chunks: AnalyticsChunkIndexRow[];
  }> {
    if (conversationIds.length === 0) {
      return { documents: [], chunks: [] };
    }

    const docs = await this.prisma.document.findMany({
      where: {
        conversation_id: { in: conversationIds },
        user_id: userId,
      },
      select: {
        id: true,
        conversation_id: true,
        file_name: true,
        page_count: true,
        ocr_status: true,
        doc_metadata: true,
      },
      orderBy: { created_at: 'asc' },
    });

    const docIds = docs.map((d) => d.id);
    if (docIds.length === 0) {
      return { documents: [], chunks: [] };
    }

    const chunks = await this.prisma.documentChunk.findMany({
      where: { document_id: { in: docIds } },
      select: {
        id: true,
        document_id: true,
        chunk_index: true,
        headings: true,
        page_numbers: true,
        token_count: true,
      },
      orderBy: [{ document_id: 'asc' }, { chunk_index: 'asc' }],
    });

    return {
      documents: docs.map((doc) => ({
        id: doc.id,
        conversationId: doc.conversation_id,
        fileName: doc.file_name,
        pageCount: doc.page_count,
        ocrStatus: doc.ocr_status,
        docMetadata: doc.doc_metadata,
      })),
      chunks: chunks.map((chunk) => ({
        id: chunk.id,
        documentId: chunk.document_id,
        chunkIndex: chunk.chunk_index,
        headings: chunk.headings,
        pageNumbers: chunk.page_numbers,
        ...(chunk.token_count !== undefined ? { tokenCount: chunk.token_count } : {}),
      })),
    };
  }

  async getFrequentlyAskedChunkCounts(
    conversationIds: string[],
    userId: string,
    sinceDate: Date,
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (conversationIds.length === 0) return counts;

    const rows = await this.prisma.message.findMany({
      where: {
        role: 'assistant',
        created_at: { gte: sinceDate },
        chat_session: {
          conversation_id: { in: conversationIds },
          conversation: { user_id: userId },
        },
      },
      select: {
        source_chunks: true,
      },
      orderBy: { created_at: 'desc' },
      take: 300,
    });

    for (const row of rows) {
      const uniqueInMsg = new Set(row.source_chunks);
      for (const chunkId of uniqueInMsg) {
        counts.set(chunkId, (counts.get(chunkId) ?? 0) + 1);
      }
    }

    return counts;
  }

  async getChunkIndexByDocumentId(
    documentId: string,
  ): Promise<AnalyticsChunkIndexRow[]> {
    const chunks = await this.prisma.documentChunk.findMany({
      where: { document_id: documentId },
      select: {
        id: true,
        document_id: true,
        chunk_index: true,
        headings: true,
        page_numbers: true,
        bboxes: true,
      },
      orderBy: { chunk_index: 'asc' },
    });

    return chunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.document_id,
      chunkIndex: chunk.chunk_index,
      headings: chunk.headings,
      pageNumbers: chunk.page_numbers,
      ...(chunk.bboxes !== undefined ? { bboxes: chunk.bboxes } : {}),
    }));
  }
}
