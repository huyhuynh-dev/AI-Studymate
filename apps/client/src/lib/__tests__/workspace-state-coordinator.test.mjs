import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WorkspaceStateCoordinator,
  mergeConversationPatch,
} from '../workspace-state-coordinator.ts';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const SUBJ_1 = '33333333-3333-4333-8333-333333333333';
const CONV_1 = '44444444-4444-4444-8444-444444444444';
const CONV_2 = '55555555-5555-4555-8555-555555555555';
const DOC_1 = '66666666-6666-4666-8666-666666666666';
const CHAT_1 = '77777777-7777-4777-8777-777777777777';

function createFakeTimers() {
  let now = 0;
  let nextId = 1;
  const tasks = new Map();

  return {
    timers: {
      setTimeout(fn, ms) {
        const id = nextId++;
        tasks.set(id, { runAt: now + ms, fn });
        return id;
      },
      clearTimeout(id) {
        tasks.delete(id);
      },
    },
    async advanceBy(ms) {
      const target = now + ms;
      while (true) {
        let earliestId = null;
        let earliestTime = Infinity;
        for (const [id, entry] of tasks.entries()) {
          if (entry.runAt <= target && entry.runAt < earliestTime) {
            earliestTime = entry.runAt;
            earliestId = id;
          }
        }
        if (earliestId === null) break;
        const entry = tasks.get(earliestId);
        tasks.delete(earliestId);
        now = entry.runAt;
        entry.fn();
        await Promise.resolve();
        await Promise.resolve();
      }
      now = target;
    },
  };
}

