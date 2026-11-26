import { Injectable, Logger, Optional } from '@nestjs/common';
import type { ResolvedWorkspaceContext } from '../ai/prompts/workspace-context.types.js';
import type {
  GetDeckCardsToolInput,
  GetDeckCardsToolOutput,
  GetNoteContentToolInput,
  GetNoteContentToolOutput,
  GetQuizContentOptionItem,
  GetQuizContentQuestionItem,
  GetQuizContentToolInput,
  GetQuizContentToolOutput,
  SearchWorkspaceResourcesToolInput,
  SearchWorkspaceResourcesToolOutput,
  WorkspaceResourceSearchItem,
  WorkspaceSearchResourceType,
} from '../ai/tools/types.js';
import {
  MAX_NOTE_CONTENT_CHARS,
  extractNoteSectionOrSlice,
  serializeBlockNoteToMarkdown,
} from '../common/utils/blocknote-markdown.helper.js';
import {
  htmlToCleanText,
  normalizeHeadingKey,
  parseGradingCriteria,
} from '../common/utils/text.utils.js';
import { parseAttemptConfig, parseQuizOptions } from '../quiz/quiz.helper.js';
import { ConversationsRepoService } from '../repo/conversations-repo/conversations-repo.service.js';
import { DeckFlashcardRepoService } from '../repo/deck-flashcard-repo/deck-flashcard-repo.service.js';
import { DocumentsRepoService } from '../repo/documents-repo/documents-repo.service.js';
import { QuizRepoService } from '../repo/quiz-repo/quiz-repo.service.js';
import { SummariesRepoService } from '../repo/summaries-repo/summaries-repo.service.js';

export interface WorkspaceL2ReadContext {
  userId: string;
  conversationId: string;
  subjectId?: string;
  workspaceContext?: ResolvedWorkspaceContext;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value?: string | null): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

function toIsoString(val: unknown): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return val;
  return undefined;
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string');
}

@Injectable()
export class WorkspaceL2ReadService {
  private readonly logger = new Logger(WorkspaceL2ReadService.name);

  constructor(
    @Optional() private readonly summariesRepo?: SummariesRepoService,
    @Optional() private readonly quizRepo?: QuizRepoService,
    @Optional() private readonly deckFlashcardRepo?: DeckFlashcardRepoService,
    @Optional() private readonly documentsRepo?: DocumentsRepoService,
    @Optional() private readonly conversationsRepo?: ConversationsRepoService,
  ) {}

