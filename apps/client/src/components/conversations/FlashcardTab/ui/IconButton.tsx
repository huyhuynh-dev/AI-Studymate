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
        "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#777587] transition-all duration-300 active:scale-90",
        SPRING,
        tone === "danger" ? "hover:bg-[#FFDAD6]/70 hover:text-[#BA1A1A]" : "hover:bg-[#EFF4FF] hover:text-indigo-600",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
