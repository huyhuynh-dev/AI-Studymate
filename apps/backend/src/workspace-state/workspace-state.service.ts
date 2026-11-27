import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  WORKSPACE_STATE_SCHEMA_VERSION,
  sanitizeStoredLayout,
  sanitizeStoredLocation,
  validateLocationInvariants,
  type ResolvedWorkspaceLocation,
  type UpsertWorkspaceStateResult,
  type WorkspaceLocationPayload,
  type WorkspaceStateReadResult,
} from './domain/workspace-state.types.js';
import type { UpsertWorkspaceStateDto } from './dto/upsert-workspace-state.dto.js';
import {
  WORKSPACE_STATE_REPOSITORY,
  type WorkspaceStateRepositoryPort,
} from './workspace-state.repository.port.js';

@Injectable()
export class WorkspaceStateService {
  constructor(
    @Inject(WORKSPACE_STATE_REPOSITORY)
    private readonly repo: WorkspaceStateRepositoryPort,
  ) {}

  /**
   * Đọc trạng thái workspace của tài khoản và kiểm tra quyền sở hữu / tồn tại thực tế.
   * Lỗi DB hoặc kết nối sẽ lan truyền thành 5xx, tuyệt đối không trả về `invalid`.
   */
  async getState(userId: string): Promise<WorkspaceStateReadResult> {
    const record = await this.repo.findByUserId(userId);
    if (!record) {
      return {
        schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
        location: null,
        layout: null,
      };
    }

    const layout = sanitizeStoredLayout(record.layoutJson);
    const storedLocation = sanitizeStoredLocation(record.locationJson);

    if (storedLocation === null) {
      return {
        schemaVersion: record.schemaVersion || WORKSPACE_STATE_SCHEMA_VERSION,
        location: null,
        layout,
      };
    }

    const resolvedLocation = await this.resolveLocation(userId, storedLocation);
    return {
      schemaVersion: record.schemaVersion || WORKSPACE_STATE_SCHEMA_VERSION,
      location: resolvedLocation,
      layout,
    };
  }

  /**
   * Ghi cập nhật một hoặc cả hai nhóm (`location`, `layout`) kèm kiểm tra bất biến và thứ tự `sourceId/seq`.
   */
  async upsertState(
    userId: string,
    dto: UpsertWorkspaceStateDto,
  ): Promise<UpsertWorkspaceStateResult> {
    if (dto.location === undefined && dto.layout === undefined) {
      throw new BadRequestException(
        'Cần cung cấp ít nhất một nhóm trạng thái (location hoặc layout)',
      );
    }

    let normalizedLocation: WorkspaceLocationPayload | undefined;
    if (dto.location !== undefined) {
      normalizedLocation = {
        ...(dto.location.subjectId !== undefined
          ? { subjectId: dto.location.subjectId }
          : {}),
        ...(dto.location.conversationId !== undefined
          ? { conversationId: dto.location.conversationId }
          : {}),
        ...(dto.location.tab !== undefined ? { tab: dto.location.tab } : {}),
        ...(dto.location.document !== undefined
          ? {
              document: {
                docId: dto.location.document.docId,
                ...(dto.location.document.page !== undefined
                  ? { page: dto.location.document.page }
                  : {}),
              },
            }
          : {}),
        ...(dto.location.summaryId !== undefined
          ? { summaryId: dto.location.summaryId }
          : {}),
        ...(dto.location.deckId !== undefined
          ? { deckId: dto.location.deckId }
          : {}),
        ...(dto.location.quizId !== undefined
          ? { quizId: dto.location.quizId }
          : {}),
        ...(dto.location.chatSessionId !== undefined
          ? { chatSessionId: dto.location.chatSessionId }
          : {}),
      };

      const invariant = validateLocationInvariants(normalizedLocation);
      if (!invariant.ok) {
        throw new BadRequestException(invariant.reason);
      }
    }

    const normalizedLayout =
      dto.layout !== undefined
        ? {
            leftSidebarCollapsed: dto.layout.leftSidebarCollapsed,
            rightSidebarCollapsed: dto.layout.rightSidebarCollapsed,
          }
        : undefined;

    return this.repo.upsertGroupsAtomic({
      userId,
      schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
      sourceId: dto.sourceId,
      seq: dto.seq,
      location: normalizedLocation,
      layout: normalizedLayout,
    });
  }

  private async resolveLocation(
    userId: string,
    stored: WorkspaceLocationPayload,
  ): Promise<ResolvedWorkspaceLocation> {
    // Mức home `{}` luôn hợp lệ
    if (!stored.subjectId && !stored.conversationId) {
      return { resolution: 'valid' };
    }

    if (stored.conversationId) {
      const conversation = await this.repo.findOwnedConversation(
        userId,
        stored.conversationId,
      );
      if (!conversation) {
        return { resolution: 'invalid' };
      }

      const verified = await this.repo.verifyConversationChildren(
        conversation.id,
        {
          docId: stored.document?.docId,
          summaryId: stored.summaryId,
          deckId: stored.deckId,
          quizId: stored.quizId,
          chatSessionId: stored.chatSessionId,
        },
      );

      return {
        resolution: 'valid',
        subjectId: conversation.subjectId,
        conversationId: conversation.id,
        ...(stored.tab !== undefined ? { tab: stored.tab } : {}),
        ...(stored.document && verified.docValid
          ? { document: stored.document }
          : {}),
        ...(stored.summaryId && verified.summaryValid
          ? { summaryId: stored.summaryId }
          : {}),
        ...(stored.deckId && verified.deckValid
          ? { deckId: stored.deckId }
          : {}),
        ...(stored.quizId && verified.quizValid
          ? { quizId: stored.quizId }
          : {}),
        ...(stored.chatSessionId && verified.chatSessionValid
          ? { chatSessionId: stored.chatSessionId }
          : {}),
      };
    }

    if (stored.subjectId) {
      const ownsSubject = await this.repo.verifyOwnedSubject(
        userId,
        stored.subjectId,
      );
      if (!ownsSubject) {
        return { resolution: 'invalid' };
      }
      return {
        resolution: 'valid',
        subjectId: stored.subjectId,
      };
    }

    return { resolution: 'invalid' };
  }
}
