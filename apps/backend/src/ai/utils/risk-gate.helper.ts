export type ToolRiskTier = 'tier_0' | 'tier_1' | 'tier_2';

export const MAX_ACTIVE_TOOLS_BUDGET = 19;

const TIER_2_NOTE_ACTIONS = new Set([
  'replace_content',
  'refine_note',
  'delete_note',
  'batch_reorganize',
]);

const TIER_1_NOTE_ACTIONS = new Set([
  'create_manual',
  'rename',
  'append_section',
  'update_section',
]);

const TIER_2_QUIZ_ACTIONS = new Set([
  'delete_quiz',
  'delete_questions',
  'batch_update_questions',
]);

const TIER_1_QUIZ_ACTIONS = new Set([
  'update_metadata',
  'add_question',
  'update_question',
]);

const TIER_1_DOC_ACTIONS = new Set([
  'save_as_new_document',
  'convert_note_to_markdown',
  'convert_markdown_to_note',
]);

const TIER_1_WORKSPACE_ACTIONS = new Set([
  'update_preferences',
  'undo_action',
  'enqueue_background_job',
  'retry_job',
  'cancel_job',
]);

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object'
    ? (input as Record<string, unknown>)
    : {};
}

/**
 * Xác định tầng rủi ro tất định (Tier 0 / Tier 1 / Tier 2) cho mọi tool call của Agent.
 */
export function evaluateToolRiskTier(
  toolName: string,
  input: unknown,
): ToolRiskTier {
  const payload = asRecord(input);
  const action =
    typeof payload.action === 'string' ? payload.action.trim() : '';

  switch (toolName) {
    case 'manageNotes': {
      if (TIER_2_NOTE_ACTIONS.has(action)) return 'tier_2';
      if (TIER_1_NOTE_ACTIONS.has(action)) return 'tier_1';
      return 'tier_2';
    }
    case 'manageFlashcards': {
      if (
        action === 'delete_deck' ||
        action === 'delete_cards' ||
        action === 'merge_duplicates'
      ) {
        return 'tier_2';
      }
      if (action === 'add_cards') {
        const cards = Array.isArray(payload.cards) ? payload.cards : [];
        return cards.length > 5 ? 'tier_2' : 'tier_1';
      }
      if (action === 'move_cards') {
        const cardIds = Array.isArray(payload.cardIds) ? payload.cardIds : [];
        return cardIds.length >= 2 ? 'tier_2' : 'tier_1';
      }
      if (
        action === 'create_deck' ||
        action === 'rename_deck' ||
        action === 'update_card'
      ) {
        return 'tier_1';
      }
      return 'tier_2';
    }
    case 'manageQuiz': {
      if (TIER_2_QUIZ_ACTIONS.has(action)) return 'tier_2';
      if (TIER_1_QUIZ_ACTIONS.has(action)) return 'tier_1';
      return 'tier_2';
    }
    case 'manageEditableDocument': {
      if (action === 'read_content') return 'tier_0';
      if (action === 'update_content') return 'tier_2';
      if (TIER_1_DOC_ACTIONS.has(action)) return 'tier_1';
      return 'tier_2';
    }
    case 'manageWorkspaceAndJobs': {
      if (TIER_1_WORKSPACE_ACTIONS.has(action)) return 'tier_1';
      return 'tier_0';
    }
    default:
      return 'tier_0';
  }
}

/**
 * Predicate truyền trực tiếp vào `needsApproval` của Vercel AI SDK v6 `tool(...)`.
 */
export function requiresUserApproval(
  toolName: string,
  input: unknown,
): boolean {
  return evaluateToolRiskTier(toolName, input) === 'tier_2';
}

export interface UnifiedTextDiffPreview {
  diffText: string;
  addedLines: number;
  removedLines: number;
  truncated: boolean;
}

/**
 * Tạo bản xem trước khác biệt theo dòng (Unified Diff) gọn nhẹ cho thẻ duyệt Tier 2.
 */
