'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  AlertCircle,
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
import { handleRequestEmailVerification, handleVerifyEmail } from '@/services/auth.api';

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
  isRequestingOtp,
  countdown,
  errorMessage,
  successMessage,
}: {
  email: string;
  otp: string[];
  setOtp: (v: string[]) => void;
  onSubmit: () => void;
  onResend: () => void;
  isLoading: boolean;
  isResending: boolean;
  isRequestingOtp: boolean;
  countdown: number;
  errorMessage: string | null;
  successMessage: string | null;
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
      <div className="flex justify-center mb-5">
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

      {/* Error / Success Feedback Banners */}
      {errorMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-sm text-red-700 animate-in fade-in">
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-500" />
          <span className="flex-1 leading-snug">{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-sm text-emerald-700 animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-500" />
          <span className="flex-1 leading-snug">{successMessage}</span>
        </div>
      )}

      {isRequestingOtp && !errorMessage && !successMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center gap-2.5 text-sm text-indigo-700 animate-in fade-in">
          <RefreshCw size={18} className="shrink-0 animate-spin text-indigo-500" />
          <span className="flex-1 leading-snug">
            Đang yêu cầu mã OTP xác thực tới hộp thư của bạn...
          </span>
        </div>
      )}

      {/* OTP Input */}
      <OtpInput value={otp} onChange={setOtp} disabled={isLoading || isRequestingOtp} />

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
          disabled={isResending || isRequestingOtp || countdown > 0}
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
          disabled={otp.some((d) => !d) || isRequestingOtp}
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
          Email <strong>{email}</strong> đã được xác thực thành công. Vui lòng đăng nhập lại để bắt đầu góc học tập của bạn.
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
          Tự động chuyển về trang Đăng nhập sau
        </span>
        <span className="text-indigo-600 font-bold text-sm">
          {redirectCountdown} giây
        </span>
      </div>

      {/* CTA Button */}
      <AuthSubmitButton
        label="Đăng nhập ngay"
        type="button"
        onClick={onRedirect}
        className="!from-emerald-600 !to-emerald-700 hover:!from-emerald-700 hover:!to-emerald-800 !shadow-emerald-200"
      />

      {/* Quick links */}
      <div className="mt-4 flex items-center justify-center gap-3 text-xs text-gray-500">
        <Link
          href="/auth/login"
          className="flex items-center gap-1 hover:text-gray-700 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Quay lại trang Đăng nhập
        </Link>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
function EmailVerificationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get('email');

  const [step, setStep] = useState<'verify' | 'success'>('verify');

  // Email from query params (e.g. redirected from login) or fallback
  const [email] = useState(emailFromQuery || 'nguyen_van_a@student.edu.vn');

  // OTP state
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [countdown, setCountdown] = useState(300); // 5 minutes
  const [isResending, setIsResending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);

  // Status feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Success state
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  // Ref to prevent duplicate API calls in React StrictMode
  const hasRequestedRef = useRef(false);

  // Send / Resend OTP API caller
  const requestOtp = useCallback(
    async (targetEmail: string, isManualResend = false) => {
      const trimmed = targetEmail.trim();
      if (!trimmed) {
        setErrorMessage('Vui lòng cung cấp địa chỉ email hợp lệ.');
        return;
      }

      if (isManualResend) {
        setIsResending(true);
      } else {
        setIsRequestingOtp(true);
      }

      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const result = await handleRequestEmailVerification(trimmed);

        if (!result.success) {
          // 400: Email không hợp lệ
          if (result.statusCode === 400) {
            setErrorMessage('Email không hợp lệ. Vui lòng kiểm tra lại định dạng email.');
            return;
          }

          // 429: Gửi quá số lần cho phép (Rate limiting)
          if (result.statusCode === 429) {
            setErrorMessage(
              'Bạn đã yêu cầu gửi mã quá nhiều lần. Vui lòng đợi ít phút trước khi thử lại.'
            );
            return;
          }

          setErrorMessage(
            result.error || 'Có lỗi xảy ra khi yêu cầu mã xác thực. Vui lòng thử lại sau.'
          );
          return;
        }

        // Thành công: hiển thị thông báo trung lập bảo vệ chống User Enumeration
        setSuccessMessage(
          result.message ||
            'Nếu email hợp lệ, mã OTP sẽ được gửi đến hộp thư. Vui lòng kiểm tra email của bạn!'
        );
        setCountdown(300); // 5 minutes TTL
        if (isManualResend) {
          setOtp(Array(6).fill(''));
        }
      } catch (err: any) {
        setErrorMessage(
          err.message || 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.'
        );
      } finally {
        setIsRequestingOtp(false);
        setIsResending(false);
      }
    },
    [router]
  );

  // Trigger request-email-verification API immediately upon navigating to this page
  useEffect(() => {
    if (!email || hasRequestedRef.current) return;
    hasRequestedRef.current = true;
    requestOtp(email, false);
  }, [email, requestOtp]);

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

  // Redirect countdown timer (after success -> redirect to login page)
  useEffect(() => {
    if (step !== 'success') return;
    if (redirectCountdown <= 0) {
      router.push('/auth/login');
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
    if (code.length !== 6) {
      setErrorMessage('Vui lòng nhập đầy đủ 6 chữ số mã OTP.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await handleVerifyEmail({
        email: email.trim(),
        otp: code,
      });

      if (result.success && result.isVerified) {
        // OTP đúng -> chuyển sang bước thành công và chuẩn bị điều hướng về login
        setStep('success');
        setRedirectCountdown(5);
        return;
      }

      // OTP sai (HTTP 200 false)
      if (result.isVerified === false) {
        setErrorMessage(
          result.error || 'Mã OTP không chính xác. Vui lòng kiểm tra lại.'
        );
        return;
      }

      // Email không tồn tại (HTTP 404)
      if (result.statusCode === 404) {
        setErrorMessage(
          'Email không tồn tại trong hệ thống. Vui lòng kiểm tra lại hoặc đăng ký mới.'
        );
        return;
      }

      // OTP hết hạn hoặc không hợp lệ (HTTP 400)
      if (result.statusCode === 400) {
        setErrorMessage(
          result.error ||
            'Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng nhấn "Gửi lại mã OTP".'
        );
        return;
      }

      // Lỗi hệ thống (HTTP 500)
      if (result.statusCode === 500) {
        setErrorMessage(
          'Lỗi hệ thống khi xác thực email. Vui lòng thử lại sau.'
        );
        return;
      }

      setErrorMessage(
        result.error || 'Xác thực email thất bại. Vui lòng thử lại sau.'
      );
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Xác thực OTP thất bại. Vui lòng thử lại.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [otp, email]);

  // Resend OTP via API
  const handleResend = useCallback(async () => {
    await requestOtp(email, true);
  }, [email, requestOtp]);

  // Redirect back to login
  const handleRedirect = useCallback(() => {
    router.push('/auth/login');
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
          isRequestingOtp={isRequestingOtp}
          countdown={countdown}
          errorMessage={errorMessage}
          successMessage={successMessage}
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

export default function EmailVerificationPage() {
  return (
    <React.Suspense fallback={null}>
      <EmailVerificationContent />
    </React.Suspense>
  );
}
