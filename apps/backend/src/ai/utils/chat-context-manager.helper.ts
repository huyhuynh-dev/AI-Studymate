import type { ModelMessage, UIMessage } from 'ai';
import { toSearchChunksLightweightOutput } from '../tools/definitions/documents/search-document-chunks.tool.js';
import { toSectionOrPagesLightweightOutput } from '../tools/definitions/documents/get-document-section-or-pages.tool.js';
import { toFullContentLightweightOutput } from '../tools/definitions/documents/get-documents-full-content.tool.js';
import { toNoteContentLightweightOutput } from '../tools/definitions/summaries/get-note-content.tool.js';
import { toQuizContentLightweightOutput } from '../tools/definitions/quiz/get-quiz-content.tool.js';
import { toDeckCardsLightweightOutput } from '../tools/definitions/flashcards/get-deck-cards.tool.js';
import { toWorkspaceResourcesLightweightOutput } from '../tools/definitions/common/search-workspace-resources.tool.js';
import {
  toSearchInternetLightweightOutput,
  toExtractWebPageLightweightOutput,
} from '../tools/definitions/web/index.js';
import {
  toSuperDocInspectLightweightOutput,
  toSuperDocApiSearchLightweightOutput,
  toSuperDocApiCallLightweightOutput,
} from '../tools/definitions/superdoc/index.js';

export const CLEAR_KEEP_RECENT_TURNS = 2;
export const CLEAR_MIN_OUTPUT_CHARS = 300;
export const COMPACTION_TRIGGER_TOKENS = 24_000;
export const COMPACTION_KEEP_RECENT_TURNS = 4;
export const COMPACTION_MAX_SUMMARY_CHARS = 3_000;

export const CLEARABLE_HEAVY_TOOLS = new Set<string>([
  'searchDocumentChunks',
  'getDocumentSectionOrPages',
  'getDocumentsFullContent',
  'getNoteContent',
  'getQuizContent',
  'getDeckCards',
  'searchWorkspaceResources',
  'searchInternet',
  'extractWebPage',
  'superdoc_inspect',
  'superdoc_api_search',
  'superdoc_api_call',
]);

function compactCitRange(ids: unknown): string {
  if (!Array.isArray(ids) || ids.length === 0) return '';
  const list = ids.filter((x): x is string => typeof x === 'string');
  if (list.length <= 3) return ` [${list.join(', ')}]`;
  return ` [${list[0]}..${list[list.length - 1]}]`;
}

function getStringField(
  obj: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const val = obj?.[key];
  return typeof val === 'string' && val.trim() ? val.trim() : undefined;
}

function getNumberField(
  obj: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  const val = obj?.[key];
  return typeof val === 'number' && Number.isFinite(val) ? val : undefined;
}

/**
 * Tạo chuỗi tóm tắt ngắn (~120–240 ký tự) thay thế tool-result đọc nặng ở các lượt cũ
 * dựa trên chính các hàm `to*LightweightOutput` của Phase 2.
 */
