"use client";

import { useEffect, useRef } from "react";

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

interface Options {
  /** Vị trí (tỉ lệ viewport) mà tại đó progress = 0. Mặc định 1 (mép dưới). */
  start?: number;
  /** Vị trí (tỉ lệ viewport) mà tại đó progress = 1. Mặc định 0.3. */
  end?: number;
}

/**
 * Ghi tiến độ cuộn (0 → 1) của phần tử vào CSS variable `--p`.
 * Không gây re-render: cập nhật trực tiếp style bằng requestAnimationFrame.
 */
export function useScrollProgress<T extends HTMLElement>({
  start = 1,
  end = 0.3,
}: Options = {}) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--p", "1");
      return;
    }

    let raf = 0;
    const update = () => {
      raf = 0;
      const top = el.getBoundingClientRect().top;
      const vh = window.innerHeight;
      const p = clamp((vh * start - top) / (vh * (start - end)));
      el.style.setProperty("--p", p.toFixed(4));
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
  }, [start, end]);

  return ref;
}
