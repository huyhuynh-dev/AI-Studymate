import { normalizeHeadingKey } from './text.utils.js';

export const MAX_NOTE_CONTENT_CHARS = 10_000;
export const MAX_NOTE_OUTLINE_ITEMS = 25;
export const MAX_BLOCK_DEPTH = 8;

export interface ParsedNoteSection {
  heading: string;
  level: number;
  startOffset: number;
  endOffset: number;
}

export interface ParsedBlockNoteMarkdown {
  markdown: string;
  outline: string[];
  sections: ParsedNoteSection[];
}

interface RawInlineStyles {
  bold?: boolean | null;
  italic?: boolean | null;
  strike?: boolean | null;
  code?: boolean | null;
}

interface RawBlockNode {
  type?: unknown;
  props?: Record<string, unknown> | null;
  content?: unknown;
  children?: unknown;
}

function applyInlineStyles(text: string, styles?: RawInlineStyles | null): string {
  if (!text || !styles || typeof styles !== 'object') return text;

  let formatted = text;
  if (styles.code) {
    formatted = `\`${formatted}\``;
  }
  if (styles.bold) {
    formatted = `**${formatted}**`;
  }
  if (styles.italic) {
    formatted = `*${formatted}*`;
  }
  if (styles.strike) {
    formatted = `~~${formatted}~~`;
  }
  return formatted;
}

function renderInlineContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((item) => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return '';
      const node = item as Record<string, unknown>;

      if (node.type === 'math' && typeof node.content === 'string') {
        const expr = node.content.trim();
        return expr ? `$${expr}$` : '';
      }

      if (node.type === 'link') {
        const inner = renderInlineContent(node.content).trim();
        const href = typeof node.href === 'string' ? node.href.trim() : '';
        const isSafeHttpUrl = /^https?:\/\//i.test(href);
        if (inner && isSafeHttpUrl) {
          return `[${inner}](${href})`;
        }
        return inner;
      }

      if (typeof node.text === 'string') {
        return applyInlineStyles(
          node.text,
          (node.styles as RawInlineStyles | null | undefined) ?? null,
        );
      }

      return '';
    })
    .join('');
}

function renderPlainInlineText(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';

  return content
    .map((item) => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return '';
      const node = item as Record<string, unknown>;
      if (node.type === 'link') {
        return renderPlainInlineText(node.content);
      }
      if (node.type === 'math' && typeof node.content === 'string') {
        return node.content;
      }
      return typeof node.text === 'string' ? node.text : '';
    })
    .join('')
    .trim();
}

function renderTableBlock(content: unknown, indent: string): string {
  if (!content || typeof content !== 'object') return '';
  const tableContent = content as { rows?: unknown };
  if (!Array.isArray(tableContent.rows) || tableContent.rows.length === 0) {
    return '';
  }

  const rows: string[][] = [];
  for (const rawRow of tableContent.rows) {
    if (!rawRow || typeof rawRow !== 'object') continue;
    const cells = (rawRow as { cells?: unknown }).cells;
    if (!Array.isArray(cells) || cells.length === 0) continue;
    rows.push(
      cells.map((cell) =>
        renderInlineContent(cell).replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim(),
      ),
    );
  }

  if (rows.length === 0) return '';
  const colCount = Math.max(...rows.map((r) => r.length));
  const normalizeRow = (r: string[]) =>
    Array.from({ length: colCount }, (_, i) => r[i] ?? '');

  const header = normalizeRow(rows[0]);
  const separator = Array.from({ length: colCount }, () => '---');
  const lines = [
    `${indent}| ${header.join(' | ')} |`,
    `${indent}| ${separator.join(' | ')} |`,
    ...rows.slice(1).map((r) => `${indent}| ${normalizeRow(r).join(' | ')} |`),
  ];

  return lines.join('\n');
}