export function formatClearedToolSummary(
  toolName: string,
  input: unknown,
  rawOutput: unknown,
): string {
  const safeInput =
    input && typeof input === 'object'
      ? (input as Record<string, unknown>)
      : undefined;

  switch (toolName) {
    case 'searchDocumentChunks': {
      const lw = toSearchChunksLightweightOutput(rawOutput as any);
      const query = getStringField(lw, 'semanticQuery') ?? getStringField(safeInput, 'semanticQuery') ?? '';
      const total = getNumberField(lw, 'totalChunks') ?? 0;
      const sources = Array.isArray(lw?.sources)
        ? (lw.sources as Array<{ fileName?: string; pageNumbers?: number[] }>)
            .slice(0, 3)
            .map((s) => {
              const pages =
                Array.isArray(s.pageNumbers) && s.pageNumbers.length > 0
                  ? ` (p.${s.pageNumbers.slice(0, 4).join(', ')})`
                  : '';
              return `"${s.fileName || 'doc'}"${pages}`;
            })
            .join(', ')
        : '';
      const cits = compactCitRange(lw?.citationIds);
      return `[Cleared older tool result] searchDocumentChunks(query="${query.slice(0, 60)}"): retrieved ${total} chunks${sources ? ` from ${sources}` : ''}${cits}. Call searchDocumentChunks again if exact raw quotes are needed.`;
    }

    case 'getDocumentSectionOrPages': {
      const lw = toSectionOrPagesLightweightOutput(rawOutput as any);
      const fileName = getStringField(lw, 'fileName') ?? 'document';
      const total = getNumberField(lw, 'totalChunks') ?? 0;
      const cits = compactCitRange(lw?.citationIds);
      return `[Cleared older tool result] getDocumentSectionOrPages: read ${total} chunks from "${fileName}"${cits}. Call getDocumentSectionOrPages again if exact passages are needed.`;
    }

    case 'getDocumentsFullContent': {
      const lw = toFullContentLightweightOutput(rawOutput as any);
      const total = getNumberField(lw, 'totalDocuments') ?? 0;
      return `[Cleared older tool result] getDocumentsFullContent: read ${total} documents. Call document tools again if exact passages are needed.`;
    }

    case 'getNoteContent': {
      const lw = toNoteContentLightweightOutput(rawOutput as any);
      if (lw?.found === false) {
        return `[Cleared older tool result] getNoteContent: note not found (${getStringField(lw, 'message') ?? 'no match'}).`;
      }
      const title = getStringField(lw, 'title') ?? 'Untitled';
      const summaryId = getStringField(lw, 'summaryId') ?? '';
      const totalChars = getNumberField(lw, 'totalChars') ?? 0;
      return `[Cleared older tool result] getNoteContent: read Note "${title}"${summaryId ? ` (summaryId: "${summaryId}")` : ''} (${totalChars} chars). Call getNoteContent again if exact note text is needed.`;
    }

    case 'getQuizContent': {
      const lw = toQuizContentLightweightOutput(rawOutput as any);
      if (lw?.found === false) {
        return `[Cleared older tool result] getQuizContent: quiz/attempt not found.`;
      }
      const title = getStringField(lw, 'quizTitle') ?? 'Quiz';
      const quizId = getStringField(lw, 'quizId') ?? '';
      const returned = getNumberField(lw, 'returnedCount') ?? 0;
      const total = getNumberField(lw, 'totalQuestions') ?? 0;
      const examFlag = lw?.examIntegrityEnforced ? ', examIntegrityEnforced=true' : '';
      return `[Cleared older tool result] getQuizContent: read Quiz "${title}"${quizId ? ` (quizId: "${quizId}")` : ''} (${returned}/${total} questions${examFlag}). Call getQuizContent again if exact question details are needed.`;
    }

    case 'getDeckCards': {
      const lw = toDeckCardsLightweightOutput(rawOutput as any);
      if (lw?.found === false) {
        return `[Cleared older tool result] getDeckCards: deck not found.`;
      }
      const deckName = getStringField(lw, 'deckName') ?? 'Deck';
      const deckId = getStringField(lw, 'deckId') ?? '';
      const returned = getNumberField(lw, 'returnedCount') ?? 0;
      const total = getNumberField(lw, 'totalCards') ?? 0;
      const due = getNumberField(lw, 'dueCount') ?? 0;
      return `[Cleared older tool result] getDeckCards: read Deck "${deckName}"${deckId ? ` (deckId: "${deckId}")` : ''} (${returned}/${total} cards, due=${due}). Call getDeckCards again if card text is needed.`;
    }

    case 'searchWorkspaceResources': {
      const lw = toWorkspaceResourcesLightweightOutput(rawOutput as any);
      const total = getNumberField(lw, 'totalResults') ?? 0;
      const scope = getStringField(lw, 'scope') ?? 'conversation';
      const query = getStringField(lw, 'query');
      return `[Cleared older tool result] searchWorkspaceResources(scope="${scope}"${query ? `, query="${query.slice(0, 50)}"` : ''}): found ${total} resources. Call searchWorkspaceResources again if list details are needed.`;
    }

    case 'searchInternet': {
      const lw = toSearchInternetLightweightOutput(rawOutput as any);
      const query = getStringField(lw, 'query') ?? getStringField(safeInput, 'query') ?? '';
      const total = getNumberField(lw, 'totalResults') ?? 0;
      const domains = Array.isArray(lw?.domains) ? (lw.domains as string[]).slice(0, 4).join(', ') : '';
      const cits = compactCitRange(lw?.citationIds);
      return `[Cleared older tool result] searchInternet(query="${query.slice(0, 50)}"): ${total} results${domains ? ` (${domains})` : ''}${cits}.`;
    }

    case 'extractWebPage': {
      const lw = toExtractWebPageLightweightOutput(rawOutput as any);
      const totalSuccess = getNumberField(lw, 'totalSuccess') ?? 0;
      const domains = Array.isArray(lw?.domains) ? (lw.domains as string[]).slice(0, 4).join(', ') : '';
      const cits = compactCitRange(lw?.citationIds);
      return `[Cleared older tool result] extractWebPage: extracted ${totalSuccess} pages${domains ? ` (${domains})` : ''}${cits}. Call extractWebPage again if full text is needed.`;
    }

    case 'superdoc_inspect': {
      const lw = toSuperDocInspectLightweightOutput(
        (safeInput ?? {}) as Record<string, unknown>,
        rawOutput,
      );
      const summary =
        getStringField(lw, 'summary') ?? JSON.stringify(lw).slice(0, 140);
      return `[Cleared older tool result] superdoc_inspect: ${summary.slice(0, 140)}. Call superdoc_inspect again before editing if fresh nodeIds are needed.`;
    }

    case 'superdoc_api_search': {
      const lw = toSuperDocApiSearchLightweightOutput(
        (safeInput ?? {}) as Record<string, unknown>,
        rawOutput,
      );
      const summary =
        getStringField(lw, 'summary') ?? JSON.stringify(lw).slice(0, 140);
      return `[Cleared older tool result] superdoc_api_search: ${summary.slice(0, 140)}.`;
    }

    case 'superdoc_api_call': {
      const lw = toSuperDocApiCallLightweightOutput(
        (safeInput ?? {}) as Record<string, unknown>,
        rawOutput,
      );
      const summary =
        getStringField(lw, 'summary') ?? JSON.stringify(lw).slice(0, 140);
      return `[Cleared older tool result] superdoc_api_call: ${summary.slice(0, 140)}.`;
    }

    default:
      return `[Cleared older tool result] ${toolName}: completed in an earlier turn. Call ${toolName} again if exact output is needed.`;
  }
}

