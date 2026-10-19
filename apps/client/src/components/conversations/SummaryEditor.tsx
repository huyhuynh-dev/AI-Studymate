"use client";

import React, { useEffect, useRef } from "react";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { MantineProvider } from "@mantine/core";

import "@mantine/core/styles.css";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

interface SummaryEditorProps {
  summaryId: string;
  initialContent: any[];
  onChange: (blocks: any[]) => void;
  editable?: boolean;
}

function InnerBlockNoteEditor({
  summaryId,
  initialContent,
  onChange,
  editable = true,
}: SummaryEditorProps) {
  // Chuẩn bị initial content an toàn cho BlockNote
  const validInitialBlocks = React.useMemo<PartialBlock[] | undefined>(() => {
    if (Array.isArray(initialContent) && initialContent.length > 0) {
      return initialContent as PartialBlock[];
    }
    return undefined;
  }, [initialContent]);

  const editor = useCreateBlockNote({
    initialContent: validInitialBlocks,
  });

  // Lưu ref onChange để tránh re-subscribe không cần thiết
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Lắng nghe thay đổi nội dung từ editor
  useEffect(() => {
    if (!editor) return;

    const unsubscribe = editor.onChange(() => {
      if (editor.document) {
        onChangeRef.current(editor.document);
      }
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [editor]);

  // Cập nhật blocks khi initialContent thay đổi do AI Refine (cùng summaryId)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (editor && Array.isArray(initialContent) && initialContent.length > 0) {
      try {
        editor.replaceBlocks(editor.document, initialContent as PartialBlock[]);
      } catch (err) {
        console.warn("Lỗi đồng bộ blocks sau khi AI tinh chỉnh:", err);
      }
    }
  }, [editor, initialContent]);

  return (
    <div className="w-full flex-1 bg-white min-h-[450px] p-4 sm:p-6 overflow-y-auto">
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme="light"
        className="prose prose-indigo max-w-none focus:outline-hidden"
      />
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
