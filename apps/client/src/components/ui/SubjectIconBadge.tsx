import React from "react";
import { Folder, FolderOpen } from "lucide-react";

export interface SubjectIconBadgeProps {
  color?: string | null;
  isOpen?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "tinted" | "solid";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<SubjectIconBadgeProps["size"]>, { box: string; icon: string }> = {
  sm: { box: "h-6 w-6 rounded-lg", icon: "h-3.5 w-3.5" },
  md: { box: "h-9 w-9 rounded-lg", icon: "h-4 w-4" },
  lg: { box: "h-11 w-11 rounded-xl", icon: "h-5 w-5" },
};

/**
 * Hiển thị biểu tượng thư mục đại diện cho một không gian môn học,
 * giữ đồng nhất sắc độ màu giữa thẻ Home, Sidebar và Modal xem trước.
 */
export function SubjectIconBadge({
  color,
  isOpen = false,
  size = "lg",
  variant = "tinted",
  className = "",
}: SubjectIconBadgeProps) {
  const resolvedColor = color || "#4F46E5";
  const dimensions = SIZE_CLASSES[size];
  const Icon = isOpen ? FolderOpen : Folder;

  const style: React.CSSProperties =
    variant === "solid"
      ? { backgroundColor: resolvedColor, color: "#FFFFFF" }
      : {
          backgroundColor: `${resolvedColor}18`,
          border: `1px solid ${resolvedColor}33`,
          color: resolvedColor,
        };

  return (
    <span
      aria-hidden="true"
      style={style}
      className={`flex shrink-0 items-center justify-center shadow-2xs ${dimensions.box} ${className}`.trim()}
    >
      <Icon className={dimensions.icon} />
    </span>
  );
}
