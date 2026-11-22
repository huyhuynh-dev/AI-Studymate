"use client";

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { EditorContent, useEditor, type AnyExtension, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import ImageExtension from '@tiptap/extension-image';
import DOMPurify from 'dompurify';
import {
  Bold,
  Code,
  Code2,
  Eye,
  FileCode2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  ListTree,
  Minus,
  Pilcrow,
  Plus,
  Quote,
  Redo2,
  Search,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  X,
} from 'lucide-react';
import type { DocumentEditorMode } from './document-format-profiles';
import {
  DocumentOutlineSidebar,
  type OutlineHeadingItem,
} from './DocumentOutlineSidebar';
import {
  joinMarkdownFrontmatter,
  splitMarkdownFrontmatter,
} from './markdown-frontmatter.helper';
import {
  CitationHighlightExtension,
  dispatchCitationHighlight,
} from './citation-highlight.extension';
import {
  resolveTextSegmentsCitation,
  type EditorCitationTarget,
  type ProseMirrorCitationResolution,
  type ProseMirrorTextSegment,
} from './text-anchor-resolver';

export interface MarkdownWysiwygCanvasProps {
  value: string;
  onChange: (nextValue: string) => void;
  mode: Extract<DocumentEditorMode, 'markdown_wysiwyg' | 'html_wysiwyg' | 'plain_text'>;
  readOnly?: boolean;
  compactReaderMode?: boolean;
  citationTarget?: EditorCitationTarget | null;
  scrollToCitationNonce?: number;
  onCitationResolved?: (resolution: ProseMirrorCitationResolution | null) => void;
  onCitationDismiss?: () => void;
}

interface ToolbarBtnProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarBtn({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
}: ToolbarBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs transition-all active:scale-95 ${
        active
          ? 'border-indigo-500/35 bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 shadow-2xs'
          : 'border-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-white'
      } disabled:opacity-35 disabled:pointer-events-none cursor-pointer`}
    >
      {children}
    </button>
  );
}

function sanitizeSafeHtml(rawHtml: string): string {
  if (typeof window === 'undefined') {
    return rawHtml;
  }
  return DOMPurify.sanitize(rawHtml);
}

function plainTextToTiptapDoc(rawText: string) {
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line.length > 0 ? [{ type: 'text', text: line }] : [],
    })),
  };
}

function extractOutlineHeadings(editor: Editor): OutlineHeadingItem[] {
  const headings: OutlineHeadingItem[] = [];
  let counter = 0;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      counter += 1;
      const level = Number(node.attrs?.level ?? 1);
      headings.push({
        id: `h-${counter}-${pos}`,
        level,
        text: node.textContent.trim() || '(Tiêu đề trống)',
        pos,
      });
    }
  });
  return headings;
}

function findTextRangeInEditor(
  editor: Editor,
  rawQuery: string,
  fromOffset = 0,
): { from: number; to: number } | null {
  const needle = rawQuery.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!needle) return null;

  let found: { from: number; to: number } | null = null;
  let firstMatch: { from: number; to: number } | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (!node.isTextblock) return true;

    const text = node.textContent.toLowerCase();
    const idx = text.indexOf(needle);
    if (idx === -1) return true;

    const matchRange = {
      from: pos + 1 + idx,
      to: Math.min(pos + 1 + idx + needle.length, pos + 1 + node.textContent.length),
    };
    if (!firstMatch) firstMatch = matchRange;
    if (matchRange.from >= fromOffset) {
      found = matchRange;
      return false;
    }
    return true;
  });

  return found ?? firstMatch;
}

function extractProseMirrorTextSegments(editor: Editor): ProseMirrorTextSegment[] {
  const segments: ProseMirrorTextSegment[] = [];
  let headingActive = false;
  let needBlockBreak = false;

  editor.state.doc.descendants((node, pos) => {
    if (node.isTextblock) {
      headingActive = node.type.name === 'heading';
      needBlockBreak = true;
      return true;
    }

    if (node.isText && node.text) {
      segments.push({
        text: node.text,
        from: pos,
        to: pos + node.text.length,
        isBlockStart: needBlockBreak,
        isHeading: headingActive,
      });
      needBlockBreak = false;
    }

    return true;
  });

  return segments;
}

export function MarkdownWysiwygCanvas({
  value,
  onChange,
  mode,
  readOnly = false,
  compactReaderMode = false,
  citationTarget,
  scrollToCitationNonce = 0,
  onCitationResolved,
  onCitationDismiss,
}: MarkdownWysiwygCanvasProps) {
  const supportsWysiwyg = mode !== 'plain_text';
  const supportsSourceToggle = mode === 'markdown_wysiwyg' || mode === 'html_wysiwyg';

  const [initialMountSplit] = useState(() =>
    mode === 'markdown_wysiwyg'
      ? splitMarkdownFrontmatter(value)
      : { frontmatter: '', body: value },
  );

  const frontmatterRef = useRef(initialMountSplit.frontmatter);
  const lastEmittedRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onCitationResolvedRef = useRef(onCitationResolved);
  const onCitationDismissRef = useRef(onCitationDismiss);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const lastAutoSwitchedNonceRef = useRef<number | null>(null);

  const [isSourceView, setIsSourceView] = useState(false);
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [headings, setHeadings] = useState<OutlineHeadingItem[]>([]);
  const [, forceToolbarUpdate] = useReducer((count: number) => count + 1, 0);

  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('');

  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');

  useEffect(() => {
    onChangeRef.current = onChange;
    onCitationResolvedRef.current = onCitationResolved;
    onCitationDismissRef.current = onCitationDismiss;
  });

  const extensions = useMemo<AnyExtension[]>(() => {
    const citationHighlightExt = CitationHighlightExtension.configure({
      onAutoDismiss: () => onCitationDismissRef.current?.(),
    });

    if (mode === 'plain_text') {
      return [
        StarterKit.configure({
          blockquote: false,
          bold: false,
          bulletList: false,
          code: false,
          codeBlock: false,
          hardBreak: {},
          heading: false,
          horizontalRule: false,
          italic: false,
          listItem: false,
          listKeymap: false,
          link: false,
          orderedList: false,
          strike: false,
          underline: false,
        }),
        Placeholder.configure({
          placeholder: 'Nhập văn bản thuần...',
        }),
        citationHighlightExt,
      ];
    }

    const richExtensions: AnyExtension[] = [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
        },
      }),
      TableKit.configure({
        table: { resizable: true },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ImageExtension.configure({
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder: 'Bắt đầu gõ nội dung hoặc sử dụng thanh công cụ định dạng phía trên...',
      }),
      citationHighlightExt,
    ];

    if (mode === 'markdown_wysiwyg') {
      richExtensions.push(
        Markdown.configure({
          markedOptions: {
            gfm: true,
            breaks: true,
          },
        }),
      );
    }

    return richExtensions;
  }, [mode]);

  const [initialEditorContent] = useState(() => {
    if (mode === 'markdown_wysiwyg') {
      return initialMountSplit.body;
    }
    if (mode === 'html_wysiwyg') {
      return sanitizeSafeHtml(initialMountSplit.body);
    }
    return plainTextToTiptapDoc(initialMountSplit.body);
  });

  const syncOutlineFromEditor = useCallback(
    (ed: Editor) => {
      if (!supportsWysiwyg) return;
      setHeadings(extractOutlineHeadings(ed));
    },
    [supportsWysiwyg],
  );

  const editor = useEditor(
    {
      extensions,
      content: initialEditorContent,
      ...(mode === 'markdown_wysiwyg' ? { contentType: 'markdown' as const } : {}),
      editable: !readOnly,
      immediatelyRender: false,
      enableInputRules: mode !== 'plain_text',
      enablePasteRules: mode !== 'plain_text',
      editorProps: {
        attributes: {
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': 'Trình soạn thảo tài liệu',
          class:
            mode === 'plain_text'
              ? 'mx-auto min-h-full max-w-4xl px-5 sm:px-8 py-6 font-mono text-[13.5px] leading-7 text-neutral-900 dark:text-neutral-100 outline-none'
              : 'mx-auto min-h-full max-w-4xl px-5 sm:px-10 py-7 text-[15px] sm:text-[15.5px]',
        },
      },
      onCreate: ({ editor: ed }) => {
        syncOutlineFromEditor(ed);
      },
      onSelectionUpdate: () => {
        forceToolbarUpdate();
      },
      onUpdate: ({ editor: ed }) => {
        syncOutlineFromEditor(ed);
        forceToolbarUpdate();

        let serialized = '';
        if (mode === 'markdown_wysiwyg') {
          const mdBody = ed.getMarkdown();
          serialized = joinMarkdownFrontmatter(frontmatterRef.current, mdBody);
        } else if (mode === 'html_wysiwyg') {
          serialized = ed.isEmpty ? '' : sanitizeSafeHtml(ed.getHTML());
        } else {
          serialized = ed.getText({ blockSeparator: '\n' });
        }

        lastEmittedRef.current = serialized;
        onChangeRef.current(serialized);
      },
    },
    [extensions],
  );

  // Đồng bộ editable khi readOnly đổi
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  // Đồng bộ giá trị bên ngoài (vd: tải lần đầu hoặc Reload sau 409 Conflict)
  useEffect(() => {
    if (!editor || editor.isDestroyed || value === lastEmittedRef.current) {
      return;
    }

    lastEmittedRef.current = value;

    if (mode === 'markdown_wysiwyg') {
      const split = splitMarkdownFrontmatter(value);
      frontmatterRef.current = split.frontmatter;
      editor.commands.setContent(split.body, {
        emitUpdate: false,
        contentType: 'markdown',
      });
    } else if (mode === 'html_wysiwyg') {
      editor.commands.setContent(sanitizeSafeHtml(value), {
        emitUpdate: false,
        contentType: 'html',
      });
    } else {
      editor.commands.setContent(plainTextToTiptapDoc(value), {
        emitUpdate: false,
      });
    }

    queueMicrotask(() => {
      if (!editor.isDestroyed) {
        syncOutlineFromEditor(editor);
      }
    });
  }, [editor, value, mode, syncOutlineFromEditor]);

  // Tự động định vị & tô sáng phi phá hủy (DecorationSet) đoạn trích dẫn nguồn 4 tầng
  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      return;
    }

    if (!citationTarget) {
      lastAutoSwitchedNonceRef.current = null;
      dispatchCitationHighlight(editor.view, { range: null, tier: null });
      queueMicrotask(() => onCitationResolvedRef.current?.(null));
      return;
    }

    if (
      isSourceView &&
      lastAutoSwitchedNonceRef.current !== citationTarget.nonce
    ) {
      lastAutoSwitchedNonceRef.current = citationTarget.nonce;
      queueMicrotask(() => setIsSourceView(false));
      return;
    }

    if (isSourceView) {
      return;
    }

    const segments = extractProseMirrorTextSegments(editor);
    const resolution = resolveTextSegmentsCitation(
      segments,
      value.length,
      citationTarget,
    );

    if (
      resolution &&
      resolution.tier !== 4 &&
      resolution.from !== null &&
      resolution.to !== null
    ) {
      dispatchCitationHighlight(editor.view, {
        range: { from: resolution.from, to: resolution.to },
        tier: resolution.tier,
      });

      requestAnimationFrame(() => {
        const container = editorContainerRef.current;
        if (!container) return;
        const firstHighlightEl = container.querySelector<HTMLElement>(
          '[data-citation-highlight="true"]',
        );
        firstHighlightEl?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      });
    } else {
      dispatchCitationHighlight(editor.view, { range: null, tier: null });
    }

    queueMicrotask(() => {
      onCitationResolvedRef.current?.(resolution);
    });
  }, [editor, citationTarget, scrollToCitationNonce, isSourceView, value]);

  // Lắng nghe Ctrl+F mở thanh tìm kiếm nội bộ
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsFindOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleSourceView = () => {
    if (!supportsSourceToggle || !editor || editor.isDestroyed) return;
    if (isSourceView) {
      if (mode === 'markdown_wysiwyg') {
        const split = splitMarkdownFrontmatter(value);
        frontmatterRef.current = split.frontmatter;
        editor.commands.setContent(split.body, {
          emitUpdate: false,
          contentType: 'markdown',
        });
      } else {
        editor.commands.setContent(sanitizeSafeHtml(value), {
          emitUpdate: false,
          contentType: 'html',
        });
      }
      lastEmittedRef.current = value;
      syncOutlineFromEditor(editor);
      setIsSourceView(false);
      return;
    }

    setIsSourceView(true);
  };

  const handleApplyLink = () => {
    if (!editor || editor.isDestroyed) return;
    const trimmed = linkUrlInput.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setIsLinkPopoverOpen(false);
      return;
    }
    const safeUrl =
      /^(https?:\/\/|mailto:|#)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: safeUrl })
      .run();
    setIsLinkPopoverOpen(false);
  };

  const handleOpenLinkPopover = () => {
    if (!editor || editor.isDestroyed) return;
    const currentHref = String(editor.getAttributes('link')?.href ?? '');
    setLinkUrlInput(currentHref);
    setIsLinkPopoverOpen((prev) => !prev);
  };

  const handleFindNext = () => {
    if (!findQuery || !editor || editor.isDestroyed || isSourceView) return;
    const currentPos = editor.state.selection.to;
    const match = findTextRangeInEditor(editor, findQuery, currentPos);
    if (match) {
      editor.chain().focus().setTextSelection(match).scrollIntoView().run();
    }
  };

  const handleReplaceMatch = () => {
    if (!findQuery || readOnly || !editor || editor.isDestroyed || isSourceView) {
      return;
    }
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (selectedText.toLowerCase() === findQuery.trim().toLowerCase()) {
      editor.chain().focus().insertContentAt({ from, to }, replaceQuery).run();
    }
    handleFindNext();
  };

  const stats = useMemo(() => {
    const plain = value.trim();
    const words = plain ? plain.split(/\s+/).length : 0;
    return {
      words,
      chars: value.length,
    };
  }, [value]);

  const isInTable = Boolean(editor && !isSourceView && editor.isActive('table'));

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      {/* Top Formatting Toolbar trực quan kiểu Apple HIG */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.08] bg-neutral-50/95 dark:bg-[#131722] px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-0.5">
          {!readOnly && editor && !isSourceView && (
            <>
              <ToolbarBtn
                title="Hoàn tác (Ctrl+Z)"
                disabled={!editor.can().undo()}
                onClick={() => editor.chain().focus().undo().run()}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                title="Làm lại (Ctrl+Y)"
                disabled={!editor.can().redo()}
                onClick={() => editor.chain().focus().redo().run()}
              >
                <Redo2 className="h-3.5 w-3.5" />
              </ToolbarBtn>
            </>
          )}

          {supportsWysiwyg && !readOnly && editor && !isSourceView && (
            <>
              <div className="mx-1 h-4 w-px bg-black/[0.08] dark:bg-white/[0.1]" />

              <ToolbarBtn
                title="Đoạn văn thường"
                active={editor.isActive('paragraph')}
                onClick={() => editor.chain().focus().setParagraph().run()}
              >
                <Pilcrow className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                title="Tiêu đề lớn (H1)"
                active={editor.isActive('heading', { level: 1 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              >
                <Heading1 className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                title="Tiêu đề vừa (H2)"
                active={editor.isActive('heading', { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              >
                <Heading2 className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                title="Tiêu đề nhỏ (H3)"
                active={editor.isActive('heading', { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              >
                <Heading3 className="h-3.5 w-3.5" />
              </ToolbarBtn>

              <div className="mx-1 h-4 w-px bg-black/[0.08] dark:bg-white/[0.1]" />

              <ToolbarBtn
                title="In đậm (Ctrl+B)"
                active={editor.isActive('bold')}
                onClick={() => editor.chain().focus().toggleBold().run()}
              >
                <Bold className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                title="In nghiêng (Ctrl+I)"
                active={editor.isActive('italic')}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              >
                <Italic className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                title="Gạch chân (Ctrl+U)"
                active={editor.isActive('underline')}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
              >
                <UnderlineIcon className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                title="Gạch ngang"
                active={editor.isActive('strike')}
                onClick={() => editor.chain().focus().toggleStrike().run()}
              >
                <Strikethrough className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                title="Mã nội tuyến"
                active={editor.isActive('code')}
                onClick={() => editor.chain().focus().toggleCode().run()}
              >
                <Code className="h-3.5 w-3.5" />
              </ToolbarBtn>

              <div className="mx-1 h-4 w-px bg-black/[0.08] dark:bg-white/[0.1]" />

              <ToolbarBtn
                title="Danh sách chấm"
                active={editor.isActive('bulletList')}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              >
                <List className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                title="Danh sách đánh số"
                active={editor.isActive('orderedList')}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                title="Danh sách công việc (Checklist)"
                active={editor.isActive('taskList')}
                onClick={() => editor.chain().focus().toggleTaskList().run()}
              >
                <ListChecks className="h-3.5 w-3.5" />
              </ToolbarBtn>

              <div className="mx-1 h-4 w-px bg-black/[0.08] dark:bg-white/[0.1]" />

              <ToolbarBtn
                title="Trích dẫn"
                active={editor.isActive('blockquote')}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              >
                <Quote className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                title="Khối mã nguồn"
                active={editor.isActive('codeBlock')}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              >
                <FileCode2 className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                title="Đường kẻ phân cách"
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
              >
                <Minus className="h-3.5 w-3.5" />
              </ToolbarBtn>

              <div className="relative">
                <ToolbarBtn
                  title="Chèn / sửa liên kết"
                  active={editor.isActive('link') || isLinkPopoverOpen}
                  onClick={handleOpenLinkPopover}
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                </ToolbarBtn>
                {isLinkPopoverOpen && (
                  <div className="absolute left-0 top-9 z-40 flex items-center gap-1.5 rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#181C26] p-2 shadow-xl">
                    <input
                      type="url"
                      value={linkUrlInput}
                      onChange={(e) => setLinkUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyLink();
                        }
                      }}
                      placeholder="https://..."
                      className="h-7 w-48 rounded-lg border border-black/[0.1] dark:border-white/[0.12] bg-neutral-50 dark:bg-white/[0.05] px-2 text-xs text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyLink}
                      className="h-7 rounded-lg bg-[#4F46E5] px-2.5 text-xs font-semibold text-white hover:bg-[#4338CA] cursor-pointer"
                    >
                      Áp dụng
                    </button>
                  </div>
                )}
              </div>

              <ToolbarBtn
                title="Chèn bảng (3x3)"
                active={editor.isActive('table')}
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
                }
              >
                <TableIcon className="h-3.5 w-3.5" />
              </ToolbarBtn>
            </>
          )}
        </div>

        {/* Cụm công cụ phụ bên phải: Mục lục, Tìm kiếm, Xem mã nguồn */}
        <div className="flex items-center gap-1">
          {supportsWysiwyg && !isSourceView && (
            <button
              type="button"
              onClick={() => setIsOutlineOpen((prev) => !prev)}
              title="Bật/tắt mục lục tiêu đề"
              className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-xs font-semibold transition-colors cursor-pointer ${
                isOutlineOpen
                  ? 'border-indigo-500/35 bg-indigo-500/12 text-indigo-600 dark:text-indigo-400'
                  : 'border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.12]'
              }`}
            >
              <ListTree className="h-3.5 w-3.5" />
              {!compactReaderMode && <span className="hidden lg:inline">Mục lục</span>}
            </button>
          )}

          {!isSourceView && (
            <button
              type="button"
              onClick={() => setIsFindOpen((prev) => !prev)}
              title="Tìm kiếm trong tài liệu (Ctrl+F)"
              className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-xs font-semibold transition-colors cursor-pointer ${
                isFindOpen
                  ? 'border-indigo-500/35 bg-indigo-500/12 text-indigo-600 dark:text-indigo-400'
                  : 'border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.12]'
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              {!compactReaderMode && <span className="hidden lg:inline">Tìm</span>}
            </button>
          )}

          {supportsSourceToggle && (
            <button
              type="button"
              onClick={handleToggleSourceView}
              title={
                isSourceView
                  ? 'Chuyển lại chế độ xem & sửa trực quan (WYSIWYG)'
                  : 'Xem mã nguồn gốc (tùy chọn nâng cao)'
              }
              className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-xs font-semibold transition-colors cursor-pointer ${
                isSourceView
                  ? 'border-indigo-500/35 bg-indigo-500/12 text-indigo-600 dark:text-indigo-400'
                  : 'border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.12]'
              }`}
            >
              {isSourceView ? (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  <span>Trực quan</span>
                </>
              ) : (
                <>
                  <Code2 className="h-3.5 w-3.5" />
                  {!compactReaderMode && <span className="hidden xl:inline">Mã nguồn</span>}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Thanh ngữ cảnh chỉnh sửa Bảng (hiện khi con trỏ nằm trong bảng) */}
      {isInTable && !readOnly && editor && (
        <div className="flex flex-wrap items-center gap-1 border-b border-indigo-500/15 bg-indigo-500/[0.05] px-3 py-1.5 text-[11px] font-semibold">
          <span className="mr-1 text-indigo-700 dark:text-indigo-300">Bảng:</span>
          <button
            type="button"
            onClick={() => editor.chain().focus().addRowAfter().run()}
            className="inline-flex h-6 items-center gap-1 rounded-md bg-white dark:bg-white/[0.08] px-2 text-neutral-700 dark:text-neutral-200 hover:bg-indigo-500/15 cursor-pointer"
          >
            <Plus className="h-3 w-3" /> Hàng
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            className="inline-flex h-6 items-center gap-1 rounded-md bg-white dark:bg-white/[0.08] px-2 text-neutral-700 dark:text-neutral-200 hover:bg-indigo-500/15 cursor-pointer"
          >
            <Plus className="h-3 w-3" /> Cột
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteRow().run()}
            className="inline-flex h-6 items-center gap-1 rounded-md bg-white dark:bg-white/[0.08] px-2 text-neutral-700 dark:text-neutral-200 hover:bg-rose-500/15 cursor-pointer"
          >
            - Hàng
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            className="inline-flex h-6 items-center gap-1 rounded-md bg-white dark:bg-white/[0.08] px-2 text-neutral-700 dark:text-neutral-200 hover:bg-rose-500/15 cursor-pointer"
          >
            - Cột
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteTable().run()}
            className="inline-flex h-6 items-center gap-1 rounded-md bg-rose-500/10 px-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 cursor-pointer"
          >
            <Trash2 className="h-3 w-3" /> Xóa bảng
          </button>
        </div>
      )}

      {/* Thanh Tìm & Thay thế */}
      {isFindOpen && !isSourceView && (
        <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#161922] px-3 py-2">
          <input
            type="text"
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleFindNext();
              }
            }}
            placeholder="Tìm trong văn bản..."
            className="h-7 w-40 sm:w-52 rounded-lg border border-black/[0.1] dark:border-white/[0.12] bg-neutral-50 dark:bg-white/[0.04] px-2.5 text-xs text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={handleFindNext}
            className="h-7 rounded-lg bg-indigo-500/10 px-2.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 cursor-pointer"
          >
            Tìm tiếp
          </button>
          {!readOnly && (
            <>
              <input
                type="text"
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                placeholder="Thay thế..."
                className="h-7 w-32 sm:w-40 rounded-lg border border-black/[0.1] dark:border-white/[0.12] bg-neutral-50 dark:bg-white/[0.04] px-2.5 text-xs text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleReplaceMatch}
                className="h-7 rounded-lg bg-neutral-100 dark:bg-white/[0.08] px-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-white/[0.14] cursor-pointer"
              >
                Thay thế
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setIsFindOpen(false)}
            aria-label="Đóng thanh tìm kiếm"
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Thân soạn thảo chính: Outline Sidebar + WYSIWYG / Source Canvas */}
      <div className="flex flex-1 min-h-0 overflow-hidden bg-white dark:bg-[#0D1017]">
        {supportsWysiwyg && isOutlineOpen && !isSourceView && (
          <DocumentOutlineSidebar
            headings={headings}
            onSelectHeading={(item) => {
              if (!editor || editor.isDestroyed) return;
              editor
                .chain()
                .focus()
                .setTextSelection(item.pos + 1)
                .scrollIntoView()
                .run();
            }}
            onClose={() => setIsOutlineOpen(false)}
          />
        )}

        {isSourceView ? (
          <textarea
            value={value}
            readOnly={readOnly}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            aria-label="Mã nguồn Markdown hoặc HTML"
            className="h-full w-full flex-1 resize-none overflow-auto bg-transparent p-5 sm:p-8 font-mono text-[13px] leading-6 text-neutral-900 dark:text-neutral-100 outline-none"
          />
        ) : (
          <div
            ref={editorContainerRef}
            className="relative flex-1 overflow-y-auto studymate-doc-editor"
          >
            {editor && supportsWysiwyg && !readOnly && (
              <BubbleMenu
                editor={editor}
                shouldShow={({ editor: ed, state }) =>
                  !ed.isDestroyed && ed.isEditable && !state.selection.empty && !isSourceView
                }
                className="flex items-center gap-0.5 rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#181C26]/95 px-1.5 py-1 shadow-xl backdrop-blur-xl"
              >
                <ToolbarBtn
                  title="In đậm"
                  active={editor.isActive('bold')}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                >
                  <Bold className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn
                  title="In nghiêng"
                  active={editor.isActive('italic')}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                  <Italic className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn
                  title="Gạch chân"
                  active={editor.isActive('underline')}
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                >
                  <UnderlineIcon className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn
                  title="Gạch ngang"
                  active={editor.isActive('strike')}
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                >
                  <Strikethrough className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn
                  title="Mã nội tuyến"
                  active={editor.isActive('code')}
                  onClick={() => editor.chain().focus().toggleCode().run()}
                >
                  <Code className="h-3.5 w-3.5" />
                </ToolbarBtn>
              </BubbleMenu>
            )}

            <EditorContent editor={editor} className="min-h-full" />
          </div>
        )}
      </div>

      {/* Footer thống kê nhẹ */}
      <div className="flex items-center justify-between border-t border-black/[0.05] dark:border-white/[0.06] bg-neutral-50/70 dark:bg-[#11141C] px-4 py-1 text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
        <span>
          {mode === 'markdown_wysiwyg'
            ? isSourceView
              ? 'Đang xem mã nguồn Markdown'
              : 'Soạn thảo trực quan WYSIWYG (tự động xuất chuẩn Markdown)'
            : mode === 'html_wysiwyg'
              ? isSourceView
                ? 'Đang xem mã nguồn HTML'
                : 'Soạn thảo trực quan HTML (đã bảo vệ XSS)'
              : 'Chế độ văn bản thuần'}
        </span>
        <span>
          {stats.words.toLocaleString()} từ · {stats.chars.toLocaleString()} ký tự
        </span>
      </div>
    </div>
  );
}
