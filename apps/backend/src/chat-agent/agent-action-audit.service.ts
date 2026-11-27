import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  CardStateEnum,
  CardTypeEnum,
  Prisma,
  QuestionTypeEnum,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { UsersService } from '../users/users.service.js';
import type { ToolRiskTier } from '../ai/utils/risk-gate.helper.js';
import type {
  WorkspaceActionEvent,
  WorkspaceSyncEvent,
} from './workspace-sync.types.js';

export type AuditResourceType =
  | 'note'
  | 'deck'
  | 'flashcard'
  | 'quiz'
  | 'document'
  | 'preferences';

export interface RecordAgentActionInput {
  userId: string;
  conversationId?: string | null;
  chatSessionId?: string | null;
  toolCallId?: string | null;
  toolName: string;
  actionName: string;
  riskTier: Exclude<ToolRiskTier, 'tier_0'>;
  resourceType: AuditResourceType;
  resourceIds: string[];
  summaryText: string;
  beforeState?: unknown;
  afterState?: unknown;
  undoable?: boolean;
}

export interface AgentActionLogItem {
  id: string;
  toolName: string;
  actionName: string;
  riskTier: 'tier_1' | 'tier_2';
  status: 'executed' | 'undone' | 'denied' | 'failed';
  resourceType: string;
  resourceIds: string[];
  summaryText: string;
  undoable: boolean;
  undoneAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface UndoActionResult {
  ok: boolean;
  alreadyUndone?: boolean;
  actionLogId: string;
  resourceType: string;
  resourceIds: string[];
  conversationId: string | null;
  message: string;
  syncEvents: WorkspaceSyncEvent[];
  workspaceActions: WorkspaceActionEvent[];
}

const DEFAULT_UNDO_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày

@Injectable()
export class AgentActionAuditService {
  private readonly logger = new Logger(AgentActionAuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly documentsService?: DocumentsService,
    @Optional() private readonly usersService?: UsersService,
  ) {}

  async recordAction(input: RecordAgentActionInput): Promise<{ id: string }> {
    const expiresAt = new Date(Date.now() + DEFAULT_UNDO_TTL_MS);
    const created = await this.prisma.agentActionLog.create({
      data: {
        user_id: input.userId,
        conversation_id: input.conversationId ?? null,
        chat_session_id: input.chatSessionId ?? null,
        tool_call_id: input.toolCallId ?? null,
        tool_name: input.toolName.slice(0, 80),
        action_name: input.actionName.slice(0, 80),
        risk_tier: input.riskTier,
        status: 'executed',
        resource_type: input.resourceType.slice(0, 40),
        resource_ids: input.resourceIds,
        summary_text: input.summaryText.slice(0, 500),
        before_state:
          input.beforeState !== undefined
            ? (input.beforeState as Prisma.InputJsonValue)
            : Prisma.DbNull,
        after_state:
          input.afterState !== undefined
            ? (input.afterState as Prisma.InputJsonValue)
            : Prisma.DbNull,
        undoable: input.undoable ?? true,
        expires_at: expiresAt,
      },
      select: { id: true },
    });

    return { id: created.id };
  }