function getSafeMediaLabel(props?: Record<string, unknown> | null): string {
  if (!props || typeof props !== 'object') return '';
  const caption =
    typeof props.caption === 'string' ? props.caption.trim() : '';
  const name = typeof props.name === 'string' ? props.name.trim() : '';
  return caption || name;
}

/**
 * Chuyển đổi BlockNote JSON (`Summary.content_json`) sang Markdown có cấu trúc,
 * hỗ trợ đủ 16 built-in blocks và che toàn bộ media URLs/storage keys.
 */
export function serializeBlockNoteToMarkdown(
  contentJson: unknown,
): ParsedBlockNoteMarkdown {
  if (!Array.isArray(contentJson) || contentJson.length === 0) {
    return { markdown: '', outline: [], sections: [] };
  }

  const outline: string[] = [];
  const headingMarkers: Array<{
    lineIndex: number;
    heading: string;
    level: number;
  }> = [];
  const lines: string[] = [];

  const pushBlockLines = (text: string) => {
    if (!text) return;
    lines.push(text);
  };

  const walk = (blocks: unknown[], depth: number) => {
    if (depth > MAX_BLOCK_DEPTH) return;
    const indent = '  '.repeat(depth);

    for (const raw of blocks) {
      if (!raw || typeof raw !== 'object') continue;
      const block = raw as RawBlockNode;
      const type = typeof block.type === 'string' ? block.type : 'paragraph';
      const props = block.props ?? null;

      switch (type) {
        case 'heading': {
          const rawLevel =
            typeof props?.level === 'number' ? Math.round(props.level) : 1;
          const level = Math.min(6, Math.max(1, rawLevel));
          const text = renderInlineContent(block.content).trim();
          const plainText = renderPlainInlineText(block.content);
          if (text) {
            const lineIndex = lines.length;
            pushBlockLines(`${indent}${'#'.repeat(level)} ${text}`);
            if (plainText) {
              if (level <= 3 && outline.length < MAX_NOTE_OUTLINE_ITEMS) {
                outline.push(`H${level}: ${plainText.slice(0, 80)}`);
              }
              headingMarkers.push({
                lineIndex,
                heading: plainText,
                level,
              });
            }
          }
          break;
        }
        case 'paragraph': {
          const text = renderInlineContent(block.content).trim();
          if (text) {
            pushBlockLines(`${indent}${text}`);
          }
          break;
        }
        case 'bulletListItem':
        case 'toggleListItem': {
          const text = renderInlineContent(block.content).trim();
          if (text) {
            pushBlockLines(`${indent}- ${text}`);
          }
          break;
        }
        case 'numberedListItem': {
          const text = renderInlineContent(block.content).trim();
          const start =
            typeof props?.start === 'number' && Number.isFinite(props.start)
              ? Math.max(1, Math.round(props.start))
              : 1;
          if (text) {
            pushBlockLines(`${indent}${start}. ${text}`);
          }
          break;
        }
        case 'checkListItem': {
          const text = renderInlineContent(block.content).trim();
          const checked = Boolean(props?.checked);
          if (text) {
            pushBlockLines(`${indent}- [${checked ? 'x' : ' '}] ${text}`);
          }
          break;
        }
        case 'quote': {
          const text = renderInlineContent(block.content).trim();
          if (text) {
            const quoted = text
              .split('\n')
              .map((line) => `${indent}> ${line}`)
              .join('\n');
            pushBlockLines(quoted);
          }
          break;
        }
        case 'codeBlock': {
          const lang =
            typeof props?.language === 'string' ? props.language.trim() : '';
          const code =
            typeof block.content === 'string'
              ? block.content
              : renderPlainInlineText(block.content);
          pushBlockLines(`${indent}\`\`\`${lang}\n${code}\n${indent}\`\`\``);
          break;
        }
        case 'table': {
          const tableMd = renderTableBlock(block.content, indent);
          if (tableMd) {
            pushBlockLines(tableMd);
          }
          break;
        }
        case 'mathBlock': {
          const math =
            typeof block.content === 'string'
              ? block.content.trim()
              : renderPlainInlineText(block.content);
          if (math) {
            pushBlockLines(`${indent}$$\n${math}\n$$`);
          }
          break;
        }
        case 'diagram': {
          const mermaidCode =
            typeof block.content === 'string'
              ? block.content.trim()
              : renderPlainInlineText(block.content);
          if (mermaidCode) {
            pushBlockLines(`${indent}\`\`\`mermaid\n${mermaidCode}\n${indent}\`\`\``);
          }
          break;
        }
        case 'divider': {
          pushBlockLines(`${indent}---`);
          break;
        }
        case 'image':
        case 'file':
        case 'video':
        case 'audio': {
          const label = getSafeMediaLabel(props);
          const typeLabel =
            type.charAt(0).toUpperCase() + type.slice(1);
          pushBlockLines(
            label
              ? `${indent}[${typeLabel}: ${label}]`
              : `${indent}[${typeLabel} attachment]`,
          );
          break;
        }
        default: {
          const text = renderInlineContent(block.content).trim();
          if (text) {
            pushBlockLines(`${indent}${text}`);
          }
          break;
        }
      }

      if (Array.isArray(block.children) && block.children.length > 0) {
        walk(block.children, depth + 1);
      }
    }
  };

  walk(contentJson, 0);

  if (lines.length === 0) {
    return { markdown: '', outline, sections: [] };
  }

  // Tính offset ký tự của từng line khi ghép bằng '\n\n' để xây dựng danh sách section chính xác
  const lineStartOffsets: number[] = [];
  let cursor = 0;
  for (let i = 0; i < lines.length; i += 1) {
    lineStartOffsets.push(cursor);
    cursor += lines[i].length + (i < lines.length - 1 ? 2 : 0);
  }
  const markdown = lines.join('\n\n');

  const sections: ParsedNoteSection[] = headingMarkers.map((marker, idx) => {
    const startOffset = lineStartOffsets[marker.lineIndex] ?? 0;
    let endOffset = markdown.length;

    // Kết thúc section khi gặp heading cùng cấp hoặc cao hơn (level <= marker.level)
    for (let j = idx + 1; j < headingMarkers.length; j += 1) {
      if (headingMarkers[j].level <= marker.level) {
        const nextStart = lineStartOffsets[headingMarkers[j].lineIndex];
        if (typeof nextStart === 'number') {
          endOffset = Math.max(startOffset, nextStart - 2);
        }
        break;
      }
    }

    return {
      heading: marker.heading,
      level: marker.level,
      startOffset,
      endOffset,
    };
  });

  return { markdown, outline, sections };
}

