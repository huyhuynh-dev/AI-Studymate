'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Lock,
  ShieldCheck,
  KeyRound,
  MailCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Clock,
  Pencil,
  Check,
} from 'lucide-react';

import AuthInput from '@/components/auth/AuthInput';
import AuthSubmitButton from '@/components/auth/AuthSubmitButton';
import AuthSwitchLink from '@/components/auth/AuthSwitchLink';
import AuthCheckbox from '@/components/auth/AuthCheckbox';
import PasswordStrength from '@/components/auth/PasswordStrength';
import OtpInput from '@/components/auth/OtpInput';
import {
  handleForgotPassword,
  handleVerifyOtp,
  handleResetPassword,
} from '@/services/auth.api';

// ─────────────────────────────────────────────
// Apple Step Indicator
// ─────────────────────────────────────────────
function AppleStepProgress({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  const steps = [
    { num: 1, label: 'Email' },
    { num: 2, label: 'Xác thực OTP' },
    { num: 3, label: 'Mật khẩu mới' },
  ];

  return (
    <div className="mb-6 select-none">
      <div className="flex items-center gap-1.5 h-1">
        {steps.map((s) => (
          <div
            key={s.num}
            className={`h-full flex-1 rounded-full transition-all duration-300 ease-out ${
              s.num <= currentStep
                ? 'bg-indigo-600 dark:bg-indigo-400'
                : 'bg-gray-200/80 dark:bg-white/10'
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 text-[11px] font-heading text-gray-400 dark:text-gray-500 font-medium tracking-tight">
        <span>
          Bước {currentStep}/3: {steps[currentStep - 1].label}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 1 — Enter email
// ─────────────────────────────────────────────
function StepEmail({
  email,
  setEmail,
  onSubmit,
  isLoading,
  errorMessage,
  successMessage,
}: {
  email: string;
  setEmail: (v: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
}) {
  return (
    <>
      <AppleStepProgress currentStep={1} />

      {/* App Squircle Glyph */}
      <div className="flex flex-col items-center mb-5">
        <div className="w-12 h-12 rounded-[14px] bg-gradient-to-b from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 ring-1 ring-white/20 apple-spring">
          <KeyRound className="w-6 h-6 text-white" strokeWidth={1.8} />
        </div>
      </div>

      {/* Title & Subtitle */}
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-[26px] font-semibold font-heading text-gray-900 dark:text-white tracking-[-0.025em] leading-tight">
          Quên mật khẩu?
        </h1>
        <p className="mt-1.5 text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed">
          Nhập email học tập của bạn để nhận mã xác thực đặt lại mật khẩu.
        </p>
      </div>

      {/* Feedback Banners */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-4 p-3.5 rounded-xl bg-red-500/10 dark:bg-red-500/15 border border-red-500/20 text-red-700 dark:text-red-300 flex items-start gap-2.5 text-[13px] leading-snug animate-in fade-in duration-200"
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
          className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5 text-[13px] leading-snug animate-in fade-in duration-200"
        >
          <CheckCircle2
            className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
            strokeWidth={2}
          />
          <span className="flex-1 font-medium">{successMessage}</span>
        </div>
      )}

      {/* Email input */}
      <div className="space-y-4">
        <AuthInput
          label="Email học tập / Sinh viên"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          placeholder="nguyen_van_a@student.edu.vn"
          icon={<Mail className="w-4 h-4" strokeWidth={1.8} />}
        />

        {/* Submit */}
        <div className="pt-1">
          <AuthSubmitButton
            label="Gửi mã xác thực"
            type="button"
            isLoading={isLoading}
            loadingLabel="Đang gửi mã..."
            onClick={onSubmit}
          />
        </div>
      </div>

      {/* Login link */}
      <AuthSwitchLink
        text="Đã nhớ mật khẩu?"
        linkText="Đăng nhập"
        href="/auth/login"
      />
    </>
  );
}

// ─────────────────────────────────────────────
// Step 2 — Verify OTP
// ─────────────────────────────────────────────
function StepOtp({
  email,
  otp,
  setOtp,
  onSubmit,
  onResend,
  onBack,
  onEditEmail,
  isLoading,
  isResending,
  countdown,
  resendCooldown,
  errorMessage,
  successMessage,
}: {
  email: string;
  otp: string[];
  setOtp: (v: string[]) => void;
  onSubmit: () => void;
  onResend: () => void;
  onBack: () => void;
  onEditEmail: () => void;
  isLoading: boolean;
  isResending: boolean;
  countdown: number;
  resendCooldown: number;
  errorMessage?: string | null;
  successMessage?: string | null;
}) {
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <AppleStepProgress currentStep={2} />

      {/* App Squircle Glyph */}
      <div className="flex flex-col items-center mb-5">
        <div className="w-12 h-12 rounded-[14px] bg-gradient-to-b from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 ring-1 ring-white/20 apple-spring">
          <MailCheck className="w-6 h-6 text-white" strokeWidth={1.8} />
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-4">
        <h1 className="text-2xl sm:text-[26px] font-semibold font-heading text-gray-900 dark:text-white tracking-[-0.025em] leading-tight">
          Xác thực mã OTP
        </h1>
        <p className="mt-1.5 text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed">
          Nhập mã xác nhận gồm 6 chữ số vừa được gửi đến:
        </p>
      </div>

      {/* Email chip */}
      <div className="flex justify-center mb-6">
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-gray-50/80 dark:bg-white/5 text-gray-700 dark:text-gray-200 text-[13px] font-medium rounded-full border border-gray-200/80 dark:border-white/10 select-none">
          <Mail className="w-3.5 h-3.5 text-indigo-500" strokeWidth={1.8} />
          <span>{email}</span>
          <button
            type="button"
            onClick={onEditEmail}
            className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-0.5 rounded cursor-pointer active:scale-90"
            aria-label="Chỉnh sửa email"
          >
            <Pencil className="w-3 h-3" strokeWidth={2} />
          </button>
        </span>
      </div>

      {/* Feedback Banners */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-4 p-3.5 rounded-xl bg-red-500/10 dark:bg-red-500/15 border border-red-500/20 text-red-700 dark:text-red-300 flex items-start gap-2.5 text-[13px] leading-snug animate-in fade-in duration-200"
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
          className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5 text-[13px] leading-snug animate-in fade-in duration-200"
        >
          <CheckCircle2
            className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
            strokeWidth={2}
          />
          <span className="flex-1 font-medium">{successMessage}</span>
        </div>
      )}

      {/* OTP Input */}
      <div className="my-2">
        <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />
      </div>

      {/* Countdown + Resend */}
      <div className="flex items-center justify-between mt-4 px-1 select-none">
        <div className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400">
          <Clock className="w-3.5 h-3.5" strokeWidth={1.8} />
          <span>
            Hết hạn sau:{' '}
            <span
              className={`tabular-nums font-semibold ${
                countdown <= 30
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
          disabled={isResending || resendCooldown > 0}
          className="flex items-center gap-1 text-[12px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`}
            strokeWidth={1.8}
          />
          {resendCooldown > 0
            ? `Gửi lại sau (${resendCooldown}s)`
            : 'Gửi lại mã OTP'}
        </button>
      </div>

      {/* Submit */}
      <div className="mt-6">
        <AuthSubmitButton
          label="Tiếp tục"
          type="button"
          isLoading={isLoading}
          loadingLabel="Đang xác thực..."
          onClick={onSubmit}
          disabled={otp.some((d) => !d) || countdown === 0}
        />
      </div>

      {/* Back button */}
      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.8} />
          Quay lại bước trước
        </button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Step 3 — New password
// ─────────────────────────────────────────────
function StepNewPassword({
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  logoutAll,
  setLogoutAll,
  onSubmit,
  isLoading,
  errorMessage,
  successMessage,
}: {
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  logoutAll: boolean;
  setLogoutAll: (v: boolean) => void;
  onSubmit: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
}) {
  // Password strength calculation
  const getPasswordStrength = (): {
    text: string;
    level: 'empty' | 'weak' | 'medium' | 'strong';
  } => {
    if (!password) return { text: 'Chưa nhập', level: 'empty' };
    if (password.length < 8)
      return { text: 'Yếu (tối thiểu 8 ký tự)', level: 'weak' };
    if (password.length > 64)
      return { text: 'Lỗi (tối đa 64 ký tự)', level: 'weak' };

    let score = 0;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[@$!%*?&]/.test(password)) score++;

    if (score === 3)
      return { text: 'Mạnh', level: 'strong' };
    if (score >= 1) return { text: 'Trung bình', level: 'medium' };
    return { text: 'Yếu', level: 'weak' };
  };

  const passwordStrength = getPasswordStrength();

  const passwordChecks = [
    {
      label: '8 đến 64 ký tự',
      valid: password.length >= 8 && password.length <= 64,
    },
    {
      label: 'Chữ hoa & chữ thường',
      valid: /[a-z]/.test(password) && /[A-Z]/.test(password),
    },
    { label: 'Ít nhất 1 chữ số', valid: /[0-9]/.test(password) },
    {
      label: 'Ký tự đặc biệt (@$!%*?&)',
      valid: /[@$!%*?&]/.test(password),
    },
  ];

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  return (
    <>
      <AppleStepProgress currentStep={3} />

      {/* App Squircle Glyph (Đồng bộ gradient thương hiệu Indigo) */}
      <div className="flex flex-col items-center mb-5">
        <div className="w-12 h-12 rounded-[14px] bg-gradient-to-b from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 ring-1 ring-white/20 apple-spring">
          <ShieldCheck className="w-6 h-6 text-white" strokeWidth={1.8} />
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-[26px] font-semibold font-heading text-gray-900 dark:text-white tracking-[-0.025em] leading-tight">
          Tạo mật khẩu mới
        </h1>
        <p className="mt-1.5 text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed">
          Thiết lập mật khẩu mới an toàn cho tài khoản học tập của bạn.
        </p>
      </div>

      {/* Feedback Banners */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-4 p-3.5 rounded-xl bg-red-500/10 dark:bg-red-500/15 border border-red-500/20 text-red-700 dark:text-red-300 flex items-start gap-2.5 text-[13px] leading-snug animate-in fade-in duration-200"
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
          className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5 text-[13px] leading-snug animate-in fade-in duration-200"
        >
          <CheckCircle2
            className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
            strokeWidth={2}
          />
          <span className="flex-1 font-medium">{successMessage}</span>
        </div>
      )}

      {/* Form */}
      <div className="space-y-4">
        {/* New Password */}
        <div>
          <AuthInput
            label="Mật khẩu mới"
            type="password"
            name="newPassword"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            placeholder="Tạo mật khẩu mạnh"
            icon={<Lock className="w-4 h-4" strokeWidth={1.8} />}
            showPasswordToggle
          />

          {/* Dynamic 3-Segment Password Strength Indicator */}
          <PasswordStrength
            value={passwordStrength.text}
            level={passwordStrength.level}
          />

          {/* Minimalist Criteria Checklist (Hiện diện tiến trình tinh tế theo thời gian thực) */}
          {password && (
            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2.5 rounded-xl bg-gray-50/70 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] select-none">
              {passwordChecks.map((check, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px]">
                  <span
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      check.valid
                        ? 'bg-emerald-500 text-white'
                        : 'border border-gray-300 dark:border-white/20'
                    }`}
                  >
                    {check.valid && (
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    )}
                  </span>
                  <span
                    className={
                      check.valid
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : 'text-gray-400 dark:text-gray-500'
                    }
                  >
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <AuthInput
            label="Xác nhận mật khẩu mới"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            placeholder="Nhập lại mật khẩu mới"
            icon={<ShieldCheck className="w-4 h-4" strokeWidth={1.8} />}
            showPasswordToggle
          />
          {confirmPassword && (
            <p
              className={`mt-1.5 text-[12px] flex items-center gap-1.5 px-0.5 select-none ${
                passwordsMatch
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-500'
              }`}
            >
              {passwordsMatch ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>Mật khẩu trùng khớp</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>Mật khẩu chưa trùng khớp</span>
                </>
              )}
            </p>
          )}
        </div>

        {/* Logout all devices */}
        <div className="pt-1">
          <AuthCheckbox
            checked={logoutAll}
            onChange={(e) =>
              setLogoutAll((e.target as HTMLInputElement).checked)
            }
            disabled={isLoading}
            label={
              <span>
                Đăng xuất khỏi tất cả thiết bị khác{' '}
                <span className="text-gray-400 dark:text-gray-500 text-[11px] block">
                  Khuyên dùng để bảo vệ tài khoản khỏi các phiên đăng nhập cũ
                </span>
              </span>
            }
          />
        </div>

        {/* Submit (The 1 Primary CTA) */}
        <div className="pt-2">
          <AuthSubmitButton
            label="Đặt lại mật khẩu"
            type="button"
            isLoading={isLoading}
            loadingLabel="Đang cập nhật..."
            onClick={onSubmit}
            disabled={
              !passwordsMatch ||
              password.length < 8 ||
              password.length > 64 ||
              !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(password)
            }
          />
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Main multi-step page
// ─────────────────────────────────────────────
export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [email, setEmail] = useState('');

  // Step 2
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [countdown, setCountdown] = useState(120); // OTP expires in 120s
  const [resendCooldown, setResendCooldown] = useState(60); // 60s cooldown for resend
  const [isResending, setIsResending] = useState(false);
  const [resetToken, setResetToken] = useState<string>('');

  // Step 3
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [logoutAll, setLogoutAll] = useState(true);

  // Shared states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Timers for OTP expiry and Resend cooldown
  useEffect(() => {
    if (step !== 2) return;
    const interval = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
      setResendCooldown((rc) => (rc > 0 ? rc - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  // Step 1: Send OTP
  const handleSendOtp = useCallback(async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Vui lòng nhập địa chỉ email của bạn.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('Địa chỉ email không đúng định dạng.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await handleForgotPassword({ email: trimmedEmail });
      if (!response.success) {
        setErrorMessage(
          response.error || 'Không thể gửi mã xác nhận OTP. Vui lòng thử lại.'
        );
        return;
      }

      setStep(2);
      setCountdown(120);
      setResendCooldown(60);
      setOtp(Array(6).fill(''));
      setSuccessMessage(
        response.message || 'Mã xác thực OTP đã được gửi đến email của bạn.'
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Đã có lỗi xảy ra. Vui lòng kiểm tra lại kết nối.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  // Step 2: Verify OTP
  const handleVerifyOtpSubmit = useCallback(async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const code = otp.join('');
    if (code.length !== 6) {
      setErrorMessage('Vui lòng nhập đầy đủ 6 chữ số mã OTP.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await handleVerifyOtp({
        email: email.trim(),
        otp: code,
      });

      if (!response.success || !response.reset_token) {
        setErrorMessage(
          response.error || 'Mã OTP không hợp lệ hoặc đã hết hạn.'
        );
        return;
      }

      setResetToken(response.reset_token);
      setStep(3);
      setSuccessMessage(
        'Xác thực mã OTP thành công. Vui lòng thiết lập mật khẩu mới.'
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Lỗi khi xác minh mã OTP.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [email, otp]);

  // Step 2: Resend OTP
  const handleResendOtp = useCallback(async () => {
    if (resendCooldown > 0) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsResending(true);

    try {
      const response = await handleForgotPassword({ email: email.trim() });
      if (!response.success) {
        setErrorMessage(
          response.error || 'Chưa thể gửi lại mã OTP. Vui lòng thử lại sau.'
        );
        return;
      }

      setCountdown(120);
      setResendCooldown(60);
      setOtp(Array(6).fill(''));
      setSuccessMessage('Đã gửi lại mã OTP mới. Vui lòng kiểm tra hộp thư!');
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Không thể gửi lại mã OTP.'
      );
    } finally {
      setIsResending(false);
    }
  }, [email, resendCooldown]);

  // Step 3: Update password
  const handleUpdatePassword = useCallback(async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!resetToken) {
      setErrorMessage(
        'Phiên xác thực đã hết hạn hoặc không hợp lệ. Vui lòng thực hiện lại.'
      );
      return;
    }

    if (newPassword.length < 8 || newPassword.length > 64) {
      setErrorMessage('Mật khẩu mới phải từ 8 đến 64 ký tự.');
      return;
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(newPassword)) {
      setErrorMessage(
        'Mật khẩu mới phải chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt (@$!%*?&).'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await handleResetPassword({
        reset_token: resetToken,
        new_password: newPassword,
      });

      if (!response.success) {
        setErrorMessage(
          response.error || 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.'
        );
        return;
      }

      setSuccessMessage(
        response.message ||
          'Đặt lại mật khẩu thành công! Đang chuyển hướng sang trang đăng nhập...'
      );

      setTimeout(() => {
        router.push('/auth/login');
      }, 1500);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Đã có lỗi xảy ra khi đặt lại mật khẩu.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [resetToken, newPassword, confirmPassword, router]);

  return (
    <>
      {step === 1 && (
        <StepEmail
          email={email}
          setEmail={setEmail}
          onSubmit={handleSendOtp}
          isLoading={isLoading}
          errorMessage={errorMessage}
          successMessage={successMessage}
        />
      )}

      {step === 2 && (
        <StepOtp
          email={email}
          otp={otp}
          setOtp={setOtp}
          onSubmit={handleVerifyOtpSubmit}
          onResend={handleResendOtp}
          onBack={() => {
            setErrorMessage(null);
            setSuccessMessage(null);
            setStep(1);
          }}
          onEditEmail={() => {
            setErrorMessage(null);
            setSuccessMessage(null);
            setStep(1);
          }}
          isLoading={isLoading}
          isResending={isResending}
          countdown={countdown}
          resendCooldown={resendCooldown}
          errorMessage={errorMessage}
          successMessage={successMessage}
        />
      )}

      {step === 3 && (
        <StepNewPassword
          password={newPassword}
          setPassword={setNewPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          logoutAll={logoutAll}
          setLogoutAll={setLogoutAll}
          onSubmit={handleUpdatePassword}
          isLoading={isLoading}
          errorMessage={errorMessage}
          successMessage={successMessage}
        />
      )}
    </>
  );
}
