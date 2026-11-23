import React from "react";
import Image from "next/image";

export interface StudyMateAiIconProps {
  /**
   * - `"full"`: dùng trực tiếp `/studymate.svg` (Squircle nền, đầy đủ màu & đổ bóng) cho Avatar, EmptyState, Header lớn.
   * - `"simple"`: dùng phiên bản vector tinh giản từ `/studymate_simple.svg` kế thừa `currentColor` cho Tab, nút bấm, badge nhỏ.
   */
  variant?: "full" | "simple";
  className?: string;
}

export function StudyMateAiIcon({
  variant = "simple",
  className = "h-4 w-4",
}: StudyMateAiIconProps) {
  if (variant === "full") {
    return (
      <Image
        src="/studymate.svg"
        alt=""
        width={64}
        height={64}
        unoptimized
        aria-hidden="true"
        className={`shrink-0 select-none ${className}`}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <g transform="rotate(-28 12 12)">
        <ellipse
          cx="12"
          cy="12"
          rx="10"
          ry="4.3"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeDasharray="36 10.5"
          strokeLinecap="round"
        />
      </g>
      <g transform="rotate(32 12 12)">
        <ellipse
          cx="12"
          cy="12"
          rx="10"
          ry="4.3"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeDasharray="36 10.5"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M12 7.4Q12 12 16.6 12Q12 12 12 16.6Q12 12 7.4 12Q12 12 12 7.4Z"
        fill="currentColor"
      />
      <circle cx="15.3" cy="8.7" r="1" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

/** Wrapper tương thích props `{ className?: string }` cho cấu hình Tab / danh sách nguồn */
export function StudyMateAiSimpleIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return <StudyMateAiIcon variant="simple" className={className} />;
}
