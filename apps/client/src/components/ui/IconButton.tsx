import React from "react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Nhãn mô tả dùng đồng thời cho aria-label và tooltip */
  label: string;
  isActive?: boolean;
  size?: "sm" | "md";
  ref?: React.Ref<HTMLButtonElement>;
}

const SIZE_CLASSES: Record<NonNullable<IconButtonProps["size"]>, string> = {
  sm: "h-7 w-7 rounded-lg",
  md: "h-8 w-8 rounded-xl",
};

/**
 * Nút biểu tượng chuẩn hóa vùng chạm mở rộng trên thiết bị cảm ứng,
 * focus-visible rõ ràng và hiệu ứng nhấn tức thì.
 */
export function IconButton({
  label,
  isActive = false,
  size = "md",
  className = "",
  children,
  ref,
  ...rest
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={`relative flex shrink-0 cursor-pointer items-center justify-center transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5] after:content-[''] after:absolute after:-inset-2 [@media(pointer:fine)]:after:hidden ${SIZE_CLASSES[size]} ${
        isActive
          ? "bg-[#E5EEFF] text-[#0B1C30] dark:bg-white/[0.14] dark:text-white shadow-2xs"
          : "text-[#5E5C6E] hover:bg-[#E5EEFF]/70 hover:text-[#0B1C30] dark:text-[#9DA3AF] dark:hover:bg-white/[0.1] dark:hover:text-white"
      } ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
