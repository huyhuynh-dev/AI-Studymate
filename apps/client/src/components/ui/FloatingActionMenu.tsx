"use client";

import React, { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export interface FloatingMenuPosition {
  top: number;
  left: number;
  originClass?: string;
}

const emptySubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

/**
 * Tính vị trí menu nổi dựa theo bounding box của nút kích hoạt,
 * tự động lật lên trên nếu chạm cạnh dưới viewport.
 */
export function computeFloatingMenuPosition(
  rect: DOMRect,
  options?: { menuWidth?: number; menuHeight?: number; gap?: number }
): FloatingMenuPosition {
  const menuWidth = options?.menuWidth ?? 156;
  const menuHeight = options?.menuHeight ?? 92;
  const gap = options?.gap ?? 4;

  let openUpward = false;
  let top = rect.bottom + gap;
  if (top + menuHeight > window.innerHeight - 8) {
    top = Math.max(8, rect.top - menuHeight - gap);
    openUpward = true;
  }

  let left = rect.right - menuWidth;
  if (left < 8) {
    left = 8;
  } else if (left + menuWidth > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - menuWidth - 8);
  }

  return {
    top,
    left,
    originClass: openUpward ? "origin-bottom-right" : "origin-top-right",
  };
}

/**
 * Tính vị trí menu nổi từ tọa độ con trỏ (dùng cho right-click / clientX-Y).
 */
export function computePointerMenuPosition(
  x: number,
  y: number,
  options?: { menuWidth?: number; menuHeight?: number }
): FloatingMenuPosition {
  const menuWidth = options?.menuWidth ?? 176;
  const menuHeight = options?.menuHeight ?? 100;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1000;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;

  const left = Math.max(8, Math.min(x, viewportWidth - menuWidth - 8));
  const openUpward = y + menuHeight > viewportHeight - 8;
  const top = openUpward
    ? Math.max(8, y - menuHeight)
    : Math.max(8, y);

  return {
    top,
    left,
    originClass: openUpward ? "origin-bottom-left" : "origin-top-left",
  };
}

export interface FloatingActionMenuProps {
  isOpen: boolean;
  position: FloatingMenuPosition | null;
  onClose: () => void;
  ariaLabel?: string;
  widthClass?: string;
  children: React.ReactNode;
}

/**
 * Menu ngữ cảnh nổi dùng chung (render qua Portal để không bị cắt bởi overflow-hidden
 * hay bị kẹt stacking context bên trong thẻ có CSS transform).
 */
export function FloatingActionMenu({
  isOpen,
  position,
  onClose,
  ariaLabel = "Menu tùy chọn",
  widthClass = "w-40",
  children,
}: FloatingActionMenuProps) {
  const isClient = useIsClient();
  const menuRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        menuRef.current?.contains(target) ||
        target?.closest('[data-menu-trigger="true"]')
      ) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        previousFocusRef.current?.focus?.();
        return;
      }

      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Home" ||
        event.key === "End"
      ) {
        const items = menuRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]:not(:disabled)'
        );
        if (!items || items.length === 0) return;

        event.preventDefault();
        if (event.key === "Home") {
          items[0]?.focus();
          return;
        }
        if (event.key === "End") {
          items[items.length - 1]?.focus();
          return;
        }
        const activeIndex = Array.from(items).indexOf(
          document.activeElement as HTMLButtonElement
        );
        const nextIndex =
          event.key === "ArrowDown"
            ? (activeIndex + 1) % items.length
            : (activeIndex - 1 + items.length) % items.length;
        items[nextIndex]?.focus();
      }
    };

    const handleViewportChange = () => {
      onClose();
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !position || !isClient) return null;

  return createPortal(
    <div
      ref={menuRef}
      data-dropdown-menu="true"
      data-context-menu="true"
      role="menu"
      aria-label={ariaLabel}
      style={{
        position: "fixed",
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      onClick={(event) => event.stopPropagation()}
      className={`apple-liquid-glass z-[70] ${widthClass} ${
        position.originClass ?? "origin-top-right"
      } rounded-xl p-1 shadow-xl shadow-[#0B1C30]/10 dark:shadow-black/50 animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none select-none`}
    >
      {children}
    </div>,
    document.body
  );
}

export interface FloatingActionMenuItemProps {
  icon?: React.ReactNode;
  tone?: "default" | "danger";
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}

export function FloatingActionMenuItem({
  icon,
  tone = "default",
  onClick,
  children,
}: FloatingActionMenuItemProps) {
  const toneClasses =
    tone === "danger"
      ? "text-[#BA1A1A] dark:text-[#F87171] hover:bg-[#BA1A1A] hover:text-white focus-visible:outline-[#BA1A1A]"
      : "text-[#464555] dark:text-[#EFF0F6] hover:bg-[#4F46E5] hover:text-white focus-visible:outline-[#4F46E5]";

  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 sm:py-1.5 text-xs font-medium active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-1 transition-[color,background-color,transform] duration-150 motion-reduce:transition-none cursor-pointer text-left ${toneClasses}`}
    >
      {icon ? <span aria-hidden="true" className="shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
