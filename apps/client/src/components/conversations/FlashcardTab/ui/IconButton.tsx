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
        "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[#777587] dark:text-neutral-400 transition-all duration-300 active:scale-95",
        SPRING,
        tone === "danger"
          ? "hover:bg-[#FFDAD6]/70 hover:text-[#BA1A1A] dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
          : "hover:bg-[#EEF2FF] hover:text-[#4F46E5] dark:hover:bg-white/[0.08] dark:hover:text-white",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
