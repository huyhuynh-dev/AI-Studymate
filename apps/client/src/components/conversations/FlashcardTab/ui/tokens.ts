import type { CSSProperties } from "react";

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

/** Góc bo liên tục kiểu iOS (squircle). Trình duyệt chưa hỗ trợ sẽ tự rơi về border-radius thường. */
export const SQUIRCLE = { cornerShape: "squircle" } as CSSProperties;

/**
 * Động lực học lò xo giảm chấn tới hạn chuẩn Apple HIG (Critically Damped Spring):
 * Không nảy lố (overshoot), mượt mà và phản hồi tức thì.
 */
export const SPRING = "ease-[cubic-bezier(0.22,1,0.36,1)]";
export const EASE_IOS = "ease-[cubic-bezier(0.32,0.72,0,1)]";

export const FONT_HEADING = "font-sans tracking-tight";

/**
 * Hệ thống Bề mặt Trục Z (Z-Axis Luminance) & Viền Bắt sáng (Specular Hairline Border)
 * Level 1 (Card / Grouped Surface): Light #FFFFFF / Dark #161922
 * Level 2 (Elevated Modal): Light #FFFFFF/95 / Dark #1C202C/95
 * Level 3 (Floating Popover / Menu): Light #FFFFFF/95 / Dark #242938/95
 */
export const GLASS =
  "bg-white dark:bg-[#161922] border border-black/[0.06] dark:border-white/[0.08]";
export const GLASS_MODAL =
  "bg-white/95 dark:bg-[#1C202C]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.1]";
export const GLASS_POPOVER =
  "bg-white/95 dark:bg-[#242938]/95 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.12]";

export const SHADOW_1 =
  "shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_16px_-4px_rgba(15,23,42,0.06)] dark:shadow-none";
export const SHADOW_HOVER =
  "hover:shadow-[0_10px_28px_-6px_rgba(79,70,229,0.12),0_2px_6px_-1px_rgba(15,23,42,0.04)] dark:hover:bg-[#1B1F2A] hover:border-indigo-500/30 dark:hover:border-indigo-500/40";
export const SHADOW_3 =
  "shadow-[0_20px_48px_-12px_rgba(15,23,42,0.18),0_4px_12px_-2px_rgba(15,23,42,0.08)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]";
