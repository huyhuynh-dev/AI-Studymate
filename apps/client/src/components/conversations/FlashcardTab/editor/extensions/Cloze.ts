import { Mark } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    cloze: { toggleCloze: () => ReturnType };
  }
}

/**
 * Chỗ trống của thẻ điền khuyết = một Mark → lưu thành <span data-cloze="true">đáp án</span>.
 * Mark (không phải cú pháp {{ }}) nên chồng được lên bold/italic/list mà không vỡ HTML.
 * Mở rộng sau này (cloze đánh số c1, c2…): thêm attribute `index` ở đây + 1 dòng trong schema.ts.
 */
export const Cloze = Mark.create({
  name: "cloze",
  inclusive: false, // gõ tiếp ở cuối chỗ trống sẽ không bị "dính" vào chỗ trống

  parseHTML() {
    return [{ tag: "span[data-cloze]" }];
  },

  renderHTML() {
    // Không gắn class: kiểu dáng do container quyết định (styles.ts) nên HTML lưu xuống luôn sạch
    return ["span", { "data-cloze": "true" }, 0];
  },

  addCommands() {
    return { toggleCloze: () => ({ commands }) => commands.toggleMark(this.name) };
  },

  addKeyboardShortcuts() {
    return { "Mod-Shift-e": () => this.editor.commands.toggleCloze() };
  },
});
