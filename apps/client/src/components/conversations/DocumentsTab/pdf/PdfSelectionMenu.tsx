"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useSelectionCapability,
  type SelectionSelectionMenuProps,
} from '@embedpdf/plugin-selection/react';
import { useAnnotation } from '@embedpdf/plugin-annotation/react';
import { PdfAnnotationSubtype, PdfBlendMode } from '@embedpdf/models';
import {
  Check,
  Copy,
  Highlighter,
  Strikethrough,
  Underline,
} from 'lucide-react';
import { useAskAi } from '@/contexts/AskAiContext';
import { SelectionAskAiPanel } from '../shared/SelectionAskAiPanel';
import { computePdfSelectionMenuPosition } from './pdf-selection-position.helper';

export interface PdfSelectionMenuProps extends SelectionSelectionMenuProps {
  documentId: string;
  backendDocumentId: string;
  fileName: string;
  pageWidth: number;
  compactReaderMode?: boolean;
}

type PdfTextMarkupToolId = 'highlight' | 'underline' | 'strikeout';

const PDF_MARKUP_ACTIONS: Array<{
  id: PdfTextMarkupToolId;
  title: string;
  icon: typeof Highlighter;
  hoverClass: string;
}> = [
  {
    id: 'highlight',
    title: 'Tô sáng đoạn chọn',
    icon: Highlighter,
    hoverClass: 'hover:bg-amber-500/15 hover:text-amber-600 dark:hover:text-amber-400',
  },
  {
    id: 'underline',
    title: 'Gạch chân đoạn chọn',
    icon: Underline,
    hoverClass: 'hover:bg-emerald-500/15 hover:text-emerald-600 dark:hover:text-emerald-400',
  },
  {
    id: 'strikeout',
    title: 'Gạch ngang đoạn chọn',
    icon: Strikethrough,
    hoverClass: 'hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400',
  },
];