export function buildUnifiedTextDiffPreview(
  beforeText: string,
  afterText: string,
  maxLines = 60,
): UnifiedTextDiffPreview {
  const beforeLines = beforeText.replace(/\r\n/g, '\n').split('\n');
  const afterLines = afterText.replace(/\r\n/g, '\n').split('\n');

  const n = beforeLines.length;
  const m = afterLines.length;

  // Khi tệp rất dài, tìm tiền tố/hậu tố chung để giữ thuật toán nhanh O(1) bộ nhớ nhỏ
  let prefix = 0;
  while (prefix < n && prefix < m && beforeLines[prefix] === afterLines[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < n - prefix &&
    suffix < m - prefix &&
    beforeLines[n - 1 - suffix] === afterLines[m - 1 - suffix]
  ) {
    suffix += 1;
  }

  const diffLines: string[] = [];
  let removedLines = 0;
  let addedLines = 0;

  if (prefix > 0) {
    const contextStart = Math.max(0, prefix - 2);
    if (contextStart > 0) {
      diffLines.push(`@@ -${contextStart + 1},... +${contextStart + 1},... @@`);
    }
    for (let i = contextStart; i < prefix; i += 1) {
      diffLines.push(`  ${beforeLines[i]}`);
    }
  }

  const midBefore = beforeLines.slice(prefix, n - suffix);
  const midAfter = afterLines.slice(prefix, m - suffix);

  // LCS cho phần giữa nếu kích thước hợp lý (<= 250x250), ngược lại xuất block -/+
  if (midBefore.length * midAfter.length <= 62_500) {
    const dp: number[][] = Array.from({ length: midBefore.length + 1 }, () =>
      Array.from({ length: midAfter.length + 1 }, () => 0),
    );
    for (let i = midBefore.length - 1; i >= 0; i -= 1) {
      for (let j = midAfter.length - 1; j >= 0; j -= 1) {
        if (midBefore[i] === midAfter[j]) {
          dp[i][j] = dp[i + 1][j + 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    let i = 0;
    let j = 0;
    while (i < midBefore.length && j < midAfter.length) {
      if (midBefore[i] === midAfter[j]) {
        diffLines.push(`  ${midBefore[i]}`);
        i += 1;
        j += 1;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        diffLines.push(`- ${midBefore[i]}`);
        removedLines += 1;
        i += 1;
      } else {
        diffLines.push(`+ ${midAfter[j]}`);
        addedLines += 1;
        j += 1;
      }
    }
    while (i < midBefore.length) {
      diffLines.push(`- ${midBefore[i]}`);
      removedLines += 1;
      i += 1;
    }
    while (j < midAfter.length) {
      diffLines.push(`+ ${midAfter[j]}`);
      addedLines += 1;
      j += 1;
    }
  } else {
    for (const line of midBefore) {
      diffLines.push(`- ${line}`);
      removedLines += 1;
    }
    for (const line of midAfter) {
      diffLines.push(`+ ${line}`);
      addedLines += 1;
    }
  }

  if (suffix > 0) {
    const suffixStart = m - suffix;
    const contextEnd = Math.min(m, suffixStart + 2);
    for (let i = suffixStart; i < contextEnd; i += 1) {
      diffLines.push(`  ${afterLines[i]}`);
    }
  }

  const truncated = diffLines.length > maxLines;
  const visible = truncated ? diffLines.slice(0, maxLines) : diffLines;

  return {
    diffText: visible.join('\n'),
    addedLines,
    removedLines,
    truncated,
  };
}

const FLASHCARD_OR_QUIZ_INTENT_REGEX =
  /(flashcard|deck|bộ thẻ|thẻ ghi nhớ|quiz|đề thi|câu hỏi kiểm tra|bài kiểm tra)/i;

/**
 * Contextual Tool Scoping (Poka-yoke Tool Budget < 20):
 * - Chế độ thường (không mở Word): tối đa 17 tools (< 20).
 * - Chế độ Word (mở .docx): nếu tin nhắn nhắc Flashcard/Quiz -> giữ nhóm Flashcard/Quiz và ẩn superdoc_api_search/call (<= 19);
 *   ngược lại ưu tiên đủ 5 SuperDoc Word tools + Note/Workspace/RAG/Summary/Web (<= 17).
 */
export function resolveActiveToolsForTurn(params: {
  registeredToolNames: string[];
  hasActiveWordDocument: boolean;
  lastUserMessageText?: string;
}): string[] {
  const { registeredToolNames, hasActiveWordDocument, lastUserMessageText } =
    params;

  let filtered: string[];
  if (!hasActiveWordDocument) {
    filtered = [...registeredToolNames];
  } else {
    const mentionsStudyCardsOrQuiz = Boolean(
      lastUserMessageText &&
        FLASHCARD_OR_QUIZ_INTENT_REGEX.test(lastUserMessageText),
    );

    const hiddenSet = mentionsStudyCardsOrQuiz
      ? new Set([
          'manageEditableDocument',
          'superdoc_api_search',
          'superdoc_api_call',
        ])
      : new Set([
          'manageEditableDocument',
          'getQuizContent',
          'getDeckCards',
          'manageFlashcards',
          'manageQuiz',
        ]);

    filtered = registeredToolNames.filter((name) => !hiddenSet.has(name));
  }

  if (filtered.length > MAX_ACTIVE_TOOLS_BUDGET) {
    return filtered.slice(0, MAX_ACTIVE_TOOLS_BUDGET);
  }

  return filtered;
}