  /* ==========================================================
   * 1. getNoteContent (BlockNote JSON -> Markdown có cấu trúc)
   * ========================================================== */
  async readNoteContent(
    ctx: WorkspaceL2ReadContext,
    input: GetNoteContentToolInput,
  ): Promise<GetNoteContentToolOutput> {
    if (!this.summariesRepo) {
      return {
        found: false,
        sectionOutline: [],
        contentMarkdown: '',
        totalChars: 0,
        charOffset: 0,
        truncated: false,
        message: 'Dịch vụ ghi chú hiện chưa sẵn sàng.',
      };
    }

    const requestedSummaryId = input.summaryId?.trim();
    const titleQuery = input.titleQuery?.trim();
    const activeNoteId = ctx.workspaceContext?.summaryView?.activeNote?.summaryId;

    const effectiveSummaryId =
      requestedSummaryId || (!titleQuery ? activeNoteId : undefined);

    let noteRecord: Awaited<
      ReturnType<SummariesRepoService['getSummaryByIdForUser']>
    > = null;

    if (effectiveSummaryId) {
      if (!isUuid(effectiveSummaryId)) {
        return {
          found: false,
          sectionOutline: [],
          contentMarkdown: '',
          totalChars: 0,
          charOffset: 0,
          truncated: false,
          message: 'Mã ghi chú (summaryId) không hợp lệ.',
        };
      }
      noteRecord = await this.summariesRepo.getSummaryByIdForUser(
        effectiveSummaryId,
        ctx.userId,
      );
      if (!noteRecord) {
        return {
          found: false,
          sectionOutline: [],
          contentMarkdown: '',
          totalChars: 0,
          charOffset: 0,
          truncated: false,
          message:
            'Không tìm thấy ghi chú yêu cầu hoặc bạn không có quyền truy cập.',
        };
      }
    } else if (titleQuery) {
      const matches = await this.summariesRepo.searchSummariesForUser({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        query: titleQuery,
        limit: 10,
      });

      if (matches.length === 0) {
        return {
          found: false,
          sectionOutline: [],
          contentMarkdown: '',
          totalChars: 0,
          charOffset: 0,
          truncated: false,
          message: `Không tìm thấy ghi chú nào khớp với "${titleQuery}" trong phiên học này.`,
        };
      }

      const normalizedQuery = normalizeHeadingKey(titleQuery);
      const exactMatch = matches.find(
        (m) => normalizeHeadingKey(m.title) === normalizedQuery,
      );

      if (matches.length > 1 && !exactMatch) {
        return {
          found: false,
          sectionOutline: [],
          contentMarkdown: '',
          totalChars: 0,
          charOffset: 0,
          truncated: false,
          candidates: matches.map((m) => ({
            summaryId: m.id,
            title: m.title,
          })),
          message: `Tìm thấy ${matches.length} ghi chú khớp "${titleQuery}". Hãy gọi lại getNoteContent với summaryId cụ thể.`,
        };
      }

      const chosen = exactMatch ?? matches[0];
      noteRecord = await this.summariesRepo.getSummaryByIdForUser(
        chosen.id,
        ctx.userId,
      );
    } else {
      const available = await this.summariesRepo.searchSummariesForUser({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        limit: 10,
      });

      return {
        found: false,
        sectionOutline: [],
        contentMarkdown: '',
        totalChars: 0,
        charOffset: 0,
        truncated: false,
        candidates: available.map((m) => ({
          summaryId: m.id,
          title: m.title,
        })),
        message:
          available.length > 0
            ? 'Vui lòng chỉ định summaryId hoặc titleQuery của ghi chú cần đọc.'
            : 'Phiên học này hiện chưa có ghi chú nào.',
      };
    }

    if (!noteRecord) {
      return {
        found: false,
        sectionOutline: [],
        contentMarkdown: '',
        totalChars: 0,
        charOffset: 0,
        truncated: false,
        message: 'Không thể tải nội dung ghi chú.',
      };
    }

    const parsed = serializeBlockNoteToMarkdown(noteRecord.content_json);
    const sliced = extractNoteSectionOrSlice(parsed, {
      sectionKeyword: input.sectionKeyword,
      charOffset: input.charOffset,
      maxChars: MAX_NOTE_CONTENT_CHARS,
    });

    const sectionNote =
      input.sectionKeyword?.trim() && !sliced.matchedSection
        ? `Không tìm thấy mục riêng khớp "${input.sectionKeyword.trim()}", đang trả toàn bộ nội dung ghi chú.`
        : undefined;

    return {
      found: true,
      summaryId: noteRecord.id,
      title: noteRecord.title?.trim() || 'Ghi chú chưa đặt tên',
      conversationId: noteRecord.conversation_id,
      sourceDocumentName: noteRecord.document?.file_name ?? null,
      updatedAt: toIsoString(noteRecord.updated_at),
      sectionOutline: parsed.outline,
      matchedSection: sliced.matchedSection,
      contentMarkdown: sliced.contentMarkdown,
      totalChars: sliced.totalChars,
      charOffset: sliced.charOffset,
      truncated: sliced.truncated,
      ...(sliced.nextCharOffset !== undefined
        ? { nextCharOffset: sliced.nextCharOffset }
        : {}),
      ...(sectionNote ? { message: sectionNote } : {}),
    };
  }

