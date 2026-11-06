import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx, SPRING, SQUIRCLE } from "./tokens";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[#4F46E5] text-white shadow-xs shadow-indigo-500/20 hover:bg-[#4338CA]",
  secondary:
    "bg-white dark:bg-white/[0.06] text-neutral-800 dark:text-neutral-200 border border-black/[0.08] dark:border-white/[0.1] shadow-2xs hover:bg-neutral-50 dark:hover:bg-white/[0.1] hover:border-indigo-500/30 dark:hover:border-indigo-500/40",
  ghost:
    "bg-transparent text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:text-neutral-900 dark:hover:text-white",
  danger:
    "bg-rose-600 text-white hover:bg-rose-700 shadow-xs shadow-rose-500/20",
  success:
    "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3.5 text-xs",
  md: "h-9 px-4 text-[13px]",
  lg: "h-11 px-6 text-sm",
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
        "inline-flex cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:pointer-events-none disabled:opacity-40",
        SPRING,
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
