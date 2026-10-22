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
  initialContent: PartialBlock[];
  onChange: (blocks: PartialBlock[]) => void;
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

// Slash menu items with the AI option added
const getSlashMenuItemsWithAI = (editor: BlockNoteEditor) => [
  ...getDefaultReactSlashMenuItems(editor),
  // add the default AI slash menu items, or define your own
  ...getAISlashMenuItems(editor),
];

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
  const validInitialBlocks = React.useMemo<PartialBlock[] | undefined>(() => {
    if (Array.isArray(initialContent) && initialContent.length > 0) {
      return initialContent as PartialBlock[];
    }
    return undefined;
  }, [initialContent]);

  // Create the BlockNote editor with the AI extension
  const editor = useCreateBlockNote({
    dictionary: {
      ...en,
      ai: aiEn, // add default translations for the AI extension
    },
    // Register the AI extension
    extensions: [
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
              filterSuggestionItems(getSlashMenuItemsWithAI(editor), query)
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
