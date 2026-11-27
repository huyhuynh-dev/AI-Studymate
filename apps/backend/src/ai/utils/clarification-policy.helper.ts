import type { UIMessage } from 'ai';
import type { ResolvedWorkspaceContext } from '../prompts/workspace-context.types.js';

export interface ClarificationDocumentCandidate {
  documentId: string;
  fileName: string;
}

export type SourceResolutionKind =
  | 'explicit'
  | 'explicit_conversation_all'
  | 'attached'
  | 'viewing'
  | 'single_doc'
  | 'recent_turn'
  | 'anti_repeat_all';

export type ArtifactSourceResolution =
  | {
      status: 'resolved';
      documentIds: string[];
      resolutionKind: SourceResolutionKind;
    }
  | {
      status: 'needs_clarification';
      missingField: 'documentIds';
      candidates: ClarificationDocumentCandidate[];
      message: string;
    }
  | {
      status: 'empty_workspace';
      message: string;
    };

const EXPLICIT_ALL_DOCS_REGEX =
  /(?:^|[^\p{L}\p{N}])(tất cả|toàn bộ|cả bộ|mọi tài liệu|tất cả các file|tổng hợp các tài liệu|toàn phiên|toàn bộ phiên|all documents|all files|entire conversation|whole session|everything)(?=$|[^\p{L}\p{N}])/iu;

function getToolPartName(part: unknown): string | null {
  if (!part || typeof part !== 'object') return null;
  const record = part as { type?: unknown; toolName?: unknown };
  if (typeof record.type !== 'string') return null;
  if (record.type === 'dynamic-tool' && typeof record.toolName === 'string') {
    return record.toolName;
  }
  if (record.type.startsWith('tool-')) {
    return record.type.slice('tool-'.length);
  }
  return null;
}

function getLatestUserMessageText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role !== 'user') continue;
    if (Array.isArray(msg.parts)) {
      const texts = msg.parts
        .filter(
          (p): p is { type: 'text'; text: string } =>
            Boolean(p) &&
            typeof p === 'object' &&
            (p as { type?: unknown }).type === 'text' &&
            typeof (p as { text?: unknown }).text === 'string',
        )
        .map((p) => p.text.trim())
        .filter(Boolean);
      if (texts.length > 0) return texts.join(' ');
    }
    const content = (msg as { content?: unknown }).content;
    if (typeof content === 'string' && content.trim()) {
      return content.trim();
    }
    return '';
  }
  return '';
}

