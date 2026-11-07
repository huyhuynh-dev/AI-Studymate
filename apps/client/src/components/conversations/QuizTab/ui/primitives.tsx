"use client";

import {
  forwardRef, useEffect, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, X } from "lucide-react";
import { cx, type Tone } from "../utils";
import { TONE } from "../constants";

/* ------------------------------ Button ------------------------------ */
type Variant = "primary" | "secondary" | "tinted" | "tertiary" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "bg-card text-foreground border border-[var(--border-outline)] hover:border-primary hover:bg-[var(--qz-primary-soft)]",
  tinted: "bg-[var(--qz-primary-soft)] text-primary hover:bg-[var(--qz-fill-strong)]",
  tertiary: "text-primary hover:bg-[var(--qz-primary-soft)]",
  danger: "text-[var(--qz-danger)] hover:bg-[var(--qz-danger-soft)]",
};
const SIZE: Record<Size, string> = {
  sm: "h-11 px-4 text-[14px] sm:h-9 sm:px-3.5",
  md: "h-11 px-5 text-[15px]",
  lg: "h-12 px-6 text-[15px]",
};
const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, block, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        "apple-spring inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold tracking-[-0.01em] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        FOCUS, VARIANT[variant], SIZE[size], block && "w-full", className,
      )}
      {...rest}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: "default" | "danger" }
>(function IconButton({ label, tone = "default", className, children, type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        "apple-spring inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 sm:h-9 sm:w-9",
        tone === "danger"
          ? "text-[var(--on-surface-variant)] hover:bg-[var(--qz-danger-soft)] hover:text-[var(--qz-danger)]"
          : "text-[var(--on-surface-variant)] hover:bg-[var(--qz-fill)] hover:text-foreground",
        FOCUS, className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

/* ------------------------------ Badge ------------------------------ */
export function Badge({ tone = "neutral", icon, children, className }: {
  tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <span className={cx("inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold", TONE[tone].soft, TONE[tone].text, className)}>
      {icon}
      {children}
    </span>
  );
}

/* ------------------------------ Inputs ------------------------------ */
const INPUT_BASE =
  "apple-spring w-full rounded-xl border bg-card px-4 text-[15px] text-foreground outline-none placeholder:text-[#777587] focus:ring-[3px] disabled:opacity-50";

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function TextInput({ invalid, className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cx(
          INPUT_BASE, "h-[46px]",
          invalid
            ? "border-[var(--qz-danger)] focus:border-[var(--qz-danger)] focus:ring-[var(--qz-danger-soft)]"
            : "border-[var(--border-outline)] focus:border-primary focus:ring-primary/15",
          className,
        )}
        {...rest}
      />
    );
  },
);

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(INPUT_BASE, "h-[46px] cursor-pointer border-[var(--border-outline)] focus:border-primary focus:ring-primary/15", className)}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Field({ label, hint, error, children, className }: {
  label: string; hint?: string; error?: string | null; children: ReactNode; className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-2 block text-[14px] font-semibold text-foreground">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1.5 block text-[13px] text-[var(--qz-danger)]">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[13px] text-[var(--on-surface-variant)]">{hint}</span>
      ) : null}
    </label>
  );
}

/** Chip bật/tắt (đa chọn) */
export function ToggleChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        "apple-spring inline-flex h-11 items-center rounded-full border px-4 text-[14px] font-semibold active:scale-[0.97] sm:h-9",
        selected
          ? "border-primary bg-[var(--qz-primary-soft)] text-primary"
          : "border-[var(--border-outline)] bg-card text-[var(--on-surface-variant)] hover:border-primary",
        FOCUS,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------ Switch ------------------------------ */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "apple-spring relative h-[31px] w-[51px] shrink-0 rounded-full",
        checked ? "bg-primary" : "bg-[var(--qz-fill-strong)]",
        FOCUS,
      )}
    >
      <span
        className="apple-spring absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.25)]"
        style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

