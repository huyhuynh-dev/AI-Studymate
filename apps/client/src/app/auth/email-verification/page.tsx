'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  MailCheck,
  Mail,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

import OtpInput from '@/components/auth/OtpInput';
import AuthSubmitButton from '@/components/auth/AuthSubmitButton';
import {
  handleRequestEmailVerification,
  handleVerifyEmail,
} from '@/services/auth.api';

// ─────────────────────────────────────────────
// Step 1 — OTP Verification View
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
      {/* App Squircle Glyph */}
      <div className="flex flex-col items-center mb-5">
        <div className="w-12 h-12 rounded-[14px] bg-gradient-to-b from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 ring-1 ring-white/20 apple-spring">
          <MailCheck className="w-6 h-6 text-white" strokeWidth={1.8} />
        </div>
      </div>

      {/* Title & Subtitle */}
      <div className="text-center mb-5">
        <h1 className="text-2xl sm:text-[26px] font-semibold font-heading text-gray-900 dark:text-white tracking-[-0.025em] leading-tight">
          Xác thực tài khoản
        </h1>
        <p className="mt-1.5 text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed">
          Nhập mã xác nhận 6 chữ số vừa được gửi đến email:
        </p>
      </div>

      {/* Email chip */}
      <div className="flex justify-center mb-6">
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-gray-50/80 dark:bg-white/5 text-gray-700 dark:text-gray-200 text-[13px] font-medium rounded-full border border-gray-200/80 dark:border-white/10 select-none">
          <Mail className="w-3.5 h-3.5 text-indigo-500" strokeWidth={1.8} />
          <span className="font-semibold text-gray-900 dark:text-white">
            {email}
          </span>
        </span>
      </div>

      {/* Error / Success Feedback Banners */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-xl bg-red-500/10 dark:bg-red-500/15 border border-red-500/20 text-red-700 dark:text-red-300 flex items-start gap-2.5 text-[13px] leading-snug animate-in fade-in duration-200"
        >
          <AlertCircle
            className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5"
            strokeWidth={2}
          />
          <span className="flex-1 font-medium">{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5 text-[13px] leading-snug animate-in fade-in duration-200"
        >
          <CheckCircle2
            className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
            strokeWidth={2}
          />
          <span className="flex-1 font-medium">{successMessage}</span>
        </div>
      )}

      {isRequestingOtp && !errorMessage && !successMessage && (
        <div
          role="status"
          className="mb-5 p-3.5 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 flex items-center gap-2.5 text-[13px] text-indigo-700 dark:text-indigo-300 animate-in fade-in duration-200"
        >
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="flex-1 font-medium">
            Đang gửi mã xác thực tới hộp thư của bạn...
          </span>
        </div>
      )}

      {/* OTP Input */}
      <div className="my-2">
        <OtpInput
          value={otp}
          onChange={setOtp}
          disabled={isLoading || isRequestingOtp}
        />
      </div>

      {/* Countdown + Resend row */}
      <div className="flex items-center justify-between mt-4 px-1 select-none">
        <div className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400">
          <Clock className="w-3.5 h-3.5" strokeWidth={1.8} />
          <span>
            Hết hạn sau:{' '}
            <span
              className={`tabular-nums font-semibold ${
                countdown <= 60
                  ? 'text-red-500'
                  : 'text-indigo-600 dark:text-indigo-400'
              }`}
            >
              {formatTime(countdown)}
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={onResend}
          disabled={isResending || isRequestingOtp || countdown > 0}
          className="flex items-center gap-1 text-[12px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`}
            strokeWidth={1.8}
          />
          {countdown > 0 ? `Gửi lại sau (${countdown}s)` : 'Gửi lại mã OTP'}
        </button>
      </div>

      {/* Primary Action Button */}
      <div className="mt-6">
        <AuthSubmitButton
          label="Kích hoạt tài khoản"
          type="button"
          isLoading={isLoading}
          loadingLabel="Đang kích hoạt..."
          onClick={onSubmit}
          disabled={otp.some((d) => !d) || isRequestingOtp}
        />
      </div>

      {/* Helper Deference Note */}
      <p className="mt-4 text-center text-[12px] text-gray-400 dark:text-gray-500 select-none">
        Không thấy thư? Vui lòng kiểm tra mục Thư rác (Spam) hoặc Quảng cáo.
      </p>

      {/* Switch / Exit Navigation */}
      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/10 text-center">
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" strokeWidth={1.8} />
          <span>Đăng nhập bằng tài khoản khác</span>
        </Link>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Step 2 — Success View
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
      {/* App Squircle Glyph Success */}
      <div className="flex flex-col items-center mb-5">
        <div className="w-14 h-14 rounded-[16px] bg-gradient-to-b from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 ring-1 ring-white/20 apple-spring">
          <CheckCircle2 className="w-7 h-7 text-white" strokeWidth={2} />
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-[26px] font-semibold font-heading text-gray-900 dark:text-white tracking-[-0.025em] leading-tight">
          Kích hoạt thành công
        </h1>
        <p className="mt-1.5 text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed">
          Tài khoản học tập gắn với{' '}
          <strong className="text-gray-900 dark:text-white font-medium">
            {email}
          </strong>{' '}
          đã được xác thực. Bạn có thể đăng nhập để bắt đầu trải nghiệm.
        </p>
      </div>

      {/* Subtle Welcome Card */}
      <div className="p-4 rounded-xl bg-gray-50/80 dark:bg-white/[0.03] border border-gray-200/80 dark:border-white/10 mb-6 select-none">
        <div className="flex items-center gap-2 mb-2 text-indigo-600 dark:text-indigo-400 font-semibold font-heading text-[13px]">
          <Sparkles className="w-4 h-4" strokeWidth={2} />
          <span>Không gian học tập AI sẵn sàng</span>
        </div>
        <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">
          Tài liệu, giáo trình và trợ lý ôn luyện thông minh đã được chuẩn bị đầy
          đủ cho phiên học tập của bạn.
        </p>
      </div>

      {/* Auto redirect status */}
      <div className="flex items-center justify-between text-[12px] text-gray-500 dark:text-gray-400 mb-4 px-1 select-none">
        <span className="flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-400" />
          <span>Tự động chuyển sang trang Đăng nhập</span>
        </span>
        <span className="tabular-nums font-semibold text-indigo-600 dark:text-indigo-400 text-[13px]">
          {redirectCountdown}s
        </span>
      </div>

      {/* Primary Action Button */}
      <AuthSubmitButton
        label="Đăng nhập ngay"
        type="button"
        onClick={onRedirect}
      />

      {/* Alternative Link */}
      <div className="mt-5 text-center">
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-1 text-[13px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
        >
          <span>Chuyển tới đăng nhập</span>
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
        </Link>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Main Content
// ─────────────────────────────────────────────
function EmailVerificationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get('email');

  const [step, setStep] = useState<'verify' | 'success'>('verify');

  // Email from query params (e.g. redirected from register/login) or fallback
  const [email] = useState(emailFromQuery || 'nguyen_van_a@student.edu.vn');

  // OTP state
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [countdown, setCountdown] = useState(300); // 5 minutes TTL
  const [isResending, setIsResending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);

  // Status feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Success countdown
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
          if (result.statusCode === 400) {
            setErrorMessage(
              'Email không hợp lệ. Vui lòng kiểm tra lại định dạng email.'
            );
            return;
          }

          if (result.statusCode === 429) {
            setErrorMessage(
              'Bạn đã yêu cầu gửi mã quá nhiều lần. Vui lòng đợi ít phút trước khi thử lại.'
            );
            return;
          }

          setErrorMessage(
            result.error ||
              'Có lỗi xảy ra khi yêu cầu mã xác thực. Vui lòng thử lại sau.'
          );
          return;
        }

        setSuccessMessage(
          result.message ||
            'Mã OTP xác thực đã được gửi đến hộp thư. Vui lòng kiểm tra email của bạn!'
        );
        setCountdown(300); // 5 minutes TTL
        if (isManualResend) {
          setOtp(Array(6).fill(''));
        }
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.'
        );
      } finally {
        setIsRequestingOtp(false);
        setIsResending(false);
      }
    },
    []
  );

  // Trigger request-email-verification API immediately upon mounting
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
        setStep('success');
        setRedirectCountdown(5);
        return;
      }

      if (result.statusCode === 403) {
        setErrorMessage(
          result.error ||
            result.message ||
            'Mã OTP không chính xác. Vui lòng kiểm tra lại.'
        );
        return;
      }

      if (result.statusCode === 404) {
        setErrorMessage(
          'Email không tồn tại trong hệ thống. Vui lòng kiểm tra lại hoặc đăng ký mới.'
        );
        return;
      }

      if (result.statusCode === 400) {
        setErrorMessage(
          result.error ||
            result.message ||
            'Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng nhấn "Gửi lại mã OTP".'
        );
        return;
      }

      if (result.statusCode === 429) {
        setErrorMessage(
          'Bạn đã gửi quá nhiều yêu cầu. Vui lòng đợi ít phút rồi thử lại.'
        );
        return;
      }

      if (result.statusCode === 500) {
        setErrorMessage(
          'Lỗi hệ thống khi xác thực email. Vui lòng thử lại sau.'
        );
        return;
      }

      setErrorMessage(
        result.error ||
          result.message ||
          'Xác thực email thất bại. Vui lòng thử lại sau.'
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Xác thực OTP thất bại. Vui lòng thử lại.'
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