  async listRecentActions(
    userId: string,
    conversationId?: string,
    limit = 20,
  ): Promise<AgentActionLogItem[]> {
    const safeLimit = Math.min(Math.max(1, limit), 50);
    const rows = await this.prisma.agentActionLog.findMany({
      where: {
        user_id: userId,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: safeLimit,
    });

    const now = Date.now();
    return rows.map((row) => ({
      id: row.id,
      toolName: row.tool_name,
      actionName: row.action_name,
      riskTier: row.risk_tier,
      status: row.status,
      resourceType: row.resource_type,
      resourceIds: row.resource_ids,
      summaryText: row.summary_text,
      undoable:
        row.undoable &&
        row.status === 'executed' &&
        row.expires_at.getTime() > now,
      undoneAt: row.undone_at ? row.undone_at.toISOString() : null,
      expiresAt: row.expires_at.toISOString(),
      createdAt: row.created_at.toISOString(),
    }));
  }

  async undoLatestActionInConversation(
    userId: string,
    conversationId: string,
  ): Promise<UndoActionResult> {
    const latest = await this.prisma.agentActionLog.findFirst({
      where: {
        user_id: userId,
        conversation_id: conversationId,
        status: 'executed',
        undoable: true,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });

    if (!latest) {
      throw new NotFoundException(
        'Không có thao tác AI nào gần đây còn khả năng hoàn tác trong phiên học này',
      );
    }

    return this.undoAction(userId, latest.id);
  }

  async undoAction(
    userId: string,
    actionLogId: string,
  ): Promise<UndoActionResult> {
    const log = await this.prisma.agentActionLog.findUnique({
      where: { id: actionLogId },
    });

    if (!log) {
      throw new NotFoundException('Không tìm thấy nhật ký hành động cần hoàn tác');
    }

    if (log.user_id !== userId) {
      throw new ForbiddenException('Bạn không có quyền hoàn tác hành động này');
    }

    if (log.status === 'undone') {
      return {
        ok: true,
        alreadyUndone: true,
        actionLogId: log.id,
        resourceType: log.resource_type,
        resourceIds: log.resource_ids,
        conversationId: log.conversation_id,
        message: 'Thao tác này đã được hoàn tác trước đó.',
        syncEvents: [],
        workspaceActions: [],
      };
    }

    if (!log.undoable || log.status !== 'executed') {
      throw new BadRequestException('Hành động này không hỗ trợ hoàn tác');
    }

    if (log.expires_at.getTime() <= Date.now()) {
      throw new BadRequestException(
        'Thời hạn hoàn tác cho hành động này đã hết (quá 7 ngày)',
      );
    }

    const nowIso = new Date().toISOString();
    const syncEvents: WorkspaceSyncEvent[] = [];
    const workspaceActions: WorkspaceActionEvent[] = [];
    const convId = log.conversation_id ?? '';
    const before = (log.before_state ?? {}) as Record<string, any>;
    const after = (log.after_state ?? {}) as Record<string, any>;

    if (log.resource_type === 'document') {
      await this.restoreDocumentUndo({
        userId,
        actionName: log.action_name,
        resourceIds: log.resource_ids,
        conversationId: convId,
        before,
        after,
        nowIso,
        syncEvents,
      });
    } else if (log.resource_type === 'preferences') {
      await this.restorePreferencesUndo({
        userId,
        conversationId: convId,
        before,
        nowIso,
        syncEvents,
        workspaceActions,
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
        if (log.resource_type === 'note') {
          await this.restoreNoteInTx(tx, {
            actionName: log.action_name,
            conversationId: convId,
            before,
            after,
            nowIso,
            syncEvents,
          });
        } else if (log.resource_type === 'deck') {
          await this.restoreDeckInTx(tx, {
            userId,
            actionName: log.action_name,
            conversationId: convId,
            before,
            after,
            nowIso,
            syncEvents,
          });
        } else if (log.resource_type === 'flashcard') {
          await this.restoreFlashcardInTx(tx, {
            actionName: log.action_name,
            conversationId: convId,
            before,
            after,
            nowIso,
            syncEvents,
          });
        } else if (log.resource_type === 'quiz') {
          await this.restoreQuizInTx(tx, {
            userId,
            actionName: log.action_name,
            conversationId: convId,
            before,
            after,
            nowIso,
            syncEvents,
          });
        }

        await tx.agentActionLog.update({
          where: { id: log.id },
          data: {
            status: 'undone',
            undoable: false,
            undone_at: new Date(),
          },
        });
      });

      this.logger.log(
        `[Undo] User=${userId} hoàn tác thành công action=${log.id} (${log.tool_name}.${log.action_name})`,
      );

      return {
        ok: true,
        actionLogId: log.id,
        resourceType: log.resource_type,
        resourceIds: log.resource_ids,
        conversationId: log.conversation_id,
        message: `Đã hoàn tác: ${log.summary_text}`,
        syncEvents,
        workspaceActions,
      };
    }

    await this.prisma.agentActionLog.update({
      where: { id: log.id },
      data: {
        status: 'undone',
        undoable: false,
        undone_at: new Date(),
      },
    });

    this.logger.log(
      `[Undo] User=${userId} hoàn tác thành công action=${log.id} (${log.tool_name}.${log.action_name})`,
    );

    return {
      ok: true,
      actionLogId: log.id,
      resourceType: log.resource_type,
      resourceIds: log.resource_ids,
      conversationId: log.conversation_id,
      message: `Đã hoàn tác: ${log.summary_text}`,
      syncEvents,
      workspaceActions,
    };
  }

  private async restoreNoteInTx(
    tx: Prisma.TransactionClient,
    params: {
      actionName: string;
      conversationId: string;
      before: Record<string, any>;
      after: Record<string, any>;
      nowIso: string;
      syncEvents: WorkspaceSyncEvent[];
    },
  ): Promise<void> {
    const { actionName, conversationId, before, after, nowIso, syncEvents } =
      params;

    if (
      actionName === 'create_manual' ||
      actionName === 'convert_markdown_to_note'
    ) {
      const createdId = after.summaryId as string | undefined;
      if (createdId) {
        await tx.summary.deleteMany({ where: { id: createdId } });
        syncEvents.push({
          resource: 'summary',
          action: 'deleted',
          conversationId,
          entityId: createdId,
          occurredAt: nowIso,
        });
      }
      return;
    }

    if (actionName === 'delete_note') {
      const note = before.note as Record<string, any> | undefined;
      if (note?.id && note?.conversation_id) {
        await tx.summary.create({
          data: {
            id: note.id,
            conversation_id: note.conversation_id,
            document_id: note.document_id ?? null,
            title: String(note.title ?? ''),
            content_json: (note.content_json ?? []) as Prisma.InputJsonValue,
            pdf_storage_key: note.pdf_storage_key ?? null,
          },
        });
        syncEvents.push({
          resource: 'summary',
          action: 'created',
          conversationId: note.conversation_id,
          entityId: note.id,
          title: String(note.title ?? ''),
          occurredAt: nowIso,
        });
      }
      return;
    }

    const notesList: Array<Record<string, any>> = Array.isArray(before.notes)
      ? before.notes
      : before.note
        ? [before.note]
        : [];

    for (const item of notesList) {
      if (!item?.id) continue;
      await tx.summary.updateMany({
        where: { id: item.id },
        data: {
          ...(item.title !== undefined ? { title: String(item.title) } : {}),
          ...(item.content_json !== undefined
            ? { content_json: item.content_json as Prisma.InputJsonValue }
            : {}),
          pdf_storage_key: null,
        },
      });
      syncEvents.push({
        resource: 'summary',
        action: 'updated',
        conversationId: item.conversation_id ?? conversationId,
        entityId: item.id,
        title: typeof item.title === 'string' ? item.title : undefined,
        occurredAt: nowIso,
      });
    }
  }

  private async restoreDeckInTx(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      actionName: string;
      conversationId: string;
      before: Record<string, any>;
      after: Record<string, any>;
      nowIso: string;
      syncEvents: WorkspaceSyncEvent[];
    },
  ): Promise<void> {
    const {
      userId,
      actionName,
      conversationId,
      before,
      after,
      nowIso,
      syncEvents,
    } = params;

    if (actionName === 'create_deck') {
      const deckId = after.deckId as string | undefined;
      if (deckId) {
        await tx.flashcardDeck.deleteMany({
          where: { id: deckId, user_id: userId },
        });
        syncEvents.push({
          resource: 'flashcard',
          action: 'deleted',
          conversationId,
          entityId: deckId,
          targetKind: 'deck',
          occurredAt: nowIso,
        });
      }
      return;
    }

    if (actionName === 'rename_deck') {
      const deck = before.deck as Record<string, any> | undefined;
      if (deck?.id) {
        await tx.flashcardDeck.updateMany({
          where: { id: deck.id, user_id: userId },
          data: {
            name: String(deck.name ?? ''),
            description: deck.description ?? null,
          },
        });
        syncEvents.push({
          resource: 'flashcard',
          action: 'updated',
          conversationId: deck.conversation_id ?? conversationId,
          entityId: deck.id,
          targetKind: 'deck',
          title: String(deck.name ?? ''),
          occurredAt: nowIso,
        });
      }
      return;
    }

    if (actionName === 'delete_deck') {
      const deck = before.deck as Record<string, any> | undefined;
      const cards: Array<Record<string, any>> = Array.isArray(before.cards)
        ? before.cards
        : [];
      if (deck?.id && deck?.conversation_id) {
        await tx.flashcardDeck.create({
          data: {
            id: deck.id,
            conversation_id: deck.conversation_id,
            user_id: userId,
            name: String(deck.name ?? 'Bộ thẻ đã khôi phục'),
            description: deck.description ?? null,
          },
        });
        if (cards.length > 0) {
          await tx.flashcard.createMany({
            data: cards.map((c) => ({
              id: c.id,
              deck_id: deck.id,
              card_type: (c.card_type as CardTypeEnum) ?? CardTypeEnum.basic,
              front_text: String(c.front_text ?? ''),
              back_text: String(c.back_text ?? ''),
              image_url: c.image_url ?? null,
              audio_url: c.audio_url ?? null,
              source_refs: c.source_refs ?? Prisma.DbNull,
              state: (c.state as CardStateEnum) ?? CardStateEnum.new,
              step_index: Number(c.step_index ?? 0),
              interval: Number(c.interval ?? 0),
              ease_factor: Number(c.ease_factor ?? 2.5),
              due_date: c.due_date ? new Date(c.due_date) : new Date(),
              last_reviewed_at: c.last_reviewed_at
                ? new Date(c.last_reviewed_at)
                : null,
            })),
          });
        }
        syncEvents.push({
          resource: 'flashcard',
          action: 'created',
          conversationId: deck.conversation_id,
          entityId: deck.id,
          targetKind: 'deck',
          title: String(deck.name ?? ''),
          count: cards.length,
          occurredAt: nowIso,
        });
      }
    }
  }

  private async restoreFlashcardInTx(
    tx: Prisma.TransactionClient,
    params: {
      actionName: string;
      conversationId: string;
      before: Record<string, any>;
      after: Record<string, any>;
      nowIso: string;
      syncEvents: WorkspaceSyncEvent[];
    },
  ): Promise<void> {
    const { actionName, conversationId, before, after, nowIso, syncEvents } =
      params;

    if (actionName === 'add_cards') {
      const cardIds = Array.isArray(after.cardIds)
        ? (after.cardIds as string[])
        : [];
      const deckId = (after.deckId as string) ?? '';
      if (cardIds.length > 0) {
        await tx.flashcard.deleteMany({ where: { id: { in: cardIds } } });
      }
      if (deckId) {
        syncEvents.push({
          resource: 'flashcard',
          action: 'updated',
          conversationId,
          entityId: deckId,
          targetKind: 'deck',
          occurredAt: nowIso,
        });
      }
      return;
    }

    const cards: Array<Record<string, any>> = Array.isArray(before.cards)
      ? before.cards
      : before.card
        ? [before.card]
        : [];

    if (actionName === 'update_card' || actionName === 'move_cards') {
      const affectedDecks = new Set<string>();
      for (const c of cards) {
        if (!c?.id) continue;
        await tx.flashcard.updateMany({
          where: { id: c.id },
          data: {
            deck_id: c.deck_id,
            card_type: (c.card_type as CardTypeEnum) ?? CardTypeEnum.basic,
            front_text: String(c.front_text ?? ''),
            back_text: String(c.back_text ?? ''),
          },
        });
        if (typeof c.deck_id === 'string') affectedDecks.add(c.deck_id);
      }
      if (typeof after.targetDeckId === 'string') {
        affectedDecks.add(after.targetDeckId);
      }
      for (const deckId of affectedDecks) {
        syncEvents.push({
          resource: 'flashcard',
          action: 'updated',
          conversationId,
          entityId: deckId,
          targetKind: 'deck',
          occurredAt: nowIso,
        });
      }
      return;
    }

    if (actionName === 'delete_cards' || actionName === 'merge_duplicates') {
      const keeperCard = before.keeperCard as Record<string, any> | undefined;
      if (keeperCard?.id) {
        await tx.flashcard.updateMany({
          where: { id: keeperCard.id },
          data: {
            front_text: String(keeperCard.front_text ?? ''),
            back_text: String(keeperCard.back_text ?? ''),
            card_type:
              (keeperCard.card_type as CardTypeEnum) ?? CardTypeEnum.basic,
          },
        });
      }
      if (cards.length > 0) {
        await tx.flashcard.createMany({
          data: cards.map((c) => ({
            id: c.id,
            deck_id: c.deck_id,
            card_type: (c.card_type as CardTypeEnum) ?? CardTypeEnum.basic,
            front_text: String(c.front_text ?? ''),
            back_text: String(c.back_text ?? ''),
            image_url: c.image_url ?? null,
            audio_url: c.audio_url ?? null,
            source_refs: c.source_refs ?? Prisma.DbNull,
            state: (c.state as CardStateEnum) ?? CardStateEnum.new,
            step_index: Number(c.step_index ?? 0),
            interval: Number(c.interval ?? 0),
            ease_factor: Number(c.ease_factor ?? 2.5),
            due_date: c.due_date ? new Date(c.due_date) : new Date(),
            last_reviewed_at: c.last_reviewed_at
              ? new Date(c.last_reviewed_at)
              : null,
          })),
          skipDuplicates: true,
        });
      }
      const deckId = String(
        keeperCard?.deck_id ?? cards[0]?.deck_id ?? after.deckId ?? '',
      );
      if (deckId) {
        syncEvents.push({
          resource: 'flashcard',
          action: 'updated',
          conversationId,
          entityId: deckId,
          targetKind: 'deck',
          occurredAt: nowIso,
        });
      }
    }
  }

  private async restoreQuizInTx(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      actionName: string;
      conversationId: string;
      before: Record<string, any>;
      after: Record<string, any>;
      nowIso: string;
      syncEvents: WorkspaceSyncEvent[];
    },
  ): Promise<void> {
    const {
      userId,
      actionName,
      conversationId,
      before,
      after,
      nowIso,
      syncEvents,
    } = params;

    if (actionName === 'delete_quiz') {
      const quiz = before.quiz as Record<string, any> | undefined;
      const questions: Array<Record<string, any>> = Array.isArray(
        before.questions,
      )
        ? before.questions
        : [];
      if (quiz?.id && quiz?.conversation_id) {
        await tx.quiz.create({
          data: {
            id: quiz.id,
            conversation_id: quiz.conversation_id,
            user_id: userId,
            source_deck_id: quiz.source_deck_id ?? null,
            source: String(quiz.source ?? 'ai'),
            title: String(quiz.title ?? 'Đề kiểm tra đã khôi phục'),
            description: quiz.description ?? null,
            time_limit_sec: quiz.time_limit_sec ?? null,
          },
        });
        if (questions.length > 0) {
          await tx.quizQuestion.createMany({
            data: questions.map((q) => ({
              id: q.id,
              quiz_id: quiz.id,
              question_type:
                (q.question_type as QuestionTypeEnum) ??
                QuestionTypeEnum.single_choice,
              order_index: Number(q.order_index ?? 0),
              question_text: String(q.question_text ?? ''),
              image_url: q.image_url ?? null,
              audio_url: q.audio_url ?? null,
              points: Number(q.points ?? 1),
              options: q.options ?? Prisma.DbNull,
              sample_answer: q.sample_answer ?? null,
              grading_criteria: q.grading_criteria ?? [],
              explanation: q.explanation ?? null,
              bloom_level: q.bloom_level ?? null,
              source_refs: q.source_refs ?? Prisma.DbNull,
            })),
          });
        }
        syncEvents.push({
          resource: 'quiz',
          action: 'created',
          conversationId: quiz.conversation_id,
          entityId: quiz.id,
          title: String(quiz.title ?? ''),
          count: questions.length,
          occurredAt: nowIso,
        });
      }
      return;
    }

    if (actionName === 'update_metadata') {
      const quiz = before.quiz as Record<string, any> | undefined;
      if (quiz?.id) {
        await tx.quiz.updateMany({
          where: { id: quiz.id, user_id: userId },
          data: {
            title: String(quiz.title ?? ''),
            description: quiz.description ?? null,
            time_limit_sec: quiz.time_limit_sec ?? null,
          },
        });
        syncEvents.push({
          resource: 'quiz',
          action: 'updated',
          conversationId: quiz.conversation_id ?? conversationId,
          entityId: quiz.id,
          occurredAt: nowIso,
        });
      }
      return;
    }

    if (actionName === 'add_question') {
      const quizId = String(after.quizId ?? '');
      const questionId = after.questionId as string | undefined;
      if (questionId) {
        await tx.quizQuestion.deleteMany({ where: { id: questionId } });
      }
      if (quizId) {
        syncEvents.push({
          resource: 'quiz',
          action: 'updated',
          conversationId,
          entityId: quizId,
          occurredAt: nowIso,
        });
      }
      return;
    }

    const questions: Array<Record<string, any>> = Array.isArray(before.questions)
      ? before.questions
      : before.question
        ? [before.question]
        : [];
    const quizId = String(before.quizId ?? questions[0]?.quiz_id ?? '');

    if (actionName === 'delete_questions') {
      if (questions.length > 0) {
        await tx.quizQuestion.createMany({
          data: questions.map((q) => ({
            id: q.id,
            quiz_id: q.quiz_id,
            question_type:
              (q.question_type as QuestionTypeEnum) ??
              QuestionTypeEnum.single_choice,
            order_index: Number(q.order_index ?? 0),
            question_text: String(q.question_text ?? ''),
            image_url: q.image_url ?? null,
            audio_url: q.audio_url ?? null,
            points: Number(q.points ?? 1),
            options: q.options ?? Prisma.DbNull,
            sample_answer: q.sample_answer ?? null,
            grading_criteria: q.grading_criteria ?? [],
            explanation: q.explanation ?? null,
            bloom_level: q.bloom_level ?? null,
            source_refs: q.source_refs ?? Prisma.DbNull,
          })),
          skipDuplicates: true,
        });
      }
    } else {
      for (const q of questions) {
        if (!q?.id) continue;
        await tx.quizQuestion.updateMany({
          where: { id: q.id },
          data: {
            question_type:
              (q.question_type as QuestionTypeEnum) ??
              QuestionTypeEnum.single_choice,
            order_index: Number(q.order_index ?? 0),
            question_text: String(q.question_text ?? ''),
            points: Number(q.points ?? 1),
            options: q.options ?? Prisma.DbNull,
            sample_answer: q.sample_answer ?? null,
            grading_criteria: q.grading_criteria ?? [],
            explanation: q.explanation ?? null,
            bloom_level: q.bloom_level ?? null,
          },
        });
      }
    }

    if (quizId) {
      syncEvents.push({
        resource: 'quiz',
        action: 'updated',
        conversationId,
        entityId: quizId,
        occurredAt: nowIso,
      });
    }
  }

