import { BookOpenCheck, Sparkles } from 'lucide-react';

export interface AuthCardHeaderProps {
  variant: 'login' | 'register';
  className?: string;
}

export function AuthCardHeader({ variant, className }: AuthCardHeaderProps) {
  if (variant === 'login') {
    return (
      <div className={className}>
        {/* Top row */}
        <div className="flex items-start justify-between">
          {/* Left: Purple icon container */}
          <div className="rounded-2xl bg-indigo-100 p-3">
            <BookOpenCheck size={28} className="text-indigo-600" />
          </div>

          {/* Right: Badge/chip */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600">
            <Sparkles size={14} />
            <span>Học tập cùng AI</span>
          </div>
        </div>

        {/* Title & Subtitle */}
        <h1 className="mt-5 text-2xl font-bold text-gray-900">
          Đăng nhập vào AI StudyMate
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Tiếp tục không gian học tập và ôn luyện cùng trợ lý AI cá nhân.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center text-center ${className ?? ''}`.trim()}
    >
      {/* Sparkles icon above main icon */}
      <Sparkles size={16} className="mb-2 text-indigo-400" />

      {/* Main purple icon container */}
      <div className="rounded-2xl bg-indigo-600 p-3 text-white">
        <BookOpenCheck size={28} className="text-white" />
      </div>

      {/* Brand text */}
      <span className="mt-3 text-sm font-semibold text-indigo-600">
        AI StudyMate
      </span>

      {/* Title & Subtitle */}
      <h1 className="mt-1 text-2xl font-bold text-gray-900">
        Tạo tài khoản AI StudyMate
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Chỉ mất chưa đầy 1 phút để bắt đầu không gian học tập thông minh
      </p>
    </div>
  );
}

export default AuthCardHeader;