/**
 * Bước 1 (Tool-Result Clearing): Trích xuất bản đồ `toolCallId -> summary` từ các lượt
 * cũ hơn `keepRecentTurns` lượt user gần nhất. Tuyệt đối KHÔNG mutate `messages`.
 */
export function buildClearedToolSummariesMap(
  messages: UIMessage[],
  keepRecentTurns = CLEAR_KEEP_RECENT_TURNS,
): Map<string, string> {
  const summaryMap = new Map<string, string>();
  if (!Array.isArray(messages) || messages.length === 0) {
    return summaryMap;
  }

  const userIndices: number[] = [];
  for (let i = 0; i < messages.length; i += 1) {
    if (messages[i]?.role === 'user') {
      userIndices.push(i);
    }
  }

  if (userIndices.length <= keepRecentTurns) {
    return summaryMap;
  }

  const cutoffMessageIndex =
    keepRecentTurns <= 0
      ? messages.length
      : userIndices[userIndices.length - keepRecentTurns];

  for (let i = 0; i < cutoffMessageIndex; i += 1) {
    const msg = messages[i];
    if (msg?.role !== 'assistant' || !Array.isArray(msg.parts)) continue;

    for (const rawPart of msg.parts) {
      if (!rawPart || typeof rawPart !== 'object') continue;
      const part = rawPart as {
        type?: unknown;
        toolName?: unknown;
        toolCallId?: unknown;
        state?: unknown;
        input?: unknown;
        output?: unknown;
      };

      const toolName =
        part.type === 'dynamic-tool' && typeof part.toolName === 'string'
          ? part.toolName
          : typeof part.type === 'string' && part.type.startsWith('tool-')
            ? part.type.slice('tool-'.length)
            : null;

      if (
        !toolName ||
        !CLEARABLE_HEAVY_TOOLS.has(toolName) ||
        part.state !== 'output-available' ||
        typeof part.toolCallId !== 'string' ||
        !part.toolCallId
      ) {
        continue;
      }

      summaryMap.set(
        part.toolCallId,
        formatClearedToolSummary(toolName, part.input, part.output),
      );
    }
  }

  return summaryMap;
}