  private async restoreDocumentUndo(params: {
    userId: string;
    actionName: string;
    resourceIds: string[];
    conversationId: string;
    before: Record<string, any>;
    after: Record<string, any>;
    nowIso: string;
    syncEvents: WorkspaceSyncEvent[];
  }): Promise<void> {
    const {
      userId,
      actionName,
      resourceIds,
      conversationId,
      before,
      after,
      nowIso,
      syncEvents,
    } = params;

    if (
      actionName === 'save_as_new_document' ||
      actionName === 'convert_note_to_markdown'
    ) {
      const createdDocId = String(after.documentId ?? resourceIds[0] ?? '');
      if (createdDocId && this.documentsService) {
        await this.documentsService.deleteDocument(userId, createdDocId);
        syncEvents.push({
          resource: 'document',
          action: 'deleted',
          conversationId,
          entityId: createdDocId,
          occurredAt: nowIso,
        });
      }
      return;
    }

    if (actionName === 'update_content') {
      const documentId = String(before.documentId ?? resourceIds[0] ?? '');
      const previousContent = before.content;
      if (
        documentId &&
        typeof previousContent === 'string' &&
        this.documentsService
      ) {
        const current = await this.documentsService.getDocumentContent(
          userId,
          documentId,
        );
        const updated = await this.documentsService.updateDocumentContent(
          userId,
          documentId,
          {
            content: previousContent,
            expectedVersion: current.version,
          },
        );
        syncEvents.push({
          resource: 'document',
          action: 'updated',
          conversationId,
          entityId: documentId,
          title: current.fileName,
          version: updated.version,
          occurredAt: nowIso,
        });
      }
    }
  }

