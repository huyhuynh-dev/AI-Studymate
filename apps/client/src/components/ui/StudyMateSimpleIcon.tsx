import React from "react";

export interface StudyMateSimpleIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  /**
   * "gradient": Sử dụng dải màu thương hiệu Indigo & Mint tự động đổi Light/Dark.
   * "monochrome": Kế thừa màu chữ cha qua `currentColor` (phù hợp nút nền đặc như `bg-primary text-white`).
   */
  variant?: "gradient" | "monochrome";
}

/**
 * Biểu tượng AI tối giản của StudyMate (StudyMate Simple AI Icon).
 * Tối ưu hóa cho các nút bấm (Buttons), Tabs điều hướng và Badge tính năng AI.
 */
export function StudyMateSimpleIcon({
  size = 16,
  className = "",
  variant = "gradient",
  ...props
}: StudyMateSimpleIconProps) {
  if (variant === "monochrome") {
    return (
      <svg
        viewBox="0 0 1024 1024"
        width={size}
        height={size}
        fill="currentColor"
        className={`shrink-0 ${className}`.trim()}
        aria-hidden="true"
        {...props}
      >
        {/* Vòng quỹ đạo Gyroscope */}
        <g transform="rotate(-28 460 520)">
          <ellipse
            cx="460"
            cy="520"
            rx="400"
            ry="160"
            fill="none"
            stroke="currentColor"
            strokeWidth="56"
            strokeLinecap="round"
            opacity={0.85}
          />
        </g>
        {/* Ngôi sao chính */}
        <path d="M 460 160 Q 460 520 820 520 Q 460 520 460 880 Q 460 520 100 520 Q 460 520 460 160 Z" />
        {/* Ngôi sao phụ */}
        <path d="M 800 130 Q 800 220 890 220 Q 800 220 800 310 Q 800 220 710 220 Q 800 220 800 130 Z" />
        {/* Ngôi sao vi mô */}
        <path d="M 180 770 Q 180 820 230 820 Q 180 820 180 870 Q 180 820 130 820 Q 180 820 180 770 Z" />
        {/* Hạt photon */}
        <circle cx="870" cy="370" r="22" />
      </svg>
    );
  }

  // Variant gradient: Hiển thị dải màu nhận diện thương hiệu tự động thích ứng Light / Dark
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      fill="none"
      className={`shrink-0 ${className}`.trim()}
      aria-hidden="true"
      {...props}
    >
      <defs>
        {/* Light Mode Gradients */}
        <linearGradient id="sm-l-star" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3525CD" />
          <stop offset="50%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#6F3DD9" />
        </linearGradient>
        <linearGradient id="sm-l-orbit" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#006C49" />
          <stop offset="50%" stopColor="#0D9488" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>

        {/* Dark Mode Gradients */}
        <linearGradient id="sm-d-star" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="50%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>
        <linearGradient id="sm-d-orbit" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="50%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#6CF8BB" />
        </linearGradient>
      </defs>

      <style>{`
        .sm-icon-light { display: block; }
        .sm-icon-dark { display: none; }
        @media (prefers-color-scheme: dark) {
          .sm-icon-light { display: none; }
          .sm-icon-dark { display: block; }
        }
      `}</style>

      {/* Light Mode */}
      <g className="sm-icon-light">
        <g transform="rotate(-28 460 520)">
          <ellipse
            cx="460"
            cy="520"
            rx="400"
            ry="160"
            fill="none"
            stroke="url(#sm-l-orbit)"
            strokeWidth="52"
            strokeLinecap="round"
          />
        </g>
        <path
          d="M 460 160 Q 460 520 820 520 Q 460 520 460 880 Q 460 520 100 520 Q 460 520 460 160 Z"
          fill="url(#sm-l-star)"
        />
        <path
          d="M 800 130 Q 800 220 890 220 Q 800 220 800 310 Q 800 220 710 220 Q 800 220 800 130 Z"
          fill="url(#sm-l-orbit)"
        />
        <path
          d="M 180 770 Q 180 820 230 820 Q 180 820 180 870 Q 180 820 130 820 Q 180 820 180 770 Z"
          fill="url(#sm-l-star)"
        />
        <circle cx="870" cy="370" r="22" fill="#0D9488" />
      </g>

      {/* Dark Mode */}
      <g className="sm-icon-dark">
        <g transform="rotate(-28 460 520)">
          <ellipse
            cx="460"
            cy="520"
            rx="400"
            ry="160"
            fill="none"
            stroke="url(#sm-d-orbit)"
            strokeWidth="52"
            strokeLinecap="round"
          />
        </g>
        <path
          d="M 460 160 Q 460 520 820 520 Q 460 520 460 880 Q 460 520 100 520 Q 460 520 460 160 Z"
          fill="url(#sm-d-star)"
        />
        <path
          d="M 800 130 Q 800 220 890 220 Q 800 220 800 310 Q 800 220 710 220 Q 800 220 800 130 Z"
          fill="#6CF8BB"
        />
        <path
          d="M 180 770 Q 180 820 230 820 Q 180 820 180 870 Q 180 820 130 820 Q 180 820 180 770 Z"
          fill="#818CF8"
        />
        <circle cx="870" cy="370" r="22" fill="#6CF8BB" />
      </g>
    </svg>
  );
}

export default StudyMateSimpleIcon;
