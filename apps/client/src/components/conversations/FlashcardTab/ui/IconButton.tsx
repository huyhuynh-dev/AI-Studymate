import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx, SPRING } from "./tokens";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  tone?: "neutral" | "danger";
}

export function IconButton({ label, children, tone = "neutral", className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-500 dark:text-neutral-400 transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
        SPRING,
        tone === "danger"
          ? "hover:bg-rose-500/10 hover:text-rose-600 dark:hover:bg-rose-500/15 dark:hover:text-rose-400"
          : "hover:bg-neutral-100 dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-white",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
