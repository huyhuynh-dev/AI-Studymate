import type { ReactNode } from "react";

interface AuthCardProps {
  children: ReactNode;
  className?: string;
}

export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <div
      className={`w-full max-w-lg mx-auto bg-white/95 dark:bg-[#12151C]/95 backdrop-blur-2xl rounded-2xl sm:rounded-[24px] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_16px_40px_-12px_rgba(11,28,48,0.06)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)] px-8 py-10 sm:px-10 apple-spring ${className ?? ""}`.trim()}
    >
      {children}
    </div>
  );
}

export default AuthCard;
