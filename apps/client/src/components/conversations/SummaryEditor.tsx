"use client";

import React, { useEffect, useRef } from "react";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { FormattingToolbarController, SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { MantineProvider } from "@mantine/core";

import "@mantine/core/styles.css";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@blocknote/xl-ai/style.css";
// import "@blocknote/math-block/style.css";
import { BlockNoteSchema, createCodeBlockSpec } from "@blocknote/core";
import { codeBlockOptions, syntaxHighlighter } from "@blocknote/code-block";
import {
  createReactMathBlockSpec,
  createReactInlineMathSpec,
  locales as mathLocales,
  getMathSlashMenuItems,
} from "@blocknote/math-block";
import {
  createReactDiagramBlockSpec,
  locales as diagramLocales,
  getDiagramSlashMenuItems,
} from "@blocknote/diagram-block";

import { DefaultChatTransport } from "ai";
import {
  AIExtension,
  AIMenuController,
  AIToolbarButton,
  getAISlashMenuItems,
} from "@blocknote/xl-ai";

import {
  FormattingToolbar,
  getFormattingToolbarItems,
  getDefaultReactSlashMenuItems
} from "@blocknote/react";
import { en } from "@blocknote/core/locales";
import { en as aiEn } from "@blocknote/xl-ai/locales";

interface SummaryEditorProps {
  summaryId: string;
  initialContent: any[];
  onChange: (blocks: any[]) => void;
  editable?: boolean;
  zoomPercent?: number;
}

// Formatting toolbar with the `AIToolbarButton` added
const FormattingToolbarWithAI = () => (
  <FormattingToolbar>
    {...getFormattingToolbarItems()}
    {/* Add the AI button */}
    <AIToolbarButton />
  </FormattingToolbar>
);

// Slash menu items with AI, Math, and Diagram options added
const getSlashMenuItemsWithAI = (editor: any) => [
  ...getDefaultReactSlashMenuItems(editor),
  ...getMathSlashMenuItems(editor),
  ...getDiagramSlashMenuItems(editor),
  ...getAISlashMenuItems(editor),
];

/**
 * Chuẩn hóa phần tử inline content (text hoặc link) để bảo đảm tuân thủ nghiêm ngặt ProseMirror Schema
 */
function sanitizeInline(item: any): any {
  if (typeof item === "string") {
    return { type: "text", text: item, styles: {} };
  }
  if (!item || typeof item !== "object") {
    return { type: "text", text: "", styles: {} };
  }

  // Chuyen doi inline math sang text thong thuong (do editor dung default schema khong co math spec)
  if (item.type === "math") {
    return {
      type: "math",
      content: typeof item.content === "string" ? item.content : String(item.text || ""),
    };
  }

  if (item.type === "link") {
    let content: any[] = [];
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

  let styles = typeof item.styles === "object" && item.styles ? { ...item.styles } : {};
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
function sanitizeBlock(block: any): PartialBlock | null {
  if (!block || typeof block !== "object") {
    return null;
  }

  let type = typeof block.type === "string" ? block.type : "paragraph";
  const id = typeof block.id === "string" && block.id.trim() ? block.id : undefined;
  const props = typeof block.props === "object" && block.props ? { ...block.props } : {};

  if (!VALID_DEFAULT_BLOCKS.includes(type)) {
    type = "paragraph";
  }

  let content: any = undefined;
  if (type === "table") {
    if (
      block.content &&
      typeof block.content === "object" &&
      Array.isArray(block.content.rows) &&
      block.content.rows.length > 0
    ) {
      content = {
        type: "tableContent",
        rows: block.content.rows.map((row: any) => ({
          cells: Array.isArray(row?.cells)
            ? row.cells.map((cell: any) =>
              Array.isArray(cell)
                ? cell.map(sanitizeInline)
                : [sanitizeInline(cell)]
            )
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
    type: type as any,
    props,
    content,
    children,
  };
}

export function sanitizeBlockNoteBlocks(blocks: any[]): PartialBlock[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.map(sanitizeBlock).filter(Boolean) as PartialBlock[];
}


// Schema m? r?ng h? tr? ??y ?? Math, Diagram, CodeBlock Syntax Highlighting
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

function InnerBlockNoteEditor({
  summaryId,
  initialContent,
  onChange,
  editable = true,
  zoomPercent = 100,
}: SummaryEditorProps) {
  // Ref đánh dấu AI đang hoạt động (gồm cả Stream và giai đoạn chờ Review Accept/Reject)
  const isAiActiveRef = useRef<boolean>(false);

  // Chuẩn bị initial content an toàn cho BlockNote
  const validInitialBlocks = React.useMemo<any>(() => {
    if (Array.isArray(initialContent) && initialContent.length > 0) {
      try {
        const sanitized = sanitizeBlockNoteBlocks(initialContent);
        return sanitized.length > 0 ? sanitized : undefined;
      } catch (err) {
        console.error("[SummaryEditor] Lỗi khi làm sạch initialContent:", err);
        return undefined;
      }
    }
    return undefined;
  }, [initialContent]);

  // Create the BlockNote editor with the AI extension
  const editor = useCreateBlockNote({
    schema: summaryEditorSchema,
    dictionary: {
      ...en,
      ai: aiEn,
      math: mathLocales.en,
      diagram: diagramLocales.en,
    },
    extensions: [
      syntaxHighlighter,
      AIExtension({
        transport: new DefaultChatTransport({
          // URL to your backend API, see example source in `packages/xl-ai-server/src/routes/regular.ts`
          api: `/api/summaries/${summaryId}/ai-actions`,
          fetch: async (input, init) => {
            isAiActiveRef.current = true;
            try {
              const response = await fetch(input, init);

              if (!response.ok) {
                isAiActiveRef.current = false;
                const errorBody = await response.clone().text();
                console.error('[BlockNote AI client] Request failed', {
                  status: response.status,
                  statusText: response.statusText,
                  body: errorBody,
                });
              }

              return response;
            } catch (err) {
              isAiActiveRef.current = false;
              throw err;
            }
          },
        }),
      }),
    ],
    // Nạp dữ liệu khởi tạo 1 lần duy nhất từ DB khi editor được mount
    initialContent: validInitialBlocks,
  });

  // Theo dõi chính xác vòng đời của AI Menu / Suggestions từ BlockNote Extension Store
  useEffect(() => {
    if (!editor) return;
    const aiExt = (editor as any).getExtension?.("ai");
    if (!aiExt?.store?.subscribe) return;

    const unsubscribe = aiExt.store.subscribe((val: any) => {
      const currentState = val?.currentVal?.aiMenuState ?? aiExt.store.state?.aiMenuState;
      const isClosed = currentState === "closed";
      isAiActiveRef.current = !isClosed;

      // Khi người dùng bấm Accept hoặc Reject => Menu đóng => Auto-Save lưu nội dung chính thức
      if (isClosed && editor.document) {
        onChange(editor.document);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [editor, onChange]);

  // Lắng nghe thay đổi nội dung từ editor (Auto-Save 1 chiều từ Editor -> DB)
  useEffect(() => {
    if (!editor) return;

    const unsubscribe = editor.onChange(() => {
      // Khi AI đang hoạt động (Stream hoặc đang hiển thị Suggestions gạch ngang chờ duyệt):
      // Tuyệt đối không phát onChange để tránh Auto-Save lưu nháp dở dang và làm mất gạch ngang
      if (isAiActiveRef.current) {
        return;
      }

      if (editor.document) {
        onChange(editor.document);
      }
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [editor, onChange]);

  return (
    <div className="w-full flex-1 bg-white min-h-[450px] p-4 sm:p-6 lg:p-8 overflow-y-auto">
      <div
        className="w-full origin-top-left transition-[zoom,font-size] duration-150"
        style={{
          zoom: `${zoomPercent}%`,
          fontSize: `${(zoomPercent / 100) * 16}px`,
        }}
      >
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
              filterSuggestionItems(getSlashMenuItemsWithAI(editor as any), query)
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
