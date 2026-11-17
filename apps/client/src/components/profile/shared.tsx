"use client";

/**
 * Primitives nội bộ của thư mục profile (KHÔNG export qua index.ts).
 * Chỉ dùng design tokens đã khai báo trong globals.css
 * (bg-card, bg-raised, bg-well, border-line, border-hairline, text-muted, text-primary, ...)
 * nên Light/Dark tự động đúng mà không cần tiền tố `dark:`.
 */

import {
    useId,
    type ButtonHTMLAttributes,
    type InputHTMLAttributes,
    type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";

export function cn(...parts: Array<string | false | null | undefined>): string {
    return parts.filter(Boolean).join(" ");
}

/* ───────────────────────── Button ───────────────────────── */

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger" | "danger-quiet";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
    primary: "bg-primary text-white hover:bg-primary-hover",
    secondary: "border border-line bg-raised text-foreground hover:bg-well",
    tertiary: "text-primary hover:bg-primary/10",
    danger: "bg-error text-white hover:brightness-110",
    "danger-quiet": "bg-error/10 text-error hover:bg-error/15",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    isLoading?: boolean;
}

/** 5 trạng thái: default / hover / active (scale) / focus-visible / disabled. Cao 44px (mobile), 36px (desktop). */
export function Button({
    variant = "secondary",
    isLoading = false,
    disabled,
    className,
    type = "button",
    children,
    ...rest
}: ButtonProps) {
    return (
        <button
            type={type}
            disabled={disabled || isLoading}
            aria-busy={isLoading || undefined}
            className={cn(
                "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold whitespace-nowrap sm:h-9",
                "transition-all duration-350 ease-apple motion-reduce:transition-none",
                "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                "disabled:pointer-events-none",
                isLoading ? "disabled:opacity-70" : "disabled:opacity-40",
                BUTTON_VARIANTS[variant],
                className,
            )}
            {...rest}
        >
            {isLoading && (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            )}
            {children}
        </button>
    );
}

/* ───────────────────────── Pill ───────────────────────── */

export type PillTone = "success" | "neutral" | "accent";

const PILL_TONES: Record<PillTone, string> = {
    success: "bg-secondary/10 text-secondary",
    neutral: "bg-well text-muted",
    accent: "bg-primary/10 text-primary",
};

export function Pill({
    tone = "neutral",
    icon,
    children,
}: {
    tone?: PillTone;
    icon?: ReactNode;
    children: ReactNode;
}) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                PILL_TONES[tone],
            )}
        >
            {icon}
            {children}
        </span>
    );
}

/* ───────────────────────── Section / Rows ───────────────────────── */

/** Thẻ nhóm kiểu iOS "inset grouped": bo 24px, viền hairline, hàng nội dung full-bleed. */
export function SectionCard({
    id,
    title,
    description,
    action,
    tone = "default",
    children,
}: {
    id: string;
    title: string;
    description?: string;
    action?: ReactNode;
    tone?: "default" | "danger";
    children: ReactNode;
}) {
    const titleId = `${id}-title`;
    return (
        <section
            id={id}
            aria-labelledby={titleId}
            className={cn(
                "overflow-hidden rounded-3xl border bg-card shadow-[0_1px_2px_rgba(11,28,48,0.04)]",
                tone === "danger" ? "border-error/25" : "border-hairline",
            )}
        >
            <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
                <div className="min-w-0">
                    <h2
                        id={titleId}
                        className="font-heading text-lg leading-tight font-semibold tracking-tight text-foreground"
                    >
                        {title}
                    </h2>
                    {description && <p className="mt-1 text-sm text-muted">{description}</p>}
                </div>
                {action && <div className="shrink-0">{action}</div>}
            </header>
            {children}
        </section>
    );
}

export function RowGroup({ children }: { children: ReactNode }) {
    return <div className="divide-y divide-line border-t border-line">{children}</div>;
}

/** Hàng "nhãn ở trái – giá trị/hành động ở phải"; xếp dọc trên mobile. */
export function Row({
    label,
    description,
    leading,
    children,
}: {
    label: string;
    description?: ReactNode;
    leading?: ReactNode;
    children?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex min-w-0 items-center gap-3">
                {leading}
                <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    {description && (
                        <p aria-live="polite" className="mt-0.5 text-sm break-words text-muted">
                            {description}
                        </p>
                    )}
                </div>
            </div>
            {children && <div className="min-w-0 sm:shrink-0">{children}</div>}
        </div>
    );
}

/* ───────────────────────── TextField ───────────────────────── */

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
    label: string;
    hint?: string;
    error?: string;
    trailing?: ReactNode;
}

const INPUT_CLASS = [
    "h-11 w-full rounded-xl border border-line bg-well px-4 text-base text-foreground sm:text-sm", // 16px trên mobile để iOS không tự zoom
    "outline-none transition-all duration-350 ease-apple motion-reduce:transition-none",
    "placeholder:text-muted/60 hover:border-(--border-outline)",
    "focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/15",
    "read-only:cursor-default read-only:text-muted",
].join(" ");

export function TextField({ label, hint, error, trailing, className, ...input }: TextFieldProps) {
    const id = useId();
    const messageId = `${id}-message`;
    const message = error ?? hint;

    return (
        <div>
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
                {label}
            </label>
            <div className="relative">
                <input
                    id={id}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={message ? messageId : undefined}
                    className={cn(
                        INPUT_CLASS,
                        trailing ? "pr-12" : false,
                        error ? "border-error" : false,
                        className,
                    )}
                    {...input}
                />
                {trailing && (
                    <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>
                )}
            </div>
            {message && (
                <p
                    id={messageId}
                    role={error ? "alert" : undefined}
                    className={cn("mt-1.5 text-xs", error ? "text-error" : "text-muted")}
                >
                    {message}
                </p>
            )}
        </div>
    );
}
