import type { TextCitationAnchor } from '@/types/source-ref';

export interface EditorCitationTarget {
  documentId: string;
  fileName?: string;
  citationId?: string;
  chunkId?: string;
  chunkIndex?: number;
  pageNo?: number;
  rawContent?: string;
  headings?: string[];
  textAnchor?: TextCitationAnchor;
  nonce: number;
}

export type CitationResolutionTier = 1 | 2 | 3 | 4;

export type CitationResolutionReason =
  | 'exact_anchor'
  | 'relocated_quote'
  | 'heading_or_partial'
  | 'deleted_historical';

export interface StructuredCitationResolution {
  tier: CitationResolutionTier;
  startLine: number | null;
  endLine: number | null;
  charStart?: number;
  charEnd?: number;
  matchedText?: string;
  reason: CitationResolutionReason;
}

export interface ProseMirrorTextSegment {
  text: string;
  from: number;
  to: number;
  isBlockStart?: boolean;
  isHeading?: boolean;
}

export interface ProseMirrorCitationResolution {
  tier: CitationResolutionTier;
  from: number | null;
  to: number | null;
  reason: CitationResolutionReason;
}

interface CollapsedPosIndex {
  collapsed: string;
  rawStarts: number[];
  rawEnds: number[];
}

const CONTEXT_SCORE_WINDOW_CHARS = 64;
const PARTIAL_WINDOW_MIN_CHARS = 24;
const PARTIAL_WINDOW_TARGET_CHARS = 36;

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Gỡ bỏ ký tự định dạng Markdown thô để so khớp chính xác với nội dung hiển thị trong ProseMirror WYSIWYG.
 */
