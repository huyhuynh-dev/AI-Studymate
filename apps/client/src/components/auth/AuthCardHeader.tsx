import React from 'react';
import { BookOpenCheck, Sparkles } from 'lucide-react';

export interface AuthCardHeaderProps {
  variant: 'login' | 'register';
  className?: string;
  showBadge?: boolean;
}

export function AuthCardHeader({
  variant,
  className = '',
  showBadge = false,
}: AuthCardHeaderProps) {
  const isLogin = variant === 'login';

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      {/* Top row with squircle app glyph & optional micro-badge */}
      <div className="flex items-center justify-between">
        {/* App Icon Lockup with Concentric Squircle Geometry */}
        <div className="relative group">
          <div className="w-12 h-12 rounded-[14px] bg-gradient-to-b from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 ring-1 ring-white/20 apple-spring group-hover:scale-105">
            <BookOpenCheck className="w-6 h-6 text-white" strokeWidth={1.8} />
          </div>
          {/* Micro ambient specular glow */}
          <div className="absolute -inset-1 rounded-[16px] bg-indigo-500/15 blur-xs -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Apple Pill Badge (chỉ hiển thị khi thật sự có mục đích, mặc định tắt ở Login để tránh rác thị giác) */}
        {showBadge && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium tracking-wide bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/40 select-none">
            <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" strokeWidth={2} />
            <span>Học tập cùng AI</span>
          </div>
        )}
      </div>

      {/* Typography with Optical Sizing */}
      <div>
        <h1 className="text-2xl sm:text-[26px] font-semibold text-gray-900 dark:text-white tracking-[-0.025em] leading-tight">
          {isLogin ? 'Đăng nhập vào AI StudyMate' : 'Tạo tài khoản AI StudyMate'}
        </h1>
        <p className="mt-1.5 text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed">
          {isLogin
            ? 'Chào mừng bạn quay trở lại không gian học tập thông minh.'
            : 'Bắt đầu không gian học tập và ôn luyện cá nhân hóa cùng AI.'}
        </p>
      </div>
    </div>
  );
}

export default AuthCardHeader;
