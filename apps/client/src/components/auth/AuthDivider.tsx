import React from 'react';

export interface AuthDividerProps {
  text?: string;
  className?: string;
}

export function AuthDivider({
  text = 'HOẶC',
  className = '',
}: AuthDividerProps) {
  return (
    <div className={`flex items-center gap-3 my-6 ${className}`.trim()}>
      <div className="flex-1 h-px bg-gray-200/80 dark:bg-white/10" />
      <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 select-none px-1">
        {text}
      </span>
      <div className="flex-1 h-px bg-gray-200/80 dark:bg-white/10" />
    </div>
  );
}

export default AuthDivider;
