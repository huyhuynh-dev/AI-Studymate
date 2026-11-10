"use client";

import { Volume2 } from "lucide-react";
import { cx, SPRING } from "../../ui";

export function AudioButton({ url }: { url: string }) {
  return (
    <button
      type="button"
      aria-label="Phát âm thanh"
      onClick={(e) => {
        e.stopPropagation();
        new Audio(url).play().catch(() => {});
      }}
      className={cx(
        "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 transition-all duration-200 hover:bg-indigo-500/20 active:scale-90",
        SPRING
      )}
    >
      <Volume2 className="h-4 w-4" />
    </button>
  );
}
