import React from "react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: "neutral" | "error";
  surface?: "plain" | "card";
  className?: string;
}

/**
 * Khối hiển thị trạng thái trống hoặc lỗi tải dữ liệu với bảng màu ngữ nghĩa Light/Dark.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "neutral",
  surface = "plain",
  className = "",
}: EmptyStateProps) {
  const surfaceClasses =
    surface === "card"
      ? tone === "error"
        ? "rounded-2xl border border-rose-200/80 dark:border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/20 px-6 py-10"
        : "rounded-2xl border border-dashed border-[#E5EEFF] dark:border-white/[0.1] bg-white dark:bg-[#12151C] px-6 py-12"
      : "py-12";

  const iconWrapperClasses =
    tone === "error"
      ? "bg-rose-100/80 text-[#BA1A1A] dark:bg-rose-500/15 dark:text-[#F87171]"
      : "bg-[#EEF2FF] text-[#4F46E5] dark:bg-white/[0.06] dark:text-[#818CF8]";

  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={`flex flex-col items-center justify-center text-center ${surfaceClasses} ${className}`.trim()}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${iconWrapperClasses}`}
        >
          {icon}
        </div>
      ) : null}
      <h2 className="text-base sm:text-lg font-bold font-heading text-[#0B1C30] dark:text-[#EFF0F6] tracking-tight">
        {title}
      </h2>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm text-[#5E5C6E] dark:text-[#9DA3AF] leading-relaxed">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