  private async restorePreferencesUndo(params: {
    userId: string;
    conversationId: string;
    before: Record<string, any>;
    nowIso: string;
    syncEvents: WorkspaceSyncEvent[];
    workspaceActions: WorkspaceActionEvent[];
  }): Promise<void> {
    const {
      userId,
      conversationId,
      before,
      nowIso,
      syncEvents,
      workspaceActions,
    } = params;
    const prevPreferences = before.preferences as
      | Record<string, unknown>
      | undefined;
    const prevDailyGoal =
      typeof before.dailyGoalMinutes === 'number'
        ? before.dailyGoalMinutes
        : undefined;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(prevPreferences !== undefined
          ? { preferences: prevPreferences as Prisma.InputJsonValue }
          : {}),
        ...(prevDailyGoal !== undefined
          ? { daily_goal_minutes: prevDailyGoal }
          : {}),
      },
    });

    const prevTheme =
      prevPreferences?.theme === 'light' ||
      prevPreferences?.theme === 'dark' ||
      prevPreferences?.theme === 'system'
        ? prevPreferences.theme
        : undefined;
    const prevLang =
      prevPreferences?.aiResponseLanguage === 'vi' ||
      prevPreferences?.aiResponseLanguage === 'en' ||
      prevPreferences?.aiResponseLanguage === 'auto'
        ? prevPreferences.aiResponseLanguage
        : undefined;

    if (prevTheme) {
      workspaceActions.push({
        type: 'theme_changed',
        theme: prevTheme,
        occurredAt: nowIso,
      });
    }

    syncEvents.push({
      resource: 'preferences',
      action: 'updated',
      conversationId,
      entityId: userId,
      ...(prevTheme ? { theme: prevTheme } : {}),
      ...(prevLang ? { aiResponseLanguage: prevLang } : {}),
      occurredAt: nowIso,
    });
  }
}
