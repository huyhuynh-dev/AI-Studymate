"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { cn } from "./cn";

type Tag = "div" | "li" | "article" | "section" | "p" | "h2";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Độ trễ (ms) — dùng để so le (stagger) các phần tử cùng nhóm. */
  delay?: number;
  variant?: "up" | "scale" | "fade";
  as?: Tag;
}

/**
 * Hiện nội dung bằng lò xo giảm chấn khi phần tử cuộn vào viewport.
 * Chạy một lần duy nhất. Hiệu ứng nằm ở `.reveal` trong globals.css.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  variant = "up",
  as = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Component = as as ElementType;
  return (
    <Component
      ref={ref}
      data-in={shown}
      data-variant={variant}
      className={cn("reveal", className)}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </Component>
  );
}
