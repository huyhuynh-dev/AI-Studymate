import { useEffect, useRef, type RefObject } from "react";

/**
 * Gọi `onOutside` khi người dùng bấm ra ngoài phần tử `ref` hoặc nhấn Escape.
 * Chỉ lắng nghe khi `enabled = true` (ví dụ: lúc popover đang mở).
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  enabled = true
) {
  const callbackRef = useRef(onOutside);

  useEffect(() => {
    callbackRef.current = onOutside;
  });

  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (el && !el.contains(e.target as Node)) callbackRef.current();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") callbackRef.current();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [ref, enabled]);
}
