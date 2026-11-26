import { Injectable, Logger, Optional } from '@nestjs/common';
import type { AvailableDocumentItem } from '../documents/services/retrieval.service.js';
import type {
  ConversationTabId,
  ResolvedWorkspaceContext,
  WorkspacePageType,
} from '../ai/prompts/workspace-context.types.js';
import { ConversationsRepoService } from '../repo/conversations-repo/conversations-repo.service.js';
import { SubjectsRepoService } from '../repo/subjects-repo/subjects-repo.service.js';
import { SummariesRepoService } from '../repo/summaries-repo/summaries-repo.service.js';
import { DeckFlashcardRepoService } from '../repo/deck-flashcard-repo/deck-flashcard-repo.service.js';
import { QuizRepoService } from '../repo/quiz-repo/quiz-repo.service.js';
import type { WorkspaceUiContextDto } from './dto/ui-context.dto.js';

const MAX_LIST_ITEMS = 15;
const MAX_NOTE_HEADINGS = 8;

/**
 * Trích xuất danh sách tiêu đề Heading (H1–H3) gọn nhẹ từ BlockNote JSON
 * để phục vụ Progressive Disclosure L1 mà không dump toàn văn ghi chú.
 */
export function extractBlockNoteHeadings(contentJson: unknown): string[] {
  if (!Array.isArray(contentJson)) return [];

  const headings: string[] = [];

  const extractInlineText = (content: unknown): string => {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'text' in item) {
          const textVal = (item as { text?: unknown }).text;
          return typeof textVal === 'string' ? textVal : '';
        }
        return '';
      })
      .join('');
  };

  const walkBlocks = (blocks: unknown[]): void => {
    for (const rawBlock of blocks) {
      if (headings.length >= MAX_NOTE_HEADINGS) break;
      if (!rawBlock || typeof rawBlock !== 'object') continue;
      const block = rawBlock as {
        type?: unknown;
        props?: { level?: unknown };
        content?: unknown;
        children?: unknown;
      };

      if (block.type === 'heading') {
        const text = extractInlineText(block.content).trim();
        if (text) {
          const lvl =
            typeof block.props?.level === 'number' ? block.props.level : 1;
          headings.push(`H${Math.min(3, Math.max(1, lvl))}: ${text.slice(0, 80)}`);
        }
      }

      if (Array.isArray(block.children) && block.children.length > 0) {
        walkBlocks(block.children);
      }
    }
  };

  walkBlocks(contentJson);
  return headings;
}

function getNearbyDocumentToc(
  doc: AvailableDocumentItem,
  currentPage?: number,
): string[] {
  if (!Array.isArray(doc.toc) || doc.toc.length === 0) return [];
  if (typeof currentPage !== 'number' || currentPage < 1) {
    return doc.toc.slice(0, 4).map((t) =>
      t.pageNo ? `${t.text} (p.${t.pageNo})` : t.text,
    );
  }

  const scored = doc.toc.map((item, index) => ({
    item,
    index,
    distance:
      typeof item.pageNo === 'number'
        ? Math.abs(item.pageNo - currentPage)
        : 9999,
  }));

  scored.sort((a, b) => a.distance - b.distance || a.index - b.index);
  return scored
    .slice(0, 4)
    .sort((a, b) => a.index - b.index)
    .map((entry) =>
      entry.item.pageNo
        ? `${entry.item.text} (p.${entry.item.pageNo})`
        : entry.item.text,
    );
}

@Injectable()
export class WorkspaceContextHydratorService {
  private readonly logger = new Logger(WorkspaceContextHydratorService.name);

  constructor(
    @Optional() private readonly conversationsRepo?: ConversationsRepoService,
    @Optional() private readonly subjectsRepo?: SubjectsRepoService,
    @Optional() private readonly summariesRepo?: SummariesRepoService,
    @Optional() private readonly deckFlashcardRepo?: DeckFlashcardRepoService,
    @Optional() private readonly quizRepo?: QuizRepoService,
  ) {}

