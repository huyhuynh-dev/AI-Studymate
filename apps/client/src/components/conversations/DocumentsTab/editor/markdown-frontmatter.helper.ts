const LEADING_FRONTMATTER_REGEX = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

export interface SplitFrontmatterResult {
  frontmatter: string;
  body: string;
}

/**
 * Tách phần YAML Frontmatter ở đầu tệp Markdown (nếu có) để tránh Tiptap biến đổi cặp dấu `---` thành HorizontalRule.
 */
export function splitMarkdownFrontmatter(rawMarkdown: string): SplitFrontmatterResult {
  const normalized = rawMarkdown.replace(/\r\n/g, '\n');
  const match = normalized.match(LEADING_FRONTMATTER_REGEX);
  if (!match) {
    return {
      frontmatter: '',
      body: normalized,
    };
  }

  const frontmatter = match[0].trimEnd();
  const body = normalized.slice(match[0].length).replace(/^\n+/, '');
  return {
    frontmatter,
    body,
  };
}

/**
 * Ghép lại YAML Frontmatter vào đầu nội dung Markdown sau khi serialize từ Tiptap.
 */
export function joinMarkdownFrontmatter(frontmatter: string, body: string): string {
  const cleanFrontmatter = frontmatter.trimEnd();
  if (!cleanFrontmatter) {
    return body;
  }

  const cleanBody = body.replace(/^\n+/, '');
  if (!cleanBody) {
    return `${cleanFrontmatter}\n`;
  }

  return `${cleanFrontmatter}\n\n${cleanBody}`;
}