describe('WorkspaceStateCoordinator', () => {
  it('mergeConversationPatch khóa theo conversationId và bảo toàn trường anh em', () => {
    let state = mergeConversationPatch(null, {
      kind: 'document',
      subjectId: SUBJ_1,
      conversationId: CONV_1,
      document: { docId: DOC_1, page: 3 },
    });
    state = mergeConversationPatch(state, {
      kind: 'chatSession',
      subjectId: SUBJ_1,
      conversationId: CONV_1,
      chatSessionId: CHAT_1,
    });
    state = mergeConversationPatch(state, {
      kind: 'tab',
      subjectId: SUBJ_1,
      conversationId: CONV_1,
      tab: 'summary',
    });

    assert.deepEqual(state, {
      subjectId: SUBJ_1,
      conversationId: CONV_1,
      document: { docId: DOC_1, page: 3 },
      chatSessionId: CHAT_1,
      tab: 'summary',
    });

    // Chuyển conversation xóa toàn bộ trường con cũ
    const switched = mergeConversationPatch(state, {
      kind: 'route',
      subjectId: SUBJ_1,
      conversationId: CONV_2,
    });
    assert.deepEqual(switched, {
      subjectId: SUBJ_1,
      conversationId: CONV_2,
    });
  });

  it('không ghi trước khi settled và không ghi vị trí ban đầu khi unknown', async () => {
    const sent = [];
    const fake = createFakeTimers();
    const coordinator = new WorkspaceStateCoordinator({
      transport: {
        putState: async (p) => {
          sent.push(p);
          return { locationApplied: true };
        },
        putStateKeepalive: () => {},
      },
      generateSourceId: () => 'src-fixed-1',
      timers: fake.timers,
    });

    coordinator.bindUser(USER_A);
    coordinator.reportHome();
    await fake.advanceBy(5000);
    assert.equal(sent.length, 0);

    // Khi bootstrap gặp lỗi -> unknown: vị trí đầu tiên (/home) không được ghi lên server
    coordinator.markUnknown();
    coordinator.reportHome();
    await fake.advanceBy(5000);
    assert.equal(sent.length, 0);

    // Thao tác kế tiếp của user sau đó vẫn ghi bình thường
    coordinator.reportSubject(SUBJ_1);
    await fake.advanceBy(500);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0], {
      sourceId: 'src-fixed-1',
      seq: 1,
      location: { subjectId: SUBJ_1 },
    });
  });

  it('gộp debounce, đảm bảo single-flight và dùng debounce dài cho lật trang PDF', async () => {
    const sent = [];
    let resolveFirst = null;
    const fake = createFakeTimers();
    const coordinator = new WorkspaceStateCoordinator({
      transport: {
        putState: (p) => {
          sent.push(p);
          if (sent.length === 1) {
            return new Promise((r) => {
              resolveFirst = () => r({ locationApplied: true });
            });
          }
          return Promise.resolve({ locationApplied: true });
        },
        putStateKeepalive: () => {},
      },
      generateSourceId: () => 'src-fixed-2',
      timers: fake.timers,
    });

    coordinator.bindUser(USER_A);
    coordinator.markSettled();

    // Lật trang liên tục dùng debounce dài (1200ms)
    coordinator.reportDocument(SUBJ_1, CONV_1, { docId: DOC_1, page: 2 }, true);
    await fake.advanceBy(500);
    assert.equal(sent.length, 0);
    coordinator.reportDocument(SUBJ_1, CONV_1, { docId: DOC_1, page: 5 }, true);
    await fake.advanceBy(1200);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].location.document.page, 5);

    // Trong lúc request #1 đang bay, báo đổi layout -> không gửi song song
    coordinator.reportLayout({
      leftSidebarCollapsed: true,
      rightSidebarCollapsed: false,
    });
    await fake.advanceBy(1000);
    assert.equal(sent.length, 1);

    // Hoàn tất request #1 -> request #2 tự động gửi ngay với seq tăng dần
    resolveFirst();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(sent.length, 2);
    assert.equal(sent[1].seq, 2);
    assert.deepEqual(sent[1].layout, {
      leftSidebarCollapsed: true,
      rightSidebarCollapsed: false,
    });
  });

  it('hủy hàng đợi khi đổi user và dừng retry khi gặp 400', async () => {
    const sent = [];
    const fake = createFakeTimers();
    let mode = '400';
    const coordinator = new WorkspaceStateCoordinator({
      transport: {
        putState: async (p) => {
          sent.push(p);
          if (mode === '400') {
            const err = new Error('Bad Request');
            err.response = { status: 400 };
            throw err;
          }
          return { locationApplied: true };
        },
        putStateKeepalive: () => {},
      },
      generateSourceId: () => 'src-fixed-3',
      timers: fake.timers,
    });

    coordinator.bindUser(USER_A);
    coordinator.markSettled();
    coordinator.reportSubject(SUBJ_1);
    await fake.advanceBy(500);
    assert.equal(sent.length, 1);

    // 400 không retry thêm
    await fake.advanceBy(15000);
    assert.equal(sent.length, 1);

    // Có thay đổi chờ của USER_A, sau đó đổi sang USER_B -> thay đổi của A bị hủy hoàn toàn
    mode = 'ok';
    coordinator.reportConversation(SUBJ_1, CONV_1);
    coordinator.bindUser(USER_B);
    await fake.advanceBy(5000);
    assert.equal(sent.length, 1);
  });

  it('giữ nguyên seedFromServer khi hydrate lần đầu từ null sang userId', async () => {
    const sent = [];
    const fake = createFakeTimers();
    const coordinator = new WorkspaceStateCoordinator({
      transport: {
        putState: async (p) => {
          sent.push(p);
          return { locationApplied: true };
        },
        putStateKeepalive: () => {},
      },
      generateSourceId: () => 'src-fixed-hydrate',
      timers: fake.timers,
    });

    // Mô phỏng bootstrap GET xong trước khi useCurrentUser trả user.id
    coordinator.bindUser(null);
    coordinator.seedFromServer({
      schemaVersion: 1,
      location: {
        resolution: 'valid',
        subjectId: SUBJ_1,
        conversationId: CONV_1,
        tab: 'summary',
        document: { docId: DOC_1, page: 4 },
        chatSessionId: CHAT_1,
      },
      layout: null,
    });
    coordinator.markSettled();

    // Sau đó useCurrentUser trả về USER_A (null -> USER_A)
    coordinator.bindUser(USER_A);
    // Khi người dùng đổi sang tab khác, các trường cũ (document, chatSessionId) vẫn được giữ nguyên
    coordinator.reportTab(SUBJ_1, CONV_1, 'quiz');
    await fake.advanceBy(500);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].location, {
      subjectId: SUBJ_1,
      conversationId: CONV_1,
      tab: 'quiz',
      document: { docId: DOC_1, page: 4 },
      chatSessionId: CHAT_1,
    });
  });

  it('flushNow gửi ngay trước logout', async () => {
    const sent = [];
    const fake = createFakeTimers();
    const coordinator = new WorkspaceStateCoordinator({
      transport: {
        putState: async (p) => {
          sent.push(p);
          return { locationApplied: true };
        },
        putStateKeepalive: () => {},
      },
      generateSourceId: () => 'src-fixed-4',
      timers: fake.timers,
    });

    coordinator.bindUser(USER_A);
    coordinator.markSettled();
    coordinator.reportTab(SUBJ_1, CONV_1, 'quiz');
    await coordinator.flushNow(1500);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].location.tab, 'quiz');
  });
});