export const PdfSelectionMenu = React.memo(function PdfSelectionMenu({
  rect,
  menuWrapperProps,
  placement,
  context,
  documentId,
  backendDocumentId,
  fileName,
  pageWidth,
  compactReaderMode = false,
}: PdfSelectionMenuProps) {
  const { provides: selectionCapability } = useSelectionCapability();
  const { provides: annotationApi } = useAnnotation(documentId);
  const { askAiAboutSelection, isAiResponding } = useAskAi();

  const [isAskAiOpen, setIsAskAiOpen] = useState(false);
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const [copied, setCopied] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const position = useMemo(
    () =>
      computePdfSelectionMenuPosition({
        rectOriginX: rect.origin.x,
        rectWidth: rect.size.width,
        rectHeight: rect.size.height,
        suggestTop: placement.suggestTop,
        spaceAbove: placement.spaceAbove ?? 120,
        spaceBelow: placement.spaceBelow ?? 200,
        pageWidth,
        isExpanded: isAskAiOpen,
        compactReaderMode,
      }),
    [
      rect.origin.x,
      rect.size.width,
      rect.size.height,
      placement.suggestTop,
      placement.spaceAbove,
      placement.spaceBelow,
      pageWidth,
      isAskAiOpen,
      compactReaderMode,
    ],
  );

  const stopPointerPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const extractCurrentSelectionText = useCallback(async (): Promise<string> => {
    if (!selectionCapability) return '';
    try {
      const lines = await selectionCapability
        .forDocument(documentId)
        .getSelectedText()
        .toPromise();
      return Array.isArray(lines) ? lines.join('\n').trim() : '';
    } catch {
      return '';
    }
  }, [selectionCapability, documentId]);

  const handleOpenAskAi = async () => {
    setIsAskAiOpen(true);
    setIsExtractingText(true);

    const extracted = await extractCurrentSelectionText();
    setSelectedSnapshot(extracted);
    setIsExtractingText(false);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleCollapseAskAi = useCallback(() => {
    setIsAskAiOpen(false);
    setPromptInput('');
  }, []);

  const handleSubmitPrompt = useCallback(
    (rawPrompt: string) => {
      const cleanPrompt = rawPrompt.trim();
      const cleanSelection = selectedSnapshot.trim();
      if (!cleanPrompt || !cleanSelection) return;

      askAiAboutSelection({
        selectedText: cleanSelection,
        prompt: cleanPrompt,
        source: {
          documentId: backendDocumentId,
          fileName,
          pageNo: context.pageIndex + 1,
          mode: 'pdf',
        },
      });

      setIsAskAiOpen(false);
      setPromptInput('');
      setSelectedSnapshot('');
      selectionCapability?.forDocument(documentId).clear();
    },
    [
      selectedSnapshot,
      askAiAboutSelection,
      backendDocumentId,
      fileName,
      context.pageIndex,
      selectionCapability,
      documentId,
    ],
  );

  const handleCopy = () => {
    if (!selectionCapability) return;
    const scope = selectionCapability.forDocument(documentId);
    scope.copyToClipboard();
    setCopied(true);
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => {
      setCopied(false);
      scope.clear();
    }, 650);
  };

  const handleApplyTextMarkup = async (toolId: PdfTextMarkupToolId) => {
    if (!selectionCapability || !annotationApi) return;
    const scope = selectionCapability.forDocument(documentId);
    const formattedSelections = scope.getFormattedSelection();

    if (formattedSelections.length === 0) return;

    const extractedText = await extractCurrentSelectionText();

    const markupDefaults =
      toolId === 'highlight'
        ? {
            type: PdfAnnotationSubtype.HIGHLIGHT,
            strokeColor: '#FFCD45',
            color: '#FFCD45',
            opacity: 1,
            blendMode: PdfBlendMode.Multiply,
          }
        : toolId === 'underline'
          ? {
              type: PdfAnnotationSubtype.UNDERLINE,
              strokeColor: '#E44234',
              color: '#E44234',
              opacity: 1,
            }
          : {
              type: PdfAnnotationSubtype.STRIKEOUT,
              strokeColor: '#E44234',
              color: '#E44234',
              opacity: 1,
            };

    for (const sel of formattedSelections) {
      const id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      annotationApi.createAnnotation(sel.pageIndex, {
        ...markupDefaults,
        rect: sel.rect,
        segmentRects: sel.segmentRects,
        pageIndex: sel.pageIndex,
        created: new Date(),
        id,
        ...(extractedText ? { custom: { text: extractedText } } : {}),
      } as Parameters<typeof annotationApi.createAnnotation>[1]);
    }

    scope.clear();
  };

  return (
    <div {...menuWrapperProps}>
      <div
        style={{
          position: 'absolute',
          top: position.top,
          left: position.left,
          width: isAskAiOpen ? position.menuWidth : 'max-content',
          pointerEvents: 'auto',
          cursor: 'default',
          zIndex: 60,
        }}
        onPointerDown={stopPointerPropagation}
        onMouseDown={stopPointerPropagation}
        onClick={stopPointerPropagation}
        className="rounded-2xl border border-black/[0.08] dark:border-white/[0.14] bg-white/95 dark:bg-[#181C26]/95 shadow-2xl backdrop-blur-xl transition-all duration-150"
      >
        {!isAskAiOpen ? (
          <div className="flex items-center gap-0.5 px-1.5 py-1">
            <button
              type="button"
              onClick={() => void handleOpenAskAi()}
              data-pdf-bubble-ask-ai="true"
              className="inline-flex h-7 items-center gap-1.5 rounded-xl bg-indigo-500/12 px-2.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition-colors hover:bg-indigo-600 hover:text-white active:scale-[0.97] cursor-pointer whitespace-nowrap"
            >
              <img
                src="/studymate_simple.svg"
                alt=""
                className="h-3.5 w-3.5 shrink-0"
              />
              <span>Hỏi Studymate</span>
            </button>

            {!compactReaderMode && annotationApi && (
              <>
                <span
                  aria-hidden="true"
                  className="mx-1 h-4 w-px bg-black/[0.08] dark:bg-white/[0.12]"
                />
                {PDF_MARKUP_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => void handleApplyTextMarkup(action.id)}
                      title={action.title}
                      aria-label={action.title}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-neutral-600 dark:text-neutral-300 transition-colors active:scale-95 cursor-pointer ${action.hoverClass}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </>
            )}

            <span
              aria-hidden="true"
              className="mx-1 h-4 w-px bg-black/[0.08] dark:bg-white/[0.12]"
            />

            <button
              type="button"
              onClick={handleCopy}
              title="Sao chép văn bản đã chọn"
              aria-label="Sao chép văn bản đã chọn"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-600 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-white active:scale-95 cursor-pointer"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        ) : (
          <SelectionAskAiPanel
            selectedText={selectedSnapshot}
            promptInput={promptInput}
            onPromptInputChange={setPromptInput}
            onSubmit={handleSubmitPrompt}
            onClose={handleCollapseAskAi}
            isAiResponding={isAiResponding}
            isExtractingText={isExtractingText}
            inputRef={inputRef}
            className="w-full"
          />
        )}
      </div>
    </div>
  );
});
