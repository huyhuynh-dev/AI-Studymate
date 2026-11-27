import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  WORKSPACE_STATE_SCHEMA_VERSION,
  type UpsertWorkspaceStateResult,
} from './domain/workspace-state.types.js';
import type {
  AtomicUpsertInput,
  ChildEntityRefs,
  StoredWorkspaceStateRecord,
  VerifiedChildEntityRefs,
  WorkspaceStateRepositoryPort,
} from './workspace-state.repository.port.js';
import { WorkspaceStateService } from './workspace-state.service.js';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const SUBJ_1 = '33333333-3333-4333-8333-333333333333';
const SUBJ_2 = '44444444-4444-4444-8444-444444444444';
const CONV_1 = '55555555-5555-4555-8555-555555555555';
const DOC_1 = '66666666-6666-4666-8666-666666666666';
const SUM_1 = '77777777-7777-4777-8777-777777777777';
const DECK_1 = '88888888-8888-4888-8888-888888888888';
const QUIZ_1 = '99999999-9999-4999-8999-999999999999';
const CHAT_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

class FakeWorkspaceStateRepository implements WorkspaceStateRepositoryPort {
  public records = new Map<string, StoredWorkspaceStateRecord>();
  public subjects = new Map<string, string>(); // subjectId -> userId
  public conversations = new Map<string, { userId: string; subjectId: string }>();
  public docs = new Map<string, string>(); // docId -> conversationId
  public summaries = new Map<string, string>();
  public decks = new Map<string, string>();
  public quizzes = new Map<string, string>();
  public chatSessions = new Map<string, string>();
  public shouldThrowOnFind = false;

  async findByUserId(userId: string): Promise<StoredWorkspaceStateRecord | null> {
    if (this.shouldThrowOnFind) {
      throw new Error('DB connection lost');
    }
    return this.records.get(userId) ?? null;
  }

  async upsertGroupsAtomic(
    input: AtomicUpsertInput,
  ): Promise<UpsertWorkspaceStateResult> {
    const existing = this.records.get(input.userId);
    let locationApplied: boolean | undefined;
    let layoutApplied: boolean | undefined;

    let nextLocationJson = existing?.locationJson ?? null;
    let nextLocationSourceId = existing?.locationSourceId ?? null;
    let nextLocationSeq = existing?.locationSeq ?? 0;

    if (input.location !== undefined) {
      const shouldSkip =
        existing !== undefined &&
        existing.locationSourceId === input.sourceId &&
        existing.locationSeq >= input.seq;
      if (shouldSkip) {
        locationApplied = false;
      } else {
        locationApplied = true;
        nextLocationJson = input.location;
        nextLocationSourceId = input.sourceId;
        nextLocationSeq = input.seq;
      }
    }

    let nextLayoutJson = existing?.layoutJson ?? null;
    let nextLayoutSourceId = existing?.layoutSourceId ?? null;
    let nextLayoutSeq = existing?.layoutSeq ?? 0;

    if (input.layout !== undefined) {
      const shouldSkip =
        existing !== undefined &&
        existing.layoutSourceId === input.sourceId &&
        existing.layoutSeq >= input.seq;
      if (shouldSkip) {
        layoutApplied = false;
      } else {
        layoutApplied = true;
        nextLayoutJson = input.layout;
        nextLayoutSourceId = input.sourceId;
        nextLayoutSeq = input.seq;
      }
    }

    this.records.set(input.userId, {
      userId: input.userId,
      schemaVersion: input.schemaVersion,
      locationJson: nextLocationJson,
      locationSourceId: nextLocationSourceId,
      locationSeq: nextLocationSeq,
      layoutJson: nextLayoutJson,
      layoutSourceId: nextLayoutSourceId,
      layoutSeq: nextLayoutSeq,
    });

    return {
      ...(locationApplied !== undefined ? { locationApplied } : {}),
      ...(layoutApplied !== undefined ? { layoutApplied } : {}),
    };
  }

  async verifyOwnedSubject(userId: string, subjectId: string): Promise<boolean> {
    return this.subjects.get(subjectId) === userId;
  }

  async findOwnedConversation(
    userId: string,
    conversationId: string,
  ): Promise<{ readonly id: string; readonly subjectId: string } | null> {
    const conv = this.conversations.get(conversationId);
    if (!conv || conv.userId !== userId) return null;
    return { id: conversationId, subjectId: conv.subjectId };
  }

  async verifyConversationChildren(
    conversationId: string,
    refs: ChildEntityRefs,
  ): Promise<VerifiedChildEntityRefs> {
    return {
      docValid: refs.docId ? this.docs.get(refs.docId) === conversationId : false,
      summaryValid: refs.summaryId
        ? this.summaries.get(refs.summaryId) === conversationId
        : false,
      deckValid: refs.deckId
        ? this.decks.get(refs.deckId) === conversationId
        : false,
      quizValid: refs.quizId
        ? this.quizzes.get(refs.quizId) === conversationId
        : false,
      chatSessionValid: refs.chatSessionId
        ? this.chatSessions.get(refs.chatSessionId) === conversationId
        : false,
    };
  }
}

