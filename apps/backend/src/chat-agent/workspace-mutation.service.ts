import { Injectable, Logger, Optional } from '@nestjs/common';
import { CardTypeEnum, Prisma, QuestionTypeEnum } from '../generated/prisma/client.js';
import {
  parseMarkdownToBlockNoteBlocks,
  replaceOrAppendNoteSection,
  serializeBlockNoteToMarkdown,
} from '../common/utils/blocknote-markdown.helper.js';
import {
  buildUnifiedTextDiffPreview,
  evaluateToolRiskTier,
} from '../ai/utils/risk-gate.helper.js';
import type { ResolvedWorkspaceContext } from '../ai/prompts/workspace-context.types.js';
import type {
  ManageEditableDocumentToolInput,
  ManageEditableDocumentToolOutput,
  ManageFlashcardsToolInput,
  ManageFlashcardsToolOutput,
  ManageNotesToolInput,
  ManageNotesToolOutput,
  ManageQuizToolInput,
  ManageQuizToolOutput,
  ManageWorkspaceAndJobsToolInput,
  ManageWorkspaceAndJobsToolOutput,
} from '../ai/tools/types.js';
import { SummariesService } from '../summaries/summaries.service.js';
import { SummariesRepoService } from '../repo/summaries-repo/summaries-repo.service.js';
import { DeckService } from '../deck-flashcard/deck/deck.service.js';
import {
  FlashcardService,
  sanitizeFlashcardHtml,
} from '../deck-flashcard/flashcard/flashcard.service.js';
import { DeckFlashcardRepoService } from '../repo/deck-flashcard-repo/deck-flashcard-repo.service.js';
import { QuizRepoService, type QuestionCreatePayload } from '../repo/quiz-repo/quiz-repo.service.js';
import { QuizManageService } from '../quiz/quiz-manage.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { UsersService } from '../users/users.service.js';
import { normalizeUserPreferences } from '../users/user-preferences.types.js';
import { AgentActionAuditService } from './agent-action-audit.service.js';
import { AgentJobsQueueService } from './jobs/agent-jobs-queue.service.js';
import type { WorkspaceSyncNotifier } from './workspace-sync.types.js';

export interface WorkspaceMutationContext {
  userId: string;
  conversationId: string;
  chatSessionId?: string;
  subjectId?: string;
  workspaceContext?: ResolvedWorkspaceContext;
  syncNotifier?: WorkspaceSyncNotifier;
}

const MAX_EDITABLE_READ_CHARS = 12_000;

@Injectable()
export class WorkspaceMutationService {
  private readonly logger = new Logger(WorkspaceMutationService.name);

  constructor(
    private readonly auditService: AgentActionAuditService,
    @Optional() private readonly summariesService?: SummariesService,
    @Optional() private readonly summariesRepo?: SummariesRepoService,
    @Optional() private readonly deckService?: DeckService,
    @Optional() private readonly flashcardService?: FlashcardService,
    @Optional() private readonly deckRepo?: DeckFlashcardRepoService,
    @Optional() private readonly quizRepo?: QuizRepoService,
    @Optional() private readonly quizManageService?: QuizManageService,
    @Optional() private readonly documentsService?: DocumentsService,
    @Optional() private readonly usersService?: UsersService,
    @Optional() private readonly agentJobsQueue?: AgentJobsQueueService,
  ) {}

  async executeManageNotes(
    ctx: WorkspaceMutationContext,
    input: ManageNotesToolInput,
    toolCallId?: string,
  ): Promise<ManageNotesToolOutput> {
    const riskTier = evaluateToolRiskTier('manageNotes', input) === 'tier_2'
      ? 'tier_2'
      : 'tier_1';
    const nowIso = new Date().toISOString();

    if (!this.summariesService || !this.summariesRepo) {
      return {
        ok: false,
        action: input.action,
        riskTier,
        message: 'Dịch vụ quản lý Notes chưa sẵn sàng.',
      };
    }

    switch (input.action) {
      case 'create_manual': {
        const title = input.title?.trim() || 'Ghi chú học tập mới';
        const md = input.markdownContent?.trim() || '';
        const blocks = md ? parseMarkdownToBlockNoteBlocks(md) : [];
        const created = await this.summariesService.createManualNote(
          ctx.userId,
          ctx.conversationId,
          { title, content_json: blocks as any[] },
        );

        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageNotes',
          actionName: 'create_manual',
          riskTier,
          resourceType: 'note',
          resourceIds: [created.id],
          summaryText: `Tạo Note "${created.title}"`,
          beforeState: null,
          afterState: { summaryId: created.id },
        });

        ctx.syncNotifier?.emit({
          resource: 'summary',
          action: 'created',
          conversationId: ctx.conversationId,
          entityId: created.id,
          title: created.title,
          occurredAt: nowIso,
        });

        return {
          ok: true,
          action: 'create_manual',
          riskTier,
          summaryId: created.id,
          title: created.title,
          affectedIds: [created.id],
          actionLogId: log.id,
          undoable: true,
          message: `Đã tạo ghi chú "${created.title}".`,
        };
      }