  /* ==========================================================
   * 2. getQuizContent (Shuffled Order + Exam Guard 2 lớp)
   * ========================================================== */
  async readQuizContent(
    ctx: WorkspaceL2ReadContext,
    input: GetQuizContentToolInput,
  ): Promise<GetQuizContentToolOutput> {
    if (!this.quizRepo) {
      return {
        found: false,
        examIntegrityEnforced: false,
        totalQuestions: 0,
        filteredCount: 0,
        returnedCount: 0,
        offset: 0,
        hasMore: false,
        questions: [],
        message: 'Dịch vụ bài kiểm tra hiện chưa sẵn sàng.',
      };
    }

    const activeAttemptId =
      ctx.workspaceContext?.quizView?.activeAttempt?.attemptId;
    const activeQuizId = ctx.workspaceContext?.quizView?.activeQuiz?.quizId;

    const requestedAttemptId =
      input.attemptId?.trim() ||
      (!input.quizId?.trim() ? activeAttemptId : undefined);
    const requestedQuizId =
      input.quizId?.trim() || (!requestedAttemptId ? activeQuizId : undefined);

    if (!requestedAttemptId && !requestedQuizId) {
      return {
        found: false,
        examIntegrityEnforced: Boolean(
          ctx.workspaceContext?.guards.examIntegrityGuard,
        ),
        totalQuestions: 0,
        filteredCount: 0,
        returnedCount: 0,
        offset: 0,
        hasMore: false,
        questions: [],
        message:
          'Vui lòng cung cấp quizId hoặc attemptId (hoặc mở bài kiểm tra cần xem).',
      };
    }

    let attemptRecord: Awaited<
      ReturnType<QuizRepoService['getAttemptByIdWithDetails']>
    > | null = null;
    let quizRecord: Awaited<ReturnType<QuizRepoService['getQuizById']>> | null =
      null;

    if (requestedAttemptId) {
      if (!isUuid(requestedAttemptId)) {
        return {
          found: false,
          examIntegrityEnforced: Boolean(
            ctx.workspaceContext?.guards.examIntegrityGuard,
          ),
          totalQuestions: 0,
          filteredCount: 0,
          returnedCount: 0,
          offset: 0,
          hasMore: false,
          questions: [],
          message: 'Mã lượt làm bài (attemptId) không hợp lệ.',
        };
      }
      try {
        attemptRecord = await this.quizRepo.getAttemptByIdWithDetails(
          requestedAttemptId,
          ctx.userId,
        );
      } catch {
        return {
          found: false,
          examIntegrityEnforced: Boolean(
            ctx.workspaceContext?.guards.examIntegrityGuard,
          ),
          totalQuestions: 0,
          filteredCount: 0,
          returnedCount: 0,
          offset: 0,
          hasMore: false,
          questions: [],
          message:
            'Không tìm thấy lượt làm bài hoặc bạn không có quyền truy cập.',
        };
      }
    } else if (requestedQuizId) {
      if (!isUuid(requestedQuizId)) {
        return {
          found: false,
          examIntegrityEnforced: Boolean(
            ctx.workspaceContext?.guards.examIntegrityGuard,
          ),
          totalQuestions: 0,
          filteredCount: 0,
          returnedCount: 0,
          offset: 0,
          hasMore: false,
          questions: [],
          message: 'Mã đề kiểm tra (quizId) không hợp lệ.',
        };
      }
      try {
        quizRecord = await this.quizRepo.getQuizById(
          requestedQuizId,
          ctx.userId,
        );
      } catch {
        return {
          found: false,
          examIntegrityEnforced: Boolean(
            ctx.workspaceContext?.guards.examIntegrityGuard,
          ),
          totalQuestions: 0,
          filteredCount: 0,
          returnedCount: 0,
          offset: 0,
          hasMore: false,
          questions: [],
          message:
            'Không tìm thấy bài kiểm tra hoặc bạn không có quyền truy cập.',
        };
      }

      if (input.mode === 'attempt_review') {
        const latestSubmitted =
          await this.quizRepo.getLatestSubmittedAttemptByQuizId(
            quizRecord.id,
            ctx.userId,
          );
        if (latestSubmitted) {
          attemptRecord = latestSubmitted;
        }
      }
    }

    const resolvedQuiz = attemptRecord?.quiz ?? quizRecord;
    if (!resolvedQuiz) {
      return {
        found: false,
        examIntegrityEnforced: false,
        totalQuestions: 0,
        filteredCount: 0,
        returnedCount: 0,
        offset: 0,
        hasMore: false,
        questions: [],
        message: 'Không tìm thấy dữ liệu bài kiểm tra.',
      };
    }

    const rawQuestions = resolvedQuiz.questions ?? [];
    const fallbackIds = rawQuestions.map((q) => q.id);
    const attemptConfig = attemptRecord
      ? parseAttemptConfig(
          attemptRecord.config,
          resolvedQuiz.time_limit_sec,
          fallbackIds,
        )
      : null;

    // ── Cưỡng chế Exam Integrity Guard 2 lớp tất định ──
    const uiExamGuard = Boolean(ctx.workspaceContext?.guards.examIntegrityGuard);
    const isTargetAttemptLiveExam = Boolean(
      attemptRecord &&
        attemptRecord.status === 'in_progress' &&
        attemptConfig?.mode !== 'practice',
    );
    const dbLiveExamAttempt = isTargetAttemptLiveExam
      ? attemptRecord
      : await this.quizRepo
          .findActiveInProgressExamAttempt(resolvedQuiz.id, ctx.userId)
          .catch((err) => {
            this.logger.warn(
              `[WorkspaceL2Read] findActiveInProgressExamAttempt failed: ${err?.message}`,
            );
            return null;
          });

    const examIntegrityEnforced = uiExamGuard || Boolean(dbLiveExamAttempt);

    // ── Sắp xếp câu hỏi khớp 100% thứ tự hiển thị trên UI (questionOrder) ──
    const questionById = new Map(rawQuestions.map((q) => [q.id, q]));
    const orderedQuestions: typeof rawQuestions = [];
    if (attemptConfig?.questionOrder?.length) {
      const seen = new Set<string>();
      for (const qId of attemptConfig.questionOrder) {
        const q = questionById.get(qId);
        if (q && !seen.has(q.id)) {
          orderedQuestions.push(q);
          seen.add(q.id);
        }
      }
      for (const q of rawQuestions) {
        if (!seen.has(q.id)) {
          orderedQuestions.push(q);
        }
      }
    } else {
      orderedQuestions.push(...rawQuestions);
    }

    const answersByQuestionId = new Map(
      (attemptRecord?.answers ?? []).map((a) => [a.question_id, a]),
    );

    const includeAttemptData = Boolean(
      attemptRecord && input.mode !== 'questions_only',
    );

    // Gán displayNumber 1-based trước khi lọc để số câu luôn khớp màn hình
    const fullEntries = orderedQuestions.map((q, idx) => ({
      question: q,
      displayNumber: idx + 1,
      answer: answersByQuestionId.get(q.id),
    }));

    // Lọc theo questionNumbers
    const requestedNumbers = Array.isArray(input.questionNumbers)
      ? new Set(
          input.questionNumbers.filter(
            (n) => Number.isInteger(n) && n >= 1,
          ),
        )
      : null;

    let filteredEntries =
      requestedNumbers && requestedNumbers.size > 0
        ? fullEntries.filter((e) => requestedNumbers.has(e.displayNumber))
        : fullEntries;

    // Lọc theo evaluationFilter (vô hiệu hóa các filter đúng/sai nếu đang bật Exam Guard)
    const rawFilter = input.evaluationFilter ?? 'all';
    const effectiveFilter =
      examIntegrityEnforced &&
      (rawFilter === 'incorrect' ||
        rawFilter === 'partial' ||
        rawFilter === 'correct')
        ? 'all'
        : rawFilter;

    if (effectiveFilter !== 'all') {
      filteredEntries = filteredEntries.filter(({ question, answer }) => {
        if (effectiveFilter === 'essay') {
          return question.question_type === 'essay';
        }
        if (!attemptRecord) return true;

        if (effectiveFilter === 'flagged') {
          return Boolean(answer?.is_flagged);
        }
        if (effectiveFilter === 'unanswered') {
          const selected = parseStringArray(answer?.selected_option_ids);
          const hasText = Boolean(answer?.text_answer?.trim());
          return selected.length === 0 && !hasText;
        }
        if (
          effectiveFilter === 'incorrect' ||
          effectiveFilter === 'partial' ||
          effectiveFilter === 'correct'
        ) {
          return answer?.evaluation_status === effectiveFilter;
        }
        return true;
      });
    }

    const safeOffset = Math.max(0, Math.floor(input.offset ?? 0));
    const safeLimit = Math.min(15, Math.max(1, Math.floor(input.limit ?? 10)));
    const pagedEntries = filteredEntries.slice(
      safeOffset,
      safeOffset + safeLimit,
    );

    const mappedQuestions: GetQuizContentQuestionItem[] = pagedEntries.map(
      ({ question, displayNumber, answer }) => {
        const parsedOptions = parseQuizOptions(question.options);
        let orderedOptions = parsedOptions ?? [];

        if (
          orderedOptions.length > 0 &&
          attemptConfig?.optionOrder?.[question.id]?.length
        ) {
          const optById = new Map(orderedOptions.map((o) => [o.id, o]));
          const reordered: typeof orderedOptions = [];
          const seenOpt = new Set<string>();
          for (const optId of attemptConfig.optionOrder[question.id]) {
            const opt = optById.get(optId);
            if (opt && !seenOpt.has(opt.id)) {
              reordered.push(opt);
              seenOpt.add(opt.id);
            }
          }
          for (const opt of orderedOptions) {
            if (!seenOpt.has(opt.id)) {
              reordered.push(opt);
            }
          }
          orderedOptions = reordered;
        }

        const labelByOptId = new Map<string, string>();
        const safeOptions: GetQuizContentOptionItem[] | undefined =
          orderedOptions.length > 0
            ? orderedOptions.map((opt, optIdx) => {
                const label = String.fromCharCode(65 + optIdx);
                labelByOptId.set(opt.id, label);
                return examIntegrityEnforced
                  ? {
                      label,
                      id: opt.id,
                      text: htmlToCleanText(opt.text, 400),
                    }
                  : {
                      label,
                      id: opt.id,
                      text: htmlToCleanText(opt.text, 400),
                      isCorrect: opt.isCorrect,
                    };
              })
            : undefined;

        const baseItem: GetQuizContentQuestionItem = {
          questionId: question.id,
          displayNumber,
          questionType: question.question_type,
          questionText: htmlToCleanText(question.question_text, 800),
          points: question.points,
          ...(safeOptions ? { options: safeOptions } : {}),
          ...(question.bloom_level ? { bloomLevel: question.bloom_level } : {}),
        };

        if (includeAttemptData && answer) {
          const selectedIds = parseStringArray(answer.selected_option_ids);
          if (selectedIds.length > 0) {
            baseItem.studentSelectedLabels = selectedIds.map(
              (id) => labelByOptId.get(id) ?? id,
            );
          }
          if (answer.text_answer) {
            baseItem.studentTextAnswer = htmlToCleanText(
              answer.text_answer,
              800,
            );
          }
          if (answer.is_flagged) {
            baseItem.isFlagged = true;
          }
        }

        // Chỉ bổ sung đáp án, lời giải và kết quả chấm khi KHÔNG bị Exam Integrity Guard
        if (!examIntegrityEnforced) {
          if (question.sample_answer) {
            baseItem.sampleAnswer = htmlToCleanText(
              question.sample_answer,
              800,
            );
          }
          const criteria = parseGradingCriteria(question.grading_criteria);
          if (criteria.length > 0) {
            baseItem.gradingCriteria = criteria;
          }
          if (question.explanation) {
            baseItem.explanation = htmlToCleanText(question.explanation, 800);
          }

          if (includeAttemptData && answer) {
            baseItem.evaluationStatus = answer.evaluation_status;
            baseItem.pointsEarned = answer.points_earned;
            const matched = parseStringArray(answer.matched_points);
            const missing = parseStringArray(answer.missing_points);
            if (matched.length > 0) baseItem.matchedPoints = matched;
            if (missing.length > 0) baseItem.missingPoints = missing;
            if (answer.ai_feedback) {
              baseItem.aiFeedback = htmlToCleanText(answer.ai_feedback, 800);
            }
          }
        }

        return baseItem;
      },
    );

    const hasMore = safeOffset + mappedQuestions.length < filteredEntries.length;

    return {
      found: true,
      quizId: resolvedQuiz.id,
      quizTitle: resolvedQuiz.title,
      ...(attemptRecord
        ? {
            attemptId: attemptRecord.id,
            attemptStatus: attemptRecord.status,
            attemptMode: attemptConfig?.mode,
          }
        : {}),
      examIntegrityEnforced,
      ...(!examIntegrityEnforced && attemptRecord
        ? {
            score: attemptRecord.score,
            maxScore: attemptRecord.max_score,
          }
        : {}),
      totalQuestions: orderedQuestions.length,
      filteredCount: filteredEntries.length,
      returnedCount: mappedQuestions.length,
      offset: safeOffset,
      hasMore,
      ...(hasMore ? { nextOffset: safeOffset + mappedQuestions.length } : {}),
      questions: mappedQuestions,
    };
  }

