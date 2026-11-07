import React from 'react';

export interface AuthInfoBoxProps {
  icon: React.ReactNode;
  text: string;
  variant?: 'bordered' | 'plain';
  className?: string;
}

export function AuthInfoBox({
  icon,
  text,
  variant = 'bordered',
  className = '',
}: AuthInfoBoxProps) {
  if (variant === 'plain') {
    return (
      <div
        className={`mt-4 text-center text-[12px] text-gray-500 dark:text-gray-400 select-none ${className}`.trim()}
      >
        <span className="inline-flex items-center justify-center gap-1.5">
          <span className="shrink-0">{icon}</span>
          <span>{text}</span>
        </span>
      </div>
    );
  }

  return (
    <div
      className={`mt-6 p-3 rounded-xl bg-gray-50/70 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] flex items-center gap-2.5 ${className}`.trim()}
    >
      <span className="shrink-0">{icon}</span>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed select-none">
        {text}
      </p>
    </div>
  );
}

export default AuthInfoBox;
