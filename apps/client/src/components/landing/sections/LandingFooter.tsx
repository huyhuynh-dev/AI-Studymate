import Link from "next/link";
import { FOOTER_GROUPS } from "../data/content";
import { Logo } from "../ui/Logo";

export function LandingFooter() {
  return (
    <footer className="border-t border-hairline pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-16">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" aria-label="AI StudyMate – Trang chủ" className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <Logo />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              Nền tảng học tập dùng AI, giúp bạn học hiệu quả hơn mỗi ngày.
            </p>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="text-sm font-semibold">{group.title}</h2>
              <ul className="mt-4 space-y-1">
                {group.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="inline-flex min-h-9 items-center text-sm text-muted transition-colors duration-350 ease-apple hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="mt-16 border-t border-hairline pt-8 text-sm text-muted">
          © 2026 AI StudyMate. Bảo lưu mọi quyền.
        </p>
      </div>
    </footer>
  );
}
