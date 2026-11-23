"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  Bold,
  Code,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
} from 'lucide-react';
import { useAskAi } from '@/contexts/AskAiContext';
import { SelectionAskAiPanel } from '../shared/SelectionAskAiPanel';

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
          <SelectionAskAiPanel
            selectedText={selectedSnapshot}
            promptInput={promptInput}
            onPromptInputChange={setPromptInput}
            onSubmit={handleSubmitPrompt}
            onClose={handleCollapseAskAi}
            isAiResponding={isAiResponding}
            inputRef={inputRef}
          />
        )}
      </div>
    </BubbleMenu>
  );
}