  async hydrate(params: {
    userId: string;
    conversationId: string;
    uiContext?: WorkspaceUiContextDto;
    availableDocuments?: AvailableDocumentItem[];
    attachedDocumentIds?: string[];
    activeWordContext?: {
      documentId: string;
      changeMode?: 'tracked' | 'direct';
      selectedText?: string;
    };
  }): Promise<ResolvedWorkspaceContext | undefined> {
    const {
      userId,
      conversationId,
      uiContext,
      availableDocuments = [],
      attachedDocumentIds = [],
      activeWordContext,
    } = params;

    const docById = new Map(
      availableDocuments.map((d) => [d.documentId, d]),
    );

    const activeTab: ConversationTabId | undefined =
      uiContext?.location?.activeTab ??
      (activeWordContext?.documentId ? 'documents' : undefined);
    const pageType: WorkspacePageType =
      uiContext?.location?.pageType ?? 'conversation';

    const now = new Date();

    // 1. Chạy song song truy vấn Location + Inventory nhẹ (< 25ms)
    const [conversationRecord, notesCount, rawDecks, quizzesCount] =
      await Promise.all([
        this.conversationsRepo
          ?.getConversationById(conversationId, userId)
          .catch((err) => {
            this.logger.warn(
              `[Hydrator] conversationsRepo failed: ${err?.message}`,
            );
            return null;
          }) ?? Promise.resolve(null),
        this.summariesRepo
          ?.countSummariesByConversationId(conversationId)
          .catch((err) => {
            this.logger.warn(
              `[Hydrator] countSummaries failed: ${err?.message}`,
            );
            return 0;
          }) ?? Promise.resolve(0),
        this.deckFlashcardRepo
          ?.getDecksWithStats(userId, { conversationId })
          .catch((err) => {
            this.logger.warn(
              `[Hydrator] getDecksWithStats failed: ${err?.message}`,
            );
            return [];
          }) ?? Promise.resolve([]),
        this.quizRepo
          ?.countQuizzesByConversation(conversationId, userId)
          .catch((err) => {
            this.logger.warn(
              `[Hydrator] countQuizzes failed: ${err?.message}`,
            );
            return 0;
          }) ?? Promise.resolve(0),
      ]);

    const resolvedSubjectId =
      conversationRecord?.subject_id ??
      uiContext?.location?.subjectId ??
      undefined;

    const subjectRecord =
      resolvedSubjectId && this.subjectsRepo
        ? await this.subjectsRepo
            .getSubjectById(resolvedSubjectId, userId)
            .catch((err) => {
              this.logger.warn(
                `[Hydrator] getSubjectById failed: ${err?.message}`,
              );
              return null;
            })
        : null;

    const attachedDocs = attachedDocumentIds
      .map((id) => docById.get(id))
      .filter((d): d is AvailableDocumentItem => Boolean(d))
      .map((d) => ({ documentId: d.documentId, fileName: d.fileName }));

    const resolved: ResolvedWorkspaceContext = {
      location: {
        pathname: uiContext?.location?.pathname,
        pageType,
        subjectId: resolvedSubjectId,
        subjectName: subjectRecord?.name ?? undefined,
        conversationId,
        conversationTitle: conversationRecord?.title ?? undefined,
        activeTab,
        isFocusMode: uiContext?.location?.isFocusMode,
      },
      inventory: {
        documentsCount: availableDocuments.length,
        readyDocumentsCount: availableDocuments.length,
        notesCount: Number(notesCount ?? 0),
        decksCount: Array.isArray(rawDecks) ? rawDecks.length : 0,
        quizzesCount: Number(quizzesCount ?? 0),
      },
      ...(attachedDocs.length > 0 ? { attachedDocuments: attachedDocs } : {}),
      guards: {
        examIntegrityGuard: false,
        hideFlashcardAnswerGuard: false,
      },
    };

    // 2. Side-panel source reader (Zero-Trust: kiểm tra documentId thuộc catalog)
    if (uiContext?.sidePanel?.documentId) {
      const spDoc = docById.get(uiContext.sidePanel.documentId);
      if (spDoc) {
        resolved.sidePanel = {
          documentId: spDoc.documentId,
          fileName: spDoc.fileName,
          pageNo: uiContext.sidePanel.pageNo,
          citationId: uiContext.sidePanel.citationId,
        };
      }
    }

    // 3. Hydrate L1 chuyên sâu CHỈ cho tab đang active
    if (activeTab === 'documents') {
      const docSlice = uiContext?.documents;
      const requestedDocId =
        docSlice?.viewingDocument?.documentId ?? activeWordContext?.documentId;

      if (
        requestedDocId &&
        (docSlice?.viewMode === 'viewer' || Boolean(activeWordContext?.documentId))
      ) {
        const verifiedDoc = docById.get(requestedDocId);
        if (verifiedDoc) {
          const isWordMatch =
            activeWordContext?.documentId === verifiedDoc.documentId;
          const viewerKind =
            docSlice?.viewingDocument?.viewerKind ??
            (isWordMatch ? 'word' : 'pdf');
          const currentPage = docSlice?.viewingDocument?.currentPage;
          const selectedText =
            docSlice?.viewingDocument?.selectedText ??
            (isWordMatch ? activeWordContext?.selectedText : undefined);

          resolved.documentsView = {
            viewMode: 'viewer',
            filterType: docSlice?.filterType ?? 'all',
            visibleCount: docSlice?.visibleCount,
            viewingDocument: {
              documentId: verifiedDoc.documentId,
              fileName: verifiedDoc.fileName,
              viewerKind,
              currentPage,
              totalPages: docSlice?.viewingDocument?.totalPages,
              pageCount: verifiedDoc.pageCount ?? undefined,
              wordChangeMode:
                docSlice?.viewingDocument?.wordChangeMode ??
                (isWordMatch ? activeWordContext?.changeMode : undefined),
              status: 'ready',
              nearbyTocHeadings: getNearbyDocumentToc(verifiedDoc, currentPage),
              selectedText,
            },
          };
        } else {
          resolved.documentsView = {
            viewMode: 'list',
            filterType: docSlice?.filterType ?? 'all',
            visibleCount: docSlice?.visibleCount ?? availableDocuments.length,
          };
        }
      } else {
        resolved.documentsView = {
          viewMode: 'list',
          filterType: docSlice?.filterType ?? 'all',
          visibleCount: docSlice?.visibleCount ?? availableDocuments.length,
        };
      }
    } else if (activeTab === 'summary') {
      const sumSlice = uiContext?.summary;
      const requestedSummaryId = sumSlice?.activeSummary?.summaryId;

      const [summaryList, activeNoteRecord] = await Promise.all([
        this.summariesRepo
          ?.getSummaryListL1ByConversationId(conversationId, MAX_LIST_ITEMS)
          .catch((err) => {
            this.logger.warn(
              `[Hydrator] getSummaryListL1 failed: ${err?.message}`,
            );
            return [];
          }) ?? Promise.resolve([]),
        sumSlice?.viewMode === 'detail' &&
        requestedSummaryId &&
        this.summariesRepo
          ? this.summariesRepo
              .getSummaryByIdInConversation(requestedSummaryId, conversationId)
              .catch((err) => {
                this.logger.warn(
                  `[Hydrator] getSummaryByIdInConversation failed: ${err?.message}`,
                );
                return null;
              })
          : Promise.resolve(null),
      ]);

      const notesList = (summaryList ?? []).map((s) => ({
        id: s.id,
        title: s.title?.trim() || 'Ghi chú chưa đặt tên',
      }));

      resolved.summaryView = {
        viewMode: activeNoteRecord ? 'detail' : 'list',
        totalCount: resolved.inventory.notesCount || notesList.length,
        notesList,
        ...(activeNoteRecord
          ? {
              activeNote: {
                summaryId: activeNoteRecord.id,
                title: activeNoteRecord.title?.trim() || 'Ghi chú chưa đặt tên',
                headings: extractBlockNoteHeadings(
                  activeNoteRecord.content_json,
                ),
                selectedText: sumSlice?.activeSummary?.selectedText,
              },
            }
          : {}),
      };
    } else if (activeTab === 'flashcard') {
      const fcSlice = uiContext?.flashcard;
      const mappedDecks = (rawDecks ?? []).map((deck) => {
        const cards = Array.isArray(deck.flashcards) ? deck.flashcards : [];
        let newCount = 0;
        let learningCount = 0;
        let reviewCount = 0;
        let dueToday = 0;

        for (const card of cards) {
          if (card.state === 'new') newCount += 1;
          else if (card.state === 'learning' || card.state === 'relearning')
            learningCount += 1;
          else if (card.state === 'review') reviewCount += 1;

          if (!card.due_date || new Date(card.due_date) <= now) {
            dueToday += 1;
          }
        }

        return {
          id: deck.id,
          name: deck.name,
          totalCards: cards.length,
          newCount,
          learningCount,
          reviewCount,
          dueToday,
        };
      });

      const requestedDeckId = fcSlice?.activeDeck?.deckId;
      const verifiedDeck = requestedDeckId
        ? mappedDecks.find((d) => d.id === requestedDeckId)
        : undefined;

      const resolvedViewMode =
        verifiedDeck &&
        (fcSlice?.viewMode === 'study' || fcSlice?.viewMode === 'detail')
          ? fcSlice.viewMode
          : 'decks';

      const studyState =
        resolvedViewMode === 'study' && fcSlice?.studyState
          ? {
              mode: fcSlice.studyState.mode,
              progress: fcSlice.studyState.progress,
              remaining: fcSlice.studyState.remaining,
              currentCardId: fcSlice.studyState.currentCardId,
              isCardRevealed: fcSlice.studyState.isCardRevealed,
            }
          : undefined;

      if (resolvedViewMode === 'study' && studyState && !studyState.isCardRevealed) {
        resolved.guards.hideFlashcardAnswerGuard = true;
      }

      resolved.flashcardView = {
        viewMode: resolvedViewMode,
        totalDecksCount: mappedDecks.length,
        decksList: mappedDecks.slice(0, MAX_LIST_ITEMS).map((d) => ({
          id: d.id,
          name: d.name,
          totalCards: d.totalCards,
          dueToday: d.dueToday,
        })),
        ...(verifiedDeck
          ? {
              activeDeck: {
                deckId: verifiedDeck.id,
                name: verifiedDeck.name,
                totalCards: verifiedDeck.totalCards,
                newCount: verifiedDeck.newCount,
                learningCount: verifiedDeck.learningCount,
                reviewCount: verifiedDeck.reviewCount,
                dueToday: verifiedDeck.dueToday,
              },
            }
          : {}),
        ...(studyState ? { studyState } : {}),
      };
    } else if (activeTab === 'quiz') {
      const qSlice = uiContext?.quiz;
      const requestedQuizId = qSlice?.activeQuiz?.quizId;
      const requestedAttemptId = qSlice?.activeAttempt?.attemptId;

      const [quizList, activeQuizRecord, activeAttemptRecord] =
        await Promise.all([
          this.quizRepo
            ?.getQuizListL1ByConversation(
              conversationId,
              userId,
              MAX_LIST_ITEMS,
            )
            .catch((err) => {
              this.logger.warn(
                `[Hydrator] getQuizListL1 failed: ${err?.message}`,
              );
              return [];
            }) ?? Promise.resolve([]),
          requestedQuizId && this.quizRepo
            ? this.quizRepo
                .getQuizL1ByIdInConversation(
                  requestedQuizId,
                  conversationId,
                  userId,
                )
                .catch((err) => {
                  this.logger.warn(
                    `[Hydrator] getQuizL1 failed: ${err?.message}`,
                  );
                  return null;
                })
            : Promise.resolve(null),
          requestedAttemptId && this.quizRepo
            ? this.quizRepo
                .getAttemptL1Summary(requestedAttemptId, conversationId, userId)
                .catch((err) => {
                  this.logger.warn(
                    `[Hydrator] getAttemptL1Summary failed: ${err?.message}`,
                  );
                  return null;
                })
            : Promise.resolve(null),
        ]);

      const quizzesList = (quizList ?? []).map((q) => ({
        id: q.id,
        title: q.title,
        questionCount: q._count?.questions ?? 0,
      }));

      const resolvedQuizSource = activeAttemptRecord?.quiz ?? activeQuizRecord;
      const viewMode = qSlice?.viewMode ?? 'list';

      let attemptMode: 'exam' | 'practice' | undefined =
        qSlice?.activeAttempt?.mode;
      if (
        !attemptMode &&
        activeAttemptRecord?.config &&
        typeof activeAttemptRecord.config === 'object' &&
        'mode' in activeAttemptRecord.config
      ) {
        const rawMode = (activeAttemptRecord.config as { mode?: unknown }).mode;
        if (rawMode === 'exam' || rawMode === 'practice') {
          attemptMode = rawMode;
        }
      }

      // Fail-safe Exam Integrity Guard: bật nếu đang làm bài ở chế độ exam (hoặc chưa rõ mode khi taking)
      if (
        viewMode === 'taking' &&
        (attemptMode === 'exam' || !attemptMode)
      ) {
        resolved.guards.examIntegrityGuard = true;
      }

      let activeAttemptSummary:
        | NonNullable<ResolvedWorkspaceContext['quizView']>['activeAttempt']
        | undefined;

      if (activeAttemptRecord) {
        const answers = Array.isArray(activeAttemptRecord.answers)
          ? activeAttemptRecord.answers
          : [];
        let correctCount = 0;
        let partialCount = 0;
        let incorrectCount = 0;
        let essayCount = 0;
        for (const ans of answers) {
          if (ans.evaluation_status === 'correct') correctCount += 1;
          else if (ans.evaluation_status === 'partial') partialCount += 1;
          else if (ans.evaluation_status === 'incorrect') incorrectCount += 1;
          if (ans.question?.question_type === 'essay') essayCount += 1;
        }

        activeAttemptSummary = {
          attemptId: activeAttemptRecord.id,
          status: activeAttemptRecord.status,
          mode: attemptMode,
          currentQuestionIndex: qSlice?.activeAttempt?.currentQuestionIndex,
          totalQuestions:
            qSlice?.activeAttempt?.totalQuestions ??
            activeAttemptRecord.quiz?._count?.questions,
          answeredCount: qSlice?.activeAttempt?.answeredCount,
          score: activeAttemptRecord.score,
          maxScore: activeAttemptRecord.max_score,
          correctCount,
          partialCount,
          incorrectCount,
          essayCount,
          resultFilter: qSlice?.activeAttempt?.resultFilter,
        };
      } else if (qSlice?.activeAttempt && viewMode === 'taking') {
        activeAttemptSummary = {
          attemptId: qSlice.activeAttempt.attemptId,
          mode: attemptMode,
          currentQuestionIndex: qSlice.activeAttempt.currentQuestionIndex,
          totalQuestions: qSlice.activeAttempt.totalQuestions,
          answeredCount: qSlice.activeAttempt.answeredCount,
        };
      }

      resolved.quizView = {
        viewMode,
        totalQuizzesCount: resolved.inventory.quizzesCount || quizzesList.length,
        quizzesList,
        ...(resolvedQuizSource
          ? {
              activeQuiz: {
                quizId: resolvedQuizSource.id,
                title: resolvedQuizSource.title,
                questionCount:
                  'questions' in (resolvedQuizSource._count ?? {})
                    ? resolvedQuizSource._count.questions
                    : 0,
                attemptsCount:
                  activeQuizRecord?._count?.attempts ?? 0,
              },
            }
          : {}),
        ...(activeAttemptSummary
          ? { activeAttempt: activeAttemptSummary }
          : {}),
      };
    } else if (activeTab === 'analytics') {
      resolved.analyticsView = {
        windowDays: uiContext?.analytics?.windowDays ?? 30,
        advancedOpen: uiContext?.analytics?.advancedOpen,
      };
    }

    return resolved;
  }
}
