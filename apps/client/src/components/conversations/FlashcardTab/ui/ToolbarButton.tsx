import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx, SPRING, SQUIRCLE } from "./tokens";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  children: ReactNode;
}

/**
 * Nút công cụ dạng bật/tắt trên thanh EditorToolbar.
 * Bo 10px = 16px (khung ngoài) − 6px (padding) → đồng tâm.
 */
export function ToolbarButton({ label, active = false, title, className, style, children, type = "button", ...rest }: Props) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={title ?? label}
      aria-pressed={active}
      // Giữ nguyên vùng bôi đen & focus trong editor khi bấm nút
      onMouseDown={(e) => e.preventDefault()}
      style={{ ...SQUIRCLE, ...style }}
      className={cx(
        "flex h-8 min-w-8 shrink-0 cursor-pointer select-none items-center justify-center gap-1.5 rounded-[10px] px-1.5 transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-35",
        SPRING,
        active
          ? "bg-white dark:bg-[#252A3A] text-indigo-600 dark:text-indigo-400 shadow-xs"
          : "text-neutral-600 dark:text-neutral-400 hover:bg-white/70 dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-white",
        className
      )}
    >
      {children}
    </button>
  );
}
