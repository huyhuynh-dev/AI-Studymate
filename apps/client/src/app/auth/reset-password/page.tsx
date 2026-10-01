'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Mail,
  Lock,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  MailCheck,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  Clock,
  Pencil,
  Sparkles,
  LogOut,
} from 'lucide-react';

import AuthInput from '@/components/auth/AuthInput';
import AuthSubmitButton from '@/components/auth/AuthSubmitButton';
import AuthInfoBox from '@/components/auth/AuthInfoBox';
import AuthSwitchLink from '@/components/auth/AuthSwitchLink';
import AuthCheckbox from '@/components/auth/AuthCheckbox';
import PasswordStrength from '@/components/auth/PasswordStrength';
import OtpInput from '@/components/auth/OtpInput';

// ─────────────────────────────────────────────
// Step 1 — Enter email
// ─────────────────────────────────────────────
function StepEmail({
  email,
  setEmail,
  onSubmit,
  isLoading,
}: {
  email: string;
  setEmail: (v: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  return (
    <>
      {/* Icon + Badge */}
      <div className="flex flex-col items-center mb-5">
        <div className="relative mb-3">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-indigo-400 rounded-full flex items-center justify-center border-2 border-white">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-100">
          <ShieldCheck className="w-3.5 h-3.5" />
          Bảo mật tài khoản AI StudyMate
        </span>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Quên mật khẩu?
        </h1>
        <p className="text-sm text-gray-500">
          Đừng lo lắng! Nhập email tài khoản học tập đã đăng ký,
          AI StudyMate sẽ gửi mã OTP xác thực để đặt lại mật khẩu cho bạn.
        </p>
      </div>

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
          icon={<Mail size={18} />}
          rightLabel={
            <span className="text-xs text-gray-400 font-normal">Bước 1/3</span>
          }
        />
        <p className="text-xs text-gray-400 flex items-center gap-1 -mt-1 px-0.5">
          <span>😊</span> Hỗ trợ email sinh viên (@*.edu.vn) hoặc Gmail đã đăng ký.
        </p>

        {/* Submit */}
        <AuthSubmitButton
          label="Gửi mã xác thực OTP"
          type="button"
          isLoading={isLoading}
          loadingLabel="Đang gửi mã OTP..."
          onClick={onSubmit}
        />
      </div>

      {/* Info box */}
      <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
        <div className="flex gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-800 leading-relaxed">
            Mã OTP có hiệu lực trong <strong>10 phút</strong>. Nếu không nhận
            được thư sau 1 phút, hãy kiểm tra thư mục{' '}
            <strong>Spam / Quảng cáo</strong>.
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="my-5 border-t border-gray-100" />

      {/* Login link */}
      <AuthSwitchLink
        text="Nhớ mật khẩu rồi?"
        linkText="Đăng nhập ngay ›"
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
}) {
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Icon */}
      <div className="flex flex-col items-center mb-5">
        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
          <MailCheck className="w-7 h-7 text-white" />
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Xác thực mã OTP
        </h1>
        <p className="text-sm text-gray-500">
          Mã xác nhận 6 chữ số đã được gửi trực tiếp đến hộp thư của bạn:
        </p>
      </div>

      {/* Email chip */}
      <div className="flex justify-center mb-6">
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-full border border-indigo-100">
          <Mail className="w-4 h-4" />
          {email}
          <button
            type="button"
            onClick={onEditEmail}
            className="text-indigo-500 hover:text-indigo-700 transition-colors cursor-pointer"
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
            <span className={countdown <= 60 ? 'text-red-500 font-semibold' : 'text-indigo-600 font-semibold'}>
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
          <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
          Gửi lại mã OTP
        </button>
      </div>

      {/* Submit */}
      <div className="mt-5">
        <AuthSubmitButton
          label="Xác nhận & Tiếp tục"
          type="button"
          isLoading={isLoading}
          loadingLabel="Đang xác thực..."
          onClick={onSubmit}
          disabled={otp.some((d) => !d)}
        />
      </div>

      {/* Security notice */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
        <div className="flex gap-2">
          <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-blue-900 font-semibold">Lưu ý bảo mật</p>
            <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
              Tuyệt đối không chia sẻ mã này cho bất kỳ ai, kể cả nhân sự
              quản trị viên của AI StudyMate.
            </p>
          </div>
        </div>
      </div>

      {/* Back button */}
      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại bước trước
        </button>
      </div>

      {/* Footer info */}
      <div className="mt-5 flex items-center justify-between text-xs text-gray-400 px-1">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-emerald-400 rounded-full" />
          Hệ thống bảo mật 2 lớp SSL/TLS
        </span>
        <span>Bước 2 / 3</span>
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
}: {
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  logoutAll: boolean;
  setLogoutAll: (v: boolean) => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  // Password strength calculation
  const getPasswordStrength = (): {
    text: string;
    level: 'empty' | 'weak' | 'medium' | 'strong';
  } => {
    if (!password) return { text: 'Chưa nhập', level: 'empty' };
    if (password.length < 8)
      return { text: 'Yếu (tối thiểu 8 ký tự)', level: 'weak' };

    let score = 0;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score >= 2 && password.length >= 10)
      return { text: 'Khá mạnh', level: 'strong' };
    if (score >= 1) return { text: 'Trung bình', level: 'medium' };
    return { text: 'Yếu', level: 'weak' };
  };

  const passwordStrength = getPasswordStrength();

  const passwordChecks = [
    { label: 'Tối thiểu 8 ký tự', valid: password.length >= 8 },
    {
      label: 'Có cả chữ hoa (A-Z) và chữ thường (a-z)',
      valid: /[a-z]/.test(password) && /[A-Z]/.test(password),
    },
    { label: 'Có ít nhất 1 chữ số (0-9)', valid: /[0-9]/.test(password) },
    {
      label: 'Có ít nhất 1 ký tự đặc biệt (@, #, $, ...)',
      valid: /[^a-zA-Z0-9]/.test(password),
    },
  ];

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  // Strength bar colors
  const strengthBarColors: Record<string, string> = {
    empty: 'bg-gray-200',
    weak: 'bg-red-500',
    medium: 'bg-amber-500',
    strong: 'bg-emerald-500',
  };

  const filledBars =
    passwordStrength.level === 'empty'
      ? 0
      : passwordStrength.level === 'weak'
        ? 1
        : passwordStrength.level === 'medium'
          ? 2
          : 3;

  return (
    <>
      {/* Icon + Badge */}
      <div className="flex flex-col items-center mb-5">
        <div className="relative mb-3">
          <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center border-2 border-white">
            <CheckCircle2 className="w-3 h-3 text-white" />
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-100 uppercase tracking-wide">
          <ShieldCheck className="w-3.5 h-3.5" />
          Bảo mật tài khoản AI Study
        </span>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Tạo mật khẩu mới
        </h1>
        <p className="text-sm text-gray-500">
          Mật khẩu mới của bạn phải khác với các mật khẩu đã sử dụng trước đây
          để đảm bảo an toàn tối đa cho dữ liệu học tập.
        </p>
      </div>

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
            icon={<Lock size={18} />}
            showPasswordToggle
            rightLabel={
              password && (
                <PasswordStrength
                  label=""
                  value={`● Độ mạnh: ${passwordStrength.text}`}
                  level={passwordStrength.level}
                />
              )
            }
          />

          {/* Strength bar */}
          {password && (
            <div className="mt-2.5">
              <div className="flex gap-1 mb-2.5">
                {[1, 2, 3].map((level) => (
                  <div
                    key={level}
                    className={`h-1.5 flex-1 rounded-full transition-all ${
                      level <= filledBars
                        ? strengthBarColors[passwordStrength.level]
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <div className="space-y-1.5">
                {passwordChecks.map((check, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    {check.valid ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />
                    )}
                    <span className={check.valid ? 'text-emerald-600' : 'text-gray-400'}>
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>
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
            icon={<ShieldCheck size={18} />}
            showPasswordToggle
          />
          {confirmPassword && (
            <p
              className={`mt-1.5 text-xs flex items-center gap-1.5 px-0.5 ${
                passwordsMatch ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              {passwordsMatch ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>✓✓ Mật khẩu xác nhận đã hoàn toàn trùng khớp</span>
                </>
              ) : (
                <>
                  <span className="w-3.5 h-3.5 text-red-500">✗</span>
                  <span>Mật khẩu xác nhận không trùng khớp</span>
                </>
              )}
            </p>
          )}
        </div>

        {/* Logout all devices */}
        <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
          <AuthCheckbox
            checked={logoutAll}
            onChange={(e) => setLogoutAll((e.target as HTMLInputElement).checked)}
            disabled={isLoading}
            label={
              <div>
                <p className="text-sm font-semibold text-gray-700">
                  Đăng xuất khỏi tất cả các thiết bị khác
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Khuyên dùng để ngăn ngừa phiên đăng nhập trái phép cũ.
                </p>
              </div>
            }
          />
        </div>

        {/* Submit */}
        <AuthSubmitButton
          label="Cập nhật mật khẩu & Đăng nhập ngay"
          type="button"
          isLoading={isLoading}
          loadingLabel="Đang cập nhật..."
          onClick={onSubmit}
          disabled={!passwordsMatch || password.length < 8}
          className="!from-emerald-600 !to-emerald-700 hover:!from-emerald-700 hover:!to-emerald-800 !shadow-emerald-200"
        />
      </div>

      {/* Security info */}
      <AuthInfoBox
        icon={<ShieldCheck size={18} className="text-indigo-500" />}
        text="Bảo mật học thuật nâng cao 🔒 — Mật khẩu được mã hóa chuẩn bcrypt 256-bit an toàn tuyệt đối theo tiêu chuẩn giáo dục."
        variant="bordered"
      />
    </>
  );
}

// ─────────────────────────────────────────────
// Main multi-step page
// ─────────────────────────────────────────────
export default function ResetPasswordPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [email, setEmail] = useState('');

  // Step 2
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [countdown, setCountdown] = useState(180); // 3 minutes
  const [isResending, setIsResending] = useState(false);

  // Step 3
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [logoutAll, setLogoutAll] = useState(true);

  // Shared
  const [isLoading, setIsLoading] = useState(false);

  // Countdown timer for OTP
  useEffect(() => {
    if (step !== 2 || countdown <= 0) return;
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

  // Step 1: Send OTP
  const handleSendOtp = useCallback(async () => {
    if (!email.trim()) return;
    setIsLoading(true);

    try {
      // TODO: Call API to send OTP
      // await sendOtpToEmail(email);
      await new Promise((r) => setTimeout(r, 1000)); // simulate

      setStep(2);
      setCountdown(180);
      setOtp(Array(6).fill(''));
    } catch {
      // handle error
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  // Step 2: Verify OTP
  const handleVerifyOtp = useCallback(async () => {
    const code = otp.join('');
    if (code.length !== 6) return;
    setIsLoading(true);

    try {
      // TODO: Call API to verify OTP
      // await verifyOtp(email, code);
      await new Promise((r) => setTimeout(r, 1000)); // simulate

      setStep(3);
    } catch {
      // handle error
    } finally {
      setIsLoading(false);
    }
  }, [otp]);

  // Step 2: Resend OTP
  const handleResendOtp = useCallback(async () => {
    setIsResending(true);
    try {
      // TODO: Call API to resend OTP
      // await sendOtpToEmail(email);
      await new Promise((r) => setTimeout(r, 1000)); // simulate

      setCountdown(180);
      setOtp(Array(6).fill(''));
    } catch {
      // handle error
    } finally {
      setIsResending(false);
    }
  }, []);

  // Step 3: Update password
  const handleUpdatePassword = useCallback(async () => {
    if (newPassword !== confirmPassword || newPassword.length < 8) return;
    setIsLoading(true);

    try {
      // TODO: Call API to reset password
      // await resetPassword(email, otp.join(''), newPassword, logoutAll);
      await new Promise((r) => setTimeout(r, 1500)); // simulate

      // Redirect to login
      window.location.href = '/auth/login';
    } catch {
      // handle error
    } finally {
      setIsLoading(false);
    }
  }, [newPassword, confirmPassword]);

  return (
    <>
      {step === 1 && (
        <StepEmail
          email={email}
          setEmail={setEmail}
          onSubmit={handleSendOtp}
          isLoading={isLoading}
        />
      )}

      {step === 2 && (
        <StepOtp
          email={email}
          otp={otp}
          setOtp={setOtp}
          onSubmit={handleVerifyOtp}
          onResend={handleResendOtp}
          onBack={() => setStep(1)}
          onEditEmail={() => setStep(1)}
          isLoading={isLoading}
          isResending={isResending}
          countdown={countdown}
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
        />
      )}
    </>
  );
}