function getToolResultPartSerializedLength(output: unknown): number {
  if (output == null) return 0;
  if (typeof output === 'string') return output.length;
  if (typeof output === 'object') {
    const maybeText = output as { type?: unknown; value?: unknown };
    if (maybeText.type === 'text' && typeof maybeText.value === 'string') {
      return maybeText.value.length;
    }
  }
  try {
    return JSON.stringify(output).length;
  } catch {
    return 0;
  }
}

/**
 * Bước 2 (Tool-Result Clearing trên `ModelMessage[]` trong RAM):
 * Nén output cũ của tool đọc nặng (giữ nguyên `toolCallId`, `toolName` và cặp tool-call/tool-result)
 * đồng thời tỉa các phần `reasoning` cũ. Trả về mảng mới, không mutate đầu vào.
 */
export function clearOldToolResultsInModelMessages(
  modelMessages: ModelMessage[],
  clearedMap: Map<string, string>,
  options?: { pruneReasoningKeepRecentTurns?: number },
): {
  messages: ModelMessage[];
  clearedToolCount: number;
  prunedReasoningCount: number;
  savedChars: number;
} {
  if (!Array.isArray(modelMessages) || modelMessages.length === 0) {
    return {
      messages: modelMessages,
      clearedToolCount: 0,
      prunedReasoningCount: 0,
      savedChars: 0,
    };
  }

  const pruneKeepTurns = options?.pruneReasoningKeepRecentTurns ?? 1;
  const userModelIndices: number[] = [];
  for (let i = 0; i < modelMessages.length; i += 1) {
    if (modelMessages[i]?.role === 'user') {
      userModelIndices.push(i);
    }
  }
  const reasoningCutoffIdx =
    userModelIndices.length > pruneKeepTurns
      ? userModelIndices[userModelIndices.length - pruneKeepTurns]
      : 0;

  let clearedToolCount = 0;
  let prunedReasoningCount = 0;
  let savedChars = 0;

  const nextMessages = modelMessages.map((msg, idx) => {
    if (!msg) return msg;

    if (msg.role === 'tool' && Array.isArray(msg.content)) {
      let changed = false;
      const nextContent = msg.content.map((part) => {
        if (
          part &&
          typeof part === 'object' &&
          part.type === 'tool-result' &&
          typeof part.toolCallId === 'string' &&
          clearedMap.has(part.toolCallId)
        ) {
          const summary = clearedMap.get(part.toolCallId)!;
          const currentLen = getToolResultPartSerializedLength(part.output);
          if (currentLen > CLEAR_MIN_OUTPUT_CHARS && summary.length < currentLen) {
            changed = true;
            clearedToolCount += 1;
            savedChars += currentLen - summary.length;
            return {
              ...part,
              output: {
                type: 'text' as const,
                value: summary,
              },
            };
          }
        }
        return part;
      });

      return changed ? ({ ...msg, content: nextContent } as ModelMessage) : msg;
    }

    if (
      msg.role === 'assistant' &&
      idx < reasoningCutoffIdx &&
      Array.isArray(msg.content)
    ) {
      const hasReasoning = msg.content.some((p) => p?.type === 'reasoning');
      if (hasReasoning) {
        const remaining = msg.content.filter((p) => p?.type !== 'reasoning');
        if (remaining.length > 0) {
          const removedCount = msg.content.length - remaining.length;
          prunedReasoningCount += removedCount;
          for (const p of msg.content) {
            if (p?.type === 'reasoning' && typeof (p as { text?: unknown }).text === 'string') {
              savedChars += (p as { text: string }).text.length;
            }
          }
          return { ...msg, content: remaining } as ModelMessage;
        }
      }
    }

    return msg;
  });

  return {
    messages: nextMessages,
    clearedToolCount,
    prunedReasoningCount,
    savedChars,
  };
}

