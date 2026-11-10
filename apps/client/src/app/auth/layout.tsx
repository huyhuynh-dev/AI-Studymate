import { Suspense } from 'react';
import AuthHeader from '@/components/auth/AuthHeader';
import AuthFooter from '@/components/auth/AuthFooter';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip no-scrollbar">
      {/* Ẩn thanh cuộn dọc toàn trang cho các giao diện Auth trong khi vẫn bảo toàn khả năng cuộn mượt mà */}
      <style>{`
        html, body {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        html::-webkit-scrollbar, body::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      `}</style>

      {/* Background canvas & ambient vibrancy blobs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none transition-colors duration-500">
        <div className="absolute inset-0 bg-[#F8F9FF] dark:bg-[#090B10]" />
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-100/40 dark:bg-emerald-950/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-purple-100/40 dark:bg-purple-950/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-indigo-100/35 dark:bg-indigo-950/25 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-pink-100/30 dark:bg-pink-950/15 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <AuthHeader />

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-lg">
          <div className="bg-white/95 dark:bg-[#12151C]/95 backdrop-blur-2xl rounded-2xl sm:rounded-[24px] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_16px_40px_-12px_rgba(11,28,48,0.06)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)] px-8 py-10 sm:px-10 apple-spring">
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </div>
        </div>
      </main>

      {/* Footer */}
      <AuthFooter />
    </div>
  );
}
