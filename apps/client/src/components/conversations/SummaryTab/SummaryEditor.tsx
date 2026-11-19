"use client";

import React, { useEffect, useRef, useState } from "react";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import type { PartialBlock } from "@blocknote/core";
import {
  FormattingToolbar,
  FormattingToolbarController,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { MantineProvider } from "@mantine/core";

import "@mantine/core/styles.css";
// Inter font is managed centrally via next/font in @/app/font.ts
import "@blocknote/mantine/style.css";
import "@blocknote/xl-ai/style.css";
import {
  BlockNoteSchema,
  combineByGroup,
  createCodeBlockSpec,
} from "@blocknote/core";
import { codeBlockOptions, syntaxHighlighter } from "@blocknote/code-block";
import {
  createReactInlineMathSpec,
  createReactMathBlockSpec,
  getMathSlashMenuItems,
  locales as mathLocales,
} from "@blocknote/math-block";
import {
  createReactDiagramBlockSpec,
  getDiagramSlashMenuItems,
  locales as diagramLocales,
} from "@blocknote/diagram-block";

import { DefaultChatTransport } from "ai";
import {
  AIExtension,
  AIMenuController,
  AIToolbarButton,
  aiDocumentFormats,
  getAISlashMenuItems,
} from "@blocknote/xl-ai";
import { en } from "@blocknote/core/locales";
import { en as aiEn } from "@blocknote/xl-ai/locales";
import { UNTITLED_NOTE_LABEL } from "./noteHelpers";

interface SummaryEditorProps {
  summaryId: string;
  title: string;
  titleSyncKey?: number;
  autoFocusTitle?: boolean;
  initialContent: unknown[];
  onChange: (blocks: unknown[]) => void;
  onTitleChange: (title: string) => void;
  onTitleBlur?: () => void;
  editable?: boolean;
  zoomPercent?: number;
}

type JsonRecord = Record<string, unknown>;
type BlockNoteExtensionFactory = typeof syntaxHighlighter;
type StreamToolsProviderParam = NonNullable<
  Parameters<typeof AIExtension>[0]
>["streamToolsProvider"];

interface StreamToolChunk {
  operation?: { type?: string };
  isPossiblyPartial?: boolean;
  [key: string]: unknown;
}

interface StreamToolExecutor {
  execute: (chunk: StreamToolChunk, abortSignal?: AbortSignal) => Promise<boolean>;
}

interface StreamToolDescriptor {
  name: string;
  executor: () => StreamToolExecutor;
  [key: string]: unknown;
}

interface AiExtensionHandle {
  store?: {
    subscribe?: (
      listener: (snapshot: {
        currentVal?: { aiMenuState?: string };
      }) => void,
    ) => (() => void) | undefined;
    state?: { aiMenuState?: string };
  };
}

function createAiActivityTracker() {
  let active = false;
  return {
    isActive: (): boolean => active,
    setActive: (next: boolean): void => {
      active = next;
    },
  };
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

/**
 * Bọc streamToolsProvider chuẩn của BlockNote HTML format:
 * Khi thao tác "add" đang được stream dở dang (isPossiblyPartial = true), nếu chèn sớm bảng <table>
 * chưa đóng hết hàng/cột rồi ở chunk kế tiếp gọi updateToReplaceSteps (changeset diff) để thêm cột/hàng,
 * ProseMirror changeset của @blocknote/xl-ai 0.56.0 sẽ quăng lỗi:
 * "unexpected, openEnd > 0 and size > 1, this should have been split into two steps".
 * Giải pháp: đợi từng operation "add" nhận đủ nội dung (!chunk.isPossiblyPartial) rồi chèn 1 lần qua insertBlocks.
 */
const createSafeHtmlStreamToolsProvider = (): StreamToolsProviderParam => {
  const baseProvider = aiDocumentFormats.html.getStreamToolsProvider() as unknown as {
    getStreamTools: (
      editor: unknown,
      selectionInfo?: unknown,
      onBlockUpdate?: (blockId: string) => void,
    ) => StreamToolDescriptor[];
  };

  return {
    getStreamTools: (
      editor: unknown,
      selectionInfo?: unknown,
      onBlockUpdate?: (blockId: string) => void,
    ) => {
      const tools = baseProvider.getStreamTools(
        editor,
        selectionInfo,
        onBlockUpdate,
      );
      return tools.map((tool) => {
        if (tool.name === "add") {
          return {
            ...tool,
            executor: () => {
              const baseExecutor = tool.executor();
              return {
                execute: async (
                  chunk: StreamToolChunk,
                  abortSignal?: AbortSignal,
                ) => {
                  if (chunk.operation?.type !== "add") {
                    return false;
                  }
                  if (chunk.isPossiblyPartial) {
                    return true;
                  }
                  return baseExecutor.execute(
                    {
                      ...chunk,
                      isUpdateToPreviousOperation: false,
                    },
                    abortSignal,
                  );
                },
              };
            },
          };
        }
        return tool;
      });
    },
  } as unknown as StreamToolsProviderParam;
};

// Formatting toolbar with the `AIToolbarButton` added
const FormattingToolbarWithAI = () => (
  <FormattingToolbar>
    {...getFormattingToolbarItems()}
    {/* Add the AI button */}
    <AIToolbarButton />
  </FormattingToolbar>
);

// Slash menu items with AI, Math, and Diagram options combined by group to prevent duplicate category keys
const getSlashMenuItemsWithAI = (
  editor: Parameters<typeof getDefaultReactSlashMenuItems>[0],
) =>
  combineByGroup(
    getDefaultReactSlashMenuItems(editor),
    getMathSlashMenuItems(
      editor as unknown as Parameters<typeof getMathSlashMenuItems>[0],
    ),
    getDiagramSlashMenuItems(
      editor as unknown as Parameters<typeof getDiagramSlashMenuItems>[0],
    ),
    getAISlashMenuItems(
      editor as unknown as Parameters<typeof getAISlashMenuItems>[0],
    ),
  );

/**
 * Chuẩn hóa phần tử inline content (text hoặc link) để bảo đảm tuân thủ nghiêm ngặt ProseMirror Schema
 */
function sanitizeInline(item: unknown): JsonRecord {
  if (typeof item === "string") {
    return { type: "text", text: item, styles: {} };
  }
  if (!isJsonRecord(item)) {
    return { type: "text", text: "", styles: {} };
  }

  // Chuyen doi inline math sang text thong thuong (do editor dung default schema khong co math spec)
  if (item.type === "math") {
    return {
      type: "math",
      content:
        typeof item.content === "string"
          ? item.content
          : String(item.text || ""),
    };
  }

  if (item.type === "link") {
    let content: JsonRecord[] = [];
    if (Array.isArray(item.content)) {
      content = item.content.map(sanitizeInline);
    } else if (typeof item.content === "string") {
      content = [{ type: "text", text: item.content, styles: {} }];
    } else {
      content = [{ type: "text", text: String(item.content || ""), styles: {} }];
    }
    return {
      type: "link",
      content,
      href: typeof item.href === "string" ? item.href : "#",
    };
  }

  let styles: JsonRecord = isJsonRecord(item.styles) ? { ...item.styles } : {};
  // QUY TAC BAT BUOC CUA PROSEMIRROR / BLOCKNOTE:
  // Mark 'code' co cau hinh excludes: "_" (loai tru moi dinh dang khac).
  // Neu co ca 'code' lan 'bold'/'italic'/'strike'..., ProseMirror se qu?ng RangeError lam sap trang.
  if (styles.code) {
    styles = { code: true };
  }

  return {
    type: "text",
    text: typeof item.text === "string" ? item.text : "",
    styles,
  };
}

/**
 * Chuẩn hóa một ô bảng. Hỗ trợ cả 2 dạng:
 * - Mảng inline content (dữ liệu do AI backend sinh ra)
 * - Object { type: "tableCell", props, content } (dạng editor.document của BlockNote khi autosave)
 * Tránh làm mất nội dung ô khi nạp lại tài liệu.
 */
function sanitizeTableCell(cell: unknown): JsonRecord | JsonRecord[] {
  if (Array.isArray(cell)) {
    return cell.map(sanitizeInline);
  }
  if (isJsonRecord(cell) && cell.type === "tableCell") {
    const inner = Array.isArray(cell.content)
      ? cell.content.map(sanitizeInline)
      : typeof cell.content === "string"
        ? [sanitizeInline(cell.content)]
        : [];
    return {
      type: "tableCell",
      props: isJsonRecord(cell.props) ? { ...cell.props } : {},
      content: inner,
    };
  }
  return [sanitizeInline(cell)];
}

/**
 * Danh sach cac khoi Block chuan duoc ho tro boi BlockNote Default Schema
 */
const VALID_DEFAULT_BLOCKS = [
  "paragraph",
  "heading",
  "quote",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
  "codeBlock",
  "table",
  "file",
  "image",
  "video",
  "audio",
  "divider",
  "mathBlock",
  "diagram",
];

/**
 * De quy chuan hoa tung block va con chau cua no de ngan chan moi loi initialContent
 */
function sanitizeBlock(block: unknown): PartialBlock | null {
  if (!isJsonRecord(block)) {
    return null;
  }

  let type = typeof block.type === "string" ? block.type : "paragraph";
  const id =
    typeof block.id === "string" && block.id.trim() ? block.id : undefined;
  const props = isJsonRecord(block.props) ? { ...block.props } : {};

  if (!VALID_DEFAULT_BLOCKS.includes(type)) {
    type = "paragraph";
  }

  let content: unknown = undefined;
  if (type === "table") {
    if (
      isJsonRecord(block.content) &&
      Array.isArray(block.content.rows) &&
      block.content.rows.length > 0
    ) {
      content = {
        type: "tableContent",
        ...(Array.isArray(block.content.columnWidths)
          ? { columnWidths: block.content.columnWidths }
          : {}),
        ...(typeof block.content.headerRows === "number"
          ? { headerRows: block.content.headerRows }
          : {}),
        ...(typeof block.content.headerCols === "number"
          ? { headerCols: block.content.headerCols }
          : {}),
        rows: block.content.rows.map((row: unknown) => ({
          cells:
            isJsonRecord(row) && Array.isArray(row.cells)
              ? row.cells.map(sanitizeTableCell)
              : [],
        })),
      };
    } else {
      // Bang rong khong the nap vao ProseMirror table plugin -> chuyen sang paragraph
      type = "paragraph";
      content = [sanitizeInline("")];
    }
  } else if (["image", "video", "audio", "file", "divider"].includes(type)) {
    content = undefined;
  } else if (["codeBlock", "mathBlock", "diagram"].includes(type)) {
    if (typeof block.content === "string") {
      content = [{ type: "text", text: block.content, styles: {} }];
    } else if (Array.isArray(block.content)) {
      content = block.content.map(sanitizeInline);
    } else {
      content = [{ type: "text", text: "", styles: {} }];
    }
  } else {
    if (Array.isArray(block.content)) {
      content = block.content.map(sanitizeInline);
    } else if (typeof block.content === "string") {
      content = [sanitizeInline(block.content)];
    } else {
      content = [sanitizeInline("")];
    }
  }

  const children = Array.isArray(block.children)
    ? (block.children.map(sanitizeBlock).filter(Boolean) as PartialBlock[])
    : [];

  return {
    ...(id ? { id } : {}),
    type,
    props,
    content,
    children,
  } as PartialBlock;
}

export function sanitizeBlockNoteBlocks(blocks: unknown[]): PartialBlock[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.map(sanitizeBlock).filter(Boolean) as PartialBlock[];
}

// Schema mở rộng hỗ trợ đầy đủ Math, Diagram, CodeBlock Syntax Highlighting
const summaryEditorSchema = BlockNoteSchema.create().extend({
  blockSpecs: {
    codeBlock: createCodeBlockSpec(codeBlockOptions),
    mathBlock: createReactMathBlockSpec(),
    diagram: createReactDiagramBlockSpec(),
  },
  inlineContentSpecs: {
    math: createReactInlineMathSpec(),
  },
});

type SummaryPartialBlock = typeof summaryEditorSchema.PartialBlock;

interface NoteTitleInputProps {
  initialTitle: string;
  autoFocus?: boolean;
  editable: boolean;
  onChange: (nextTitle: string) => void;
  onBlur?: () => void;
  onEnterPress?: () => void;
}

function NoteTitleInput({
  initialTitle,
  autoFocus = false,
  editable,
  onChange,
  onBlur,
  onEnterPress,
}: NoteTitleInputProps) {
  const [value, setValue] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && editable) {
      inputRef.current?.focus();
    }
  }, [autoFocus, editable]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setValue(next);
    onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      onEnterPress?.();
    }
  };

  return (
    <div className="px-[54px] pt-2 pb-3 mb-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        readOnly={!editable}
        maxLength={255}
        placeholder={UNTITLED_NOTE_LABEL}
        aria-label="Tiêu đề ghi chú"
        onChange={handleChange}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        className="w-full bg-transparent border-0 outline-hidden font-heading text-2xl sm:text-[30px] font-bold tracking-[-0.025em] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-300 dark:placeholder:text-neutral-600"
      />
    </div>
  );
}