  /* ==========================================================
   * 3. getDeckCards (Phân trang + hideFlashcardAnswerGuard)
   * ========================================================== */
  async readDeckCards(
    ctx: WorkspaceL2ReadContext,
    input: GetDeckCardsToolInput,
  ): Promise<GetDeckCardsToolOutput> {
    if (!this.deckFlashcardRepo) {
      return {
        found: false,
        totalCards: 0,
        dueCount: 0,
        filteredCount: 0,
        returnedCount: 0,
        offset: 0,
        hasMore: false,
        cards: [],
        message: 'Dịch vụ Flashcard hiện chưa sẵn sàng.',
      };
    }

    const requestedDeckId =
      input.deckId?.trim() ||
      (!input.cardId?.trim()
        ? ctx.workspaceContext?.flashcardView?.activeDeck?.deckId
        : undefined);
    const requestedCardId = input.cardId?.trim();

    if (!requestedDeckId && !requestedCardId) {
      return {
        found: false,
        totalCards: 0,
        dueCount: 0,
        filteredCount: 0,
        returnedCount: 0,
        offset: 0,
        hasMore: false,
        cards: [],
        message:
          'Vui lòng cung cấp deckId hoặc cardId (hoặc mở bộ thẻ Flashcard cần xem).',
      };
    }

    if (
      (requestedDeckId && !isUuid(requestedDeckId)) ||
      (requestedCardId && !isUuid(requestedCardId))
    ) {
      return {
        found: false,
        totalCards: 0,
        dueCount: 0,
        filteredCount: 0,
        returnedCount: 0,
        offset: 0,
        hasMore: false,
        cards: [],
        message: 'Mã bộ thẻ (deckId) hoặc mã thẻ (cardId) không hợp lệ.',
      };
    }

    const hideGuardActive = Boolean(
      ctx.workspaceContext?.guards.hideFlashcardAnswerGuard,
    );
    const hiddenCardId = hideGuardActive
      ? ctx.workspaceContext?.flashcardView?.studyState?.currentCardId
      : undefined;
    const shouldRedactHiddenCard = Boolean(
      hiddenCardId && input.allowRevealCurrentCard !== true,
    );

    const safeOffset = Math.max(0, Math.floor(input.offset ?? 0));
    const safeLimit = Math.min(25, Math.max(1, Math.floor(input.limit ?? 15)));

    const result = await this.deckFlashcardRepo.getDeckCardsPaginated({
      deckId: requestedDeckId,
      cardId: requestedCardId,
      userId: ctx.userId,
      stateFilter: input.stateFilter ?? 'all',
      searchKeyword: input.searchKeyword?.trim() || undefined,
      excludeBackTextForCardId: shouldRedactHiddenCard
        ? hiddenCardId
        : undefined,
      offset: safeOffset,
      limit: safeLimit,
    });

    if (!result) {
      return {
        found: false,
        totalCards: 0,
        dueCount: 0,
        filteredCount: 0,
        returnedCount: 0,
        offset: safeOffset,
        hasMore: false,
        cards: [],
        message:
          'Không tìm thấy bộ thẻ Flashcard hoặc bạn không có quyền truy cập.',
      };
    }

    const cards = result.cards.map((card) => {
      const isHiddenTarget = Boolean(
        shouldRedactHiddenCard && card.id === hiddenCardId,
      );
      const isRevealedOnRequest = Boolean(
        hideGuardActive &&
          card.id === hiddenCardId &&
          input.allowRevealCurrentCard === true,
      );

      return {
        cardId: card.id,
        cardType: card.card_type,
        state: card.state,
        dueDate: toIsoString(card.due_date),
        intervalDays: card.interval,
        frontText: htmlToCleanText(card.front_text, 500),
        backText: isHiddenTarget
          ? '[ANSWER_HIDDEN_BY_STUDY_GUARD]'
          : htmlToCleanText(card.back_text, 500),
        answerHidden: isHiddenTarget,
        ...(isRevealedOnRequest ? { answerRevealedOnRequest: true } : {}),
      };
    });

    const hasMore = safeOffset + cards.length < result.filteredCount;

    return {
      found: true,
      deckId: result.deck.id,
      deckName: result.deck.name,
      deckDescription: result.deck.description,
      totalCards: result.totalCards,
      dueCount: result.dueCount,
      filteredCount: result.filteredCount,
      returnedCount: cards.length,
      offset: safeOffset,
      hasMore,
      ...(hasMore ? { nextOffset: safeOffset + cards.length } : {}),
      cards,
    };
  }