function hasPendingOrJustResolvedAskUserQuestion(
  assistantMessage: UIMessage,
): boolean {
  if (
    assistantMessage.role !== 'assistant' ||
    !Array.isArray(assistantMessage.parts)
  ) {
    return false;
  }

  let lastAskIdx = -1;
  for (let i = 0; i < assistantMessage.parts.length; i += 1) {
    const part = assistantMessage.parts[i] as {
      type?: unknown;
      toolName?: unknown;
      state?: unknown;
    };
    const toolName = getToolPartName(part);
    if (
      toolName === 'askUserQuestion' &&
      (part.state === 'output-available' ||
        part.state === 'input-available' ||
        part.state === 'input-streaming')
    ) {
      lastAskIdx = i;
    }
  }

  if (lastAskIdx === -1) {
    return false;
  }

  // Nếu sau askUserQuestion trong cùng assistant message đã có câu trả lời text
  // hoặc đã hoàn tất tạo artifact thì lượt hỏi làm rõ đó đã khép lại từ phiên trước.
  for (let i = lastAskIdx + 1; i < assistantMessage.parts.length; i += 1) {
    const part = assistantMessage.parts[i] as {
      type?: unknown;
      text?: unknown;
      state?: unknown;
      output?: { status?: unknown };
    };
    if (
      part?.type === 'text' &&
      typeof part.text === 'string' &&
      part.text.trim().length > 0
    ) {
      return false;
    }
    const afterTool = getToolPartName(part);
    if (
      (afterTool === 'createDocumentSummary' ||
        afterTool === 'createFlashcards' ||
        afterTool === 'createQuiz') &&
      part.state === 'output-available' &&
      part.output?.status !== 'needs_clarification'
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Kiểm tra xem trong chuỗi yêu cầu hiện tại đã từng hỏi làm rõ (và người dùng đã trả lời
 * hoặc chủ động bỏ qua widget) hay chưa, để chặn gọi `askUserQuestion` lần thứ 2.
 */
export function hasResolvedClarificationInCurrentChain(
  messages: UIMessage[],
): boolean {
  if (!Array.isArray(messages) || messages.length === 0) {
    return false;
  }

  const last = messages[messages.length - 1];
  if (!last) return false;

  if (last.role === 'assistant') {
    return hasPendingOrJustResolvedAskUserQuestion(last);
  }

  if (last.role === 'user' && messages.length >= 2) {
    const prev = messages[messages.length - 2];
    if (prev && prev.role === 'assistant') {
      return hasPendingOrJustResolvedAskUserQuestion(prev);
    }
  }

  return false;
}

function collectDocumentIdsFromPart(
  part: unknown,
  validDocIds: Set<string>,
  targetSet: Set<string>,
): void {
  if (!part || typeof part !== 'object') return;
  const toolName = getToolPartName(part);
  if (!toolName) return;

  const record = part as {
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
  };

  const addIfValid = (val: unknown) => {
    if (typeof val === 'string' && validDocIds.has(val)) {
      targetSet.add(val);
    }
  };

  const addArrayIfValid = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) addIfValid(item);
  };

  if (toolName === 'searchDocumentChunks') {
    addArrayIfValid(record.input?.documentIds);
    const sources = record.output?.sources;
    if (Array.isArray(sources)) {
      for (const s of sources) {
        if (s && typeof s === 'object') {
          addIfValid((s as { documentId?: unknown }).documentId);
        }
      }
    }
  } else if (toolName === 'getDocumentSectionOrPages') {
    addIfValid(record.output?.documentId);
    addIfValid(record.input?.documentId);
  } else if (toolName === 'getDocumentsFullContent') {
    addArrayIfValid(record.input?.documentIds);
    const docs = record.output?.documents;
    if (Array.isArray(docs)) {
      for (const d of docs) {
        if (d && typeof d === 'object') {
          addIfValid((d as { documentId?: unknown }).documentId);
        }
      }
    }
  } else if (
    toolName === 'createDocumentSummary' ||
    toolName === 'createFlashcards' ||
    toolName === 'createQuiz'
  ) {
    addArrayIfValid(record.input?.documentIds);
  }
}

/**
 * Bậc 5: Nếu lượt ngay trước thao tác duy nhất 1 tài liệu hợp lệ, tái sử dụng ID đó.
 */
export function extractRecentSingleTurnDocumentId(
  messages: UIMessage[],
  validDocIds: Set<string>,
): string | undefined {
  if (!Array.isArray(messages) || messages.length === 0 || validDocIds.size === 0) {
    return undefined;
  }

  let targetAssistant: UIMessage | undefined;
  const last = messages[messages.length - 1];
  if (last?.role === 'assistant') {
    for (let i = messages.length - 2; i >= 0; i -= 1) {
      if (messages[i]?.role === 'assistant') {
        targetAssistant = messages[i];
        break;
      }
    }
  } else {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'assistant') {
        targetAssistant = messages[i];
        break;
      }
    }
  }

  if (!targetAssistant || !Array.isArray(targetAssistant.parts)) {
    return undefined;
  }

  const foundIds = new Set<string>();
  for (const part of targetAssistant.parts) {
    collectDocumentIdsFromPart(part, validDocIds, foundIds);
  }

  if (foundIds.size === 1) {
    return Array.from(foundIds)[0];
  }
  return undefined;
}

/**
 * Chuỗi giải mã nguồn 6 bậc tất định cho nhóm tool tạo mới Artifact (Summary / Flashcards / Quiz).
 * Chặn trước side-effect khi nguồn mơ hồ (>= 2 tài liệu, không gắn/mở/tham chiếu)
 * và tự mở khóa khi Anti-Repeat đã kích hoạt.
 */
