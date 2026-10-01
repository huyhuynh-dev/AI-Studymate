'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MailCheck,
  Mail,
  Pencil,
  Clock,
  RefreshCw,
  Lightbulb,
  ShieldCheck,
  CheckCircle2,
  LogOut,
  Sparkles,
  ChevronLeft,
  Star,
  SlidersHorizontal,
  Compass,
  Zap,
} from 'lucide-react';

import OtpInput from '@/components/auth/OtpInput';
import AuthSubmitButton from '@/components/auth/AuthSubmitButton';

// ─────────────────────────────────────────────
// Step 1 — OTP Verification
// ─────────────────────────────────────────────
function StepVerifyOtp({
  email,
  otp,
  setOtp,
  onSubmit,
  onResend,
  isLoading,
  isResending,
  countdown,
}: {
  email: string;
  otp: string[];
  setOtp: (v: string[]) => void;
  onSubmit: () => void;
  onResend: () => void;
  isLoading: boolean;
  isResending: boolean;
  countdown: number;
}) {
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Badge */}
      <div className="flex justify-center mb-4">
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100 uppercase tracking-wide">
          <ShieldCheck className="w-3.5 h-3.5" />
          Kích hoạt tài khoản mới
        </span>
      </div>

      {/* Icon */}
      <div className="flex flex-col items-center mb-5">
        <div className="relative">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <MailCheck className="w-8 h-8 text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-indigo-400 rounded-full flex items-center justify-center border-2 border-white">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Xác thực email của bạn
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          Chào mừng bạn đến với{' '}
          <span className="text-indigo-600 font-semibold">AI StudyMate</span>!
          Vui lòng nhập mã bảo mật gồm 6 chữ số vừa được gửi đến hòm thư:
        </p>
      </div>

      {/* Email chip */}
      <div className="flex justify-center mb-6">
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 text-sm font-medium rounded-full border border-gray-200">
          <Mail className="w-4 h-4 text-gray-400" />
          {email}
          <button
            type="button"
            className="text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer"
            aria-label="Chỉnh sửa email"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </span>
      </div>

      {/* OTP Input */}
      <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />

      {/* Countdown + Resend */}
      <div className="flex items-center justify-between mt-4 px-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          <span>
            Mã hết hạn sau:{' '}
            <span
              className={
                countdown <= 60
                  ? 'text-red-500 font-semibold'
                  : 'text-indigo-600 font-semibold'
              }
            >
              {formatTime(countdown)}
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={onResend}
          disabled={isResending || countdown > 0}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`}
          />
          Gửi lại mã OTP
        </button>
      </div>

      {/* Submit */}
      <div className="mt-5">
        <AuthSubmitButton
          label="Kích hoạt tài khoản & Bắt đầu học"
          type="button"
          isLoading={isLoading}
          loadingLabel="Đang xác thực..."
          onClick={onSubmit}
          disabled={otp.some((d) => !d)}
        />
      </div>

      {/* Tip box */}
      <div className="mt-4 p-3.5 bg-amber-50 border border-amber-100 rounded-xl">
        <div className="flex gap-2.5">
          <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-relaxed">
            <strong>Mẹo nhỏ:</strong> Nếu không tìm thấy mã trong Hộp thư đến,
            bạn vui lòng kiểm tra thư mục{' '}
            <strong>Thư rác (Spam)</strong> hoặc{' '}
            <strong>Quảng cáo</strong> nhé.
          </p>
        </div>
      </div>

      {/* Bottom footer */}
      <div className="mt-6 flex items-center justify-between text-xs text-gray-400 px-1">
        <Link
          href="/auth/login"
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Đăng xuất hoặc dùng tài khoản khác</span>
        </Link>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-emerald-400 rounded-full" />
          Bước 2/2: Kích hoạt bảo mật
        </span>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Step 2 — Success
// ─────────────────────────────────────────────
function StepSuccess({
  email,
  redirectCountdown,
  onRedirect,
}: {
  email: string;
  redirectCountdown: number;
  onRedirect: () => void;
}) {
  return (
    <>
      {/* Success Icon with decorations */}
      <div className="flex flex-col items-center mb-4">
        <div className="relative w-24 h-24 flex items-center justify-center">
          {/* Decorative elements */}
          <ChevronLeft className="absolute top-0 left-2 w-5 h-5 text-emerald-300 animate-pulse" />
          <Sparkles className="absolute top-1 right-2 w-4 h-4 text-emerald-300 animate-pulse delay-300" />
          <Star className="absolute bottom-3 left-4 w-4 h-4 text-amber-300 animate-pulse delay-500" />

          {/* Main icon */}
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

      {/* Badge */}
      <div className="flex justify-center mb-4">
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-100">
          <ShieldCheck className="w-3.5 h-3.5" />
          Xác thực danh tính bảo mật 100%
        </span>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Kích hoạt tài khoản thành công!
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          Chúc mừng bạn đã gia nhập cộng đồng{' '}
          <span className="text-indigo-600 font-semibold">AI StudyMate</span>.
          Hộp thư <strong>{email}</strong> đã sẵn sàng đồng hành cùng bạn.
        </p>
      </div>

      {/* Features box */}
      <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl mb-5">
        {/* Box header */}
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">
            Gói học tập miễn phí dành cho bạn đã kích hoạt
          </span>
        </div>

        {/* Feature list */}
        <div className="space-y-2.5">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-700 leading-relaxed">
              <strong>Tải lên giáo trình &amp; Tóm tắt tài liệu</strong> tự động
              không giới hạn với AI phân tích ngữ cảnh sâu.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-700 leading-relaxed">
              <strong>Hệ thống Flashcard Spaced Repetition</strong> lặp lại ngắt
              quãng thông minh ghi nhớ dài hạn.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-700 leading-relaxed">
              <strong>AI Mock Test 15 phút</strong> tạo đề thi trắc nghiệm &amp;
              tự luận sát đề cương học viện.
            </p>
          </div>
        </div>
      </div>

      {/* Auto redirect countdown */}
      <div className="flex items-center justify-between text-xs text-gray-500 mb-4 px-1">
        <span className="flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Tự động chuyển tiếp sau
        </span>
        <span className="text-indigo-600 font-bold text-sm">
          {redirectCountdown} giây
        </span>
      </div>

      {/* CTA Button */}
      <AuthSubmitButton
        label="Bắt đầu học ngay với AI StudyMate"
        type="button"
        onClick={onRedirect}
        className="!from-emerald-600 !to-emerald-700 hover:!from-emerald-700 hover:!to-emerald-800 !shadow-emerald-200"
      />

      {/* Quick links */}
      <div className="mt-4 flex items-center justify-center gap-3 text-xs text-gray-500">
        <Link
          href="/settings/profile"
          className="flex items-center gap-1 hover:text-gray-700 transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Thiết lập hồ sơ môn học
        </Link>
        <span className="text-gray-300">•</span>
        <Link
          href="/guide"
          className="flex items-center gap-1 hover:text-gray-700 transition-colors"
        >
          <Compass className="w-3.5 h-3.5" />
          Khám phá hướng dẫn (1 phút)
        </Link>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function EmailVerificationPage() {
  const router = useRouter();

  const [step, setStep] = useState<'verify' | 'success'>('verify');

  // Simulated email — in production, get from auth context or query params
  const [email] = useState('nguyen_van_a@student.edu.vn');

  // OTP state
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [countdown, setCountdown] = useState(300); // 5 minutes
  const [isResending, setIsResending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Success state
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  // OTP countdown timer
  useEffect(() => {
    if (step !== 'verify' || countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step, countdown]);

  // Redirect countdown timer (after success)
  useEffect(() => {
    if (step !== 'success') return;
    if (redirectCountdown <= 0) {
      router.push('/');
      return;
    }
    const interval = setInterval(() => {
      setRedirectCountdown((c) => c - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [step, redirectCountdown, router]);

  // Verify OTP
  const handleVerify = useCallback(async () => {
    const code = otp.join('');
    if (code.length !== 6) return;
    setIsLoading(true);

    try {
      // TODO: Call API to verify email OTP
      // await verifyEmailOtp(email, code);
      await new Promise((r) => setTimeout(r, 1200)); // simulate

      setStep('success');
      setRedirectCountdown(5);
    } catch {
      // handle error
    } finally {
      setIsLoading(false);
    }
  }, [otp]);

  // Resend OTP
  const handleResend = useCallback(async () => {
    setIsResending(true);
    try {
      // TODO: Call API to resend email OTP
      // await resendEmailOtp(email);
      await new Promise((r) => setTimeout(r, 1000)); // simulate

      setCountdown(300);
      setOtp(Array(6).fill(''));
    } catch {
      // handle error
    } finally {
      setIsResending(false);
    }
  }, []);

  // Redirect
  const handleRedirect = useCallback(() => {
    router.push('/');
  }, [router]);

  return (
    <>
      {step === 'verify' && (
        <StepVerifyOtp
          email={email}
          otp={otp}
          setOtp={setOtp}
          onSubmit={handleVerify}
          onResend={handleResend}
          isLoading={isLoading}
          isResending={isResending}
          countdown={countdown}
        />
      )}

      {step === 'success' && (
        <StepSuccess
          email={email}
          redirectCountdown={redirectCountdown}
          onRedirect={handleRedirect}
        />
      )}
    </>
  );
}
