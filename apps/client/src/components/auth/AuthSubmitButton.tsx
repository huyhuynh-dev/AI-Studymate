'use client';

import React from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

export interface AuthSubmitButtonProps {
  label: string;
  type?: 'submit' | 'button' | 'reset';
  disabled?: boolean;
  isLoading?: boolean;
  loadingLabel?: string;
  className?: string;
  onClick?: () => void;
}

export function AuthSubmitButton({
  label,
  type = 'submit',
  disabled = false,
  isLoading = false,
  loadingLabel = 'Đang xử lý...',
  className = '',
  onClick,
}: AuthSubmitButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`group relative w-full h-12 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-[14px] tracking-[-0.01em] flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(79,70,229,0.25)] shadow-[inset_0px_1px_0px_rgba(255,255,255,0.22)] apple-spring active:scale-[0.985] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 ${className}`.trim()}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <ArrowRight
            className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
            strokeWidth={2}
          />
        </>
      )}
    </button>
  );
}

export default AuthSubmitButton;
