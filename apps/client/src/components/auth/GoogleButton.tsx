'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface GoogleButtonProps {
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function GoogleButton({
  label = 'Tiếp tục với Google',
  onClick,
  disabled = false,
  isLoading = false,
  className = '',
}: GoogleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-label="Đăng nhập bằng tài khoản Google"
      className={`w-full h-11 px-4 rounded-xl flex items-center justify-center gap-2.5 bg-gray-50/80 dark:bg-white/5 hover:bg-gray-100/90 dark:hover:bg-white/10 active:bg-gray-200/70 dark:active:bg-white/15 border border-gray-200/80 dark:border-white/10 text-[14px] font-medium text-gray-700 dark:text-gray-200 apple-spring active:scale-[0.985] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2 ${className}`.trim()}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500 dark:text-gray-400 shrink-0" />
          <span className="text-[13px] text-gray-600 dark:text-gray-300">
            Đang chuyển hướng sang Google...
          </span>
        </>
      ) : (
        <>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            className="shrink-0"
            aria-hidden="true"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

export default GoogleButton;
