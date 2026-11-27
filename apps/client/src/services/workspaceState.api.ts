import { axiosClient } from '@/lib/axios.client';
import type {
  ResolvedWorkspaceLocationState,
  UpsertWorkspaceStateDto,
  UpsertWorkspaceStateResponse,
  ValidConversationTab,
  WorkspaceDocumentState,
  WorkspaceLayoutState,
  WorkspaceStateSnapshot,
} from '@/types/workspace-state';
import { VALID_CONVERSATION_TABS } from '@/types/workspace-state';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asUuid(value: unknown): string | undefined {
  return typeof value === 'string' && UUID_REGEX.test(value)
    ? value
    : undefined;
}

function asValidTab(value: unknown): ValidConversationTab | undefined {
  if (typeof value !== 'string') return undefined;
  return (VALID_CONVERSATION_TABS as readonly string[]).includes(value)
    ? (value as ValidConversationTab)
    : undefined;
}

function mapDocumentPointer(raw: unknown): WorkspaceDocumentState | undefined {
  if (!isPlainObject(raw)) return undefined;
  const docId = asUuid(raw.docId);
  if (!docId) return undefined;
  const rawPage = raw.page;
  const page =
    typeof rawPage === 'number' &&
    Number.isInteger(rawPage) &&
    rawPage >= 1 &&
    rawPage <= 100_000
      ? rawPage
      : undefined;
  return page !== undefined ? { docId, page } : { docId };
}

function mapResolvedLocation(
  raw: unknown,
): ResolvedWorkspaceLocationState | null {
  if (!isPlainObject(raw)) return null;
  if (raw.resolution === 'invalid') {
    return { resolution: 'invalid' };
  }
  if (raw.resolution !== 'valid') {
    return null;
  }

  const subjectId = asUuid(raw.subjectId);
  const conversationId = asUuid(raw.conversationId);
  const tab = conversationId ? asValidTab(raw.tab) : undefined;
  const document = conversationId ? mapDocumentPointer(raw.document) : undefined;
  const summaryId = conversationId ? asUuid(raw.summaryId) : undefined;
  const deckId = conversationId ? asUuid(raw.deckId) : undefined;
  const quizId = conversationId ? asUuid(raw.quizId) : undefined;
  const chatSessionId = conversationId ? asUuid(raw.chatSessionId) : undefined;

  return {
    resolution: 'valid',
    ...(subjectId ? { subjectId } : {}),
    ...(conversationId ? { conversationId } : {}),
    ...(tab ? { tab } : {}),
    ...(document ? { document } : {}),
    ...(summaryId ? { summaryId } : {}),
    ...(deckId ? { deckId } : {}),
    ...(quizId ? { quizId } : {}),
    ...(chatSessionId ? { chatSessionId } : {}),
  };
}

function mapLayout(raw: unknown): WorkspaceLayoutState | null {
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

/**
 * Chuẩn hóa phản hồi từ `GET /workspace-state` sang kiểu client an toàn.
 */
export function mapWorkspaceStateResponse(
  raw: unknown,
): WorkspaceStateSnapshot {
  if (!isPlainObject(raw)) {
    return { schemaVersion: 1, location: null, layout: null };
  }
  const schemaVersion =
    typeof raw.schemaVersion === 'number' && Number.isInteger(raw.schemaVersion)
      ? raw.schemaVersion
      : 1;

  return {
    schemaVersion,
    location: mapResolvedLocation(raw.location),
    layout: mapLayout(raw.layout),
  };
}

export const workspaceStateApi = {
  getState: async (signal?: AbortSignal): Promise<WorkspaceStateSnapshot> => {
    const res = await axiosClient.get<unknown>('/workspace-state', { signal });
    return mapWorkspaceStateResponse(res.data);
  },

  putState: async (
    payload: UpsertWorkspaceStateDto,
    signal?: AbortSignal,
  ): Promise<UpsertWorkspaceStateResponse> => {
    const res = await axiosClient.put<UpsertWorkspaceStateResponse>(
      '/workspace-state',
      payload,
      { signal },
    );
    return {
      ...(typeof res.data?.locationApplied === 'boolean'
        ? { locationApplied: res.data.locationApplied }
        : {}),
      ...(typeof res.data?.layoutApplied === 'boolean'
        ? { layoutApplied: res.data.layoutApplied }
        : {}),
    };
  },

  /**
   * Gửi cập nhật best-effort khi người dùng ẩn/đóng tab.
   * Đi qua Next.js BFF `/api/proxy/workspace-state` (cùng origin, qua csrf-guard).
   */
  putStateKeepalive: (payload: UpsertWorkspaceStateDto): void => {
    if (typeof fetch !== 'function') return;
    try {
      void fetch('/api/proxy/workspace-state', {
        method: 'PUT',
        keepalive: true,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    } catch {
      // Best-effort: bỏ qua lỗi khi trang đang đóng
    }
  },
};