function InnerBlockNoteEditor({
  summaryId,
  title,
  titleSyncKey = 0,
  autoFocusTitle = false,
  initialContent,
  onChange,
  onTitleChange,
  onTitleBlur,
  editable = true,
  zoomPercent = 100,
}: SummaryEditorProps) {
  // Theo dõi AI đang hoạt động (gồm cả Stream và giai đoạn chờ Review Accept/Reject)
  const [aiActivity] = useState(createAiActivityTracker);

  // Giữ onChange mới nhất trong ref để các useEffect không bị hủy/đăng ký lại mỗi lần render
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Chuẩn bị initial content an toàn cho BlockNote (khởi tạo 1 lần duy nhất khi mount)
  const [validInitialBlocks] = useState<SummaryPartialBlock[] | undefined>(
    () => {
      if (Array.isArray(initialContent) && initialContent.length > 0) {
        try {
          const sanitized = sanitizeBlockNoteBlocks(initialContent);
          return sanitized.length > 0
            ? (sanitized as unknown as SummaryPartialBlock[])
            : undefined;
        } catch (err) {
          console.error(
            "[SummaryEditor] Lỗi khi làm sạch initialContent:",
            err,
          );
          return undefined;
        }
      }
      return undefined;
    },
  );

  // Create the BlockNote editor with the AI extension
  const editor = useCreateBlockNote({
    schema: summaryEditorSchema,
    dictionary: {
      ...en,
      placeholders: {
        ...en.placeholders,
        default: "Nhập nội dung hoặc gõ '/' để mở menu lệnh…",
        emptyDocument:
          "Bắt đầu viết ghi chú hoặc gõ '/' để chèn khối, công thức, sơ đồ, AI…",
      },
      ai: aiEn,
      math: mathLocales.en,
      diagram: diagramLocales.en,
    },
    extensions: [
      syntaxHighlighter,
      AIExtension({
        streamToolsProvider: createSafeHtmlStreamToolsProvider(),
        transport: new DefaultChatTransport({
          // URL to your backend API, see example source in `packages/xl-ai-server/src/routes/regular.ts`
          api: `/api/summaries/${summaryId}/ai-actions`,
          fetch: async (input, init) => {
            aiActivity.setActive(true);
            try {
              const response = await fetch(input, init);

              if (!response.ok) {
                aiActivity.setActive(false);
                const errorBody = await response.clone().text();
                console.error("[BlockNote AI client] Request failed", {
                  status: response.status,
                  statusText: response.statusText,
                  body: errorBody,
                });
              }

              return response;
            } catch (err) {
              aiActivity.setActive(false);
              throw err;
            }
          },
        }),
      }) as unknown as BlockNoteExtensionFactory,
    ],
    // Nạp dữ liệu khởi tạo 1 lần duy nhất từ DB khi editor được mount
    initialContent: validInitialBlocks,
  });

  // Theo dõi chính xác vòng đời của AI Menu / Suggestions từ BlockNote Extension Store
  useEffect(() => {
    if (!editor) return;
    const editorWithExt = editor as unknown as {
      getExtension?: (name: string) => AiExtensionHandle | undefined;
    };
    const aiExt = editorWithExt.getExtension?.("ai");
    if (!aiExt?.store?.subscribe) return;

    const unsubscribe = aiExt.store.subscribe((val) => {
      const currentState =
        val?.currentVal?.aiMenuState ?? aiExt.store?.state?.aiMenuState;
      const isClosed = currentState === "closed";
      aiActivity.setActive(!isClosed);

      // Khi người dùng bấm Accept hoặc Reject => Menu đóng => Auto-Save lưu nội dung chính thức
      if (isClosed && editor.document) {
        onChangeRef.current(editor.document);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [aiActivity, editor]);

  // Lắng nghe thay đổi nội dung từ editor (Auto-Save 1 chiều từ Editor -> DB)
  useEffect(() => {
    if (!editor) return;

    const unsubscribe = editor.onChange(() => {
      // Khi AI đang hoạt động (Stream hoặc đang hiển thị Suggestions gạch ngang chờ duyệt):
      // Tuyệt đối không phát onChange để tránh Auto-Save lưu nháp dở dang và làm mất gạch ngang
      if (aiActivity.isActive()) {
        return;
      }

      if (editor.document) {
        onChangeRef.current(editor.document);
      }
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [aiActivity, editor]);

  return (
    <div className="w-full flex-1 bg-white dark:bg-[#12151C] min-h-[450px] p-4 sm:p-6 lg:p-8 overflow-y-auto">
      <div
        className="w-full origin-top-left transition-[zoom,font-size] duration-150"
        style={{
          zoom: `${zoomPercent}%`,
          fontSize: `${(zoomPercent / 100) * 16}px`,
        }}
      >
        <NoteTitleInput
          key={`${summaryId}-${titleSyncKey}`}
          initialTitle={title}
          autoFocus={autoFocusTitle}
          editable={editable}
          onChange={onTitleChange}
          onBlur={onTitleBlur}
          onEnterPress={() => editor.focus()}
        />

        <BlockNoteView
          editor={editor}
          editable={editable}
          formattingToolbar={false}
          slashMenu={false}
          theme="light"
          className="prose prose-indigo max-w-none focus:outline-hidden"
        >
          {/* Add the AI Command menu to the editor */}
          <AIMenuController />

          {/* We disabled the default formatting toolbar with `formattingToolbar=false`
        and replace it for one with an "AI button" (defined below).
        (See "Formatting Toolbar" in docs)
        */}
          <FormattingToolbarController
            formattingToolbar={FormattingToolbarWithAI}
          />

          {/* We disabled the default SlashMenu with `slashMenu=false`
        and replace it for one with an AI option (defined below).
        (See "Suggestion Menus" in docs)
        */}
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) =>
              filterSuggestionItems(
                getSlashMenuItemsWithAI(
                  editor as unknown as Parameters<
                    typeof getDefaultReactSlashMenuItems
                  >[0],
                ),
                query,
              )
            }
          />
        </BlockNoteView>
      </div>
    </div>
  );
}

export default function SummaryEditor(props: SummaryEditorProps) {
  // Sử dụng key={props.summaryId} để khởi tạo editor mới tương ứng với mỗi bản tóm tắt
  return (
    <MantineProvider defaultColorScheme="light">
      <InnerBlockNoteEditor key={props.summaryId} {...props} />
    </MantineProvider>
  );
}
