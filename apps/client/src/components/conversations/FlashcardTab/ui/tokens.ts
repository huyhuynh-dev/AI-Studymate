import type { CSSProperties } from "react";

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

/** Góc bo liên tục kiểu iOS (squircle). Trình duyệt chưa hỗ trợ sẽ tự rơi về border-radius thường. */
export const SQUIRCLE = { cornerShape: "squircle" } as CSSProperties;

/** Chuyển động có quán tính (spring) & easing kiểu iOS */
export const SPRING = "ease-[cubic-bezier(0.34,1.56,0.64,1)]";
export const EASE_IOS = "ease-[cubic-bezier(0.32,0.72,0,1)]";

export const FONT_HEADING = "font-['Plus_Jakarta_Sans',sans-serif]";

/** Kính mờ + viền bắt sáng (specular highlight) */
export const GLASS = "bg-white/70 backdrop-blur-2xl border border-white/70";
export const SHADOW_1 =
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_20px_-4px_rgba(11,28,48,0.06),0_1px_3px_-1px_rgba(11,28,48,0.03)]";
export const SHADOW_HOVER =
  "hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_12px_28px_-8px_rgba(79,70,229,0.14),0_2px_4px_-1px_rgba(11,28,48,0.03)]";
export const SHADOW_3 =
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_20px_40px_-8px_rgba(11,28,48,0.12)]";
