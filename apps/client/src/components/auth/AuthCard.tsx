import type { ReactNode } from "react";

interface AuthCardProps {
  children: ReactNode;
  className?: string;
}

export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <div
      className={`w-full max-w-lg mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 px-8 py-10 sm:px-10 ${className ?? ""}`.trim()}
    >
      {children}
    </div>
  );
}

export default AuthCard;
