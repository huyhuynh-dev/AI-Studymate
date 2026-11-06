import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cx, FONT_HEADING, SQUIRCLE } from "./tokens";

/** Ô nhập dạng lấp đầy êm dịu: không viền đậm, chỉ phát sáng khi focus */
const BASE =
  "w-full rounded-xl border-[1.5px] border-transparent bg-[#EFF4FF]/70 text-[#0B1C30] outline-none transition-all duration-300 placeholder:text-[#777587] hover:bg-[#EFF4FF] focus:border-indigo-600 focus:bg-white focus:ring-[3px] focus:ring-indigo-600/15";
const INVALID = "!border-[#BA1A1A] !bg-white ring-[3px] ring-[#BA1A1A]/[0.12]";

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
      {leftIcon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777587]">{leftIcon}</span>}
      <input
        ref={ref}
        style={{ ...SQUIRCLE, ...style }}
        className={cx(BASE, compact ? "h-10 text-sm" : "h-[46px] text-[15px]", leftIcon ? "pl-10 pr-4" : "px-4", invalid && INVALID, className)}
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
      className={cx(BASE, "resize-none px-4 py-3 text-[15px] leading-6", invalid && INVALID, className)}
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
      <label htmlFor={htmlFor} className={cx(FONT_HEADING, "text-sm font-semibold text-[#0B1C30]")}>
        {label}
        {optional && <span className="ml-1.5 font-normal text-[#777587]">(không bắt buộc)</span>}
      </label>
      {children}
      {error ? <p className="text-[13px] text-[#BA1A1A]">{error}</p> : hint ? <p className="text-[13px] text-[#777587]">{hint}</p> : null}
    </div>
  );
}
