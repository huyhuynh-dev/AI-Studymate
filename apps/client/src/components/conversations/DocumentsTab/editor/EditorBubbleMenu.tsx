"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  ArrowUp,
  Bold,
  Code,
  Italic,
  Loader2,
  Strikethrough,
  Underline as UnderlineIcon,
  X,
} from 'lucide-react';
import { useAskAi } from '@/contexts/AskAiContext';
import {
  BUBBLE_AI_QUICK_PROMPTS,
  normalizeSelectionText,
} from '@/lib/ask-ai-prompt.helper';

export const EDITOR_BUBBLE_MENU_PLUGIN_KEY = 'studymateEditorBubbleMenu';

export interface EditorBubbleMenuProps {
  editor: Editor;
  supportsFormatting: boolean;
  readOnly: boolean;
  isSourceView: boolean;
  documentId?: string;
  documentFileName?: string;
  mode?: string;
}

interface FormatButtonProps {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}

function FormatButton({
  onClick,
  active = false,
  title,
  children,
}: FormatButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs transition-all active:scale-95 cursor-pointer ${
        active
          ? 'border-indigo-500/35 bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 shadow-2xs'
          : 'border-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

export function EditorBubbleMenu({
  editor,
  supportsFormatting,
  readOnly,
  isSourceView,
  documentId,
  documentFileName,
  mode,
}: EditorBubbleMenuProps) {
  const { askAiAboutSelection, isAiResponding } = useAskAi();

  const [isAskAiOpen, setIsAskAiOpen] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [selectedSnapshot, setSelectedSnapshot] = useState('');

  const isAskAiOpenRef = useRef(false);
  const isSourceViewRef = useRef(isSourceView);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isAskAiOpenRef.current = isAskAiOpen;
  }, [isAskAiOpen]);

  useEffect(() => {
    isSourceViewRef.current = isSourceView;
  }, [isSourceView]);

  const requestMenuPositionUpdate = useCallback(() => {
    requestAnimationFrame(() => {
      if (!editor.isDestroyed) {
        editor.commands.setMeta(EDITOR_BUBBLE_MENU_PLUGIN_KEY, 'updatePosition');
      }
    });
  }, [editor]);

  const resetAskState = useCallback(() => {
    isAskAiOpenRef.current = false;
    setIsAskAiOpen(false);
    setPromptInput('');
    setSelectedSnapshot('');
  }, []);

  const handleMenuHidden = useCallback(() => {
    isAskAiOpenRef.current = false;
    queueMicrotask(() => {
      setIsAskAiOpen(false);
      setPromptInput('');
      setSelectedSnapshot('');
    });
  }, []);

  // Tự đóng khung Prompt nếu người dùng click ra ngoài cả BubbleMenu lẫn vùng editor khi input đang mở
  useEffect(() => {
    if (!isAskAiOpen) return;

    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const insideMenu = menuContainerRef.current?.contains(target) ?? false;
      const insideEditor = editor.isDestroyed
        ? false
        : editor.view.dom.contains(target);

      if (!insideMenu && !insideEditor) {
        resetAskState();
        if (!editor.isDestroyed) {
          editor.commands.setMeta(EDITOR_BUBBLE_MENU_PLUGIN_KEY, 'hide');
        }
      }
    };

    window.addEventListener('pointerdown', handlePointerDownOutside, {
      capture: true,
    });
    return () => {
      window.removeEventListener('pointerdown', handlePointerDownOutside, {
        capture: true,
      });
    };
  }, [isAskAiOpen, editor, resetAskState]);

  const shouldShow = useCallback(
    ({
      editor: ed,
      state,
    }: {
      editor: Editor;
      state: Editor['state'];
    }) => {
      if (ed.isDestroyed || isSourceViewRef.current) {
        return false;
      }

      const { from, to, empty } = state.selection;
      if (empty) {
        return false;
      }

      const selectedText = state.doc.textBetween(from, to, '\n').trim();
      if (!selectedText) {
        return false;
      }

      // Cho phép giữ nguyên menu khi focus đã chuyển vào ô <input> của bước "Hỏi AI"
      if (isAskAiOpenRef.current) {
        return true;
      }

      return true;
    },
    [],
  );

  const bubbleMenuOptions = useMemo(
    () => ({
      placement: 'top' as const,
      offset: 10,
      flip: true,
      shift: { padding: 12 },
      onHide: handleMenuHidden,
    }),
    [handleMenuHidden],
  );

  const handleOpenAskAi = () => {
    if (editor.isDestroyed) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, '\n').trim();
    if (!text) return;

    setSelectedSnapshot(text);
    isAskAiOpenRef.current = true;
    setIsAskAiOpen(true);

    requestAnimationFrame(() => {
      if (!editor.isDestroyed) {
        editor.commands.setMeta(EDITOR_BUBBLE_MENU_PLUGIN_KEY, 'updatePosition');
      }
      inputRef.current?.focus();
    });
  };

  const handleCollapseAskAi = () => {
    resetAskState();
    requestMenuPositionUpdate();
    requestAnimationFrame(() => {
      if (!editor.isDestroyed && !readOnly) {
        editor.commands.focus();
      }
    });
  };

  const handleSubmitPrompt = (rawPrompt: string) => {
    const cleanPrompt = rawPrompt.trim();
    if (!cleanPrompt) return;

    let cleanSelection = selectedSnapshot.trim();
    if (!cleanSelection && !editor.isDestroyed) {
      const { from, to } = editor.state.selection;
      cleanSelection = editor.state.doc.textBetween(from, to, '\n').trim();
    }
    if (!cleanSelection) return;

    askAiAboutSelection({
      selectedText: cleanSelection,
      prompt: cleanPrompt,
      source: {
        documentId,
        fileName: documentFileName,
        mode,
      },
    });

    resetAskState();
    if (!editor.isDestroyed) {
      editor.commands.setMeta(EDITOR_BUBBLE_MENU_PLUGIN_KEY, 'hide');
    }
  };

  const previewSnippet = useMemo(
    () => normalizeSelectionText(selectedSnapshot, 120).replace(/\n+/g, ' '),
    [selectedSnapshot],
  );

  const showFormattingGroup = supportsFormatting && !readOnly;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={EDITOR_BUBBLE_MENU_PLUGIN_KEY}
      updateDelay={140}
      shouldShow={shouldShow}
      options={bubbleMenuOptions}
      className="z-50"
    >
      <div
        ref={menuContainerRef}
        className="rounded-2xl border border-black/[0.08] dark:border-white/[0.14] bg-white/95 dark:bg-[#181C26]/95 shadow-2xl backdrop-blur-xl transition-all duration-150"
      >
        {!isAskAiOpen ? (
          <div className="flex items-center gap-0.5 px-1.5 py-1">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleOpenAskAi}
              data-bubble-ask-ai="true"
              className="inline-flex h-7 items-center gap-1.5 rounded-xl bg-indigo-500/12 px-2.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition-colors hover:bg-indigo-600 hover:text-white active:scale-[0.97] cursor-pointer"
            >
              <img
                src="/studymate_simple.svg"
                alt=""
                className="h-3.5 w-3.5 shrink-0"
              />
              <span>Hỏi Studymate</span>
            </button>

            {showFormattingGroup && (
              <>
                <span
                  aria-hidden="true"
                  className="mx-1 h-4 w-px bg-black/[0.08] dark:bg-white/[0.12]"
                />
                <FormatButton
                  title="In đậm"
                  active={editor.isActive('bold')}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                >
                  <Bold className="h-3.5 w-3.5" />
                </FormatButton>
                <FormatButton
                  title="In nghiêng"
                  active={editor.isActive('italic')}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                  <Italic className="h-3.5 w-3.5" />
                </FormatButton>
                <FormatButton
                  title="Gạch chân"
                  active={editor.isActive('underline')}
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                >
                  <UnderlineIcon className="h-3.5 w-3.5" />
                </FormatButton>
                <FormatButton
                  title="Gạch ngang"
                  active={editor.isActive('strike')}
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                >
                  <Strikethrough className="h-3.5 w-3.5" />
                </FormatButton>
                <FormatButton
                  title="Mã nội tuyến"
                  active={editor.isActive('code')}
                  onClick={() => editor.chain().focus().toggleCode().run()}
                >
                  <Code className="h-3.5 w-3.5" />
                </FormatButton>
              </>
            )}
          </div>
        ) : (
          <div className="w-[min(calc(100vw-2rem),392px)] p-2.5 space-y-2">
            {/* Header ngữ cảnh đoạn đang chọn */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-500/15">
                  <img
                    src="/studymate_simple.svg"
                    alt=""
                    className="h-3.5 w-3.5"
                  />
                </span>
                <span className="truncate text-[11px] font-medium italic text-neutral-500 dark:text-neutral-400">
                  &ldquo;{previewSnippet}&rdquo;
                </span>
              </div>

              <button
                type="button"
                onClick={handleCollapseAskAi}
                aria-label="Đóng khung Hỏi AI"
                title="Thu gọn (Esc)"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.08] hover:text-neutral-700 dark:hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Ô nhập Prompt + nút Gửi */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitPrompt(promptInput);
              }}
              className="flex items-center gap-1.5"
            >
              <input
                ref={inputRef}
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCollapseAskAi();
                  }
                }}
                placeholder="Hỏi AI về đoạn văn bản này..."
                aria-label="Nhập câu hỏi cho AI về đoạn đang chọn"
                className="h-8 min-w-0 flex-1 rounded-xl border border-black/[0.1] dark:border-white/[0.12] bg-neutral-50/90 dark:bg-white/[0.05] px-3 text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              />
              <button
                type="submit"
                disabled={!promptInput.trim()}
                title="Gửi sang Trợ lý AI (Enter)"
                aria-label="Gửi yêu cầu cho AI"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5] text-white shadow-xs transition-all hover:bg-[#4338CA] active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </form>

            {/* Hàng Gợi ý nhanh 1 chạm */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {BUBBLE_AI_QUICK_PROMPTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSubmitPrompt(item.prompt)}
                  className="inline-flex h-6 items-center rounded-full border border-indigo-500/20 bg-indigo-500/[0.06] dark:bg-indigo-500/[0.12] px-2.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 transition-colors hover:bg-indigo-600 hover:text-white hover:border-indigo-600 cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {isAiResponding && (
              <div className="flex items-center gap-1.5 text-[10.5px] text-amber-600 dark:text-amber-400">
                <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                <span>
                  AI đang trả lời câu trước — yêu cầu sẽ tự gửi ngay khi xong
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}
