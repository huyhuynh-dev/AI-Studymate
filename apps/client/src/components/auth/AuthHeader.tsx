"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, ChevronLeft, CircleHelp, Globe } from "lucide-react";

/* ─────────────────────────────── Types & nội dung ─────────────────────────────── */

export type Locale = "vi" | "en";

const STORAGE_KEY = "studymate-locale";

const LANGUAGES: { code: Locale; label: string; short: string }[] = [
  { code: "vi", label: "Tiếng Việt", short: "VI" },
  { code: "en", label: "English", short: "EN" },
];

const COPY: Record<Locale, { back: string; support: string; language: string; home: string }> = {
  vi: {
    back: "Về trang chủ",
    support: "Hỗ trợ",
    language: "Chọn ngôn ngữ",
    home: "AI StudyMate – Trang chủ",
  },
  en: {
    back: "Back to home",
    support: "Support",
    language: "Choose language",
    home: "AI StudyMate – Home",
  },
};

interface AuthHeaderProps {
  className?: string;
  /** Truyền vào nếu bạn muốn tự quản lý ngôn ngữ (ví dụ từ hệ thống i18n). Bỏ trống = header tự quản lý. */
  locale?: Locale;
  /** Được gọi mỗi khi người dùng đổi ngôn ngữ — nơi để nối vào hệ thống i18n của bạn. */
  onLocaleChange?: (locale: Locale) => void;
  homeHref?: string;
  supportHref?: string;
}

/* ─────────────────────────────── Style dùng chung ─────────────────────────────── */

const cn = (...v: (string | false | undefined)[]) => v.filter(Boolean).join(" ");

/** Nút dạng viên thuốc: vùng chạm ≥44px, phản hồi lún tức thì khi nhấn, focus ring rõ ràng. */
const pill =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-full text-sm font-medium text-muted " +
  "transition duration-350 ease-apple hover:bg-foreground/[0.06] hover:text-foreground active:scale-[0.97] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <Image
      src="/logo.svg"
      alt="AI StudyMate Logo"
      width={size}
      height={size}
      priority
      className="shrink-0"
    />
  );
}

/* ─────────────────────────────── Menu ngôn ngữ ─────────────────────────────── */

function LanguageMenu({
  locale,
  onSelect,
}: {
  locale: Locale;
  onSelect: (next: Locale) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

  // Mở menu → focus vào mục đang chọn. Chạm ra ngoài → đóng.
  useEffect(() => {
    if (!open) return;
    itemRefs.current[LANGUAGES.findIndex((l) => l.code === locale)]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, locale]);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${COPY[locale].language}: ${current.label}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(pill, "min-w-11 px-3")}
      >
        <Globe className="h-[18px] w-[18px]" aria-hidden="true" />
        <span className="tabular-nums">{current.short}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-350 ease-apple",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={COPY[locale].language}
          onKeyDown={onMenuKeyDown}
          // Bán kính đồng tâm: khung 16px − padding 4px = mục bên trong 12px
          className="landing-pop absolute right-0 top-full z-50 mt-2 w-52 origin-top-right rounded-2xl border border-hairline bg-card/90 p-1 shadow-[0_16px_40px_-12px_rgba(11,28,48,0.2)] backdrop-blur-xl backdrop-saturate-[180%] dark:shadow-none"
        >
          {LANGUAGES.map((lang, i) => {
            const selected = lang.code === locale;
            return (
              <button
                key={lang.code}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  onSelect(lang.code);
                  close();
                }}
                className="flex h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-medium transition duration-350 ease-apple hover:bg-foreground/[0.06] focus-visible:bg-foreground/[0.06] focus-visible:outline-none active:scale-[0.98]"
              >
                <span className="flex items-baseline gap-2">
                  {lang.label}
                  <span className="text-xs font-normal tabular-nums text-muted">{lang.short}</span>
                </span>
                {selected && <Check className="h-4 w-4 text-primary" strokeWidth={2.5} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────── Header ─────────────────────────────── */

export default function AuthHeader({
  className,
  locale: controlledLocale,
  onLocaleChange,
  homeHref = "/",
  supportHref = "/support",
}: AuthHeaderProps) {
  const [internalLocale, setInternalLocale] = useState<Locale>("vi");
  const locale = controlledLocale ?? internalLocale;
  const t = COPY[locale];

  // Khôi phục lựa chọn ngôn ngữ đã lưu (chỉ khi header tự quản lý)
  useEffect(() => {
    if (controlledLocale) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "vi" || saved === "en") setInternalLocale(saved);
    } catch {
      /* localStorage có thể bị chặn — bỏ qua */
    }
  }, [controlledLocale]);

  // Giữ <html lang> đúng với ngôn ngữ đang chọn (trình đọc màn hình, dịch tự động)
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const handleSelect = (next: Locale) => {
    if (!controlledLocale) setInternalLocale(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* bỏ qua */
    }
    onLocaleChange?.(next);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-hairline bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-[180%]",
        className,
      )}
    >
      <div className="mx-auto grid h-14 w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 sm:h-16 sm:px-6">
        {/* Trái: quay lại — chỉ icon trên mobile, thêm chữ từ sm */}
        <Link
          href={homeHref}
          aria-label={t.back}
          className={cn(pill, "w-11 justify-self-start sm:w-auto sm:pl-2.5 sm:pr-4")}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">{t.back}</span>
        </Link>

        {/* Giữa: thương hiệu */}
        <Link
          href={homeHref}
          aria-label={t.home}
          className="inline-flex items-center gap-2.5 justify-self-center rounded-full px-2 py-1 transition duration-350 ease-apple active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <LogoMark />
          <span className="text-[17px] font-semibold font-heading tracking-tight">
            AI <span className="text-primary">StudyMate</span>
          </span>
        </Link>

        {/* Phải: ngôn ngữ + hỗ trợ */}
        <div className="flex items-center gap-0.5 justify-self-end">
          <LanguageMenu locale={locale} onSelect={handleSelect} />
          <Link
            href={supportHref}
            aria-label={t.support}
            className={cn(pill, "w-11 sm:w-auto sm:px-3")}
          >
            <CircleHelp className="h-[18px] w-[18px]" aria-hidden="true" />
            <span className="hidden sm:inline">{t.support}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export { AuthHeader };
