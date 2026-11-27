import type {
  ResolvedWorkspaceLocationState,
  ValidConversationTab,
  WorkspaceDocumentState,
} from '../types/workspace-state';

const CONVERSATION_TABS: readonly ValidConversationTab[] = [
  'documents',
  'summary',
  'flashcard',
  'quiz',
  'analytics',
];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export function isValidConversationTab(
  value: unknown,
): value is ValidConversationTab {
  return (
    typeof value === 'string' &&
    (CONVERSATION_TABS as readonly string[]).includes(value)
  );
}

/**
 * Chỉ coi `/home` KHÔNG có query string là điểm vào mặc định để tự động chuyển hướng khôi phục.
 * Ví dụ `/home?subject_id=...` là điều hướng tường minh từ sidebar/link nên giữ nguyên.
 */
export function isDefaultHomeEntry(
  pathname: string | null | undefined,
  search: string | null | undefined,
): boolean {
  if (pathname !== '/home') return false;
  const cleaned = (search ?? '').replace(/^\?/, '').trim();
  return cleaned.length === 0;
}

/**
 * Dựng đường dẫn điều hướng an toàn từ UUID đã được server xác nhận `valid`.
 */
export function buildRestoreHref(
  location: ResolvedWorkspaceLocationState | null | undefined,
): string | null {
  if (!location || location.resolution !== 'valid') return null;

  if (isValidUuid(location.conversationId) && isValidUuid(location.subjectId)) {
    return `/home/${location.subjectId}/${location.conversationId}`;
  }

  if (isValidUuid(location.subjectId)) {
    return `/home/${location.subjectId}`;
  }

  return null;
}

export interface ConversationRestoreIntentInput {
  readonly tab?: ValidConversationTab | null;
  readonly document?: WorkspaceDocumentState | null;
  readonly summaryId?: string | null;
  readonly deckId?: string | null;
  readonly quizId?: string | null;
  readonly chatSessionId?: string | null;
}

export interface ConversationExplicitSignals {
  readonly queryTab?: string | null;
  readonly queryDeckId?: string | null;
  readonly queryDocId?: string | null;
  readonly queryPage?: number | null;
  readonly openSummaryId?: string | null;
  readonly openDeckId?: string | null;
  readonly openQuizId?: string | null;
  readonly sessionStorageChatId?: string | null;
}

export interface ConversationRestorePlan {
  readonly tab: ValidConversationTab;
  readonly documentToRestore: WorkspaceDocumentState | null;
  readonly summaryIdToRestore: string | null;
  readonly deckIdToRestore: string | null;
  readonly quizIdToRestore: string | null;
  readonly chatSessionIdToRestore: string | null;
}

/**
 * Giải quyết thứ tự ưu tiên khi mở ConversationPage:
 * 1. Đích tường minh (query URL hoặc sự kiện `open-*`) luôn thắng ý định khôi phục.
 * 2. Chat session: `sessionStorage` của tab > ý định khôi phục từ server > không chọn.
 * 3. Mục chi tiết chỉ được áp nếu tab hiệu lực trùng khớp.
 */
export function resolveConversationRestorePlan(
  explicit: ConversationExplicitSignals,
  intent: ConversationRestoreIntentInput | null,
): ConversationRestorePlan {
  let effectiveTab: ValidConversationTab = 'documents';
  let hasExplicitTab = false;

  if (explicit.openSummaryId) {
    effectiveTab = 'summary';
    hasExplicitTab = true;
  } else if (explicit.openDeckId) {
    effectiveTab = 'flashcard';
    hasExplicitTab = true;
  } else if (explicit.openQuizId) {
    effectiveTab = 'quiz';
    hasExplicitTab = true;
  } else if (isValidConversationTab(explicit.queryTab)) {
    effectiveTab = explicit.queryTab;
    hasExplicitTab = true;
  } else if (isValidUuid(explicit.queryDocId)) {
    effectiveTab = 'documents';
    hasExplicitTab = true;
  } else if (isValidUuid(explicit.queryDeckId)) {
    effectiveTab = 'flashcard';
    hasExplicitTab = true;
  } else if (intent?.tab && isValidConversationTab(intent.tab)) {
    effectiveTab = intent.tab;
  }

  const hasExplicitDoc = isValidUuid(explicit.queryDocId);
  const hasExplicitDeck = Boolean(explicit.openDeckId || isValidUuid(explicit.queryDeckId));
  const hasExplicitSummary = Boolean(explicit.openSummaryId);
  const hasExplicitQuiz = Boolean(explicit.openQuizId);

  const documentToRestore =
    !hasExplicitTab &&
    !hasExplicitDoc &&
    effectiveTab === 'documents' &&
    intent?.document &&
    isValidUuid(intent.document.docId)
      ? intent.document
      : null;

  const summaryIdToRestore =
    !hasExplicitTab &&
    !hasExplicitSummary &&
    effectiveTab === 'summary' &&
    intent?.summaryId &&
    isValidUuid(intent.summaryId)
      ? intent.summaryId
      : null;

  const deckIdToRestore =
    !hasExplicitTab &&
    !hasExplicitDeck &&
    effectiveTab === 'flashcard' &&
    intent?.deckId &&
    isValidUuid(intent.deckId)
      ? intent.deckId
      : null;

  const quizIdToRestore =
    !hasExplicitTab &&
    !hasExplicitQuiz &&
    effectiveTab === 'quiz' &&
    intent?.quizId &&
    isValidUuid(intent.quizId)
      ? intent.quizId
      : null;

  const chatSessionIdToRestore = explicit.sessionStorageChatId
    ? null
    : intent?.chatSessionId && isValidUuid(intent.chatSessionId)
      ? intent.chatSessionId
      : null;

  return {
    tab: effectiveTab,
    documentToRestore,
    summaryIdToRestore,
    deckIdToRestore,
    quizIdToRestore,
    chatSessionIdToRestore,
  };
}
