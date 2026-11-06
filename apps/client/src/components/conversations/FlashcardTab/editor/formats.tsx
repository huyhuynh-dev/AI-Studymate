import type { AnyExtension, Editor } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import StarterKit, { type StarterKitOptions } from "@tiptap/starter-kit";
import { Bold, Highlighter, Italic, List, ListOrdered, Underline, type LucideIcon } from "lucide-react";
import type { FormatId } from "../richtext/schema";
import { Cloze } from "./extensions/Cloze";

type StarterKey = "bold" | "italic" | "underline" | "bulletList" | "orderedList";

export interface FormatDef {
  id: FormatId;
  label: string;
  /** Cú pháp Tiptap, vd "Mod-B" — chỉ để hiển thị gợi ý; phím tắt thật do extension đăng ký */
  shortcut?: string;
  group: "inline" | "list" | "special";
  icon: LucideIcon;
  showLabel?: boolean;
  /** Extension có sẵn trong StarterKit */
  starterKey?: StarterKey;
  /** Extension tự viết */
  extension?: AnyExtension;
  isActive: (e: Editor) => boolean;
  canRun: (e: Editor) => boolean;
  run: (e: Editor) => void;
}

/** Record<FormatId, …> → thêm id mới ở schema.ts mà quên khai báo ở đây sẽ báo lỗi TypeScript */
export const FORMAT_REGISTRY: Record<FormatId, FormatDef> = {
  bold: {
    id: "bold", label: "In đậm", shortcut: "Mod-B", group: "inline", icon: Bold, starterKey: "bold",
    isActive: (e) => e.isActive("bold"),
    canRun: (e) => e.can().toggleBold(),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  italic: {
    id: "italic", label: "In nghiêng", shortcut: "Mod-I", group: "inline", icon: Italic, starterKey: "italic",
    isActive: (e) => e.isActive("italic"),
    canRun: (e) => e.can().toggleItalic(),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  underline: {
    id: "underline", label: "Gạch chân", shortcut: "Mod-U", group: "inline", icon: Underline, starterKey: "underline",
    isActive: (e) => e.isActive("underline"),
    canRun: (e) => e.can().toggleUnderline(),
    run: (e) => e.chain().focus().toggleUnderline().run(),
  },
  bulletList: {
    id: "bulletList", label: "Danh sách chấm", shortcut: "Mod-Shift-8", group: "list", icon: List, starterKey: "bulletList",
    isActive: (e) => e.isActive("bulletList"),
    canRun: (e) => e.can().toggleBulletList(),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  orderedList: {
    id: "orderedList", label: "Danh sách số", shortcut: "Mod-Shift-7", group: "list", icon: ListOrdered, starterKey: "orderedList",
    isActive: (e) => e.isActive("orderedList"),
    canRun: (e) => e.can().toggleOrderedList(),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  cloze: {
    id: "cloze", label: "Chỗ trống", shortcut: "Mod-Shift-E", group: "special", icon: Highlighter, showLabel: true,
    extension: Cloze,
    isActive: (e) => e.isActive("cloze"),
    // Cần bôi đen một cụm từ (hoặc đang đứng trong chỗ trống để gỡ)
    canRun: (e) => !e.state.selection.empty || e.isActive("cloze"),
    run: (e) => e.chain().focus().toggleCloze().run(),
  },
};

/** Tắt mọi thứ StarterKit mang theo mà flashcard không dùng */
const STARTER_ALWAYS_OFF = {
  heading: false, blockquote: false, code: false, codeBlock: false, horizontalRule: false, strike: false, link: false,
} as const;

export function buildExtensions(formats: FormatId[], placeholder?: string): AnyExtension[] {
  const on = new Set(formats);
  const off = Object.fromEntries(
    Object.values(FORMAT_REGISTRY)
      .filter((d) => d.starterKey && !on.has(d.id))
      .map((d) => [d.starterKey, false])
  );
  return [
    StarterKit.configure({ ...STARTER_ALWAYS_OFF, ...off } as Partial<StarterKitOptions>),
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
    ...formats.flatMap((id) => FORMAT_REGISTRY[id].extension ?? []),
  ];
}

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export const formatShortcut = (s?: string) =>
  s ? s.replace("Mod", isMac() ? "⌘" : "Ctrl").replace(/-/g, "+") : "";