/**
 * Cắt nội dung Markdown của Note theo `sectionKeyword` (nếu có) và giới hạn `maxChars` + `charOffset`.
 */
export function extractNoteSectionOrSlice(
  parsed: ParsedBlockNoteMarkdown,
  options: {
    sectionKeyword?: string;
    charOffset?: number;
    maxChars?: number;
  } = {},
): {
  contentMarkdown: string;
  matchedSection: string | null;
  totalChars: number;
  charOffset: number;
  truncated: boolean;
  nextCharOffset?: number;
} {
  const maxChars = Math.max(
    100,
    options.maxChars ?? MAX_NOTE_CONTENT_CHARS,
  );
  const keyword = options.sectionKeyword?.trim();

  let workingText = parsed.markdown;
  let matchedSection: string | null = null;

  if (keyword && parsed.sections.length > 0) {
    const normalizedNeedle = normalizeHeadingKey(keyword);
    const exactMatch = parsed.sections.find(
      (s) => normalizeHeadingKey(s.heading) === normalizedNeedle,
    );
    const partialMatch =
      exactMatch ??
      parsed.sections.find((s) =>
        normalizeHeadingKey(s.heading).includes(normalizedNeedle),
      );

    if (partialMatch) {
      workingText = parsed.markdown
        .slice(partialMatch.startOffset, partialMatch.endOffset)
        .trim();
      matchedSection = partialMatch.heading;
    }
  }

  const totalChars = workingText.length;
  const rawOffset =
    typeof options.charOffset === 'number' && Number.isFinite(options.charOffset)
      ? Math.floor(options.charOffset)
      : 0;
  const safeOffset = Math.min(Math.max(0, rawOffset), totalChars);

  if (totalChars === 0 || safeOffset >= totalChars) {
    return {
      contentMarkdown: '',
      matchedSection,
      totalChars,
      charOffset: safeOffset,
      truncated: false,
    };
  }

  const remaining = totalChars - safeOffset;
  if (remaining <= maxChars) {
    return {
      contentMarkdown: workingText.slice(safeOffset),
      matchedSection,
      totalChars,
      charOffset: safeOffset,
      truncated: false,
    };
  }

  // Cắt sạch theo ranh giới dòng trong 15% cuối của cửa sổ để giữ nguyên vẹn đoạn văn/công thức
  let cutEnd = safeOffset + maxChars;
  const windowStart = safeOffset + Math.floor(maxChars * 0.85);
  const lastNewline = workingText.lastIndexOf('\n', cutEnd);
  if (lastNewline > windowStart) {
    cutEnd = lastNewline;
  }

  // Tránh cắt đôi cặp UTF-16 surrogate pair
  if (cutEnd > safeOffset && cutEnd < totalChars) {
    const code = workingText.charCodeAt(cutEnd - 1);
    if (code >= 0xd800 && code <= 0xdbff) {
      cutEnd -= 1;
    }
  }

  const contentMarkdown = workingText.slice(safeOffset, cutEnd).trimEnd();
  return {
    contentMarkdown,
    matchedSection,
    totalChars,
    charOffset: safeOffset,
    truncated: true,
    nextCharOffset: cutEnd,
  };
}