/* --------------------------- Segmented control --------------------------- */
export function Segmented<T extends string>({ options, value, onChange, label, className }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string; className?: string;
}) {
  return (
    // Đồng tâm: ngoài 12px, đệm 4px → trong 8px
    <div role="radiogroup" aria-label={label} className={cx("inline-flex w-full rounded-xl bg-[var(--qz-fill)] p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "apple-spring h-10 flex-1 rounded-[8px] px-3 text-[14px] font-semibold active:scale-[0.98]",
              active
                ? "bg-[var(--qz-elevated)] text-foreground shadow-[var(--qz-shadow-card)] ring-1 ring-[var(--border-subtle)]"
                : "text-[var(--on-surface-variant)] hover:text-foreground",
              FOCUS,
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ Progress ------------------------------ */
export function ProgressBar({ value, tone = "primary", label }: { value: number; tone?: Tone; label?: string }) {
  return (
    <div
      role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}
      className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--qz-fill-strong)]"
    >
      <div className={cx("apple-spring h-full rounded-full", TONE[tone].solid)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function ScoreRing({ pct, tone, size = 132, stroke = 10, children }: {
  pct: number; tone: Tone; size?: number; stroke?: number; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = tone === "success" ? "var(--qz-success)" : tone === "warning" ? "var(--qz-warning)" : "var(--qz-danger)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--qz-fill-strong)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, pct) / 100)}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* ------------------------------ Card ------------------------------ */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx("rounded-[24px] border border-[var(--border-subtle)] bg-card shadow-[var(--qz-shadow-card)]", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ------------------------------ Modal ------------------------------ */
export function Modal({ open, onClose, title, description, children, footer, size = "md", dismissable = true }: {
  open: boolean; onClose: () => void; title: string; description?: string;
  children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg"; dismissable?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => dismissable && e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, dismissable]);

  if (typeof document === "undefined" || !open) return null;
  const width = size === "sm" ? "sm:max-w-[420px]" : size === "lg" ? "sm:max-w-[680px]" : "sm:max-w-[540px]";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <div className="qz-anim-fade absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={dismissable ? onClose : undefined} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          "qz-anim-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] border border-[var(--border-subtle)] bg-[var(--qz-elevated)] shadow-[var(--qz-shadow-float)] outline-none sm:max-h-[86dvh] sm:rounded-[24px]",
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
          <div className="min-w-0">
            <h2 className="text-[20px] font-semibold leading-7 tracking-[-0.015em] text-foreground">{title}</h2>
            {description && <p className="mt-1 text-[14px] leading-5 text-[var(--on-surface-variant)]">{description}</p>}
          </div>
          {dismissable && (
            <IconButton label="Đóng" onClick={onClose} className="-mr-2 -mt-1">
              <X className="h-5 w-5" />
            </IconButton>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-subtle)] px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------ Menu ------------------------------ */
export interface MenuItem {
  key: string; label: string; description?: string; icon?: ReactNode; danger?: boolean; onSelect: () => void;
}

export function Menu({ button, items, width = 260 }: {
  button: (p: { onClick: () => void; "aria-expanded": boolean; "aria-haspopup": "menu" }) => ReactNode;
  items: MenuItem[]; width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {button({ onClick: () => setOpen((o) => !o), "aria-expanded": open, "aria-haspopup": "menu" })}
      {open && (
        // Đồng tâm: ngoài 16px, đệm 6px → trong 10px
        <div
          role="menu"
          style={{ width }}
          className="qz-anim-pop absolute right-0 top-full z-40 mt-2 max-w-[calc(100vw-2rem)] origin-top-right rounded-2xl border border-[var(--border-subtle)] bg-[var(--qz-elevated)] p-1.5 shadow-[var(--qz-shadow-float)]"
        >
          {items.map((it) => (
            <button
              key={it.key}
              role="menuitem"
              type="button"
              onClick={() => { setOpen(false); it.onSelect(); }}
              className={cx(
                "apple-spring flex min-h-11 w-full items-start gap-3 rounded-[10px] px-3 py-2.5 text-left active:scale-[0.99]",
                it.danger ? "text-[var(--qz-danger)] hover:bg-[var(--qz-danger-soft)]" : "text-foreground hover:bg-[var(--qz-fill)]",
                FOCUS,
              )}
            >
              {it.icon && <span className="mt-0.5 shrink-0">{it.icon}</span>}
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold">{it.label}</span>
                {it.description && <span className="mt-0.5 block text-[12.5px] leading-4 text-[var(--on-surface-variant)]">{it.description}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
