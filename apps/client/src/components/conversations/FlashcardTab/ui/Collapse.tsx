import type { ReactNode } from "react";
import { cx, EASE_IOS } from "./tokens";

/** Tiết lộ nội dung theo ngữ cảnh: trượt mở/đóng mượt (Progressive Disclosure) */
export function Collapse({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      aria-hidden={!open}
      className={cx(
        "grid transition-[grid-template-rows,opacity] duration-500",
        EASE_IOS,
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
