'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AtSign, Lock, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

import AuthCardHeader from '@/components/auth/AuthCardHeader';
import GoogleButton from '@/components/auth/GoogleButton';
import AuthDivider from '@/components/auth/AuthDivider';
import AuthInput from '@/components/auth/AuthInput';
import AuthSubmitButton from '@/components/auth/AuthSubmitButton';
import AuthSwitchLink from '@/components/auth/AuthSwitchLink';
import AuthInfoBox from '@/components/auth/AuthInfoBox';
import AuthCheckbox from '@/components/auth/AuthCheckbox';
import { handleGoogleLogin, handleEmailLogin } from '@/services/auth.api';

export default function LoginPage() {
  const router = useRouter();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle Google OAuth Click
  const onGoogleClick = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsGoogleLoading(true);

    try {
      await handleGoogleLogin();
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Không thể kết nối đến máy chủ xác thực Google.'
      );
      setIsGoogleLoading(false);
    }
  };

  // Handle Standard Email/Password Submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();

    // Client-side quick validations
    if (!trimmedEmail) {
      setErrorMessage('Vui lòng nhập địa chỉ email của bạn.');
      return;
    }

    if (!password) {
      setErrorMessage('Vui lòng nhập mật khẩu.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Mật khẩu cần có tối thiểu 8 ký tự.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await handleEmailLogin({
        email: trimmedEmail,
        password,
        rememberMe,
      });

      if (!result.success) {
        // Check if email is not verified (403: "Email is not verified")
        const isEmailNotVerified =
          result.requiresEmailVerification ||
          (result.statusCode === 403 &&
            (result.message === 'Email is not verified' ||
              result.error === 'Forbidden' ||
              result.error === 'Email is not verified')) ||
          result.message?.toLowerCase().includes('email is not verified') ||
          result.error?.toLowerCase().includes('email is not verified');

        if (isEmailNotVerified) {
          router.push(`/auth/email-verification?email=${encodeURIComponent(trimmedEmail)}`);
          return;
        }

        setErrorMessage(result.error || 'Đăng nhập không thành công.');
        setIsLoading(false);
        return;
      }

      setSuccessMessage('Đăng nhập thành công! Đang chuyển hướng...');

      // Redirect user to home/dashboard
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 700);
    } catch (err: any) {
      const resData = err.response?.data;
      const isEmailNotVerified =
        (err.response?.status === 403 || resData?.statusCode === 403) &&
        (resData?.message === 'Email is not verified' ||
          resData?.error === 'Forbidden' ||
          err.message?.toLowerCase().includes('email is not verified'));

      if (isEmailNotVerified) {
        router.push(`/auth/email-verification?email=${encodeURIComponent(trimmedEmail)}`);
        return;
      }

      setErrorMessage(
        err.message || 'Đã có lỗi xảy ra. Vui lòng kiểm tra lại kết nối.'
      );
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Card Header */}
      <AuthCardHeader variant="login" />

      {/* Google Button */}
      <div className="mt-7">
        <GoogleButton
          label="Tiếp tục với Google"
          onClick={onGoogleClick}
          isLoading={isGoogleLoading}
          disabled={isLoading || isGoogleLoading}
        />
      </div>

      {/* Divider */}
      <AuthDivider text="HOẶC ĐĂNG NHẬP BẰNG EMAIL" />

      {/* Form Submission */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Error / Success Feedback Banners */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-sm text-red-700 animate-in fade-in">
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-500" />
            <span className="flex-1 leading-snug">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-sm text-emerald-700 animate-in fade-in">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-500" />
            <span className="flex-1 leading-snug">{successMessage}</span>
          </div>
        )}

        {/* Email Input */}
        <AuthInput
          label="Email sinh viên / Học đường"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading || isGoogleLoading}
          placeholder="nguyen_van_a@student.edu.vn"
          icon={<AtSign size={18} />}
        />

        {/* Password Input */}
        <AuthInput
          label="Mật khẩu"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading || isGoogleLoading}
          placeholder="••••••••"
          icon={<Lock size={18} />}
          showPasswordToggle
          rightLabel={
            <Link
              href="/auth/reset-password"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Quên mật khẩu?
            </Link>
          }
        />

        {/* Remember Me */}
        <div className="pt-1">
          <AuthCheckbox
            label="Ghi nhớ đăng nhập trên thiết bị này"
            name="rememberMe"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isLoading || isGoogleLoading}
          />
        </div>

        {/* Submit Button */}
        <div className="mt-6">
          <AuthSubmitButton
            label="Đăng nhập vào góc học tập"
            type="submit"
            isLoading={isLoading}
            loadingLabel="Đang đăng nhập..."
            disabled={isLoading || isGoogleLoading}
          />
        </div>
      </form>

      {/* Switch Link */}
      <AuthSwitchLink
        text="Chưa có tài khoản?"
        linkText="Đăng ký ngay miễn phí"
        href="/auth/register"
      />

      {/* Info Box */}
      <AuthInfoBox
        icon={<ShieldCheck size={18} className="text-emerald-500" />}
        text="Dữ liệu giáo trình, ghi chú và bài nghiên cứu của bạn được bảo mật tuyệt đối & không chia sẻ với bên thứ ba."
        variant="bordered"
      />
    </>
  );
}