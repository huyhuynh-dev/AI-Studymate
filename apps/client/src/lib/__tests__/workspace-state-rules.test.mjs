import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRestoreHref,
  isDefaultHomeEntry,
  isValidConversationTab,
  isValidUuid,
  resolveConversationRestorePlan,
} from '../workspace-state-rules.ts';

const SUBJ_1 = '11111111-1111-4111-8111-111111111111';
const CONV_1 = '22222222-2222-4222-8222-222222222222';
const DOC_1 = '33333333-3333-4333-8333-333333333333';
const SUM_1 = '44444444-4444-4444-8444-444444444444';
const DECK_1 = '55555555-5555-4555-8555-555555555555';
const DECK_2 = '66666666-6666-4666-8666-666666666666';
const QUIZ_1 = '77777777-7777-4777-8777-777777777777';
const CHAT_1 = '88888888-8888-4888-8888-888888888888';

describe('workspace-state-rules', () => {
  it('nhận diện đúng /home mặc định không query vs các URL tường minh', () => {
    assert.equal(isDefaultHomeEntry('/home', ''), true);
    assert.equal(isDefaultHomeEntry('/home', '?'), true);
    assert.equal(isDefaultHomeEntry('/home', `?subject_id=${SUBJ_1}`), false);
    assert.equal(isDefaultHomeEntry(`/home/${SUBJ_1}`, ''), false);
    assert.equal(isDefaultHomeEntry('/profile', ''), false);
  });

  it('kiểm tra UUID và dựng đường dẫn khôi phục an toàn', () => {
    assert.equal(isValidUuid(SUBJ_1), true);
    assert.equal(isValidUuid('../etc/passwd'), false);
    assert.equal(isValidConversationTab('analytics'), true);
    assert.equal(isValidConversationTab('admin'), false);

    assert.equal(
      buildRestoreHref({
        resolution: 'valid',
        subjectId: SUBJ_1,
        conversationId: CONV_1,
      }),
      `/home/${SUBJ_1}/${CONV_1}`,
    );

    assert.equal(
      buildRestoreHref({
        resolution: 'valid',
        subjectId: SUBJ_1,
      }),
      `/home/${SUBJ_1}`,
    );

    assert.equal(buildRestoreHref({ resolution: 'invalid' }), null);
    assert.equal(
      buildRestoreHref({
        resolution: 'valid',
        subjectId: 'not-a-uuid',
      }),
      null,
    );
  });

  it('ưu tiên URL/sự kiện open-* và sessionStorage hơn ý định khôi phục', () => {
    const planFromIntent = resolveConversationRestorePlan(
      {},
      {
        tab: 'summary',
        summaryId: SUM_1,
        document: { docId: DOC_1, page: 4 },
        chatSessionId: CHAT_1,
      },
    );
    assert.equal(planFromIntent.tab, 'summary');
    assert.equal(planFromIntent.summaryIdToRestore, SUM_1);
    assert.equal(planFromIntent.documentToRestore, null);
    assert.equal(planFromIntent.chatSessionIdToRestore, CHAT_1);

    // Khi tab là flashcard, khôi phục đúng deckId; chat session ưu tiên sessionStorage của tab
    const planWithSessionStorage = resolveConversationRestorePlan(
      { sessionStorageChatId: 'tab-local-chat' },
      { tab: 'flashcard', deckId: DECK_1, chatSessionId: CHAT_1 },
    );
    assert.equal(planWithSessionStorage.tab, 'flashcard');
    assert.equal(planWithSessionStorage.deckIdToRestore, DECK_1);
    assert.equal(planWithSessionStorage.chatSessionIdToRestore, null);

    // Query ?tab=quiz hoặc ?deckId thắng ý định đã lưu
    const planExplicitQuery = resolveConversationRestorePlan(
      { queryTab: 'flashcard', queryDeckId: DECK_2 },
      { tab: 'quiz', quizId: QUIZ_1, chatSessionId: CHAT_1 },
    );
    assert.equal(planExplicitQuery.tab, 'flashcard');
    assert.equal(planExplicitQuery.deckIdToRestore, null);
    assert.equal(planExplicitQuery.quizIdToRestore, null);
    assert.equal(planExplicitQuery.chatSessionIdToRestore, CHAT_1);

    // Sự kiện open-summary thắng ý định đã lưu
    const planOpenEvent = resolveConversationRestorePlan(
      { openSummaryId: SUM_1 },
      { tab: 'documents', document: { docId: DOC_1, page: 2 } },
    );
    assert.equal(planOpenEvent.tab, 'summary');
    assert.equal(planOpenEvent.documentToRestore, null);
    assert.equal(planOpenEvent.summaryIdToRestore, null);
  });
});