export function stripMarkdownForPlainMatch(markdown: string): string {
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/```[a-zA-Z0-9_-]*\n?/g, ' ')
    .replace(/```/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/^[\s|:-]{3,}$/gm, ' ')
    .replace(/\|/g, ' ')
    .replace(/[*_~`]+/g, '');
}

function buildLineStarts(normalizedSource: string): number[] {
  const starts: number[] = [0];
  for (let i = 0; i < normalizedSource.length; i++) {
    if (normalizedSource.charCodeAt(i) === 10) {
      starts.push(i + 1);
    }
  }
  return starts;
}

function offsetToLine(lineStarts: number[], offset: number): number {
  if (lineStarts.length === 0) return 1;
  const clamped = Math.max(0, offset);
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lineStarts[mid] <= clamped) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return Math.max(1, high + 1);
}

function lineToCharStart(lineStarts: number[], textLength: number, line1Based: number): number {
  const idx = Math.max(0, Math.min(lineStarts.length - 1, line1Based - 1));
  return Math.min(textLength, lineStarts[idx] ?? 0);
}

function buildCollapsedIndex(text: string): CollapsedPosIndex {
  const chars: string[] = [];
  const rawStarts: number[] = [];
  const rawEnds: number[] = [];

  let i = 0;
  const n = text.length;
  while (i < n && /\s/.test(text[i])) i++;

  while (i < n) {
    if (/\s/.test(text[i])) {
      const wsStart = i;
      while (i < n && /\s/.test(text[i])) i++;
      if (i < n) {
        chars.push(' ');
        rawStarts.push(wsStart);
        rawEnds.push(i);
      }
    } else {
      chars.push(text[i]);
      rawStarts.push(i);
      rawEnds.push(i + 1);
      i++;
    }
  }

  return {
    collapsed: chars.join(''),
    rawStarts,
    rawEnds,
  };
}

function findAllOccurrences(haystack: string, needle: string): number[] {
  if (!haystack || !needle) return [];
  const indices: number[] = [];
  let cursor = 0;
  while (cursor <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, cursor);
    if (idx === -1) break;
    indices.push(idx);
    cursor = idx + Math.max(1, Math.floor(needle.length / 2));
  }
  return indices;
}

function computeSuffixOverlapScore(actualBefore: string, expectedPrefix?: string): number {
  const expected = expectedPrefix ? collapseWhitespace(expectedPrefix) : '';
  if (!expected) return 0;
  const tailExpected = expected.slice(-CONTEXT_SCORE_WINDOW_CHARS);
  const actual = collapseWhitespace(actualBefore).slice(-tailExpected.length);
  if (!actual || !tailExpected) return 0;

  let matched = 0;
  const minLen = Math.min(actual.length, tailExpected.length);
  for (let i = 1; i <= minLen; i++) {
    if (
      actual[actual.length - i].toLowerCase() ===
      tailExpected[tailExpected.length - i].toLowerCase()
    ) {
      matched++;
    } else {
      break;
    }
  }
  return matched / tailExpected.length;
}

function computePrefixOverlapScore(actualAfter: string, expectedSuffix?: string): number {
  const expected = expectedSuffix ? collapseWhitespace(expectedSuffix) : '';
  if (!expected) return 0;
  const headExpected = expected.slice(0, CONTEXT_SCORE_WINDOW_CHARS);
  const actual = collapseWhitespace(actualAfter).slice(0, headExpected.length);
  if (!actual || !headExpected) return 0;

  let matched = 0;
  const minLen = Math.min(actual.length, headExpected.length);
  for (let i = 0; i < minLen; i++) {
    if (actual[i].toLowerCase() === headExpected[i].toLowerCase()) {
      matched++;
    } else {
      break;
    }
  }
  return matched / headExpected.length;
}

function pickBestCandidateByContext(
  candidates: Array<{ start: number; end: number }>,
  getBefore: (start: number) => string,
  getAfter: (end: number) => string,
  expectedPrefix?: string,
  expectedSuffix?: string,
  expectedOffset?: number,
): { start: number; end: number } {
  let best = candidates[0];
  let bestScore = -1;

  for (const cand of candidates) {
    const prefixScore = computeSuffixOverlapScore(getBefore(cand.start), expectedPrefix);
    const suffixScore = computePrefixOverlapScore(getAfter(cand.end), expectedSuffix);
    const distanceScore =
      typeof expectedOffset === 'number'
        ? 1 / (1 + Math.abs(cand.start - expectedOffset) / 600)
        : 0;
    const totalScore = prefixScore * 2.5 + suffixScore * 2.5 + distanceScore * 0.5;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      best = cand;
    }
  }

  return best;
}

function buildPartialQueryFragments(cleanQuery: string): string[] {
  const fragments: string[] = [];
  if (cleanQuery.length < PARTIAL_WINDOW_MIN_CHARS) {
    return cleanQuery.length >= 12 ? [cleanQuery] : [];
  }

  const windowSize = Math.min(PARTIAL_WINDOW_TARGET_CHARS, cleanQuery.length);
  const step = Math.max(8, Math.floor(windowSize / 3));
  for (let i = 0; i <= cleanQuery.length - PARTIAL_WINDOW_MIN_CHARS; i += step) {
    const slice = cleanQuery.slice(i, i + windowSize).trim();
    if (slice.length >= PARTIAL_WINDOW_MIN_CHARS) {
      fragments.push(slice);
    }
    if (fragments.length >= 12) break;
  }
  return fragments;
}

function checkHighSimilarity(a: string, b: string): boolean {
  const na = collapseWhitespace(a);
  const nb = collapseWhitespace(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;

  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length < 16) return false;

  const head = shorter.slice(0, Math.min(36, Math.floor(shorter.length * 0.6)));
  const tail = shorter.slice(-Math.min(36, Math.floor(shorter.length * 0.6)));
  return longer.includes(head) && longer.includes(tail);
}

/**
 * Bộ định vị 4 tầng thuần túy cho Structured Source (.json, .xml, .yaml, .csv, .toml) & Plain Text/Log.
 */
export function resolveStructuredTextCitation(
  rawText: string,
  target?: EditorCitationTarget | null,
): StructuredCitationResolution | null {
  if (!target || !rawText) return null;

  const normalizedSource = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedSource.split('\n');
  const lineStarts = buildLineStarts(normalizedSource);
  const anchor = target.textAnchor;

  const rawQueries = [anchor?.quoteExact, target.rawContent]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim());

  // Tầng 1: Kiểm tra O(1) theo charStart..charEnd hoặc startLine..endLine
  if (anchor && anchor.quoteExact) {
    const clampedStart = Math.max(0, Math.min(normalizedSource.length, anchor.charStart));
    const clampedEnd = Math.max(
      clampedStart,
      Math.min(normalizedSource.length, anchor.charEnd),
    );
    const charSlice = normalizedSource.slice(clampedStart, clampedEnd);

    if (charSlice && checkHighSimilarity(charSlice, anchor.quoteExact)) {
      const startLine = offsetToLine(lineStarts, clampedStart);
      const endLine = offsetToLine(lineStarts, Math.max(clampedStart, clampedEnd - 1));
      return {
        tier: 1,
        startLine,
        endLine,
        charStart: clampedStart,
        charEnd: clampedEnd,
        matchedText: charSlice,
        reason: 'exact_anchor',
      };
    }

    if (anchor.startLine >= 1 && anchor.startLine <= lines.length) {
      const safeEndLine = Math.min(lines.length, Math.max(anchor.startLine, anchor.endLine));
      const lineSlice = lines.slice(anchor.startLine - 1, safeEndLine).join('\n');
      if (lineSlice && checkHighSimilarity(lineSlice, anchor.quoteExact)) {
        const startOffset = lineToCharStart(lineStarts, normalizedSource.length, anchor.startLine);
        const endOffset = Math.min(
          normalizedSource.length,
          lineToCharStart(lineStarts, normalizedSource.length, safeEndLine) +
            (lines[safeEndLine - 1]?.length ?? 0),
        );
        return {
          tier: 1,
          startLine: anchor.startLine,
          endLine: safeEndLine,
          charStart: startOffset,
          charEnd: endOffset,
          matchedText: lineSlice,
          reason: 'exact_anchor',
        };
      }
    }
  }

  // Tầng 2: Quét toàn tệp theo chuỗi gốc hoặc chuẩn hóa khoảng trắng + phân giải bằng quotePrefix / quoteSuffix
  const collapsedIndex = buildCollapsedIndex(normalizedSource);
  for (const query of rawQueries) {
    const exactIndices = findAllOccurrences(normalizedSource, query);
    if (exactIndices.length > 0) {
      const best = pickBestCandidateByContext(
        exactIndices.map((idx) => ({ start: idx, end: idx + query.length })),
        (s) => normalizedSource.slice(Math.max(0, s - CONTEXT_SCORE_WINDOW_CHARS), s),
        (e) => normalizedSource.slice(e, Math.min(normalizedSource.length, e + CONTEXT_SCORE_WINDOW_CHARS)),
        anchor?.quotePrefix,
        anchor?.quoteSuffix,
        anchor?.charStart,
      );
      return {
        tier: 2,
        startLine: offsetToLine(lineStarts, best.start),
        endLine: offsetToLine(lineStarts, Math.max(best.start, best.end - 1)),
        charStart: best.start,
        charEnd: best.end,
        matchedText: normalizedSource.slice(best.start, best.end),
        reason: 'relocated_quote',
      };
    }

    const collapsedQuery = collapseWhitespace(query);
    if (collapsedQuery && collapsedIndex.collapsed) {
      const normIndices = findAllOccurrences(collapsedIndex.collapsed, collapsedQuery);
      if (normIndices.length > 0) {
        const mappedCandidates = normIndices
          .map((nIdx) => {
            const start = collapsedIndex.rawStarts[nIdx];
            const end = collapsedIndex.rawEnds[nIdx + collapsedQuery.length - 1];
            return typeof start === 'number' && typeof end === 'number' && end > start
              ? { start, end }
              : null;
          })
          .filter((v): v is { start: number; end: number } => v !== null);

        if (mappedCandidates.length > 0) {
          const best = pickBestCandidateByContext(
            mappedCandidates,
            (s) => normalizedSource.slice(Math.max(0, s - CONTEXT_SCORE_WINDOW_CHARS), s),
            (e) => normalizedSource.slice(e, Math.min(normalizedSource.length, e + CONTEXT_SCORE_WINDOW_CHARS)),
            anchor?.quotePrefix,
            anchor?.quoteSuffix,
            anchor?.charStart,
          );
          return {
            tier: 2,
            startLine: offsetToLine(lineStarts, best.start),
            endLine: offsetToLine(lineStarts, Math.max(best.start, best.end - 1)),
            charStart: best.start,
            charEnd: best.end,
            matchedText: normalizedSource.slice(best.start, best.end),
            reason: 'relocated_quote',
          };
        }
      }
    }
  }

  // Tầng 3: Neo theo heading hoặc đoạn câu chung dài nhất khi đoạn gốc đã bị chỉnh sửa một phần
  const headingCandidates = [
    ...(anchor?.headingPath ?? []),
    ...(target.headings ?? []),
  ]
    .map((h) => h.trim())
    .filter(Boolean);

  let sectionMinOffset = 0;
  let headingMatchedLine: number | null = null;
  if (headingCandidates.length > 0) {
    const lastHeading = headingCandidates[headingCandidates.length - 1].toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(lastHeading)) {
        headingMatchedLine = i + 1;
        sectionMinOffset = lineToCharStart(lineStarts, normalizedSource.length, headingMatchedLine);
        break;
      }
    }
  }

  const lowerCollapsed = collapsedIndex.collapsed.toLowerCase();
  for (const query of rawQueries) {
    const fragments = buildPartialQueryFragments(collapseWhitespace(query).toLowerCase());
    let firstRaw: number | null = null;
    let lastRaw: number | null = null;

    for (const frag of fragments) {
      let searchNormFrom = 0;
      if (sectionMinOffset > 0) {
        const idxNearHeading = collapsedIndex.rawStarts.findIndex((r) => r >= sectionMinOffset);
        if (idxNearHeading >= 0) searchNormFrom = idxNearHeading;
      }

      let foundNorm = lowerCollapsed.indexOf(frag, searchNormFrom);
      if (foundNorm === -1 && searchNormFrom > 0) {
        foundNorm = lowerCollapsed.indexOf(frag, 0);
      }

      if (foundNorm !== -1) {
        const rStart = collapsedIndex.rawStarts[foundNorm];
        const rEnd = collapsedIndex.rawEnds[foundNorm + frag.length - 1];
        if (typeof rStart === 'number' && typeof rEnd === 'number') {
          firstRaw = firstRaw === null ? rStart : Math.min(firstRaw, rStart);
          lastRaw = lastRaw === null ? rEnd : Math.max(lastRaw, rEnd);
        }
      }
    }

    if (firstRaw !== null && lastRaw !== null && lastRaw > firstRaw) {
      return {
        tier: 3,
        startLine: offsetToLine(lineStarts, firstRaw),
        endLine: offsetToLine(lineStarts, Math.max(firstRaw, lastRaw - 1)),
        charStart: firstRaw,
        charEnd: lastRaw,
        matchedText: normalizedSource.slice(firstRaw, lastRaw),
        reason: 'heading_or_partial',
      };
    }
  }

  if (headingMatchedLine !== null) {
    const endLine = Math.min(lines.length, headingMatchedLine + 2);
    return {
      tier: 3,
      startLine: headingMatchedLine,
      endLine,
      reason: 'heading_or_partial',
    };
  }

  // Tầng 4: Đoạn trích dẫn không còn trong bản hiện tại
  return {
    tier: 4,
    startLine: null,
    endLine: null,
    reason: 'deleted_historical',
  };
}

interface BuiltProseMirrorIndex {
  collapsed: string;
  posStarts: number[];
  posEnds: number[];
  headingOffsets: Array<{ textLower: string; collapsedIdx: number; from: number; to: number }>;
}

/**
 * Xây dựng chỉ mục text phẳng chuẩn hóa khoảng trắng từ các text segment trích từ ProseMirror `doc`,
 * bảo toàn ánh xạ 1-1 từ từng ký tự về vị trí `pos` chính xác trong ProseMirror.
 */
export function buildProseMirrorSegmentIndex(
  segments: ProseMirrorTextSegment[],
): BuiltProseMirrorIndex {
  const chars: string[] = [];
  const posStarts: number[] = [];
  const posEnds: number[] = [];
  const headingOffsets: BuiltProseMirrorIndex['headingOffsets'] = [];

  for (const seg of segments) {
    if (!seg.text) continue;

    if (seg.isBlockStart && chars.length > 0 && chars[chars.length - 1] !== ' ') {
      chars.push(' ');
      posStarts.push(seg.from);
      posEnds.push(seg.from);
    }

    const startCollapsedIdx = chars.length;

    let i = 0;
    const text = seg.text;
    while (i < text.length) {
      if (/\s/.test(text[i])) {
        const wsStart = i;
        while (i < text.length && /\s/.test(text[i])) i++;
        if (chars.length > 0 && chars[chars.length - 1] !== ' ') {
          chars.push(' ');
          posStarts.push(seg.from + wsStart);
          posEnds.push(seg.from + i);
        }
      } else {
        chars.push(text[i]);
        posStarts.push(seg.from + i);
        posEnds.push(seg.from + i + 1);
        i++;
      }
    }

    if (seg.isHeading) {
      const headingText = collapseWhitespace(text).toLowerCase();
      if (headingText) {
        headingOffsets.push({
          textLower: headingText,
          collapsedIdx: startCollapsedIdx,
          from: seg.from,
          to: seg.to,
        });
      }
    }
  }

  while (chars.length > 0 && chars[chars.length - 1] === ' ') {
    chars.pop();
    posStarts.pop();
    posEnds.pop();
  }

  return {
    collapsed: chars.join(''),
    posStarts,
    posEnds,
    headingOffsets,
  };
}

/**
 * Bộ định vị 4 tầng thuần túy cho Tiptap/ProseMirror WYSIWYG (tách biệt khỏi DOM trình duyệt để dễ test).
 */
export function resolveTextSegmentsCitation(
  segments: ProseMirrorTextSegment[],
  rawSourceLength: number,
  target?: EditorCitationTarget | null,
): ProseMirrorCitationResolution | null {
  if (!target) return null;

  const index = buildProseMirrorSegmentIndex(segments);
  if (!index.collapsed) {
    return {
      tier: 4,
      from: null,
      to: null,
      reason: 'deleted_historical',
    };
  }

  const anchor = target.textAnchor;
  const totalCollapsedLen = index.collapsed.length;
  const expectedCollapsedIdx =
    anchor && rawSourceLength > 0
      ? Math.round((anchor.charStart / rawSourceLength) * totalCollapsedLen)
      : undefined;

  const queries = [anchor?.quoteExact, target.rawContent]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((q) => collapseWhitespace(stripMarkdownForPlainMatch(q)))
    .filter((q) => q.length > 0);

  const cleanPrefix = anchor?.quotePrefix
    ? collapseWhitespace(stripMarkdownForPlainMatch(anchor.quotePrefix))
    : undefined;
  const cleanSuffix = anchor?.quoteSuffix
    ? collapseWhitespace(stripMarkdownForPlainMatch(anchor.quoteSuffix))
    : undefined;

  for (const query of queries) {
    const occIndices = findAllOccurrences(index.collapsed, query);
    if (occIndices.length > 0) {
      const bestNorm = pickBestCandidateByContext(
        occIndices.map((idx) => ({ start: idx, end: idx + query.length })),
        (s) => index.collapsed.slice(Math.max(0, s - CONTEXT_SCORE_WINDOW_CHARS), s),
        (e) =>
          index.collapsed.slice(
            e,
            Math.min(index.collapsed.length, e + CONTEXT_SCORE_WINDOW_CHARS),
          ),
        cleanPrefix,
        cleanSuffix,
        expectedCollapsedIdx,
      );

      const from = index.posStarts[bestNorm.start];
      const to = index.posEnds[bestNorm.end - 1];

      if (typeof from === 'number' && typeof to === 'number' && to > from) {
        // Kiểm tra xem có phải Tầng 1 (vị trí không bị dịch chuyển đáng kể so với anchor) hay Tầng 2
        const tolerance = Math.max(180, Math.round(totalCollapsedLen * 0.15));
        const isAtExpectedPos =
          anchor !== undefined &&
          (occIndices.length === 1 ||
            expectedCollapsedIdx === undefined ||
            Math.abs(bestNorm.start - expectedCollapsedIdx) <= tolerance);

        return {
          tier: isAtExpectedPos ? 1 : 2,
          from,
          to,
          reason: isAtExpectedPos ? 'exact_anchor' : 'relocated_quote',
        };
      }
    }
  }

  // Tầng 3: Neo theo heading gần nhất + cửa sổ cụm câu khớp một phần
  const headingCandidates = [
    ...(anchor?.headingPath ?? []),
    ...(target.headings ?? []),
  ]
    .map((h) => collapseWhitespace(stripMarkdownForPlainMatch(h)).toLowerCase())
    .filter(Boolean);

  let matchedHeading: BuiltProseMirrorIndex['headingOffsets'][number] | null = null;
  if (headingCandidates.length > 0) {
    const targetHeading = headingCandidates[headingCandidates.length - 1];
    matchedHeading =
      index.headingOffsets.find(
        (h) => h.textLower === targetHeading || h.textLower.includes(targetHeading),
      ) ?? null;
  }

  const lowerCollapsed = index.collapsed.toLowerCase();
  for (const query of queries) {
    const fragments = buildPartialQueryFragments(query.toLowerCase());
    let firstNorm: number | null = null;
    let lastNorm: number | null = null;

    const preferredStart = matchedHeading?.collapsedIdx ?? 0;
    for (const frag of fragments) {
      let found = lowerCollapsed.indexOf(frag, preferredStart);
      if (found === -1 && preferredStart > 0) {
        found = lowerCollapsed.indexOf(frag, 0);
      }
      if (found !== -1) {
        firstNorm = firstNorm === null ? found : Math.min(firstNorm, found);
        lastNorm = lastNorm === null ? found + frag.length : Math.max(lastNorm, found + frag.length);
      }
    }

    if (firstNorm !== null && lastNorm !== null && lastNorm > firstNorm) {
      const from = index.posStarts[firstNorm];
      const to = index.posEnds[lastNorm - 1];
      if (typeof from === 'number' && typeof to === 'number' && to > from) {
        return {
          tier: 3,
          from,
          to,
          reason: 'heading_or_partial',
        };
      }
    }
  }

  if (matchedHeading && matchedHeading.to > matchedHeading.from) {
    return {
      tier: 3,
      from: matchedHeading.from,
      to: matchedHeading.to,
      reason: 'heading_or_partial',
    };
  }

  return {
    tier: 4,
    from: null,
    to: null,
    reason: 'deleted_historical',
  };
}
