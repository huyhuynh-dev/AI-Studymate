import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cx, FONT_HEADING, SQUIRCLE } from "./tokens";

/** Ô nhập dạng Inset Surface chuẩn Apple HIG: viền mảnh tinh tế, phát sáng khi focus */
const BASE =
  "w-full rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/80 dark:bg-white/[0.05] text-neutral-900 dark:text-white outline-none transition-all duration-200 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/[0.07] focus:border-indigo-500 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-[#161922] focus:ring-3 focus:ring-indigo-500/15";
const INVALID = "!border-rose-500 !bg-white dark:!bg-[#161922] ring-3 ring-rose-500/15";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  compact?: boolean;
  leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, compact, leftIcon, className, style, ...rest },
  ref
) {
  return (
    <div className="relative w-full">
      {leftIcon && (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500">
          {leftIcon}
        </span>
      )}
      <input
        ref={ref}
        style={{ ...SQUIRCLE, ...style }}
        className={cx(
          BASE,
          compact ? "h-9 text-[13px]" : "h-11 text-sm",
          leftIcon ? "pl-9 pr-3.5" : "px-3.5",
          invalid && INVALID,
          className
        )}
        {...rest}
      />
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, style, ...rest },
  ref
) {
  return (
    <textarea
      ref={ref}
      style={{ ...SQUIRCLE, ...style }}
      className={cx(BASE, "resize-none px-3.5 py-2.5 text-sm leading-6", invalid && INVALID, className)}
      {...rest}
    />
  );
});

interface FieldProps {
  label: string;
  htmlFor?: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, optional, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className={cx(FONT_HEADING, "text-[13px] font-semibold text-neutral-800 dark:text-neutral-200")}>
        {label}
        {optional && <span className="ml-1.5 font-normal text-neutral-400 dark:text-neutral-500">(không bắt buộc)</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>
      ) : null}
    </div>
  );
}
