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
