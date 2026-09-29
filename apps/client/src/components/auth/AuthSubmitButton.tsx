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
      className={`w-full py-3.5 rounded-xl bg-linear-to-r from-indigo-600 to-indigo-700 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg shadow-indigo-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${className}`.trim()}
    >
      {isLoading ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <ArrowRight size={16} />
        </>
      )}
    </button>
  );
}

export default AuthSubmitButton;
