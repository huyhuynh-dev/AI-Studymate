"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";
import { cx, FONT_HEADING, GLASS, SHADOW_3, SQUIRCLE } from "./tokens";

const SIZES = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" } as const;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: keyof typeof SIZES;
  footer?: ReactNode;
  /** Không vẽ header mặc định (dùng cho hộp thoại xác nhận) */
  bare?: boolean;
  children: ReactNode;
}

export function Modal({ open, onClose, title, description, size = "md", footer, bare, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0B1C30]/30 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={SQUIRCLE}
        className={cx(
          GLASS,
          SHADOW_3,
          "relative flex max-h-[90vh] w-full flex-col rounded-3xl bg-white/90 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-300",
          SIZES[size]
        )}
      >
        {bare ? (
          <div className="overflow-y-auto p-6">{children}</div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
              <div>
                <h2 className={cx(FONT_HEADING, "text-xl font-semibold tracking-[-0.015em] text-[#0B1C30]")}>{title}</h2>
                {description && <p className="mt-1 text-[13px] text-[#464555]/75">{description}</p>}
              </div>
              <IconButton label="Đóng" onClick={onClose}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="overflow-y-auto px-6 py-4">{children}</div>
            {footer && <div className="px-6 pb-6 pt-2">{footer}</div>}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