export interface BlockNoteInlineSpan {
  type: 'text' | 'link' | 'math';
  text?: string;
  styles?: Record<string, boolean>;
  href?: string;
  content?: BlockNoteInlineSpan[] | string;
}

export interface BlockNoteBlock {
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: BlockNoteBlock[];
}

function parseInlineMarkdown(raw: string): BlockNoteInlineSpan[] {
  const input = raw.trimEnd();
  if (!input) return [];

  const spans: BlockNoteInlineSpan[] = [];
  const tokenRegex =
    /(\*\*[^*]+?\*\*|~~[^~]+?~~|\*[^*\n]+?\*|`[^`\n]+?`|\$[^$\n]+?\$|\[[^\]]+?\]\(https?:\/\/[^\s)]+\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      spans.push({
        type: 'text',
        text: input.slice(lastIndex, match.index),
        styles: {},
      });
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      spans.push({
        type: 'text',
        text: token.slice(2, -2),
        styles: { bold: true },
      });
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      spans.push({
        type: 'text',
        text: token.slice(2, -2),
        styles: { strike: true },
      });
    } else if (token.startsWith('*') && token.endsWith('*')) {
      spans.push({
        type: 'text',
        text: token.slice(1, -1),
        styles: { italic: true },
      });
    } else if (token.startsWith('`') && token.endsWith('`')) {
      spans.push({
        type: 'text',
        text: token.slice(1, -1),
        styles: { code: true },
      });
    } else if (token.startsWith('$') && token.endsWith('$')) {
      spans.push({
        type: 'math',
        content: token.slice(1, -1).trim(),
      });
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(token);
      if (linkMatch) {
        spans.push({
          type: 'link',
          href: linkMatch[2],
          content: [{ type: 'text', text: linkMatch[1], styles: {} }],
        });
      } else {
        spans.push({ type: 'text', text: token, styles: {} });
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < input.length) {
    spans.push({
      type: 'text',
      text: input.slice(lastIndex),
      styles: {},
    });
  }

  return spans;
}

/**
 * Chuyển đổi Markdown sang mảng BlockNote JSON chuẩn hợp lệ cho StudyMate Summaries/Notes.
 */
export function parseMarkdownToBlockNoteBlocks(
  markdown: string,
): BlockNoteBlock[] {
  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const blocks: BlockNoteBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced Code / Mermaid Block
    const fenceMatch = /^```([a-zA-Z0-9_-]*)\s*$/.exec(trimmed);
    if (fenceMatch) {
      const lang = fenceMatch[1].toLowerCase();
      const bodyLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        bodyLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i += 1;
      }
      const codeContent = bodyLines.join('\n');
      if (lang === 'mermaid') {
        blocks.push({ type: 'diagram', content: codeContent });
      } else {
        blocks.push({
          type: 'codeBlock',
          props: { language: lang || 'text' },
          content: codeContent,
        });
      }
      continue;
    }

    // Math Block $$ ... $$
    if (trimmed === '$$') {
      const mathLines: string[] = [];
      i += 1;
      while (i < lines.length && lines[i].trim() !== '$$') {
        mathLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && lines[i].trim() === '$$') {
        i += 1;
      }
      blocks.push({
        type: 'mathBlock',
        content: mathLines.join('\n').trim(),
      });
      continue;
    }

    // Divider ---
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'divider' });
      i += 1;
      continue;
    }

    // Heading H1..H6 (BlockNote built-in levels 1..3/6)
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = Math.min(3, headingMatch[1].length);
      blocks.push({
        type: 'heading',
        props: { level },
        content: parseInlineMarkdown(headingMatch[2].trim()),
      });
      i += 1;
      continue;
    }

    // GFM Table
    if (
      trimmed.startsWith('|') &&
      i + 1 < lines.length &&
      /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(lines[i + 1].trim())
    ) {
      const parseTableRow = (rowLine: string): BlockNoteInlineSpan[][] => {
        const inner = rowLine.trim().replace(/^\|/, '').replace(/\|$/, '');
        return inner
          .split('|')
          .map((cell) => parseInlineMarkdown(cell.trim()));
      };
      const rows: Array<{ cells: BlockNoteInlineSpan[][] }> = [
        { cells: parseTableRow(lines[i]) },
      ];
      i += 2; // skip header + separator
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push({ cells: parseTableRow(lines[i]) });
        i += 1;
      }
      blocks.push({
        type: 'table',
        content: { type: 'tableContent', rows },
      });
      continue;
    }

    // Check list item
    const checkMatch = /^[-*]\s+\[( |x|X)\]\s+(.+)$/.exec(trimmed);
    if (checkMatch) {
      blocks.push({
        type: 'checkListItem',
        props: { checked: checkMatch[1].toLowerCase() === 'x' },
        content: parseInlineMarkdown(checkMatch[2]),
      });
      i += 1;
      continue;
    }

    // Bullet list item
    const bulletMatch = /^[-*+]\s+(.+)$/.exec(trimmed);
    if (bulletMatch) {
      blocks.push({
        type: 'bulletListItem',
        content: parseInlineMarkdown(bulletMatch[1]),
      });
      i += 1;
      continue;
    }

    // Numbered list item
    const numberedMatch = /^(\d+)\.\s+(.+)$/.exec(trimmed);
    if (numberedMatch) {
      blocks.push({
        type: 'numberedListItem',
        props: { start: Number(numberedMatch[1]) || 1 },
        content: parseInlineMarkdown(numberedMatch[2]),
      });
      i += 1;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({
        type: 'quote',
        content: parseInlineMarkdown(quoteLines.join(' ')),
      });
      continue;
    }

    // Paragraph (gom các dòng thường liền kề tới dòng trống hoặc block mới)
    const paraLines: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const nextTrimmed = lines[i].trim();
      if (
        !nextTrimmed ||
        /^(#{1,6}\s|```|\$\$|---|\*\*\*|[-*+]\s|\d+\.\s|>|\|)/.test(nextTrimmed)
      ) {
        break;
      }
      paraLines.push(nextTrimmed);
      i += 1;
    }
    blocks.push({
      type: 'paragraph',
      content: parseInlineMarkdown(paraLines.join(' ')),
    });
  }

  return blocks;
}

