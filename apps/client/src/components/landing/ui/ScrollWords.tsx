"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "./cn";

interface ScrollWordsProps {
  text: string;
  className?: string;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** Số từ "chuyển sáng" cùng lúc — càng lớn, làn sóng sáng càng mềm. */
const FEATHER = 6;

/**
 * Đoạn văn sáng dần từng từ theo tiến độ cuộn (kiểu trang sản phẩm Apple).
 * Văn bản vẫn nằm đầy đủ trong DOM → tốt cho SEO và trình đọc màn hình.
 */
export function ScrollWords({ text, className }: ScrollWordsProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.querySelectorAll<HTMLElement>("[data-w]"));

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      spans.forEach((s) => (s.style.opacity = "1"));
      return;
    }

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 khi đỉnh đoạn văn chạm 85% viewport → 1 khi đáy chạm 45% viewport
      const p = clamp((vh * 0.85 - rect.top) / (vh * 0.4 + rect.height));
      const n = spans.length;
      spans.forEach((s, i) => {
        const v = clamp((p * (n + FEATHER) - i) / FEATHER);
        s.style.opacity = (0.16 + 0.84 * v).toFixed(3);
      });
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
  }, [words]);

  return (
    <p ref={ref} className={cn(className)}>
      {words.map((w, i) => (
        <span key={i} data-w className="transition-opacity duration-150">
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}