describe('WorkspaceStateService', () => {
  let repo: FakeWorkspaceStateRepository;
  let service: WorkspaceStateService;

  beforeEach(() => {
    repo = new FakeWorkspaceStateRepository();
    repo.subjects.set(SUBJ_1, USER_A);
    repo.subjects.set(SUBJ_2, USER_B);
    repo.conversations.set(CONV_1, { userId: USER_A, subjectId: SUBJ_1 });
    repo.docs.set(DOC_1, CONV_1);
    repo.summaries.set(SUM_1, CONV_1);
    repo.decks.set(DECK_1, CONV_1);
    repo.quizzes.set(QUIZ_1, CONV_1);
    repo.chatSessions.set(CHAT_1, CONV_1);
    service = new WorkspaceStateService(repo);
  });

  it('trả về location=null và layout=null khi user chưa có bản ghi', async () => {
    const res = await service.getState(USER_A);
    expect(res).toEqual({
      schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
      location: null,
      layout: null,
    });
  });

  it('từ chối payload không có nhóm nào hoặc vi phạm bất biến location', async () => {
    await expect(
      service.upsertState(USER_A, { sourceId: 'source-12345', seq: 1 }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.upsertState(USER_A, {
        sourceId: 'source-12345',
        seq: 1,
        location: { conversationId: CONV_1 },
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.upsertState(USER_A, {
        sourceId: 'source-12345',
        seq: 1,
        location: { tab: 'quiz' },
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.upsertState(USER_A, {
        sourceId: 'source-12345',
        seq: 1,
        location: {
          subjectId: SUBJ_1,
          conversationId: CONV_1,
          document: { docId: DOC_1, page: 0 },
        },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('bảo toàn nhóm độc lập và chống đảo thứ tự / retry trùng theo sourceId+seq', async () => {
    const first = await service.upsertState(USER_A, {
      sourceId: 'tab-source-1',
      seq: 2,
      location: { subjectId: SUBJ_1, conversationId: CONV_1, tab: 'documents' },
    });
    expect(first).toEqual({ locationApplied: true });

    // Ghi layout độc lập không làm mất location
    const layoutWrite = await service.upsertState(USER_A, {
      sourceId: 'tab-source-1',
      seq: 3,
      layout: { leftSidebarCollapsed: true, rightSidebarCollapsed: false },
    });
    expect(layoutWrite).toEqual({ layoutApplied: true });

    // Retry cùng sourceId + seq=2 bị bỏ qua (idempotent)
    const retry = await service.upsertState(USER_A, {
      sourceId: 'tab-source-1',
      seq: 2,
      location: {},
    });
    expect(retry).toEqual({ locationApplied: false });

    // Request cũ seq=1 từ cùng sourceId bị bỏ qua
    const stale = await service.upsertState(USER_A, {
      sourceId: 'tab-source-1',
      seq: 1,
      location: {},
    });
    expect(stale).toEqual({ locationApplied: false });

    // Nguồn khác (thiết bị khác) với seq=1 vẫn thắng (LWW)
    const otherDevice = await service.upsertState(USER_A, {
      sourceId: 'device-b-9999',
      seq: 1,
      location: { subjectId: SUBJ_1, conversationId: CONV_1, tab: 'summary', summaryId: SUM_1 },
    });
    expect(otherDevice).toEqual({ locationApplied: true });

    const state = await service.getState(USER_A);
    expect(state.location).toEqual({
      resolution: 'valid',
      subjectId: SUBJ_1,
      conversationId: CONV_1,
      tab: 'summary',
      summaryId: SUM_1,
    });
    expect(state.layout).toEqual({
      leftSidebarCollapsed: true,
      rightSidebarCollapsed: false,
    });
  });

  it('trả về invalid khi conversation bị xóa hoặc thuộc user khác (chống rò rỉ)', async () => {
    await service.upsertState(USER_B, {
      sourceId: 'attacker-src-1',
      seq: 1,
      location: {
        subjectId: SUBJ_1,
        conversationId: CONV_1,
        tab: 'documents',
        document: { docId: DOC_1, page: 4 },
      },
    });

    const stateB = await service.getState(USER_B);
    expect(stateB.location).toEqual({ resolution: 'invalid' });
  });

  it('chuẩn hóa subjectId theo server và chỉ loại bỏ tài nguyên con đã xóa (giữ conversation valid)', async () => {
    await service.upsertState(USER_A, {
      sourceId: 'source-abc-123',
      seq: 1,
      location: {
        subjectId: SUBJ_2, // cố tình lệch subjectId
        conversationId: CONV_1,
        tab: 'documents',
        document: { docId: DOC_1, page: 7 },
        summaryId: SUM_1,
        deckId: DECK_1,
        quizId: QUIZ_1,
        chatSessionId: CHAT_1,
      },
    });

    // Xóa riêng document & chatSession, giữ conversation & các mục khác
    repo.docs.delete(DOC_1);
    repo.chatSessions.delete(CHAT_1);

    const state = await service.getState(USER_A);
    expect(state.location).toEqual({
      resolution: 'valid',
      subjectId: SUBJ_1, // chuẩn hóa theo server
      conversationId: CONV_1,
      tab: 'documents',
      summaryId: SUM_1,
      deckId: DECK_1,
      quizId: QUIZ_1,
    });
  });

  it('lan truyền lỗi DB thành exception (5xx) thay vì trả về invalid', async () => {
    repo.shouldThrowOnFind = true;
    await expect(service.getState(USER_A)).rejects.toThrow('DB connection lost');
  });
});