export function estimateModelMessagesChars(messages: ModelMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    if (!msg) continue;
    if (typeof msg.content === 'string') {
      total += msg.content.length;
      continue;
    }
    if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (!part || typeof part !== 'object') continue;
        if ('text' in part && typeof part.text === 'string') {
          total += part.text.length;
        } else if ('output' in part) {
          total += getToolResultPartSerializedLength(part.output);
        } else {
          try {
            total += JSON.stringify(part).length;
          } catch {
            // ignore circular safety
          }
        }
      }
    }
  }
  return total;
}

export interface CompactionSplitResult {
  olderMessages: ModelMessage[];
  recentMessages: ModelMessage[];
  olderTurnCount: number;
  boundaryMessageId: string;
}

/**
 * Tách mảng `ModelMessage[]` tại đúng ranh giới bắt đầu một lượt `role === 'user'`
 * để giữ nguyên vẹn `keepRecentTurns` lượt gần nhất và KHÔNG BAO GIỜ xẻ đôi cặp tool-call/tool-result.
 */
export function splitMessagesForCompaction(
  modelMessages: ModelMessage[],
  uiMessages: UIMessage[],
  keepRecentTurns = COMPACTION_KEEP_RECENT_TURNS,
): CompactionSplitResult | null {
  const modelUserIndices: number[] = [];
  for (let i = 0; i < modelMessages.length; i += 1) {
    if (modelMessages[i]?.role === 'user') {
      modelUserIndices.push(i);
    }
  }

  if (modelUserIndices.length <= keepRecentTurns) {
    return null;
  }

  const olderTurnCount = modelUserIndices.length - keepRecentTurns;
  const splitModelIdx = modelUserIndices[olderTurnCount];
  if (splitModelIdx <= 0) {
    return null;
  }

  const uiUsers = uiMessages.filter((m) => m?.role === 'user');
  const boundaryUiUser = uiUsers[olderTurnCount - 1];
  const boundaryMessageId = boundaryUiUser?.id || `turn-${olderTurnCount}`;

  return {
    olderMessages: modelMessages.slice(0, splitModelIdx),
    recentMessages: modelMessages.slice(splitModelIdx),
    olderTurnCount,
    boundaryMessageId,
  };
}

function extractCompactTextFromContent(content: ModelMessage['content']): string {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    if (part.type === 'text' && typeof part.text === 'string') {
      parts.push(part.text.trim());
    } else if (part.type === 'tool-call') {
      const inputStr = (() => {
        try {
          return JSON.stringify(part.input ?? {}).slice(0, 220);
        } catch {
          return '';
        }
      })();
      parts.push(`[ToolCall ${part.toolName}: ${inputStr}]`);
    } else if (part.type === 'tool-result') {
      const out = part.output;
      const outText =
        typeof out === 'object' &&
        out !== null &&
        'type' in out &&
        (out as { type?: unknown }).type === 'text' &&
        typeof (out as { value?: unknown }).value === 'string'
          ? (out as { value: string }).value
          : (() => {
              try {
                return JSON.stringify(out ?? '');
              } catch {
                return '';
              }
            })();
      parts.push(`[ToolResult ${part.toolName}: ${outText.slice(0, 450)}]`);
    }
  }
  return parts.filter(Boolean).join('\n');
}

