import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx, FONT_HEADING, SPRING, SQUIRCLE } from "./tokens";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-indigo-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_16px_-4px_rgba(79,70,229,0.45)] hover:bg-[#3525CD] hover:-translate-y-px",
  secondary:
    "bg-white/80 text-[#0B1C30] ring-1 ring-inset ring-[#0B1C30]/[0.07] hover:bg-white hover:ring-indigo-300/70 hover:shadow-[0_6px_16px_-2px_rgba(79,70,229,0.08)]",
  ghost: "bg-transparent text-[#464555] hover:bg-[#EFF4FF]",
  danger: "bg-[#BA1A1A] text-white hover:bg-[#93000A] shadow-[0_6px_16px_-4px_rgba(186,26,26,0.4)]",
  success: "bg-[#6CF8BB]/30 text-[#005236] hover:bg-[#6CF8BB]/45",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  fullWidth,
  className,
  style,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      style={{ ...SQUIRCLE, ...style }}
      className={cx(
        "inline-flex cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold tracking-[0.01em] transition-all duration-300 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        SPRING,
        FONT_HEADING,
        SIZES[size],
        VARIANTS[variant],
        fullWidth && "w-full",
        className
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
