import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';

export interface CitationHighlightPluginState {
  range: { from: number; to: number } | null;
  tier: 1 | 2 | 3 | null;
}

export interface CitationHighlightExtensionOptions {
  onAutoDismiss?: () => void;
}

export const CITATION_HIGHLIGHT_PLUGIN_KEY = new PluginKey<CitationHighlightPluginState>(
  'studymateCitationHighlight',
);

const EMPTY_HIGHLIGHT_STATE: CitationHighlightPluginState = {
  range: null,
  tier: null,
};

function stepOverlapsHighlightRange(
  tr: Transaction,
  range: { from: number; to: number },
): boolean {
  for (const step of tr.steps) {
    let touched = false;
    step.getMap().forEach((oldStart, oldEnd) => {
      if (oldStart <= range.to && oldEnd >= range.from) {
        touched = true;
      }
    });
    if (touched) return true;
  }
  return false;
}

function clampRange(
  range: { from: number; to: number } | null,
  docSize: number,
): { from: number; to: number } | null {
  if (!range || docSize < 2) return null;
  const from = Math.max(1, Math.min(docSize - 1, range.from));
  const to = Math.max(from + 1, Math.min(docSize, range.to));
  return to > from ? { from, to } : null;
}

/**
 * Extension Tiptap dùng ProseMirror DecorationSet để tô sáng đoạn trích dẫn mà không làm thay đổi tài liệu:
 * - Không trigger `onUpdate`, không kích hoạt Auto-save, không làm bẩn Undo/Redo.
 * - Tự tắt highlight nếu người dùng bắt đầu gõ chỉnh sửa trực tiếp vào đoạn đang được tô sáng.
 */
export const CitationHighlightExtension =
  Extension.create<CitationHighlightExtensionOptions>({
    name: 'citationHighlight',

    addOptions() {
      return {
        onAutoDismiss: undefined,
      };
    },

    addProseMirrorPlugins() {
      const getDismissHandler = () => this.options.onAutoDismiss;

      return [
        new Plugin<CitationHighlightPluginState>({
          key: CITATION_HIGHLIGHT_PLUGIN_KEY,
          state: {
            init: (): CitationHighlightPluginState => EMPTY_HIGHLIGHT_STATE,
            apply: (
              tr: Transaction,
              prev: CitationHighlightPluginState,
              _oldState: EditorState,
              newState: EditorState,
            ): CitationHighlightPluginState => {
              const meta = tr.getMeta(CITATION_HIGHLIGHT_PLUGIN_KEY) as
                | CitationHighlightPluginState
                | undefined;

              if (meta !== undefined) {
                const clamped = clampRange(meta.range, newState.doc.content.size);
                return clamped
                  ? { range: clamped, tier: meta.tier ?? 1 }
                  : EMPTY_HIGHLIGHT_STATE;
              }

              if (!prev.range || !tr.docChanged) {
                return prev;
              }

              if (stepOverlapsHighlightRange(tr, prev.range)) {
                const onDismiss = getDismissHandler();
                if (onDismiss) {
                  queueMicrotask(onDismiss);
                }
                return EMPTY_HIGHLIGHT_STATE;
              }

              const mappedFrom = tr.mapping.map(prev.range.from, 1);
              const mappedTo = tr.mapping.map(prev.range.to, -1);
              const clamped = clampRange(
                { from: mappedFrom, to: mappedTo },
                newState.doc.content.size,
              );

              if (!clamped) {
                return EMPTY_HIGHLIGHT_STATE;
              }

              return {
                range: clamped,
                tier: prev.tier,
              };
            },
          },
          props: {
            decorations(state: EditorState): DecorationSet | null {
              const pluginState = CITATION_HIGHLIGHT_PLUGIN_KEY.getState(state);
              if (!pluginState?.range) {
                return DecorationSet.empty;
              }

              const { from, to } = pluginState.range;
              const className =
                pluginState.tier === 3
                  ? 'studymate-citation-highlight studymate-citation-highlight--partial'
                  : 'studymate-citation-highlight';

              return DecorationSet.create(state.doc, [
                Decoration.inline(from, to, {
                  class: className,
                  'data-citation-highlight': 'true',
                }),
              ]);
            },
          },
        }),
      ];
    },
  });

/**
 * Gửi transaction meta phi phá hủy để cập nhật/xóa highlight trên EditorView hiện tại.
 */
export function dispatchCitationHighlight(
  view: EditorView | null | undefined,
  state: CitationHighlightPluginState,
): void {
  if (!view || view.isDestroyed) return;
  const tr = view.state.tr
    .setMeta(CITATION_HIGHLIGHT_PLUGIN_KEY, state)
    .setMeta('addToHistory', false);
  view.dispatch(tr);
}
