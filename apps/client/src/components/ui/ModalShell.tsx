"use client";

import React, { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

const emptySubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  role?: "dialog" | "alertdialog";
  size?: "sm" | "md";
  disableDismiss?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  labelledBy?: string;
  describedBy?: string;
  className?: string;
  children: React.ReactNode;
}

const SIZE_CLASSES: Record<NonNullable<ModalShellProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
};

/**
 * Khung hộp thoại dùng chung hỗ trợ Portal, Focus Trap, Escape để đóng,
 * khôi phục focus khi đóng và khóa cuộn nền.
 */
export function ModalShell({
  isOpen,
  onClose,
  role = "dialog",
  size = "md",
  disableDismiss = false,
  initialFocusRef,
  labelledBy,
  describedBy,
  className = "",
  children,
}: ModalShellProps) {
  const isClient = useIsClient();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const fallbackTitleId = useId();
  const resolvedLabelledBy = labelledBy || fallbackTitleId;

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Đặt focus ban đầu vào phần tử chỉ định hoặc khung dialog mà không tự mở bàn phím ảo trên mobile
    const focusTimer = window.requestAnimationFrame(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else {
        dialogRef.current?.focus();
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !disableDismiss) {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);

        if (focusable.length === 0) {
          event.preventDefault();
          dialogRef.current.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (event.shiftKey) {
          if (!active || active === first || !dialogRef.current.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else if (!active || active === last || !dialogRef.current.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, disableDismiss, initialFocusRef, onClose]);

  if (!isOpen || !isClient) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto overscroll-contain"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !disableDismiss) {
          onClose();
        }
      }}
    >
      {/* Translucent Dimming Backdrop */}
      <div
        className="fixed inset-0 bg-[#0B1C30]/40 backdrop-blur-md transition-opacity duration-200 motion-reduce:transition-none"
        aria-hidden="true"
        onClick={() => {
          if (!disableDismiss) onClose();
        }}
      />

      {/* Modal Dialog Surface */}
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={resolvedLabelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`relative z-10 w-full ${SIZE_CLASSES[size]} rounded-[20px] bg-white dark:bg-[#12151C] p-6 shadow-2xl border border-[#E5EEFF] dark:border-white/[0.12] overscroll-contain outline-none animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none ${className}`.trim()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export interface ModalHeaderProps {
  icon?: React.ReactNode;
  iconClassName?: string;
  title: string;
  subtitle?: string;
  titleId?: string;
  onClose?: () => void;
  closeDisabled?: boolean;
}

export function ModalHeader({
  icon,
  iconClassName = "bg-[#EEF2FF] dark:bg-white/[0.06] text-[#4F46E5] dark:text-[#818CF8]",
  title,
  subtitle,
  titleId,
  onClose,
  closeDisabled = false,
}: ModalHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#E5EEFF] dark:border-white/[0.08] select-none">
      <div className="flex items-center gap-3 min-w-0">
        {icon ? (
          <div
            aria-hidden="true"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <h2
            id={titleId}
            className="text-base font-bold font-heading text-[#0B1C30] dark:text-[#EFF0F6] tracking-tight leading-snug"
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="text-xs text-[#5E5C6E] dark:text-[#9DA3AF] mt-0.5">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {onClose ? (
        <button
          type="button"
          disabled={closeDisabled}
          onClick={onClose}
          aria-label="Đóng"
          className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F8F9FF] dark:bg-white/[0.08] text-[#5E5C6E] dark:text-[#9DA3AF] hover:bg-[#E5EEFF] dark:hover:bg-white/[0.14] hover:text-[#0B1C30] dark:hover:text-white active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5] transition-[color,background-color,transform] duration-150 motion-reduce:transition-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed after:content-[''] after:absolute after:-inset-2 [@media(pointer:fine)]:after:hidden"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function ModalFooter({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-[#E5EEFF] dark:border-white/[0.08] select-none ${className}`.trim()}
    >
      {children}
    </div>
  );
}