export function resolveArtifactSourceTarget(params: {
  toolKind: 'summary' | 'flashcards' | 'quiz';
  explicitDocumentIds?: string[];
  explicitConversationScope?: boolean;
  availableDocuments?: Array<{ documentId: string; fileName: string }>;
  attachedDocumentIds?: string[];
  workspaceContext?: ResolvedWorkspaceContext;
  messages?: UIMessage[];
}): ArtifactSourceResolution {
  const catalog = params.availableDocuments ?? [];
  const validDocIds = new Set(catalog.map((d) => d.documentId));
  const messages = params.messages ?? [];

  if (catalog.length === 0) {
    return {
      status: 'empty_workspace',
      message:
        'Hiện chưa có tài liệu nào sẵn sàng trong phiên học này. Hãy tải tài liệu lên trước rồi mình sẽ tạo giúp bạn nhé.',
    };
  }

  // Bậc 1: Explicit documentIds (hoặc scope='conversation' có chủ đích rõ ràng)
  const validExplicit = Array.isArray(params.explicitDocumentIds)
    ? [...new Set(params.explicitDocumentIds.filter((id) => validDocIds.has(id)))]
    : [];
  if (validExplicit.length > 0) {
    return {
      status: 'resolved',
      documentIds: validExplicit,
      resolutionKind: 'explicit',
    };
  }

  const antiRepeatActive = hasResolvedClarificationInCurrentChain(messages);

  if (params.toolKind === 'summary' && params.explicitConversationScope) {
    const latestUserText = getLatestUserMessageText(messages);
    if (
      catalog.length === 1 ||
      antiRepeatActive ||
      EXPLICIT_ALL_DOCS_REGEX.test(latestUserText)
    ) {
      return {
        status: 'resolved',
        documentIds: catalog.map((d) => d.documentId),
        resolutionKind: 'explicit_conversation_all',
      };
    }
  }

  // Bậc 2: Attached documents trong lượt hiện tại
  const validAttached = Array.isArray(params.attachedDocumentIds)
    ? [...new Set(params.attachedDocumentIds.filter((id) => validDocIds.has(id)))]
    : [];
  if (validAttached.length > 0) {
    return {
      status: 'resolved',
      documentIds: validAttached,
      resolutionKind: 'attached',
    };
  }

  // Bậc 3: Tài liệu đang mở trên UI (viewer chính hoặc side-panel)
  const viewingDocId =
    params.workspaceContext?.documentsView?.viewMode === 'viewer'
      ? params.workspaceContext.documentsView.viewingDocument?.documentId
      : undefined;
  const sidePanelDocId = params.workspaceContext?.sidePanel?.documentId;

  if (viewingDocId && validDocIds.has(viewingDocId)) {
    return {
      status: 'resolved',
      documentIds: [viewingDocId],
      resolutionKind: 'viewing',
    };
  }
  if (sidePanelDocId && validDocIds.has(sidePanelDocId)) {
    return {
      status: 'resolved',
      documentIds: [sidePanelDocId],
      resolutionKind: 'viewing',
    };
  }

  // Bậc 4: Chỉ có đúng 1 tài liệu sẵn sàng trong phiên học
  if (catalog.length === 1) {
    return {
      status: 'resolved',
      documentIds: [catalog[0].documentId],
      resolutionKind: 'single_doc',
    };
  }

  // Bậc 5: Lượt ngay trước thao tác duy nhất 1 tài liệu hợp lệ
  const recentDocId = extractRecentSingleTurnDocumentId(messages, validDocIds);
  if (recentDocId) {
    return {
      status: 'resolved',
      documentIds: [recentDocId],
      resolutionKind: 'recent_turn',
    };
  }

  // Bậc 6: Anti-Repeat (người dùng vừa trả lời hoặc bỏ qua askUserQuestion trong chuỗi này)
  if (antiRepeatActive) {
    return {
      status: 'resolved',
      documentIds: catalog.map((d) => d.documentId),
      resolutionKind: 'anti_repeat_all',
    };
  }

  return {
    status: 'needs_clarification',
    missingField: 'documentIds',
    candidates: catalog.map((d) => ({
      documentId: d.documentId,
      fileName: d.fileName,
    })),
    message:
      'Phiên học hiện có nhiều tài liệu sẵn sàng và chưa rõ nguồn mục tiêu. Hãy gọi askUserQuestion để hỏi người dùng chọn tài liệu nguồn (kèm tùy chọn "Tất cả tài liệu trong phiên").',
  };
}
