"use client";

import { useEffect, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Extension } from "@tiptap/core";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, List, ListOrdered, Redo2, Underline as UnderlineIcon, Undo2 } from "lucide-react";
import { cx, countWords } from "../utils";

/* Căn lề đoạn văn — tự viết để không cần cài thêm @tiptap/extension-text-align */
type Align = "left" | "center" | "right";
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    qzTextAlign: { setQzTextAlign: (align: Align) => ReturnType };
  }
}
const QzTextAlign = Extension.create({
  name: "qzTextAlign",
  addGlobalAttributes() {
    return [{
      types: ["paragraph"],
      attributes: {
        textAlign: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.textAlign || null,
          renderHTML: (attrs: Record<string, unknown>) =>
            attrs.textAlign ? { style: `text-align: ${String(attrs.textAlign)}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setQzTextAlign: (align: Align) => ({ commands }) => commands.updateAttributes("paragraph", { textAlign: align }),
    };
  },
});

function ToolButton({ label, active, onClick, disabled, children }: {
  label: string; active?: boolean; onClick: () => void; disabled?: boolean; children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      // mousedown giữ focus trong editor
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cx(
        "apple-spring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.94] disabled:opacity-30",
        active ? "bg-[var(--qz-primary-soft)] text-primary" : "text-[var(--on-surface-variant)] hover:bg-[var(--qz-fill)] hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-[var(--border-outline)]" aria-hidden />;
}

function Toolbar({ editor, compact }: { editor: Editor; compact: boolean }) {
  const c = () => editor.chain().focus();
  const icon = "h-[17px] w-[17px]";
  return (
    <div role="toolbar" aria-label="Định dạng văn bản" className="no-scrollbar flex items-center gap-0.5 overflow-x-auto border-b border-[var(--border-subtle)] px-2 py-1.5">
      <ToolButton label="In đậm" active={editor.isActive("bold")} onClick={() => c().toggleBold().run()}><Bold className={icon} /></ToolButton>
      <ToolButton label="In nghiêng" active={editor.isActive("italic")} onClick={() => c().toggleItalic().run()}><Italic className={icon} /></ToolButton>
      <ToolButton label="Gạch chân" active={editor.isActive("underline")} onClick={() => c().toggleUnderline().run()}><UnderlineIcon className={icon} /></ToolButton>
      <Divider />
      <ToolButton label="Danh sách gạch đầu dòng" active={editor.isActive("bulletList")} onClick={() => c().toggleBulletList().run()}><List className={icon} /></ToolButton>
      <ToolButton label="Danh sách đánh số" active={editor.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()}><ListOrdered className={icon} /></ToolButton>
      {!compact && (
        <>
          <Divider />
          <ToolButton label="Căn trái" active={editor.isActive({ textAlign: "left" })} onClick={() => c().setQzTextAlign("left").run()}><AlignLeft className={icon} /></ToolButton>
          <ToolButton label="Căn giữa" active={editor.isActive({ textAlign: "center" })} onClick={() => c().setQzTextAlign("center").run()}><AlignCenter className={icon} /></ToolButton>
          <ToolButton label="Căn phải" active={editor.isActive({ textAlign: "right" })} onClick={() => c().setQzTextAlign("right").run()}><AlignRight className={icon} /></ToolButton>
          <Divider />
          <ToolButton label="Hoàn tác" disabled={!editor.can().undo()} onClick={() => c().undo().run()}><Undo2 className={icon} /></ToolButton>
          <ToolButton label="Làm lại" disabled={!editor.can().redo()} onClick={() => c().redo().run()}><Redo2 className={icon} /></ToolButton>
        </>
      )}
    </div>
  );
}

export interface RichTextInputProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Chiều cao tối thiểu vùng soạn thảo (px) */
  minHeight?: number;
  /** compact: chỉ B / I / U / danh sách. full: thêm căn lề + hoàn tác */
  toolbar?: "compact" | "full";
  showWordCount?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  autoFocus?: boolean;
}

export function RichTextInput({
  value, onChange, placeholder, minHeight = 120, toolbar = "full",
  showWordCount = false, disabled, invalid, ariaLabel, autoFocus,
}: RichTextInputProps) {
  const editor = useEditor({
    immediatelyRender: false, // tránh lỗi hydration trong Next.js
    shouldRerenderOnTransaction: true, // TipTap v3 mặc định tắt: cần bật để thanh công cụ cập nhật trạng thái B/I/U
    editable: !disabled,
    autofocus: autoFocus ? "end" : false,
    extensions: [
      StarterKit.configure({ heading: false, blockquote: false, codeBlock: false, horizontalRule: false, link: false }),
      QzTextAlign,
      Placeholder.configure({ placeholder: placeholder ?? "Nhập nội dung…" }),
    ],
    content: value,
    editorProps: {
      attributes: { class: "qz-prose px-4 py-3", role: "textbox", "aria-multiline": "true", "aria-label": ariaLabel ?? placeholder ?? "Soạn thảo văn bản" },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  // Đồng bộ khi giá trị bên ngoài đổi (vd: reset) mà editor không đang focus
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  useEffect(() => { editor?.setEditable(!disabled); }, [disabled, editor]);

  return (
    <div
      className={cx(
        "apple-spring overflow-hidden rounded-xl border bg-card focus-within:ring-[3px]",
        invalid
          ? "border-[var(--qz-danger)] focus-within:ring-[var(--qz-danger-soft)]"
          : "border-[var(--border-outline)] focus-within:border-primary focus-within:ring-primary/15",
        disabled && "opacity-60",
      )}
    >
      {editor && !disabled && <Toolbar editor={editor} compact={toolbar === "compact"} />}
      <div className="qz-editor" style={{ ["--qz-editor-min" as string]: `${minHeight}px` }}>
        <EditorContent editor={editor} />
      </div>
      {showWordCount && (
        <div className="flex justify-end px-4 pb-2.5 text-[12px] tabular-nums text-[var(--on-surface-variant)]" aria-live="polite">
          {countWords(value)} từ
        </div>
      )}
    </div>
  );
}