export function serializeMessagesForCompactionTranscript(
  messages: ModelMessage[],
  maxInputChars = 28_000,
): string {
  const lines: string[] = [];
  let used = 0;

  for (const msg of messages) {
    const body = extractCompactTextFromContent(msg.content);
    if (!body) continue;
    const roleLabel =
      msg.role === 'user'
        ? 'Student'
        : msg.role === 'assistant'
          ? 'Tutor'
          : msg.role === 'tool'
            ? 'Tools'
            : 'System';
    const line = `[${roleLabel}]: ${body.slice(0, 2_000)}`;
    if (used + line.length + 2 > maxInputChars) {
      break;
    }
    lines.push(line);
    used += line.length + 2;
  }

  return lines.join('\n\n');
}

/**
 * Fallback tất định khi model `FAST` nén hội thoại gặp lỗi/timeout:
 * giữ lại các Artifact IDs, lựa chọn askUserQuestion và lát cắt ngắn của các lượt cũ.
 */
export function buildDeterministicExtractiveCompaction(
  olderMessages: ModelMessage[],
  maxSummaryChars = COMPACTION_MAX_SUMMARY_CHARS,
): string {
  const artifactLines: string[] = [];
  const decisionLines: string[] = [];
  const topicSnippets: string[] = [];

  for (const msg of olderMessages) {
    if (msg.role === 'user') {
      const text = extractCompactTextFromContent(msg.content)
        .replace(/\s+/g, ' ')
        .trim();
      if (text) {
        topicSnippets.push(`- Student: ${text.slice(0, 140)}`);
      }
      continue;
    }

    if (msg.role === 'tool' && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part?.type !== 'tool-result') continue;
        const outStr = extractCompactTextFromContent([part]);
        if (
          part.toolName === 'createDocumentSummary' ||
          part.toolName === 'createFlashcards' ||
          part.toolName === 'createQuiz'
        ) {
          artifactLines.push(`- ${part.toolName}: ${outStr.slice(0, 240)}`);
        } else if (part.toolName === 'askUserQuestion') {
          decisionLines.push(`- Clarification: ${outStr.slice(0, 200)}`);
        }
      }
    }
  }

  const sections: string[] = [];
  if (decisionLines.length > 0) {
    sections.push(`**Quyết định & Lựa chọn:**\n${decisionLines.slice(-4).join('\n')}`);
  }
  if (artifactLines.length > 0) {
    sections.push(`**Tài nguyên / Artifact đã tạo:**\n${artifactLines.slice(-8).join('\n')}`);
  }
  if (topicSnippets.length > 0) {
    sections.push(`**Mạch trao đổi trước đó:**\n${topicSnippets.slice(-8).join('\n')}`);
  }

  const joined =
    sections.join('\n\n') ||
    'Cuộc trò chuyện trước đó đã trao đổi nhiều lượt về tài liệu học tập trong phiên.';

  return joined.length > maxSummaryChars
    ? `${joined.slice(0, maxSummaryChars - 1)}…`
    : joined;
}

export function buildCompactedBridgeMessages(
  summaryText: string,
  compactedTurns: number,
): ModelMessage[] {
  const cleanSummary = summaryText.trim().slice(0, COMPACTION_MAX_SUMMARY_CHARS);
  return [
    {
      role: 'user',
      content: `<compacted_conversation_history compacted_turns="${compactedTurns}">\n${cleanSummary}\n</compacted_conversation_history>`,
    },
    {
      role: 'assistant',
      content:
        'Mình đã nắm lại toàn bộ bối cảnh, quyết định và tài nguyên từ các lượt trước đó. Chúng ta tiếp tục nhé.',
    },
  ];
}
