import { Injectable, Logger } from '@nestjs/common';
import type { ModelMessage, UIMessage } from 'ai';
import { AiService } from './ai.service.js';
import { estimateTokensFromChars } from './telemetry/ai-telemetry.service.js';
import {
  COMPACTION_KEEP_RECENT_TURNS,
  COMPACTION_MAX_SUMMARY_CHARS,
  COMPACTION_TRIGGER_TOKENS,
  buildCompactedBridgeMessages,
  buildDeterministicExtractiveCompaction,
  estimateModelMessagesChars,
  serializeMessagesForCompactionTranscript,
  splitMessagesForCompaction,
} from './utils/chat-context-manager.helper.js';

export const COMPACTION_CACHE_MAX_SESSIONS = 200;
export const COMPACTION_CACHE_TTL_MS = 30 * 60 * 1000;
export const COMPACTION_FAST_TIMEOUT_MS = 6_000;

interface CompactionCacheEntry {
  boundaryMessageId: string;
  compactedTurns: number;
  summary: string;
  updatedAt: number;
}

export interface CompactChatMessagesResult {
  messages: ModelMessage[];
  compacted: boolean;
  fromCache: boolean;
  usedFallback: boolean;
  estimatedTokensBefore: number;
  estimatedTokensAfter: number;
  compactedTurns: number;
}

@Injectable()
export class ChatCompactionService {
  private readonly logger = new Logger(ChatCompactionService.name);
  private readonly cache = new Map<string, CompactionCacheEntry>();

  constructor(private readonly aiService: AiService) {}

