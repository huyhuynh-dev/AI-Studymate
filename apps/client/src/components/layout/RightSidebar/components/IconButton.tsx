import React from "react";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Dùng cho aria-label và tooltip */
  label: string;
  isActive?: boolean;
}

export function IconButton({
  label,
  isActive = false,
  className = "",
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#4F46E5] ${
        isActive
          ? "bg-[#EEF2FF] text-[#4F46E5] dark:bg-white/[0.12] dark:text-white shadow-2xs"
          : "text-[#777587] hover:bg-[#F8F9FF] hover:text-[#0B1C30] dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
      } ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