  /* ==========================================================
   * 4. searchWorkspaceResources (Tìm kiếm hợp nhất KB5)
   * ========================================================== */
  async searchWorkspaceResources(
    ctx: WorkspaceL2ReadContext,
    input: SearchWorkspaceResourcesToolInput,
  ): Promise<SearchWorkspaceResourcesToolOutput> {
    const scope = input.scope ?? 'conversation';
    const query = input.query?.trim() || undefined;
    const limitPerType = Math.min(
      10,
      Math.max(1, Math.floor(input.limitPerType ?? 5)),
    );
    const requestedTypes: WorkspaceSearchResourceType[] =
      Array.isArray(input.resourceTypes) && input.resourceTypes.length > 0
        ? [...new Set(input.resourceTypes)]
        : ['document', 'note', 'deck', 'quiz'];

    let resolvedSubjectId =
      ctx.subjectId ?? ctx.workspaceContext?.location.subjectId;
    if (scope === 'subject' && !resolvedSubjectId && this.conversationsRepo) {
      const conv = await this.conversationsRepo
        .getConversationById(ctx.conversationId, ctx.userId)
        .catch(() => null);
      resolvedSubjectId = conv?.subject_id ?? undefined;
    }

    const conversationFilter =
      scope === 'conversation' ? ctx.conversationId : undefined;
    const subjectFilter = scope === 'subject' ? resolvedSubjectId : undefined;

    const want = new Set(requestedTypes);

    const [docs, notes, decks, quizzes, conversations] = await Promise.all([
      want.has('document') && this.documentsRepo
        ? this.documentsRepo
            .searchDocumentsForUser({
              userId: ctx.userId,
              conversationId: conversationFilter,
              subjectId: subjectFilter,
              query,
              limit: limitPerType,
            })
            .catch((err) => {
              this.logger.warn(
                `[WorkspaceL2Read] searchDocumentsForUser failed: ${err?.message}`,
              );
              return [];
            })
        : Promise.resolve([]),
      want.has('note') && this.summariesRepo
        ? this.summariesRepo
            .searchSummariesForUser({
              userId: ctx.userId,
              conversationId: conversationFilter,
              subjectId: subjectFilter,
              query,
              limit: limitPerType,
            })
            .catch((err) => {
              this.logger.warn(
                `[WorkspaceL2Read] searchSummariesForUser failed: ${err?.message}`,
              );
              return [];
            })
        : Promise.resolve([]),
      want.has('deck') && this.deckFlashcardRepo
        ? this.deckFlashcardRepo
            .searchDecksForUser({
              userId: ctx.userId,
              conversationId: conversationFilter,
              subjectId: subjectFilter,
              query,
              limit: limitPerType,
            })
            .catch((err) => {
              this.logger.warn(
                `[WorkspaceL2Read] searchDecksForUser failed: ${err?.message}`,
              );
              return [];
            })
        : Promise.resolve([]),
      want.has('quiz') && this.quizRepo
        ? this.quizRepo
            .searchQuizzesForUser({
              userId: ctx.userId,
              conversationId: conversationFilter,
              subjectId: subjectFilter,
              query,
              limit: limitPerType,
            })
            .catch((err) => {
              this.logger.warn(
                `[WorkspaceL2Read] searchQuizzesForUser failed: ${err?.message}`,
              );
              return [];
            })
        : Promise.resolve([]),
      want.has('conversation') && this.conversationsRepo
        ? this.conversationsRepo
            .searchConversationsForUser({
              userId: ctx.userId,
              subjectId: scope === 'subject' ? resolvedSubjectId : undefined,
              query,
              limit: limitPerType,
            })
            .catch((err) => {
              this.logger.warn(
                `[WorkspaceL2Read] searchConversationsForUser failed: ${err?.message}`,
              );
              return [];
            })
        : Promise.resolve([]),
    ]);

    const items: WorkspaceResourceSearchItem[] = [];

    for (const d of docs) {
      items.push({
        id: d.id,
        type: 'document',
        title: d.file_name,
        conversationId: d.conversation_id,
        conversationTitle: d.conversation?.title,
        subjectName: d.conversation?.subject?.name,
        updatedAt: toIsoString(d.uploaded_at),
        meta: [
          d.page_count ? `${d.page_count} trang` : null,
          `OCR:${d.ocr_status}`,
          `Embed:${d.embed_status}`,
        ]
          .filter(Boolean)
          .join(' · '),
      });
    }

    for (const n of notes) {
      items.push({
        id: n.id,
        type: 'note',
        title: n.title?.trim() || 'Ghi chú chưa đặt tên',
        conversationId: n.conversation_id,
        conversationTitle: n.conversation?.title,
        subjectName: n.conversation?.subject?.name,
        updatedAt: toIsoString(n.updated_at),
        meta: n.document?.file_name
          ? `Nguồn: ${n.document.file_name}`
          : undefined,
      });
    }

    for (const deck of decks) {
      items.push({
        id: deck.id,
        type: 'deck',
        title: deck.name,
        conversationId: deck.conversation_id,
        conversationTitle: deck.conversation?.title,
        subjectName: deck.conversation?.subject?.name,
        updatedAt: toIsoString(deck.updated_at),
        meta: `${deck._count?.flashcards ?? 0} thẻ`,
      });
    }

    for (const q of quizzes) {
      items.push({
        id: q.id,
        type: 'quiz',
        title: q.title,
        conversationId: q.conversation_id,
        conversationTitle: q.conversation?.title,
        subjectName: q.conversation?.subject?.name,
        updatedAt: toIsoString(q.updated_at),
        meta: `${q._count?.questions ?? 0} câu · ${q._count?.attempts ?? 0} lượt làm`,
      });
    }

    for (const c of conversations) {
      items.push({
        id: c.id,
        type: 'conversation',
        title: c.title,
        conversationId: c.id,
        subjectName: c.subject?.name,
        updatedAt: toIsoString(c.updated_at),
        meta: `${c._count?.documents ?? 0} tài liệu · ${c._count?.summaries ?? 0} ghi chú · ${c._count?.flashcard_decks ?? 0} deck · ${c._count?.quizzes ?? 0} quiz`,
      });
    }

    return {
      scope,
      ...(query ? { query } : {}),
      totalResults: items.length,
      items,
      ...(items.length === 0
        ? {
            message: query
              ? `Không tìm thấy tài nguyên nào khớp "${query}" trong phạm vi "${scope}".`
              : `Chưa có tài nguyên nào trong phạm vi "${scope}".`,
          }
        : {}),
    };
  }
}
