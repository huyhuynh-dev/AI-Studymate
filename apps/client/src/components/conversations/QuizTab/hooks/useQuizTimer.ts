"use client";

import { useEffect, useRef, useState } from "react";

/** Đồng hồ làm bài: đếm lên (không giới hạn) hoặc đếm ngược. Tính theo Date.now() nên không trôi khi tab bị nền. */
export function useQuizTimer({ baseElapsedSec, limitSec, running = true, onExpire }: {
  baseElapsedSec: number; limitSec: number | null; running?: boolean; onExpire?: () => void;
}) {
  const start = useRef<number | null>(null);
  const base = useRef(baseElapsedSec);
  const expired = useRef(false);
  const cb = useRef(onExpire);
  const [elapsed, setElapsed] = useState(baseElapsedSec);
  const elapsedRef = useRef(baseElapsedSec);

  useEffect(() => {
    cb.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!running) return;
    start.current ??= Date.now();
    const tick = () => {
      const e = base.current + Math.floor((Date.now() - (start.current ?? Date.now())) / 1000);
      elapsedRef.current = e;
      setElapsed(e);
      if (limitSec != null && e >= limitSec && !expired.current) {
        expired.current = true;
        cb.current?.();
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running, limitSec]);

  return {
    elapsed,
    remaining: limitSec != null ? Math.max(0, limitSec - elapsed) : null,
    getElapsed: () => elapsedRef.current,
  };
}
