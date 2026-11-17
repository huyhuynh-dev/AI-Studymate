'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { extractAdminErrorMessage } from '@/lib/axios.admin';
import { adminApi } from '@/services/admin.api';
import { IconAlert, IconShield } from '@/components/ui/AdminIcons';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(() => {
    if (searchParams.get('forbidden') === 'true') {
      return 'Tài khoản hiện tại không có quyền Quản trị viên (Admin). Vui lòng đăng nhập bằng tài khoản Admin.';
    }
    if (searchParams.get('session_expired') === 'true') {
      return 'Phiên đăng nhập Quản trị viên đã hết hạn. Vui lòng đăng nhập lại.';
    }
    return null;
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await adminApi.loginAdmin({
        email: email.trim(),
        password,
        rememberMe,
      });
      router.replace('/');
    } catch (error: unknown) {
      setErrorMsg(
        extractAdminErrorMessage(
          error,
          'Không thể đăng nhập Cổng Quản trị. Vui lòng kiểm tra thông tin.',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-[#08080A]">
      <div className="w-full max-w-[440px]">
        {/* Outer Card: R_outer = 24px, Padding = 8px -> Inner R_inner = 16px */}
        <div className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
          <div className="rounded-[16px] p-6 bg-[#1C1C22]/75 border border-white/[0.06]">
            <div className="flex items-center gap-3.5 mb-6">
              <div className="w-11 h-11 rounded-[12px] bg-[#0A84FF]/15 border border-[#0A84FF]/30 flex items-center justify-center text-[#0A84FF] shrink-0">
                <IconShield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#F5F5F7]">
                  Operations Console
                </h1>
                <p className="text-[13.5px] text-[#A1A1AA]">
                  Đăng nhập bằng tài khoản Quản trị viên AI-StudyMate
                </p>
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 p-3.5 rounded-[12px] bg-[#FF453A]/12 border border-[#FF453A]/30 text-[13px] text-[#FF8A82]"
              >
                <IconAlert className="w-4 h-4 shrink-0 mt-0.5 text-[#FF453A]" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-email"
                  className="block text-[13px] font-medium text-[#D4D4D8] mb-1.5"
                >
                  Email Quản trị viên
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@studymate.local"
                  className="w-full h-11 px-3.5 rounded-[12px] bg-[#121216] border border-white/[0.1] text-[14px] text-[#F5F5F7] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#0A84FF] focus:border-transparent"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-[13px] font-medium text-[#D4D4D8] mb-1.5"
                >
                  Mật khẩu
                </label>
                <input
                  id="admin-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-3.5 rounded-[12px] bg-[#121216] border border-white/[0.1] text-[14px] text-[#F5F5F7] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#0A84FF] focus:border-transparent"
                />
              </div>

              <label className="flex items-center gap-2.5 text-[13px] text-[#A1A1AA] cursor-pointer select-none py-1">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#0A84FF]"
                />
                <span>Duy trì phiên làm việc Quản trị (30 ngày)</span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="spring-interactive w-full min-h-[44px] rounded-[12px] bg-[#0A84FF] text-white text-[14px] font-semibold hover:bg-[#0A84FF]/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40 disabled:pointer-events-none"
              >
                {isSubmitting ? 'Đang xác minh quyền Admin...' : 'Đăng nhập Cổng Quản trị'}
              </button>
            </form>

            <p className="mt-5 pt-4 border-t border-white/[0.08] text-[12px] leading-relaxed text-[#71717A]">
              Lưu ý: Chỉ tài khoản có <code className="text-[#A1A1AA]">role = &apos;admin&apos;</code> hoặc
              email nằm trong biến môi trường <code className="text-[#A1A1AA]">ADMIN_EMAILS</code> của
              Backend mới được cấp quyền truy cập.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#08080A] text-[#A1A1AA] text-[14px]">
          Đang tải cổng xác thực...
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