      case 'rename': {
        if (!input.summaryId || !input.title?.trim()) {
          return {
            ok: false,
            action: 'rename',
            riskTier,
            message: 'Thiếu summaryId hoặc tiêu đề mới để đổi tên Note.',
          };
        }
        const existing = await this.summariesRepo.getSummaryByIdForUser(
          input.summaryId,
          ctx.userId,
        );
        if (!existing) {
          return {
            ok: false,
            action: 'rename',
            riskTier,
            message: 'Không tìm thấy Note được chỉ định.',
          };
        }
        const updated = await this.summariesService.updateSummary(
          ctx.userId,
          existing.id,
          { title: input.title.trim() },
        );
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: existing.conversation_id,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageNotes',
          actionName: 'rename',
          riskTier,
          resourceType: 'note',
          resourceIds: [existing.id],
          summaryText: `Đổi tên Note "${existing.title}" thành "${updated.title}"`,
          beforeState: {
            note: {
              id: existing.id,
              conversation_id: existing.conversation_id,
              title: existing.title,
            },
          },
          afterState: { summaryId: existing.id, title: updated.title },
        });
        ctx.syncNotifier?.emit({
          resource: 'summary',
          action: 'updated',
          conversationId: existing.conversation_id,
          entityId: existing.id,
          title: updated.title,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'rename',
          riskTier,
          summaryId: existing.id,
          title: updated.title,
          affectedIds: [existing.id],
          actionLogId: log.id,
          undoable: true,
          message: `Đã đổi tên ghi chú thành "${updated.title}".`,
        };
      }

      case 'append_section':
      case 'update_section': {
        if (!input.summaryId || !input.markdownContent?.trim()) {
          return {
            ok: false,
            action: input.action,
            riskTier,
            message:
              'Thiếu summaryId hoặc markdownContent để cập nhật nội dung Note.',
          };
        }
        const existing = await this.summariesRepo.getSummaryByIdForUser(
          input.summaryId,
          ctx.userId,
        );
        if (!existing) {
          return {
            ok: false,
            action: input.action,
            riskTier,
            message: 'Không tìm thấy Note được chỉ định.',
          };
        }
        const prevBlocks = Array.isArray(existing.content_json)
          ? existing.content_json
          : [];
        const patched = replaceOrAppendNoteSection(prevBlocks, {
          sectionHeading: input.sectionHeading,
          markdownContent: input.markdownContent,
          mode:
            input.action === 'append_section' ? 'append' : 'replace_section',
        });

        const updated = await this.summariesService.updateSummary(
          ctx.userId,
          existing.id,
          { content_json: patched.blocks as any[] },
        );

        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: existing.conversation_id,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageNotes',
          actionName: input.action,
          riskTier,
          resourceType: 'note',
          resourceIds: [existing.id],
          summaryText:
            input.action === 'append_section'
              ? `Bổ sung nội dung vào Note "${existing.title}"`
              : `Cập nhật mục "${patched.matchedHeading ?? input.sectionHeading ?? 'chính'}" trong Note "${existing.title}"`,
          beforeState: {
            note: {
              id: existing.id,
              conversation_id: existing.conversation_id,
              title: existing.title,
              content_json: prevBlocks,
            },
          },
          afterState: { summaryId: existing.id },
        });

        ctx.syncNotifier?.emit({
          resource: 'summary',
          action: 'updated',
          conversationId: existing.conversation_id,
          entityId: existing.id,
          title: updated.title,
          occurredAt: nowIso,
        });

        return {
          ok: true,
          action: input.action,
          riskTier,
          summaryId: existing.id,
          title: updated.title,
          affectedIds: [existing.id],
          actionLogId: log.id,
          undoable: true,
          message: `Đã cập nhật ghi chú "${updated.title}".`,
        };
      }

      case 'replace_content': {
        if (!input.summaryId || input.markdownContent === undefined) {
          return {
            ok: false,
            action: 'replace_content',
            riskTier,
            message: 'Thiếu summaryId hoặc markdownContent.',
          };
        }
        const existing = await this.summariesRepo.getSummaryByIdForUser(
          input.summaryId,
          ctx.userId,
        );
        if (!existing) {
          return {
            ok: false,
            action: 'replace_content',
            riskTier,
            message: 'Không tìm thấy Note được chỉ định.',
          };
        }
        const nextBlocks = parseMarkdownToBlockNoteBlocks(input.markdownContent);
        const updated = await this.summariesService.updateSummary(
          ctx.userId,
          existing.id,
          {
            ...(input.title?.trim() ? { title: input.title.trim() } : {}),
            content_json: nextBlocks as any[],
          },
        );
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: existing.conversation_id,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageNotes',
          actionName: 'replace_content',
          riskTier,
          resourceType: 'note',
          resourceIds: [existing.id],
          summaryText: `Thay thế toàn bộ nội dung Note "${existing.title}"`,
          beforeState: {
            note: {
              id: existing.id,
              conversation_id: existing.conversation_id,
              title: existing.title,
              content_json: existing.content_json,
            },
          },
          afterState: { summaryId: existing.id },
        });
        ctx.syncNotifier?.emit({
          resource: 'summary',
          action: 'updated',
          conversationId: existing.conversation_id,
          entityId: existing.id,
          title: updated.title,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'replace_content',
          riskTier,
          summaryId: existing.id,
          title: updated.title,
          affectedIds: [existing.id],
          actionLogId: log.id,
          undoable: true,
          message: `Đã viết lại ghi chú "${updated.title}".`,
        };
      }

      case 'refine_note': {
        if (!input.summaryId || !input.instruction?.trim()) {
          return {
            ok: false,
            action: 'refine_note',
            riskTier,
            message: 'Thiếu summaryId hoặc instruction để tinh chỉnh Note.',
          };
        }
        const existing = await this.summariesRepo.getSummaryByIdForUser(
          input.summaryId,
          ctx.userId,
        );
        if (!existing) {
          return {
            ok: false,
            action: 'refine_note',
            riskTier,
            message: 'Không tìm thấy Note được chỉ định.',
          };
        }
        const updated = await this.summariesService.refineSummary(
          ctx.userId,
          existing.id,
          { instruction: input.instruction.trim() },
        );
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: existing.conversation_id,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageNotes',
          actionName: 'refine_note',
          riskTier,
          resourceType: 'note',
          resourceIds: [existing.id],
          summaryText: `Tinh chỉnh Note "${existing.title}"`,
          beforeState: {
            note: {
              id: existing.id,
              conversation_id: existing.conversation_id,
              title: existing.title,
              content_json: existing.content_json,
            },
          },
          afterState: { summaryId: existing.id },
        });
        ctx.syncNotifier?.emit({
          resource: 'summary',
          action: 'updated',
          conversationId: existing.conversation_id,
          entityId: existing.id,
          title: updated.title,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'refine_note',
          riskTier,
          summaryId: existing.id,
          title: updated.title,
          affectedIds: [existing.id],
          actionLogId: log.id,
          undoable: true,
          message: `Đã tinh chỉnh ghi chú "${updated.title}".`,
        };
      }

      case 'delete_note': {
        if (!input.summaryId) {
          return {
            ok: false,
            action: 'delete_note',
            riskTier,
            message: 'Thiếu summaryId để xóa Note.',
          };
        }
        const existing = await this.summariesRepo.getSummaryByIdForUser(
          input.summaryId,
          ctx.userId,
        );
        if (!existing) {
          return {
            ok: false,
            action: 'delete_note',
            riskTier,
            message: 'Không tìm thấy Note được chỉ định.',
          };
        }
        // Xóa DB record qua repo (bảo toàn media trên R2 trong cửa sổ Undo 7 ngày)
        await this.summariesRepo.deleteSummary(existing.id);
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: existing.conversation_id,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageNotes',
          actionName: 'delete_note',
          riskTier,
          resourceType: 'note',
          resourceIds: [existing.id],
          summaryText: `Xóa Note "${existing.title}"`,
          beforeState: {
            note: {
              id: existing.id,
              conversation_id: existing.conversation_id,
              document_id: existing.document_id,
              title: existing.title,
              content_json: existing.content_json,
              pdf_storage_key: null,
            },
          },
          afterState: null,
        });
        ctx.syncNotifier?.emit({
          resource: 'summary',
          action: 'deleted',
          conversationId: existing.conversation_id,
          entityId: existing.id,
          title: existing.title,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'delete_note',
          riskTier,
          summaryId: existing.id,
          title: existing.title,
          affectedIds: [existing.id],
          actionLogId: log.id,
          undoable: true,
          message: `Đã xóa ghi chú "${existing.title}". Bạn có thể bấm Hoàn tác để khôi phục nếu cần.`,
        };
      }

      case 'batch_reorganize': {
        const items = Array.isArray(input.batchItems) ? input.batchItems : [];
        if (items.length === 0) {
          return {
            ok: false,
            action: 'batch_reorganize',
            riskTier,
            message: 'Danh sách batchItems đang trống.',
          };
        }
        const beforeNotes: Array<Record<string, unknown>> = [];
        const updatedIds: string[] = [];

        for (const item of items) {
          const existing = await this.summariesRepo.getSummaryByIdForUser(
            item.summaryId,
            ctx.userId,
          );
          if (!existing) continue;
          beforeNotes.push({
            id: existing.id,
            conversation_id: existing.conversation_id,
            title: existing.title,
            content_json: existing.content_json,
          });
          const nextBlocks =
            item.newMarkdownContent !== undefined
              ? parseMarkdownToBlockNoteBlocks(item.newMarkdownContent)
              : undefined;
          await this.summariesService.updateSummary(ctx.userId, existing.id, {
            ...(item.newTitle?.trim() ? { title: item.newTitle.trim() } : {}),
            ...(nextBlocks !== undefined
              ? { content_json: nextBlocks as any[] }
              : {}),
          });
          updatedIds.push(existing.id);
          ctx.syncNotifier?.emit({
            resource: 'summary',
            action: 'updated',
            conversationId: existing.conversation_id,
            entityId: existing.id,
            title: item.newTitle?.trim() || existing.title,
            occurredAt: nowIso,
          });
        }

        if (updatedIds.length === 0) {
          return {
            ok: false,
            action: 'batch_reorganize',
            riskTier,
            message: 'Không tìm thấy Note hợp lệ nào trong batchItems.',
          };
        }

        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageNotes',
          actionName: 'batch_reorganize',
          riskTier,
          resourceType: 'note',
          resourceIds: updatedIds,
          summaryText: `Sắp xếp lại ${updatedIds.length} ghi chú`,
          beforeState: { notes: beforeNotes },
          afterState: { affectedIds: updatedIds },
        });

        return {
          ok: true,
          action: 'batch_reorganize',
          riskTier,
          affectedIds: updatedIds,
          actionLogId: log.id,
          undoable: true,
          message: `Đã cập nhật và sắp xếp lại ${updatedIds.length} ghi chú.`,
        };
      }
    }
  }

  async executeManageFlashcards(
    ctx: WorkspaceMutationContext,
    input: ManageFlashcardsToolInput,
    toolCallId?: string,
  ): Promise<ManageFlashcardsToolOutput> {
    const riskTier =
      evaluateToolRiskTier('manageFlashcards', input) === 'tier_2'
        ? 'tier_2'
        : 'tier_1';
    const nowIso = new Date().toISOString();

    if (!this.deckService || !this.flashcardService || !this.deckRepo) {
      return {
        ok: false,
        action: input.action,
        riskTier,
        message: 'Dịch vụ Flashcards chưa sẵn sàng.',
      };
    }

    switch (input.action) {
      case 'create_deck': {
        const name = input.deckName?.trim() || 'Bộ thẻ mới';
        const created = await this.deckService.createDeck(ctx.userId, {
          conversationId: ctx.conversationId,
          name,
          description: input.deckDescription?.trim(),
        });
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageFlashcards',
          actionName: 'create_deck',
          riskTier,
          resourceType: 'deck',
          resourceIds: [created.id],
          summaryText: `Tạo bộ thẻ "${created.name}"`,
          beforeState: null,
          afterState: { deckId: created.id },
        });
        ctx.syncNotifier?.emit({
          resource: 'flashcard',
          action: 'created',
          conversationId: ctx.conversationId,
          entityId: created.id,
          targetKind: 'deck',
          title: created.name,
          count: 0,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'create_deck',
          riskTier,
          deckId: created.id,
          deckName: created.name,
          affectedIds: [created.id],
          actionLogId: log.id,
          undoable: true,
          message: `Đã tạo bộ thẻ "${created.name}".`,
        };
      }

      case 'rename_deck': {
        if (!input.deckId || !input.deckName?.trim()) {
          return {
            ok: false,
            action: 'rename_deck',
            riskTier,
            message: 'Thiếu deckId hoặc deckName.',
          };
        }
        const existing = await this.deckRepo.getDeckById(
          input.deckId,
          ctx.userId,
        );
        if (!existing) {
          return {
            ok: false,
            action: 'rename_deck',
            riskTier,
            message: 'Không tìm thấy bộ thẻ được chỉ định.',
          };
        }
        const updated = await this.deckService.updateDeck(
          existing.id,
          ctx.userId,
          {
            name: input.deckName.trim(),
            ...(input.deckDescription !== undefined
              ? { description: input.deckDescription.trim() }
              : {}),
          },
        );
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: existing.conversation_id,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageFlashcards',
          actionName: 'rename_deck',
          riskTier,
          resourceType: 'deck',
          resourceIds: [existing.id],
          summaryText: `Đổi tên bộ thẻ "${existing.name}" thành "${updated.name}"`,
          beforeState: {
            deck: {
              id: existing.id,
              conversation_id: existing.conversation_id,
              name: existing.name,
              description: existing.description,
            },
          },
          afterState: { deckId: existing.id, name: updated.name },
        });
        ctx.syncNotifier?.emit({
          resource: 'flashcard',
          action: 'updated',
          conversationId: existing.conversation_id,
          entityId: existing.id,
          targetKind: 'deck',
          title: updated.name,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'rename_deck',
          riskTier,
          deckId: existing.id,
          deckName: updated.name,
          affectedIds: [existing.id],
          actionLogId: log.id,
          undoable: true,
          message: `Đã cập nhật bộ thẻ "${updated.name}".`,
        };
      }

      case 'delete_deck': {
        if (!input.deckId) {
          return {
            ok: false,
            action: 'delete_deck',
            riskTier,
            message: 'Thiếu deckId để xóa bộ thẻ.',
          };
        }
        const existing = await this.deckRepo.getDeckById(
          input.deckId,
          ctx.userId,
        );
        if (!existing) {
          return {
            ok: false,
            action: 'delete_deck',
            riskTier,
            message: 'Không tìm thấy bộ thẻ được chỉ định.',
          };
        }
        const cards = await this.deckRepo.getAllFlashcardsByDeckId(
          existing.id,
          ctx.userId,
        );
        await this.deckService.deleteDeck(existing.id, ctx.userId);
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: existing.conversation_id,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageFlashcards',
          actionName: 'delete_deck',
          riskTier,
          resourceType: 'deck',
          resourceIds: [existing.id],
          summaryText: `Xóa bộ thẻ "${existing.name}" (${cards.length} thẻ)`,
          beforeState: {
            deck: {
              id: existing.id,
              conversation_id: existing.conversation_id,
              name: existing.name,
              description: existing.description,
            },
            cards,
          },
          afterState: null,
        });
        ctx.syncNotifier?.emit({
          resource: 'flashcard',
          action: 'deleted',
          conversationId: existing.conversation_id,
          entityId: existing.id,
          targetKind: 'deck',
          title: existing.name,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'delete_deck',
          riskTier,
          deckId: existing.id,
          deckName: existing.name,
          affectedCount: cards.length,
          affectedIds: [existing.id],
          actionLogId: log.id,
          undoable: true,
          message: `Đã xóa bộ thẻ "${existing.name}".`,
        };
      }

      case 'add_cards': {
        if (!input.deckId || !Array.isArray(input.cards) || input.cards.length === 0) {
          return {
            ok: false,
            action: 'add_cards',
            riskTier,
            message: 'Thiếu deckId hoặc danh sách cards cần thêm.',
          };
        }
        const deck = await this.deckRepo.getDeckById(input.deckId, ctx.userId);
        if (!deck) {
          return {
            ok: false,
            action: 'add_cards',
            riskTier,
            message: 'Không tìm thấy bộ thẻ đích.',
          };
        }
        const rows = input.cards.map((c) => {
          const cardType =
            c.cardType === 'cloze'
              ? CardTypeEnum.cloze
              : c.cardType === 'type_in'
                ? CardTypeEnum.type_in
                : CardTypeEnum.basic;
          return {
            card_type: cardType,
            front_text: sanitizeFlashcardHtml(
              c.frontText,
              cardType === CardTypeEnum.cloze,
            ),
            back_text: sanitizeFlashcardHtml(c.backText ?? '', false),
          };
        });
        const createdCards = await this.deckRepo.addFlashcardsToDeckAtomic(
          deck.id,
          rows,
        );
        const cardIds = createdCards.map((c) => c.id);
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: deck.conversation_id,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageFlashcards',
          actionName: 'add_cards',
          riskTier,
          resourceType: 'flashcard',
          resourceIds: cardIds,
          summaryText: `Thêm ${cardIds.length} thẻ vào bộ "${deck.name}"`,
          beforeState: null,
          afterState: { deckId: deck.id, cardIds },
        });
        ctx.syncNotifier?.emit({
          resource: 'flashcard',
          action: 'updated',
          conversationId: deck.conversation_id,
          entityId: deck.id,
          targetKind: 'deck',
          title: deck.name,
          count: cardIds.length,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'add_cards',
          riskTier,
          deckId: deck.id,
          deckName: deck.name,
          affectedCount: cardIds.length,
          affectedIds: cardIds,
          actionLogId: log.id,
          undoable: true,
          message: `Đã thêm ${cardIds.length} thẻ vào bộ "${deck.name}".`,
        };
      }

      case 'update_card': {
        if (!input.cardId) {
          return {
            ok: false,
            action: 'update_card',
            riskTier,
            message: 'Thiếu cardId để sửa thẻ.',
          };
        }
        if (
          ctx.workspaceContext?.guards?.hideFlashcardAnswerGuard &&
          ctx.workspaceContext.flashcardView?.studyState?.currentCardId ===
            input.cardId
        ) {
          return {
            ok: false,
            action: 'update_card',
            riskTier,
            message:
              'Đang ở chế độ tự kiểm tra (chưa lật đáp án thẻ hiện tại). Hãy lật hoặc hoàn thành thẻ trước khi chỉnh sửa.',
          };
        }
        const existing = await this.deckRepo.getFlashcardById(
          input.cardId,
          ctx.userId,
        );
        if (!existing) {
          return {
            ok: false,
            action: 'update_card',
            riskTier,
            message: 'Không tìm thấy thẻ ghi nhớ được chỉ định.',
          };
        }
        await this.flashcardService.updateFlashcard(existing.id, ctx.userId, {
          ...(input.frontText !== undefined
            ? { frontText: input.frontText }
            : {}),
          ...(input.backText !== undefined ? { backText: input.backText } : {}),
          ...(input.cardType !== undefined
            ? { cardType: input.cardType as CardTypeEnum }
            : {}),
        });
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageFlashcards',
          actionName: 'update_card',
          riskTier,
          resourceType: 'flashcard',
          resourceIds: [existing.id],
          summaryText: `Cập nhật thẻ flashcard ${existing.id.slice(0, 8)}`,
          beforeState: { card: existing },
          afterState: { cardId: existing.id, deckId: existing.deck_id },
        });
        ctx.syncNotifier?.emit({
          resource: 'flashcard',
          action: 'updated',
          conversationId: ctx.conversationId,
          entityId: existing.deck_id,
          targetKind: 'deck',
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'update_card',
          riskTier,
          deckId: existing.deck_id,
          affectedCount: 1,
          affectedIds: [existing.id],
          actionLogId: log.id,
          undoable: true,
          message: 'Đã cập nhật nội dung thẻ ghi nhớ.',
        };
      }

      case 'delete_cards': {
        const ids = Array.isArray(input.cardIds) ? input.cardIds : [];
        if (ids.length === 0) {
          return {
            ok: false,
            action: 'delete_cards',
            riskTier,
            message: 'Thiếu danh sách cardIds để xóa.',
          };
        }
        const deleted = await this.deckRepo.deleteManyFlashcards(
          ids,
          ctx.userId,
        );
        const deckId = deleted[0]?.deck_id ?? input.deckId;
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageFlashcards',
          actionName: 'delete_cards',
          riskTier,
          resourceType: 'flashcard',
          resourceIds: deleted.map((c) => c.id),
          summaryText: `Xóa ${deleted.length} thẻ ghi nhớ`,
          beforeState: { cards: deleted },
          afterState: { deckId },
        });
        if (deckId) {
          ctx.syncNotifier?.emit({
            resource: 'flashcard',
            action: 'updated',
            conversationId: ctx.conversationId,
            entityId: deckId,
            targetKind: 'deck',
            occurredAt: nowIso,
          });
        }
        return {
          ok: true,
          action: 'delete_cards',
          riskTier,
          deckId,
          affectedCount: deleted.length,
          affectedIds: deleted.map((c) => c.id),
          actionLogId: log.id,
          undoable: true,
          message: `Đã xóa ${deleted.length} thẻ ghi nhớ.`,
        };
      }

      case 'move_cards': {
        const ids = Array.isArray(input.cardIds) ? input.cardIds : [];
        if (!input.targetDeckId || ids.length === 0) {
          return {
            ok: false,
            action: 'move_cards',
            riskTier,
            message: 'Thiếu targetDeckId hoặc danh sách cardIds để di chuyển.',
          };
        }
        const movedBefore = await this.deckRepo.moveFlashcardsToDeck(
          ids,
          input.targetDeckId,
          ctx.userId,
        );
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageFlashcards',
          actionName: 'move_cards',
          riskTier,
          resourceType: 'flashcard',
          resourceIds: movedBefore.map((c) => c.id),
          summaryText: `Di chuyển ${movedBefore.length} thẻ sang bộ mới`,
          beforeState: { cards: movedBefore },
          afterState: { targetDeckId: input.targetDeckId },
        });
        ctx.syncNotifier?.emit({
          resource: 'flashcard',
          action: 'updated',
          conversationId: ctx.conversationId,
          entityId: input.targetDeckId,
          targetKind: 'deck',
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'move_cards',
          riskTier,
          deckId: input.targetDeckId,
          affectedCount: movedBefore.length,
          affectedIds: movedBefore.map((c) => c.id),
          actionLogId: log.id,
          undoable: true,
          message: `Đã di chuyển ${movedBefore.length} thẻ sang bộ thẻ đích.`,
        };
      }

      case 'merge_duplicates': {
        const groups = Array.isArray(input.mergeGroups) ? input.mergeGroups : [];
        if (groups.length === 0) {
          return {
            ok: false,
            action: 'merge_duplicates',
            riskTier,
            message: 'Thiếu danh sách mergeGroups để gộp thẻ trùng lặp.',
          };
        }

        const deletedAll: Prisma.FlashcardModel[] = [];
        let firstKeeperBefore: Prisma.FlashcardModel | null = null;

        for (const group of groups) {
          const keeper = await this.deckRepo.getFlashcardById(
            group.keepCardId,
            ctx.userId,
          );
          if (!keeper) continue;
          if (!firstKeeperBefore) firstKeeperBefore = keeper;

          if (
            group.updatedFrontText !== undefined ||
            group.updatedBackText !== undefined
          ) {
            await this.flashcardService.updateFlashcard(keeper.id, ctx.userId, {
              ...(group.updatedFrontText !== undefined
                ? { frontText: group.updatedFrontText }
                : {}),
              ...(group.updatedBackText !== undefined
                ? { backText: group.updatedBackText }
                : {}),
            });
          }

          const toDeleteIds = group.deleteCardIds.filter(
            (id) => id !== group.keepCardId,
          );
          if (toDeleteIds.length > 0) {
            const removed = await this.deckRepo.deleteManyFlashcards(
              toDeleteIds,
              ctx.userId,
            );
            deletedAll.push(...removed);
          }
        }

        const deckId =
          firstKeeperBefore?.deck_id ?? deletedAll[0]?.deck_id ?? input.deckId;
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageFlashcards',
          actionName: 'merge_duplicates',
          riskTier,
          resourceType: 'flashcard',
          resourceIds: deletedAll.map((c) => c.id),
          summaryText: `Gộp ${groups.length} nhóm thẻ trùng (xóa ${deletedAll.length} thẻ thừa)`,
          beforeState: {
            keeperCard: firstKeeperBefore,
            cards: deletedAll,
          },
          afterState: { deckId },
        });
        if (deckId) {
          ctx.syncNotifier?.emit({
            resource: 'flashcard',
            action: 'updated',
            conversationId: ctx.conversationId,
            entityId: deckId,
            targetKind: 'deck',
            occurredAt: nowIso,
          });
        }
        return {
          ok: true,
          action: 'merge_duplicates',
          riskTier,
          deckId,
          affectedCount: deletedAll.length,
          affectedIds: deletedAll.map((c) => c.id),
          actionLogId: log.id,
          undoable: true,
          message: `Đã gộp ${groups.length} nhóm thẻ trùng lặp và dọn ${deletedAll.length} thẻ thừa.`,
        };
      }
    }
  }

  async executeManageQuiz(
    ctx: WorkspaceMutationContext,
    input: ManageQuizToolInput,
    toolCallId?: string,
  ): Promise<ManageQuizToolOutput> {
    const riskTier =
      evaluateToolRiskTier('manageQuiz', input) === 'tier_2' ? 'tier_2' : 'tier_1';
    const nowIso = new Date().toISOString();

    if (!this.quizRepo) {
      return {
        ok: false,
        action: input.action,
        riskTier,
        message: 'Dịch vụ Quiz chưa sẵn sàng.',
      };
    }

    // Khóa Exam Integrity Guard lớp Tool dựa trực tiếp trên PostgreSQL
    const activeAttempt = await this.quizRepo.findActiveInProgressExamAttempt(
      input.quizId,
      ctx.userId,
    );
    if (activeAttempt || ctx.workspaceContext?.guards?.examIntegrityGuard) {
      return {
        ok: false,
        action: input.action,
        riskTier,
        quizId: input.quizId,
        blockedReason: 'blocked_exam_integrity',
        message:
          'Không thể chỉnh sửa hoặc xóa đề kiểm tra khi đang có lượt làm bài (exam) chưa nộp. Hãy hoàn thành hoặc nộp bài trước nhé.',
      };
    }

    const existingQuiz = await this.quizRepo.assertQuizOwnership(
      input.quizId,
      ctx.userId,
    );

    switch (input.action) {
      case 'update_metadata': {
        const nextTitle = input.title?.trim() || existingQuiz.title;
        const nextDesc =
          input.description !== undefined
            ? input.description?.trim() || null
            : existingQuiz.description;
        const nextTimeLimit =
          input.timeLimitSec !== undefined
            ? input.timeLimitSec
            : existingQuiz.time_limit_sec;

        await this.quizRepo.updateQuizWithQuestions(
          existingQuiz.id,
          ctx.userId,
          {
            title: nextTitle,
            description: nextDesc,
            time_limit_sec: nextTimeLimit,
          },
          existingQuiz.questions.map((q) => ({
            id: q.id,
            question_type: q.question_type,
            order_index: q.order_index,
            question_text: q.question_text,
            image_url: q.image_url,
            audio_url: q.audio_url,
            points: q.points,
            options: q.options as Prisma.InputJsonValue,
            sample_answer: q.sample_answer,
            grading_criteria: q.grading_criteria as Prisma.InputJsonValue,
            explanation: q.explanation,
            bloom_level: q.bloom_level,
          })),
        );

        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: existingQuiz.conversation_id,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageQuiz',
          actionName: 'update_metadata',
          riskTier,
          resourceType: 'quiz',
          resourceIds: [existingQuiz.id],
          summaryText: `Cập nhật thông tin Quiz "${nextTitle}"`,
          beforeState: {
            quiz: {
              id: existingQuiz.id,
              conversation_id: existingQuiz.conversation_id,
              title: existingQuiz.title,
              description: existingQuiz.description,
              time_limit_sec: existingQuiz.time_limit_sec,
            },
          },
          afterState: { quizId: existingQuiz.id },
        });
        ctx.syncNotifier?.emit({
          resource: 'quiz',
          action: 'updated',
          conversationId: existingQuiz.conversation_id,
          entityId: existingQuiz.id,
          title: nextTitle,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'update_metadata',
          riskTier,
          quizId: existingQuiz.id,
          title: nextTitle,
          affectedCount: 1,
          affectedIds: [existingQuiz.id],
          actionLogId: log.id,
          undoable: true,
          message: `Đã cập nhật thông tin đề "${nextTitle}".`,
        };
      }

      case 'add_question': {
        if (!input.question?.questionText?.trim()) {
          return {
            ok: false,
            action: 'add_question',
            riskTier,
            message: 'Thiếu nội dung câu hỏi cần thêm.',
          };
        }
        const q = input.question;
        const payload: QuestionCreatePayload = {
          question_type:
            (q.questionType as QuestionTypeEnum) ??
            QuestionTypeEnum.single_choice,
          order_index: existingQuiz.questions.length,
          question_text: q.questionText.trim(),
          points: q.points ?? 1,
          options: q.options
            ? (q.options.map((opt, idx) => ({
                id: opt.id || `opt-${idx + 1}`,
                text: opt.text,
                isCorrect: opt.isCorrect,
              })) as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
          sample_answer: q.sampleAnswer ?? null,
          grading_criteria: [],
          explanation: q.explanation ?? null,
        };
        const created = await this.quizRepo.addQuizQuestions(
          existingQuiz.id,
          ctx.userId,
          [payload],
        );
        const createdId = created[0]?.id;
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: existingQuiz.conversation_id,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageQuiz',
          actionName: 'add_question',
          riskTier,
          resourceType: 'quiz',
          resourceIds: createdId ? [createdId] : [existingQuiz.id],
          summaryText: `Thêm câu hỏi mới vào Quiz "${existingQuiz.title}"`,
          beforeState: null,
          afterState: { quizId: existingQuiz.id, questionId: createdId },
        });
        ctx.syncNotifier?.emit({
          resource: 'quiz',
          action: 'updated',
          conversationId: existingQuiz.conversation_id,
          entityId: existingQuiz.id,
          title: existingQuiz.title,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'add_question',
          riskTier,
          quizId: existingQuiz.id,
          title: existingQuiz.title,
          affectedCount: 1,
          affectedIds: createdId ? [createdId] : [],
          actionLogId: log.id,
          undoable: true,
          message: `Đã thêm câu hỏi mới vào đề "${existingQuiz.title}".`,
        };
      }

      case 'update_question': {
        const targetId = input.questionId || input.question?.questionId;
        if (!targetId || !input.question) {
          return {
            ok: false,
            action: 'update_question',
            riskTier,
            message: 'Thiếu questionId hoặc dữ liệu question cần cập nhật.',
          };
        }
        const prevQ = existingQuiz.questions.find((item) => item.id === targetId);
        if (!prevQ) {
          return {
            ok: false,
            action: 'update_question',
            riskTier,
            message: 'Không tìm thấy câu hỏi trong đề kiểm tra.',
          };
        }
        await this.quizRepo.updateQuizQuestion(
          existingQuiz.id,
          targetId,
          ctx.userId,
          {
            question_text: input.question.questionText.trim(),
            ...(input.question.questionType
              ? {
                  question_type: input.question.questionType as QuestionTypeEnum,
                }
              : {}),
            ...(input.question.points !== undefined
              ? { points: input.question.points }
              : {}),
            ...(input.question.options !== undefined
              ? {
                  options: input.question.options.map((opt, idx) => ({
                    id: opt.id || `opt-${idx + 1}`,
                    text: opt.text,
                    isCorrect: opt.isCorrect,
                  })) as unknown as Prisma.InputJsonValue,
                }
              : {}),
            ...(input.question.sampleAnswer !== undefined
              ? { sample_answer: input.question.sampleAnswer }
              : {}),
            ...(input.question.explanation !== undefined
              ? { explanation: input.question.explanation }
              : {}),
          },
        );
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: existingQuiz.conversation_id,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageQuiz',
          actionName: 'update_question',
          riskTier,
          resourceType: 'quiz',
          resourceIds: [targetId],
          summaryText: `Cập nhật câu hỏi trong Quiz "${existingQuiz.title}"`,
          beforeState: { quizId: existingQuiz.id, question: prevQ },
          afterState: { quizId: existingQuiz.id, questionId: targetId },
        });
        ctx.syncNotifier?.emit({
          resource: 'quiz',
          action: 'updated',
          conversationId: existingQuiz.conversation_id,
          entityId: existingQuiz.id,
          title: existingQuiz.title,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'update_question',
          riskTier,
          quizId: existingQuiz.id,
          title: existingQuiz.title,
          affectedCount: 1,
          affectedIds: [targetId],
          actionLogId: log.id,
          undoable: true,
          message: 'Đã cập nhật câu hỏi trong bài kiểm tra.',
        };
      }

      case 'delete_questions': {
        const ids = Array.isArray(input.questionIds) ? input.questionIds : [];
        if (ids.length === 0) {
          return {
            ok: false,
            action: 'delete_questions',
            riskTier,
            message: 'Thiếu danh sách questionIds cần xóa.',
          };
        }
        const removed = await this.quizRepo.deleteQuizQuestions(
          existingQuiz.id,
          ids,
          ctx.userId,
        );
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: existingQuiz.conversation_id,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageQuiz',
          actionName: 'delete_questions',
          riskTier,
          resourceType: 'quiz',
          resourceIds: removed.map((q) => q.id),
          summaryText: `Xóa ${removed.length} câu hỏi khỏi Quiz "${existingQuiz.title}"`,
          beforeState: { quizId: existingQuiz.id, questions: removed },
          afterState: { quizId: existingQuiz.id },
        });
        ctx.syncNotifier?.emit({
          resource: 'quiz',
          action: 'updated',
          conversationId: existingQuiz.conversation_id,
          entityId: existingQuiz.id,
          title: existingQuiz.title,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'delete_questions',
          riskTier,
          quizId: existingQuiz.id,
          title: existingQuiz.title,
          affectedCount: removed.length,
          affectedIds: removed.map((q) => q.id),
          actionLogId: log.id,
          undoable: true,
          message: `Đã xóa ${removed.length} câu hỏi khỏi đề "${existingQuiz.title}".`,
        };
      }

      case 'batch_update_questions': {
        const list = Array.isArray(input.questions) ? input.questions : [];
        if (list.length === 0) {
          return {
            ok: false,
            action: 'batch_update_questions',
            riskTier,
            message: 'Danh sách câu hỏi cập nhật hàng loạt đang trống.',
          };
        }
        const prevQuestions = existingQuiz.questions.filter((q) =>
          list.some((item) => item.questionId === q.id),
        );
        const updatedIds: string[] = [];
        for (const item of list) {
          if (!prevQuestions.some((q) => q.id === item.questionId)) continue;
          await this.quizRepo.updateQuizQuestion(
            existingQuiz.id,
            item.questionId,
            ctx.userId,
            {
              question_text: item.questionText.trim(),
              ...(item.points !== undefined ? { points: item.points } : {}),
              ...(item.explanation !== undefined
                ? { explanation: item.explanation }
                : {}),
              ...(item.options !== undefined
                ? {
                    options: item.options.map((opt, idx) => ({
                      id: opt.id || `opt-${idx + 1}`,
                      text: opt.text,
                      isCorrect: opt.isCorrect,
                    })) as unknown as Prisma.InputJsonValue,
                  }
                : {}),
            },
          );
          updatedIds.push(item.questionId);
        }
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: existingQuiz.conversation_id,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageQuiz',
          actionName: 'batch_update_questions',
          riskTier,
          resourceType: 'quiz',
          resourceIds: updatedIds,
          summaryText: `Cập nhật hàng loạt ${updatedIds.length} câu hỏi trong Quiz "${existingQuiz.title}"`,
          beforeState: { quizId: existingQuiz.id, questions: prevQuestions },
          afterState: { quizId: existingQuiz.id },
        });
        ctx.syncNotifier?.emit({
          resource: 'quiz',
          action: 'updated',
          conversationId: existingQuiz.conversation_id,
          entityId: existingQuiz.id,
          title: existingQuiz.title,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'batch_update_questions',
          riskTier,
          quizId: existingQuiz.id,
          title: existingQuiz.title,
          affectedCount: updatedIds.length,
          affectedIds: updatedIds,
          actionLogId: log.id,
          undoable: true,
          message: `Đã cập nhật ${updatedIds.length} câu hỏi trong đề "${existingQuiz.title}".`,
        };
      }

      case 'delete_quiz': {
        await this.quizRepo.deleteQuiz(existingQuiz.id, ctx.userId);
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: existingQuiz.conversation_id,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageQuiz',
          actionName: 'delete_quiz',
          riskTier,
          resourceType: 'quiz',
          resourceIds: [existingQuiz.id],
          summaryText: `Xóa Quiz "${existingQuiz.title}" (${existingQuiz.questions.length} câu hỏi)`,
          beforeState: {
            quiz: {
              id: existingQuiz.id,
              conversation_id: existingQuiz.conversation_id,
              source_deck_id: existingQuiz.source_deck_id,
              source: existingQuiz.source,
              title: existingQuiz.title,
              description: existingQuiz.description,
              time_limit_sec: existingQuiz.time_limit_sec,
            },
            questions: existingQuiz.questions,
          },
          afterState: null,
        });
        ctx.syncNotifier?.emit({
          resource: 'quiz',
          action: 'deleted',
          conversationId: existingQuiz.conversation_id,
          entityId: existingQuiz.id,
          title: existingQuiz.title,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'delete_quiz',
          riskTier,
          quizId: existingQuiz.id,
          title: existingQuiz.title,
          affectedCount: existingQuiz.questions.length,
          affectedIds: [existingQuiz.id],
          actionLogId: log.id,
          undoable: true,
          message: `Đã xóa bài kiểm tra "${existingQuiz.title}".`,
        };
      }
    }
  }

  async executeManageEditableDocument(
    ctx: WorkspaceMutationContext,
    input: ManageEditableDocumentToolInput,
    toolCallId?: string,
  ): Promise<ManageEditableDocumentToolOutput> {
    const riskTier = evaluateToolRiskTier('manageEditableDocument', input);
    const nowIso = new Date().toISOString();

    if (!this.documentsService) {
      return {
        ok: false,
        action: input.action,
        riskTier,
        message: 'DocumentsService chưa sẵn sàng.',
      };
    }

    switch (input.action) {
      case 'read_content': {
        if (!input.documentId) {
          return {
            ok: false,
            action: 'read_content',
            riskTier: 'tier_0',
            message: 'Thiếu documentId để đọc tài liệu văn bản.',
          };
        }
        const doc = await this.documentsService.getDocumentContent(
          ctx.userId,
          input.documentId,
        );
        const totalChars = doc.content.length;
        const offset = Math.min(Math.max(0, input.charOffset ?? 0), totalChars);
        const slice = doc.content.slice(offset, offset + MAX_EDITABLE_READ_CHARS);
        const truncated = offset + slice.length < totalChars;
        return {
          ok: true,
          action: 'read_content',
          riskTier: 'tier_0',
          documentId: doc.id,
          fileName: doc.fileName,
          version: doc.version,
          content: slice,
          totalChars,
          returnedChars: slice.length,
          truncated,
          ...(truncated ? { nextCharOffset: offset + slice.length } : {}),
          message: `Đã đọc tài liệu "${doc.fileName}".`,
        };
      }

      case 'update_content': {
        if (!input.documentId) {
          return {
            ok: false,
            action: 'update_content',
            riskTier: 'tier_2',
            message: 'Thiếu documentId để cập nhật nội dung.',
          };
        }
        const current = await this.documentsService.getDocumentContent(
          ctx.userId,
          input.documentId,
        );
        let nextFullContent = input.newContent;
        if (input.replaceSnippet) {
          const { oldSnippet, newSnippet } = input.replaceSnippet;
          if (!current.content.includes(oldSnippet)) {
            return {
              ok: false,
              action: 'update_content',
              riskTier: 'tier_2',
              documentId: current.id,
              fileName: current.fileName,
              message:
                'Không tìm thấy đoạn văn bản cũ khớp chính xác để thay thế. Hãy gọi read_content kiểm tra lại nội dung hiện tại.',
            };
          }
          nextFullContent = current.content.replace(oldSnippet, newSnippet);
        }

        if (typeof nextFullContent !== 'string') {
          return {
            ok: false,
            action: 'update_content',
            riskTier: 'tier_2',
            message: 'Thiếu replaceSnippet hoặc newContent.',
          };
        }

        const diff = buildUnifiedTextDiffPreview(
          current.content,
          nextFullContent,
        );
        const updated = await this.documentsService.updateDocumentContent(
          ctx.userId,
          current.id,
          {
            content: nextFullContent,
            expectedVersion: input.expectedVersion ?? current.version,
          },
        );

        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageEditableDocument',
          actionName: 'update_content',
          riskTier: 'tier_2',
          resourceType: 'document',
          resourceIds: [current.id],
          summaryText: `Cập nhật tài liệu "${current.fileName}" (+${diff.addedLines}/-${diff.removedLines} dòng)`,
          beforeState: {
            documentId: current.id,
            content: current.content,
          },
          afterState: { version: updated.version },
        });

        ctx.syncNotifier?.emit({
          resource: 'document',
          action: 'updated',
          conversationId: ctx.conversationId,
          entityId: current.id,
          title: current.fileName,
          version: updated.version,
          occurredAt: nowIso,
        });

        return {
          ok: true,
          action: 'update_content',
          riskTier: 'tier_2',
          documentId: current.id,
          fileName: current.fileName,
          version: updated.version,
          diffPreview: diff.diffText,
          actionLogId: log.id,
          undoable: true,
          message: `Đã lưu bản cập nhật v${updated.version} cho "${current.fileName}" và xếp lịch đồng bộ lại ngữ cảnh RAG.`,
        };
      }

      case 'save_as_new_document': {
        if (!input.newFileName?.trim() || typeof input.newContent !== 'string') {
          return {
            ok: false,
            action: 'save_as_new_document',
            riskTier: 'tier_1',
            message: 'Thiếu newFileName hoặc newContent để lưu thành tài liệu mới.',
          };
        }
        const created = await this.documentsService.createEditableDocumentFromText(
          {
            userId: ctx.userId,
            conversationId: ctx.conversationId,
            fileName: input.newFileName.trim(),
            content: input.newContent,
          },
        );
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageEditableDocument',
          actionName: 'save_as_new_document',
          riskTier: 'tier_1',
          resourceType: 'document',
          resourceIds: [created.id],
          summaryText: `Tạo tài liệu mới "${created.file_name}"`,
          beforeState: null,
          afterState: { documentId: created.id },
        });
        ctx.syncNotifier?.emit({
          resource: 'document',
          action: 'created',
          conversationId: ctx.conversationId,
          entityId: created.id,
          title: created.file_name,
          version: created.content_version,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'save_as_new_document',
          riskTier: 'tier_1',
          documentId: created.id,
          fileName: created.file_name,
          version: created.content_version,
          actionLogId: log.id,
          undoable: true,
          message: `Đã lưu tài liệu mới "${created.file_name}".`,
        };
      }

      case 'convert_note_to_markdown': {
        if (!input.summaryId || !this.summariesRepo) {
          return {
            ok: false,
            action: 'convert_note_to_markdown',
            riskTier: 'tier_1',
            message: 'Thiếu summaryId để xuất sang Markdown.',
          };
        }
        const note = await this.summariesRepo.getSummaryByIdForUser(
          input.summaryId,
          ctx.userId,
        );
        if (!note) {
          return {
            ok: false,
            action: 'convert_note_to_markdown',
            riskTier: 'tier_1',
            message: 'Không tìm thấy Note cần chuyển đổi.',
          };
        }
        const parsed = serializeBlockNoteToMarkdown(note.content_json);
        const mdText = `# ${note.title}\n\n${parsed.markdown}`.trim();
        const baseName =
          input.newFileName?.trim() ||
          `${note.title.replace(/[^\p{L}\p{N}._-]+/gu, '_') || 'note'}.md`;
        const fileName = baseName.endsWith('.md') ? baseName : `${baseName}.md`;

        const created = await this.documentsService.createEditableDocumentFromText(
          {
            userId: ctx.userId,
            conversationId: note.conversation_id,
            fileName,
            content: mdText,
          },
        );
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: note.conversation_id,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageEditableDocument',
          actionName: 'convert_note_to_markdown',
          riskTier: 'tier_1',
          resourceType: 'document',
          resourceIds: [created.id],
          summaryText: `Chuyển Note "${note.title}" thành "${created.file_name}"`,
          beforeState: null,
          afterState: { documentId: created.id },
        });
        ctx.syncNotifier?.emit({
          resource: 'document',
          action: 'created',
          conversationId: note.conversation_id,
          entityId: created.id,
          title: created.file_name,
          version: 1,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'convert_note_to_markdown',
          riskTier: 'tier_1',
          documentId: created.id,
          summaryId: note.id,
          fileName: created.file_name,
          actionLogId: log.id,
          undoable: true,
          message: `Đã chuyển ghi chú "${note.title}" thành tệp Markdown "${created.file_name}".`,
        };
      }

      case 'convert_markdown_to_note': {
        if (!input.documentId || !this.summariesService) {
          return {
            ok: false,
            action: 'convert_markdown_to_note',
            riskTier: 'tier_1',
            message: 'Thiếu documentId để chuyển thành Note.',
          };
        }
        const doc = await this.documentsService.getDocumentContent(
          ctx.userId,
          input.documentId,
        );
        const blocks = parseMarkdownToBlockNoteBlocks(doc.content);
        const title =
          input.noteTitle?.trim() || doc.fileName.replace(/\.[^.]+$/, '');
        const createdNote = await this.summariesService.createManualNote(
          ctx.userId,
          ctx.conversationId,
          { title, content_json: blocks as any[] },
        );
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageEditableDocument',
          actionName: 'convert_markdown_to_note',
          riskTier: 'tier_1',
          resourceType: 'note',
          resourceIds: [createdNote.id],
          summaryText: `Chuyển tệp "${doc.fileName}" thành Note "${createdNote.title}"`,
          beforeState: null,
          afterState: { summaryId: createdNote.id },
        });
        ctx.syncNotifier?.emit({
          resource: 'summary',
          action: 'created',
          conversationId: ctx.conversationId,
          entityId: createdNote.id,
          title: createdNote.title,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'convert_markdown_to_note',
          riskTier: 'tier_1',
          documentId: doc.id,
          summaryId: createdNote.id,
          fileName: doc.fileName,
          actionLogId: log.id,
          undoable: true,
          message: `Đã chuyển "${doc.fileName}" thành ghi chú "${createdNote.title}".`,
        };
      }
    }
  }

  async executeManageWorkspaceAndJobs(
    ctx: WorkspaceMutationContext,
    input: ManageWorkspaceAndJobsToolInput,
    toolCallId?: string,
  ): Promise<ManageWorkspaceAndJobsToolOutput> {
    const nowIso = new Date().toISOString();

    switch (input.action) {
      case 'navigate': {
        if (!input.navigationTarget) {
          return {
            ok: false,
            action: 'navigate',
            riskTier: 'tier_0',
            message: 'Thiếu navigationTarget để điều hướng.',
          };
        }
        ctx.syncNotifier?.emitAction?.({
          type: 'navigate',
          target: input.navigationTarget,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'navigate',
          riskTier: 'tier_0',
          message: 'Đã gửi lệnh điều hướng giao diện theo yêu cầu.',
        };
      }

      case 'get_preferences': {
        if (!this.usersService) {
          return {
            ok: false,
            action: 'get_preferences',
            riskTier: 'tier_0',
            message: 'UsersService chưa sẵn sàng.',
          };
        }
        const profile = await this.usersService.getProfile(ctx.userId);
        return {
          ok: true,
          action: 'get_preferences',
          riskTier: 'tier_0',
          preferences: {
            ...normalizeUserPreferences(profile.preferences),
            dailyGoalMinutes: profile.daily_goal_minutes,
          },
          message: 'Đã đọc thiết lập cá nhân hiện tại.',
        };
      }

      case 'update_preferences': {
        if (!this.usersService) {
          return {
            ok: false,
            action: 'update_preferences',
            riskTier: 'tier_1',
            message: 'UsersService chưa sẵn sàng.',
          };
        }
        const beforeProfile = await this.usersService.getProfile(ctx.userId);
        const beforePrefs = normalizeUserPreferences(beforeProfile.preferences);

        const updated = await this.usersService.updateProfile(ctx.userId, {
          ...(input.dailyGoalMinutes !== undefined
            ? { dailyGoalMinutes: input.dailyGoalMinutes }
            : {}),
          ...(input.theme !== undefined ||
          input.aiResponseLanguage !== undefined
            ? {
                preferences: {
                  ...(input.theme !== undefined ? { theme: input.theme } : {}),
                  ...(input.aiResponseLanguage !== undefined
                    ? { aiResponseLanguage: input.aiResponseLanguage }
                    : {}),
                },
              }
            : {}),
        });

        const nextPrefs = normalizeUserPreferences(updated.preferences);
        const log = await this.auditService.recordAction({
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          chatSessionId: ctx.chatSessionId,
          toolCallId,
          toolName: 'manageWorkspaceAndJobs',
          actionName: 'update_preferences',
          riskTier: 'tier_1',
          resourceType: 'preferences',
          resourceIds: [ctx.userId],
          summaryText: `Cập nhật cài đặt (theme=${nextPrefs.theme}, language=${nextPrefs.aiResponseLanguage})`,
          beforeState: {
            preferences: beforePrefs,
            dailyGoalMinutes: beforeProfile.daily_goal_minutes,
          },
          afterState: {
            preferences: nextPrefs,
            dailyGoalMinutes: updated.daily_goal_minutes,
          },
        });

        if (input.theme !== undefined) {
          ctx.syncNotifier?.emitAction?.({
            type: 'theme_changed',
            theme: nextPrefs.theme,
            occurredAt: nowIso,
          });
        }
        ctx.syncNotifier?.emit({
          resource: 'preferences',
          action: 'updated',
          conversationId: ctx.conversationId,
          entityId: ctx.userId,
          theme: nextPrefs.theme,
          aiResponseLanguage: nextPrefs.aiResponseLanguage,
          occurredAt: nowIso,
        });

        return {
          ok: true,
          action: 'update_preferences',
          riskTier: 'tier_1',
          actionLogId: log.id,
          undoable: true,
          preferences: {
            ...nextPrefs,
            dailyGoalMinutes: updated.daily_goal_minutes,
          },
          message: 'Đã cập nhật thiết lập cá nhân của bạn.',
        };
      }

      case 'list_action_history': {
        const actions = await this.auditService.listRecentActions(
          ctx.userId,
          ctx.conversationId,
          input.limit ?? 15,
        );
        return {
          ok: true,
          action: 'list_action_history',
          riskTier: 'tier_0',
          actions: actions as unknown as Array<Record<string, unknown>>,
          message: `Tìm thấy ${actions.length} thao tác AI gần đây.`,
        };
      }

      case 'undo_action': {
        const undoRes = input.actionLogId
          ? await this.auditService.undoAction(ctx.userId, input.actionLogId)
          : await this.auditService.undoLatestActionInConversation(
              ctx.userId,
              ctx.conversationId,
            );
        for (const ev of undoRes.syncEvents) {
          ctx.syncNotifier?.emit(ev);
        }
        for (const act of undoRes.workspaceActions) {
          ctx.syncNotifier?.emitAction?.(act);
        }
        return {
          ok: true,
          action: 'undo_action',
          riskTier: 'tier_1',
          actionLogId: undoRes.actionLogId,
          undoable: false,
          message: undoRes.message,
        };
      }

      case 'enqueue_background_job': {
        if (!this.agentJobsQueue || !input.jobType) {
          return {
            ok: false,
            action: 'enqueue_background_job',
            riskTier: 'tier_1',
            message: 'Hàng đợi tác vụ nền chưa sẵn sàng hoặc thiếu jobType.',
          };
        }
        const job = await this.agentJobsQueue.enqueueJob({
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          chatSessionId: ctx.chatSessionId,
          jobType: input.jobType,
          title:
            input.jobTitle?.trim() ||
            `Tác vụ nền (${input.jobType})`,
          payload: {
            documentIds: input.documentIds,
            count: input.count,
            deckName: input.deckName,
            instructions: input.instructions,
          },
        });
        ctx.syncNotifier?.emitAction?.({
          type: 'job_enqueued',
          jobId: job.id,
          jobType: job.jobType,
          title: job.title,
          conversationId: ctx.conversationId,
          occurredAt: nowIso,
        });
        return {
          ok: true,
          action: 'enqueue_background_job',
          riskTier: 'tier_1',
          jobId: job.id,
          jobStatus: job.status,
          message: `Đã đưa tác vụ "${job.title}" vào hàng đợi xử lý nền (ID: ${job.id}). Bạn có thể tiếp tục học hoặc quay lại sau, tiến trình được cập nhật trực tiếp ở khay Tác vụ nền.`,
        };
      }

      case 'list_jobs': {
        if (!this.agentJobsQueue) {
          return {
            ok: false,
            action: 'list_jobs',
            riskTier: 'tier_0',
            message: 'Hàng đợi tác vụ nền chưa sẵn sàng.',
          };
        }
        const jobs = await this.agentJobsQueue.listJobs(ctx.userId, {
          conversationId: ctx.conversationId,
          limit: input.limit ?? 10,
        });
        return {
          ok: true,
          action: 'list_jobs',
          riskTier: 'tier_0',
          jobs: jobs as unknown as Array<Record<string, unknown>>,
          message: `Có ${jobs.length} tác vụ nền gần đây.`,
        };
      }

      case 'get_job_status': {
        if (!this.agentJobsQueue || !input.jobId) {
          return {
            ok: false,
            action: 'get_job_status',
            riskTier: 'tier_0',
            message: 'Thiếu jobId để kiểm tra trạng thái.',
          };
        }
        const job = await this.agentJobsQueue.getJobById(
          ctx.userId,
          input.jobId,
        );
        return {
          ok: true,
          action: 'get_job_status',
          riskTier: 'tier_0',
          jobId: job.id,
          jobStatus: job.status,
          jobs: [job as unknown as Record<string, unknown>],
          message: `Tác vụ "${job.title}" đang ở trạng thái ${job.status} (${job.progressPercent}%).`,
        };
      }

      case 'retry_job': {
        if (!this.agentJobsQueue || !input.jobId) {
          return {
            ok: false,
            action: 'retry_job',
            riskTier: 'tier_1',
            message: 'Thiếu jobId để thử lại.',
          };
        }
        const job = await this.agentJobsQueue.retryFromCheckpoint(
          ctx.userId,
          input.jobId,
        );
        return {
          ok: true,
          action: 'retry_job',
          riskTier: 'tier_1',
          jobId: job.id,
          jobStatus: job.status,
          message: `Đã xếp lịch tiếp nối tác vụ "${job.title}" từ bước lỗi.`,
        };
      }

      case 'cancel_job': {
        if (!this.agentJobsQueue || !input.jobId) {
          return {
            ok: false,
            action: 'cancel_job',
            riskTier: 'tier_1',
            message: 'Thiếu jobId để hủy tác vụ.',
          };
        }
        const job = await this.agentJobsQueue.cancelJob(
          ctx.userId,
          input.jobId,
        );
        return {
          ok: true,
          action: 'cancel_job',
          riskTier: 'tier_1',
          jobId: job.id,
          jobStatus: job.status,
          message: `Đã hủy tác vụ "${job.title}".`,
        };
      }
    }
  }
}