  clearSessionCache(chatSessionId: string): void {
    this.cache.delete(chatSessionId);
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  private getValidCacheEntry(
    chatSessionId?: string,
  ): CompactionCacheEntry | undefined {
    if (!chatSessionId) return undefined;
    const entry = this.cache.get(chatSessionId);
    if (!entry) return undefined;

    if (Date.now() - entry.updatedAt > COMPACTION_CACHE_TTL_MS) {
      this.cache.delete(chatSessionId);
      return undefined;
    }

    // Refresh LRU order
    this.cache.delete(chatSessionId);
    this.cache.set(chatSessionId, entry);
    return entry;
  }

  private setCacheEntry(
    chatSessionId: string | undefined,
    entry: CompactionCacheEntry,
  ): void {
    if (!chatSessionId) return;
    if (this.cache.has(chatSessionId)) {
      this.cache.delete(chatSessionId);
    } else if (this.cache.size >= COMPACTION_CACHE_MAX_SESSIONS) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(chatSessionId, entry);
  }

  private tryReuseCachedCompaction(params: {
    cached: CompactionCacheEntry;
    modelMessages: ModelMessage[];
    uiMessages: UIMessage[];
    triggerTokens: number;
    keepRecentTurns: number;
    estimatedTokensBefore: number;
  }): CompactChatMessagesResult | null {
    const {
      cached,
      modelMessages,
      uiMessages,
      triggerTokens,
      keepRecentTurns,
      estimatedTokensBefore,
    } = params;

    const uiUsers = uiMessages.filter((m) => m?.role === 'user');
    const boundaryUserIdx = uiUsers.findIndex(
      (u) => u?.id === cached.boundaryMessageId,
    );
    if (boundaryUserIdx === -1) {
      return null;
    }

    const tailTurnsCount = uiUsers.length - (boundaryUserIdx + 1);
    if (tailTurnsCount < 1 || tailTurnsCount > keepRecentTurns + 2) {
      return null;
    }

    const modelUserIndices: number[] = [];
    for (let i = 0; i < modelMessages.length; i += 1) {
      if (modelMessages[i]?.role === 'user') {
        modelUserIndices.push(i);
      }
    }

    const splitModelIdx = modelUserIndices[boundaryUserIdx + 1];
    if (typeof splitModelIdx !== 'number' || splitModelIdx <= 0) {
      return null;
    }

    const candidateMessages = [
      ...buildCompactedBridgeMessages(cached.summary, cached.compactedTurns),
      ...modelMessages.slice(splitModelIdx),
    ];
    const estimatedTokensAfter = estimateTokensFromChars(
      estimateModelMessagesChars(candidateMessages),
    );

    if (estimatedTokensAfter > triggerTokens) {
      return null;
    }

    return {
      messages: candidateMessages,
      compacted: true,
      fromCache: true,
      usedFallback: false,
      estimatedTokensBefore,
      estimatedTokensAfter,
      compactedTurns: cached.compactedTurns,
    };
  }

  async compactIfNeeded(params: {
    chatSessionId?: string;
    modelMessages: ModelMessage[];
    uiMessages: UIMessage[];
    triggerTokens?: number;
    keepRecentTurns?: number;
  }): Promise<CompactChatMessagesResult> {
    const triggerTokens = params.triggerTokens ?? COMPACTION_TRIGGER_TOKENS;
    const keepRecentTurns =
      params.keepRecentTurns ?? COMPACTION_KEEP_RECENT_TURNS;

    const estimatedTokensBefore = estimateTokensFromChars(
      estimateModelMessagesChars(params.modelMessages),
    );

    const cached = this.getValidCacheEntry(params.chatSessionId);
    if (cached) {
      const reused = this.tryReuseCachedCompaction({
        cached,
        modelMessages: params.modelMessages,
        uiMessages: params.uiMessages,
        triggerTokens,
        keepRecentTurns,
        estimatedTokensBefore,
      });
      if (reused) {
        return reused;
      }
    }

    if (estimatedTokensBefore <= triggerTokens) {
      return {
        messages: params.modelMessages,
        compacted: false,
        fromCache: false,
        usedFallback: false,
        estimatedTokensBefore,
        estimatedTokensAfter: estimatedTokensBefore,
        compactedTurns: 0,
      };
    }

    const split = splitMessagesForCompaction(
      params.modelMessages,
      params.uiMessages,
      keepRecentTurns,
    );

    if (!split) {
      return {
        messages: params.modelMessages,
        compacted: false,
        fromCache: false,
        usedFallback: false,
        estimatedTokensBefore,
        estimatedTokensAfter: estimatedTokensBefore,
        compactedTurns: 0,
      };
    }

    let summaryText = '';
    let usedFallback = false;
    const transcriptToCompact = serializeMessagesForCompactionTranscript(
      split.olderMessages,
    );

    if (transcriptToCompact) {
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      try {
        const fastResponse = await Promise.race([
          this.aiService.generateTextForFeature('CHAT_COMPACTION', {
            transcriptToCompact,
            previousSummary: cached?.summary,
            maxSummaryChars: COMPACTION_MAX_SUMMARY_CHARS,
          }),
          new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => {
              reject(new Error('CHAT_COMPACTION timed out'));
            }, COMPACTION_FAST_TIMEOUT_MS);
          }),
        ]);
        summaryText = (fastResponse?.text || '').trim();
      } catch (err) {
        this.logger.warn(
          `[ChatCompactionService] FAST compaction failed, using deterministic fallback: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
      }
    }

    if (!summaryText) {
      usedFallback = true;
      summaryText = buildDeterministicExtractiveCompaction(
        split.olderMessages,
        COMPACTION_MAX_SUMMARY_CHARS,
      );
    }

    if (summaryText.length > COMPACTION_MAX_SUMMARY_CHARS) {
      summaryText = `${summaryText.slice(0, COMPACTION_MAX_SUMMARY_CHARS - 1)}…`;
    }

    this.setCacheEntry(params.chatSessionId, {
      boundaryMessageId: split.boundaryMessageId,
      compactedTurns: split.olderTurnCount,
      summary: summaryText,
      updatedAt: Date.now(),
    });

    const compactedMessages = [
      ...buildCompactedBridgeMessages(summaryText, split.olderTurnCount),
      ...split.recentMessages,
    ];
    const estimatedTokensAfter = estimateTokensFromChars(
      estimateModelMessagesChars(compactedMessages),
    );

    return {
      messages: compactedMessages,
      compacted: true,
      fromCache: false,
      usedFallback,
      estimatedTokensBefore,
      estimatedTokensAfter,
      compactedTurns: split.olderTurnCount,
    };
  }
}
