"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { STEPS } from "../data/content";
import { cn } from "../ui/cn";
import { Reveal } from "../ui/Reveal";
import { SectionHeading } from "../ui/SectionHeading";
import { STEP_VISUALS } from "../visuals/StepVisuals";

/** Mỗi bước chiếm bao nhiêu dvh chiều cao cuộn (desktop). */
const SCROLL_PER_STEP_DVH = 90;

/**
 * Desktop (≥1024px): một "cảnh" được ghim (sticky) trong viewport. Chữ và minh họa
 * nằm CHUNG trong cảnh đó và đổi bước cùng lúc theo tiến độ cuộn → luôn thẳng hàng.
 * Mobile: mỗi bước kèm minh họa riêng, xếp dọc.
 */
export function HowItWorksSection() {
  const [active, setActive] = useState(0);
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      if (window.innerWidth < 1024) return;
      const rect = el.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;
      const p = Math.min(0.9999, Math.max(0, -rect.top / scrollable));
      setActive(Math.floor(p * STEPS.length)); // cùng giá trị → React bỏ qua render
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="how-it-works" className="scroll-mt-24 pt-24 md:pt-32">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionHeading
          title="Từ tài liệu đến kiến thức, chỉ bốn bước."
          description="Không cấu hình, không học cách dùng. Bạn chỉ việc bắt đầu."
        />

        {/* ───────── Mobile / Tablet: xếp dọc ───────── */}
        <ol className="mt-16 flex flex-col gap-16 pb-24 lg:hidden">
          {STEPS.map((step, i) => {
            const Visual = STEP_VISUALS[i];
            return (
              <li key={step.title}>
                <Reveal>
                  <span className="font-heading text-sm font-semibold tabular-nums text-primary">
                    Bước {i + 1}
                  </span>
                  <h3 className="mt-3 text-balance text-[clamp(1.5rem,5vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.025em]">
                    {step.title}
                  </h3>
                  <p className="mt-4 max-w-md text-pretty text-lg leading-relaxed text-muted">
                    {step.description}
                  </p>
                </Reveal>
                <div className="mt-8 aspect-[5/4.4] rounded-[32px] border border-hairline bg-card p-2 sm:mx-auto sm:max-w-md">
                  <Visual />
                </div>
              </li>
            );
          })}
        </ol>

        {/* ───────── Desktop: cảnh được ghim ───────── */}
        <div
          ref={sceneRef}
          className="relative hidden lg:block"
          style={
            {
              height: `${STEPS.length * SCROLL_PER_STEP_DVH}dvh`,
            } as CSSProperties
          }
        >
          <div className="sticky top-0 grid h-dvh grid-cols-2 items-center gap-20 pt-16">
            {/* Cột chữ: các bước chồng cùng một ô lưới, chuyển cảnh bằng opacity */}
            <div>
              <div className="grid">
                {STEPS.map((step, i) => (
                  <div
                    key={step.title}
                    aria-hidden={active !== i}
                    className={cn(
                      "[grid-area:1/1] transition duration-500 ease-apple",
                      active === i
                        ? "translate-y-0 opacity-100 blur-0"
                        : "pointer-events-none translate-y-4 opacity-0 blur-sm",
                    )}
                  >
                    <span className="font-heading text-sm font-semibold tabular-nums text-primary">
                      Bước {i + 1}
                    </span>
                    <h3 className="mt-3 text-balance text-[clamp(1.75rem,3vw,2.5rem)] font-bold leading-[1.12] tracking-[-0.025em]">
                      {step.title}
                    </h3>
                    <p className="mt-4 max-w-md text-pretty text-lg leading-relaxed text-muted">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Thanh tiến độ: cho biết đang ở bước mấy / tổng số bước */}
              <div
                className="mt-10 flex max-w-xs gap-2"
                role="img"
                aria-label={`Bước ${active + 1} trên ${STEPS.length}`}
              >
                {STEPS.map((step, i) => (
                  <span
                    key={step.title}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors duration-500 ease-apple",
                      i <= active ? "bg-primary" : "bg-foreground/10",
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Cột minh họa: các khung chồng nhau, chuyển cảnh cùng nhịp với chữ */}
            <div className="relative mx-auto aspect-[5/4.4] w-full max-w-xl rounded-[32px] border border-hairline bg-card p-2">
              {STEP_VISUALS.map((Visual, i) => (
                <div
                  key={i}
                  aria-hidden={active !== i}
                  className={cn(
                    "absolute inset-2 transition duration-500 ease-apple",
                    active === i
                      ? "scale-100 opacity-100 blur-0"
                      : "pointer-events-none scale-[0.97] opacity-0 blur-sm",
                  )}
                >
                  <Visual />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
