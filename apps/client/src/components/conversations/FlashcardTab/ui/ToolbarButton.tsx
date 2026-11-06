import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx, SPRING, SQUIRCLE } from "./tokens";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  children: ReactNode;
}

/**
 * Nút công cụ dạng bật/tắt. Trạng thái bật = nền trắng + specular highlight (giống thumb của SegmentedControl).
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
        "flex h-8 min-w-8 shrink-0 cursor-pointer select-none items-center justify-center gap-1.5 rounded-[10px] px-1.5 transition-all duration-300 active:scale-90 disabled:pointer-events-none disabled:opacity-35",
        SPRING,
        active
          ? "bg-white text-indigo-600 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_8px_-2px_rgba(11,28,48,0.14)]"
          : "text-[#464555]/80 hover:bg-white/70 hover:text-[#0B1C30]",
        className
      )}
    >
      {children}
    </button>
  );
}
