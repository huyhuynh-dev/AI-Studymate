export const WORKSPACE_STATE_SCHEMA_VERSION = 1;
export const MAX_WORKSPACE_PAGE = 100_000;
export const MAX_WORKSPACE_TAB_LENGTH = 32;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface WorkspaceDocumentPointer {
  readonly docId: string;
  readonly page?: number;
}

export interface WorkspaceLocationPayload {
  readonly subjectId?: string;
  readonly conversationId?: string;
  readonly tab?: string;
  readonly document?: WorkspaceDocumentPointer;
  readonly summaryId?: string;
  readonly deckId?: string;
  readonly quizId?: string;
  readonly chatSessionId?: string;
}

export interface WorkspaceLayoutPayload {
  readonly leftSidebarCollapsed: boolean;
  readonly rightSidebarCollapsed: boolean;
}

export type ResolvedWorkspaceLocation =
  | ({ readonly resolution: 'valid' } & WorkspaceLocationPayload)
  | { readonly resolution: 'invalid' };

export interface WorkspaceStateReadResult {
  readonly schemaVersion: number;
  readonly location: ResolvedWorkspaceLocation | null;
  readonly layout: WorkspaceLayoutPayload | null;
}

export interface UpsertWorkspaceStateResult {
  readonly locationApplied?: boolean;
  readonly layoutApplied?: boolean;
}

export type InvariantValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export function isUuidString(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Kiểm tra các bất biến cấu trúc của nhóm `location`.
 * Quy tắc:
 * - `{}` (mức home) hợp lệ.
 * - `conversationId` bắt buộc phải có `subjectId`.
 * - Các trường con của conversation (`tab`, `document`, `summaryId`, `deckId`, `quizId`, `chatSessionId`)
 *   bắt buộc phải có `conversationId`.
 * - `document.page` (nếu có) phải là số nguyên dương trong [1, 100000].
 */
export function validateLocationInvariants(
  location: WorkspaceLocationPayload,
): InvariantValidationResult {
  if (location.conversationId && !location.subjectId) {
    return {
      ok: false,
      reason: 'conversationId bắt buộc phải đi kèm subjectId',
    };
  }

  const hasConversationChildren = Boolean(
    location.tab !== undefined ||
      location.document !== undefined ||
      location.summaryId !== undefined ||
      location.deckId !== undefined ||
      location.quizId !== undefined ||
      location.chatSessionId !== undefined,
  );

  if (hasConversationChildren && !location.conversationId) {
    return {
      ok: false,
      reason:
        'Các trạng thái chi tiết (tab, document, summary, deck, quiz, chatSession) bắt buộc phải có conversationId',
    };
  }

  if (location.document !== undefined) {
    if (!isUuidString(location.document.docId)) {
      return { ok: false, reason: 'document.docId không hợp lệ' };
    }
    if (location.document.page !== undefined) {
      const page = location.document.page;
      if (
        typeof page !== 'number' ||
        !Number.isInteger(page) ||
        page < 1 ||
        page > MAX_WORKSPACE_PAGE
      ) {
        return {
          ok: false,
          reason: `document.page phải là số nguyên trong khoảng 1..${MAX_WORKSPACE_PAGE}`,
        };
      }
    }
  }

  return { ok: true };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Chuẩn hóa an toàn dữ liệu `location_json` đọc từ DB, tránh lỗi runtime nếu schema cũ/hỏng.
 */
export function sanitizeStoredLocation(
  raw: unknown,
): WorkspaceLocationPayload | null {
  if (!isPlainObject(raw)) return null;

  const result: {
    subjectId?: string;
    conversationId?: string;
    tab?: string;
    document?: WorkspaceDocumentPointer;
    summaryId?: string;
    deckId?: string;
    quizId?: string;
    chatSessionId?: string;
  } = {};

  if (isUuidString(raw.subjectId)) result.subjectId = raw.subjectId;
  if (isUuidString(raw.conversationId))
    result.conversationId = raw.conversationId;
  if (
    typeof raw.tab === 'string' &&
    raw.tab.length > 0 &&
    raw.tab.length <= MAX_WORKSPACE_TAB_LENGTH
  ) {
    result.tab = raw.tab;
  }

  if (isPlainObject(raw.document) && isUuidString(raw.document.docId)) {
    const rawPage = raw.document.page;
    const page =
      typeof rawPage === 'number' &&
      Number.isInteger(rawPage) &&
      rawPage >= 1 &&
      rawPage <= MAX_WORKSPACE_PAGE
        ? rawPage
        : undefined;
    result.document = page !== undefined
      ? { docId: raw.document.docId, page }
      : { docId: raw.document.docId };
  }

  if (isUuidString(raw.summaryId)) result.summaryId = raw.summaryId;
  if (isUuidString(raw.deckId)) result.deckId = raw.deckId;
  if (isUuidString(raw.quizId)) result.quizId = raw.quizId;
  if (isUuidString(raw.chatSessionId)) result.chatSessionId = raw.chatSessionId;

  const invariant = validateLocationInvariants(result);
  if (!invariant.ok) {
    return null;
  }

  return result;
}

/**
 * Chuẩn hóa an toàn dữ liệu `layout_json` đọc từ DB.
 */
export function sanitizeStoredLayout(
  raw: unknown,
): WorkspaceLayoutPayload | null {
  if (!isPlainObject(raw)) return null;
  if (
    typeof raw.leftSidebarCollapsed !== 'boolean' ||
    typeof raw.rightSidebarCollapsed !== 'boolean'
  ) {
    return null;
  }
  return {
    leftSidebarCollapsed: raw.leftSidebarCollapsed,
    rightSidebarCollapsed: raw.rightSidebarCollapsed,
  };
}
