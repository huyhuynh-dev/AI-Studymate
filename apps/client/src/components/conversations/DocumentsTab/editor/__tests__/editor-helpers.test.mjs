import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isEditableTextDocument,
  resolveDocumentEditorProfile,
} from '../document-format-profiles.ts';
import {
  joinMarkdownFrontmatter,
  splitMarkdownFrontmatter,
} from '../markdown-frontmatter.helper.ts';
import { validateStructuredContent } from '../structured-validation.helper.ts';

describe('document-format-profiles', () => {
  it('phân loại chính xác Markdown, HTML, Plain Text và Structured Markup', () => {
    assert.equal(
      resolveDocumentEditorProfile({ file_name: 'notes.md', mime_type: 'text/markdown' }).mode,
      'markdown_wysiwyg',
    );
    assert.equal(
      resolveDocumentEditorProfile({ file_name: 'slides.html', mime_type: 'text/html' }).mode,
      'html_wysiwyg',
    );
    assert.equal(
      resolveDocumentEditorProfile({ file_name: 'readme.txt', mime_type: 'text/plain' }).mode,
      'plain_text',
    );
    assert.equal(
      resolveDocumentEditorProfile({ file_name: 'app.log', mime_type: 'application/octet-stream' }).mode,
      'plain_text',
    );
    assert.equal(
      resolveDocumentEditorProfile({ file_name: 'config.json', mime_type: 'application/json' }).mode,
      'structured_source',
    );
    assert.equal(
      resolveDocumentEditorProfile({ file_name: 'docker-compose.yml', mime_type: 'text/plain' }).mode,
      'structured_source',
    );
  });

  it('loại trừ các tệp nhị phân như PDF và Hình ảnh khỏi trình soạn thảo văn bản', () => {
    assert.equal(isEditableTextDocument({ file_name: 'doc.pdf', mime_type: 'application/pdf' }), false);
    assert.equal(isEditableTextDocument({ file_name: 'img.png', mime_type: 'image/png' }), false);
    assert.equal(isEditableTextDocument({ file_name: 'guide.md', mime_type: 'text/plain' }), true);
  });
});

describe('markdown-frontmatter.helper', () => {
  it('tách và ghép lại YAML frontmatter chuẩn xác theo round-trip', () => {
    const raw = '---\r\ntitle: "StudyMate"\r\ntags: [ai, rag]\r\n---\r\n\r\n# Nội dung chính\r\nĐoạn 1.';
    const split = splitMarkdownFrontmatter(raw);

    assert.equal(split.frontmatter, '---\ntitle: "StudyMate"\ntags: [ai, rag]\n---');
    assert.equal(split.body, '# Nội dung chính\nĐoạn 1.');

    const joined = joinMarkdownFrontmatter(split.frontmatter, split.body);
    assert.equal(
      joined,
      '---\ntitle: "StudyMate"\ntags: [ai, rag]\n---\n\n# Nội dung chính\nĐoạn 1.',
    );
  });

  it('giữ nguyên tài liệu nếu không có frontmatter dẫn đầu', () => {
    const raw = '# Heading\n\n---\n\nĐoạn sau dấu gạch ngang';
    const split = splitMarkdownFrontmatter(raw);

    assert.equal(split.frontmatter, '');
    assert.equal(split.body, raw);
    assert.equal(joinMarkdownFrontmatter('', split.body), raw);
  });
});

describe('structured-validation.helper', () => {
  it('kiểm tra cú pháp JSON và trả về null với các ngôn ngữ khác', () => {
    assert.equal(validateStructuredContent('json', '{"ok":true}'), null);
    assert.ok(validateStructuredContent('json', '{"ok":'));
    assert.ok(validateStructuredContent('json', '   '));
    assert.equal(validateStructuredContent('yaml', 'key: value'), null);
  });
});