function getHeadingPlainText(rawBlock: unknown): {
  isHeading: boolean;
  level: number;
  text: string;
} {
  if (!rawBlock || typeof rawBlock !== 'object') {
    return { isHeading: false, level: 0, text: '' };
  }
  const block = rawBlock as RawBlockNode;
  if (block.type !== 'heading') {
    return { isHeading: false, level: 0, text: '' };
  }
  const level =
    typeof block.props?.level === 'number'
      ? Math.min(6, Math.max(1, Math.round(block.props.level)))
      : 1;
  return {
    isHeading: true,
    level,
    text: renderPlainInlineText(block.content),
  };
}

/**
 * Sửa cục bộ hoặc chèn thêm section vào mảng BlockNote blocks hiện có
 * mà KHÔNG làm mất các block hoặc media `r2://` ở những phần khác.
 */
export function replaceOrAppendNoteSection(
  existingBlocks: unknown[],
  options: {
    sectionHeading?: string;
    markdownContent: string;
    mode: 'append' | 'replace_section';
  },
): { blocks: unknown[]; matchedHeading: string | null } {
  const safeExisting = Array.isArray(existingBlocks) ? [...existingBlocks] : [];
  const incomingBlocks = parseMarkdownToBlockNoteBlocks(options.markdownContent);

  if (options.mode === 'append' && !options.sectionHeading?.trim()) {
    return {
      blocks: [...safeExisting, ...incomingBlocks],
      matchedHeading: null,
    };
  }

  const needle = normalizeHeadingKey(options.sectionHeading ?? '');
  if (!needle) {
    return {
      blocks: [...safeExisting, ...incomingBlocks],
      matchedHeading: null,
    };
  }

  let matchIndex = -1;
  let matchLevel = 1;
  let matchedHeading: string | null = null;

  for (let idx = 0; idx < safeExisting.length; idx += 1) {
    const info = getHeadingPlainText(safeExisting[idx]);
    if (!info.isHeading) continue;
    const norm = normalizeHeadingKey(info.text);
    if (norm === needle || (norm && norm.includes(needle))) {
      matchIndex = idx;
      matchLevel = info.level;
      matchedHeading = info.text;
      if (norm === needle) break;
    }
  }

  if (matchIndex === -1) {
    // Không tìm thấy heading tương ứng: thêm heading + nội dung vào cuối nếu append
    if (options.mode === 'append') {
      return {
        blocks: [...safeExisting, ...incomingBlocks],
        matchedHeading: null,
      };
    }
    return {
      blocks: safeExisting,
      matchedHeading: null,
    };
  }

  // Tìm ranh giới kết thúc section (heading tiếp theo có level <= matchLevel)
  let sectionEnd = safeExisting.length;
  for (let idx = matchIndex + 1; idx < safeExisting.length; idx += 1) {
    const info = getHeadingPlainText(safeExisting[idx]);
    if (info.isHeading && info.level <= matchLevel) {
      sectionEnd = idx;
      break;
    }
  }

  if (options.mode === 'append') {
    const updated = [
      ...safeExisting.slice(0, sectionEnd),
      ...incomingBlocks,
      ...safeExisting.slice(sectionEnd),
    ];
    return { blocks: updated, matchedHeading };
  }

  // replace_section: giữ lại heading gốc nếu incomingBlocks chưa bắt đầu bằng heading tương đương
  const firstIncoming = getHeadingPlainText(incomingBlocks[0]);
  const replacement = firstIncoming.isHeading
    ? incomingBlocks
    : [safeExisting[matchIndex], ...incomingBlocks];

  return {
    blocks: [
      ...safeExisting.slice(0, matchIndex),
      ...replacement,
      ...safeExisting.slice(sectionEnd),
    ],
    matchedHeading,
  };
}
