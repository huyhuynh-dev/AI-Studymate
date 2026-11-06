"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { BASIC_FORMATS, type FormatId } from "../richtext/schema";
import { CLOZE_CHIP, CLOZE_MODES, EDITOR_PLACEHOLDER, RICH_CONTENT } from "../richtext/styles";
import { cx, SQUIRCLE } from "../ui";
import { EditorToolbar } from "./EditorToolbar";
import { buildExtensions } from "./formats";

export interface RichTextEditorHandle {
  focus: () => void;
}

interface Props {
  id?: string;
  /** HTML (đã chuẩn hoá bằng toRichHtml). Đổi từ bên ngoài → editor tự đồng bộ. */
  value: string;
  /** Trả về HTML; "" khi rỗng. Chưa sanitize — hãy gọi finalizeRich() khi lưu. */
  onChange: (html: string) => void;
  formats?: FormatId[];
  placeholder?: string;
  /** Khung thấp hơn cho trường phụ (ghi chú) */
  compact?: boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
}

/** Khung soạn thảo: nền xanh xám, không viền; viền chàm + ring chỉ hiện khi focus (Borderless Tonal Surface) */
export const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(function RichTextEditor(
  { id, value, onChange, formats = BASIC_FORMATS, placeholder, compact, autoFocus, "aria-label": ariaLabel },
  ref
) {
  const lastEmitted = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const extensions = useMemo(() => buildExtensions(formats, placeholder), [formats, placeholder]);

  const editor = useEditor(
    {
      extensions,
      content: value,
      immediatelyRender: false, // tránh lệch hydration với Next.js SSR
      autofocus: autoFocus ? "end" : false,
      editorProps: {
        attributes: {
          ...(id ? { id } : {}),
          ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
          role: "textbox",
          "aria-multiline": "true",
          class: cx("px-4 py-3 text-[15px] leading-7 text-[#0B1C30] outline-none", compact ? "min-h-[64px]" : "min-h-[112px]", RICH_CONTENT, EDITOR_PLACEHOLDER),
        },
      },
      onUpdate: ({ editor: ed }) => {
        const html = ed.isEmpty ? "" : ed.getHTML();
        lastEmitted.current = html;
        onChangeRef.current(html);
      },
    },
    [extensions]
  );

  // Đồng bộ khi cha đổi value (vd: "Tiếp tục tạo thẻ" → reset về rỗng)
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useImperativeHandle(ref, () => ({ focus: () => editor?.commands.focus("end") }), [editor]);

  return (
    <div
      data-cloze-mode="marked"
      style={SQUIRCLE}
      className={cx(
        "overflow-hidden rounded-2xl border-[1.5px] border-transparent bg-[#EFF4FF]/80 transition-all duration-300 focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-[3px] focus-within:ring-indigo-600/15",
        CLOZE_CHIP,
        CLOZE_MODES
      )}
    >
      {editor ? (
        <>
          <EditorToolbar editor={editor} formats={formats} />
          <div aria-hidden className="mx-1.5 h-px bg-[#0B1C30]/[0.06]" />
          <div className="max-h-64 overflow-y-auto">
            <EditorContent editor={editor} />
          </div>
        </>
      ) : (
        <div aria-hidden className={compact ? "h-[112px]" : "h-[160px]"} />
      )}
    </div>
  );
});
