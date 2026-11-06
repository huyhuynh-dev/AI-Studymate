"use client";

import { MoreVertical } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconButton } from "./IconButton";
import { cx, GLASS, SHADOW_3, SQUIRCLE } from "./tokens";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onClick: () => void;
}

export function Menu({ items, label = "Tùy chọn" }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <IconButton label={label} onClick={() => setOpen((o) => !o)}>
        <MoreVertical className="h-4 w-4" />
      </IconButton>
      {open && (
        <div
          role="menu"
          style={SQUIRCLE}
          className={cx(GLASS, SHADOW_3, "absolute right-0 top-full z-30 mt-1.5 w-48 origin-top-right rounded-2xl bg-white/90 p-1.5 animate-in fade-in zoom-in-95 duration-150")}
        >
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={cx(
                "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-[13px] font-medium transition-colors",
                it.danger ? "text-[#BA1A1A] hover:bg-[#FFDAD6]/60" : "text-[#0B1C30] hover:bg-[#EFF4FF]"
              )}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
