'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AtSign, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

import AuthCardHeader from '@/components/auth/AuthCardHeader';
import GoogleButton from '@/components/auth/GoogleButton';
import AuthDivider from '@/components/auth/AuthDivider';
import AuthInput from '@/components/auth/AuthInput';
import AuthSubmitButton from '@/components/auth/AuthSubmitButton';
import AuthSwitchLink from '@/components/auth/AuthSwitchLink';
import AuthCheckbox from '@/components/auth/AuthCheckbox';
import { handleGoogleLogin, handleEmailLogin } from '@/services/auth.api';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'oauth_failed' || errorParam === 'access_denied') {
      setErrorMessage('Xác thực bằng Google thất bại hoặc đã bị hủy.');
    } else if (errorParam) {
      setErrorMessage(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

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
          router.push(
            `/auth/email-verification?email=${encodeURIComponent(trimmedEmail)}`
          );
          return;
        }

        setErrorMessage(result.error || 'Đăng nhập không thành công.');
        setIsLoading(false);
        return;
      }

      setSuccessMessage('Đăng nhập thành công! Đang chuyển hướng...');

      const rawRedirect = searchParams.get('redirect');
      const redirectTarget =
        rawRedirect &&
        rawRedirect.startsWith('/') &&
        !rawRedirect.startsWith('//')
          ? rawRedirect
          : '/home';

      // Redirect user to destination
      setTimeout(() => {
        router.push(redirectTarget);
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
        router.push(
          `/auth/email-verification?email=${encodeURIComponent(trimmedEmail)}`
        );
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
      {/* Card Header (Khung định danh tinh gọn, loại bỏ các badge tiếp thị rườm rà) */}
      <AuthCardHeader variant="login" showBadge={false} />

      {/* Google OAuth (Secondary Action theo quy tắc 1 Primary CTA của Apple) */}
      <div className="mt-7">
        <GoogleButton
          label="Tiếp tục với Google"
          onClick={onGoogleClick}
          isLoading={isGoogleLoading}
          disabled={isLoading || isGoogleLoading}
        />
      </div>

      {/* Hairline Divider thanh lịch, nhường chỗ cho form đăng nhập */}
      <AuthDivider text="HOẶC TIẾP TỤC VỚI EMAIL" />

      {/* Form Submission */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Apple Callout Feedback Banners */}
        {errorMessage && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-500/10 dark:bg-red-500/15 border border-red-500/20 text-red-700 dark:text-red-300 flex items-start gap-2.5 text-[13px] leading-snug animate-in fade-in duration-200"
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
            className="p-3.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5 text-[13px] leading-snug animate-in fade-in duration-200"
          >
            <CheckCircle2
              className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
              strokeWidth={2}
            />
            <span className="flex-1 font-medium">{successMessage}</span>
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
          icon={<AtSign className="w-4 h-4" strokeWidth={1.8} />}
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
          icon={<Lock className="w-4 h-4" strokeWidth={1.8} />}
          showPasswordToggle
          rightLabel={
            <Link
              href="/auth/reset-password"
              className="text-[12px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors focus-visible:outline-none focus-visible:underline"
            >
              Quên mật khẩu?
            </Link>
          }
        />

        {/* Remember Me */}
        <div className="pt-0.5">
          <AuthCheckbox
            label="Ghi nhớ đăng nhập trên thiết bị này"
            name="rememberMe"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isLoading || isGoogleLoading}
          />
        </div>

        {/* The 1 Primary CTA Button */}
        <div className="pt-2">
          <AuthSubmitButton
            label="Đăng nhập"
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
    </>
  );
}
