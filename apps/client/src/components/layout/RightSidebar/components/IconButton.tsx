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
      className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 ${
        isActive ? "bg-gray-100 text-gray-900" : "text-gray-500"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
