"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { NAV_LINKS, ROUTES } from "../data/content";
import { ButtonLink } from "../ui/ButtonLink";
import { Logo } from "../ui/Logo";

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
      <div className="mx-auto max-w-5xl">
        {/* Thanh điều hướng Liquid Glass dạng viên thuốc */}
        <div className="apple-liquid-glass flex h-14 items-center justify-between rounded-full pl-5 pr-1.5">
          <Link
            href="/"
            aria-label="AI StudyMate – Trang chủ"
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Logo />
          </Link>

          <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-muted transition duration-350 ease-apple hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <ButtonLink href={ROUTES.login} variant="tertiary" size="sm" className="hidden sm:inline-flex">
              Đăng nhập
            </ButtonLink>
            {/* CTA chính của viewport nằm ở Hero → nút header dùng kiểu secondary */}
            <ButtonLink href={ROUTES.register} variant="secondary" size="sm">
              Đăng ký
            </ButtonLink>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Đóng menu" : "Mở menu"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full transition duration-350 ease-apple hover:bg-foreground/[0.06] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <nav
            id="mobile-nav"
            aria-label="Menu di động"
            className="apple-liquid-glass landing-pop mt-2 rounded-3xl p-2 md:hidden"
          >
            {[...NAV_LINKS, { label: "Đăng nhập", href: ROUTES.login }].map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex h-12 items-center rounded-2xl px-4 text-base font-medium transition duration-350 ease-apple hover:bg-foreground/[0.06] active:scale-[0.99]"
              >
                {l.label}
              </a>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
