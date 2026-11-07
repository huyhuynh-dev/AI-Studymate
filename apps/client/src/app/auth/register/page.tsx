'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Mail,
  Lock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

import AuthCardHeader from '@/components/auth/AuthCardHeader';
import GoogleButton from '@/components/auth/GoogleButton';
import AuthDivider from '@/components/auth/AuthDivider';
import AuthInput from '@/components/auth/AuthInput';
import AuthSubmitButton from '@/components/auth/AuthSubmitButton';
import AuthSwitchLink from '@/components/auth/AuthSwitchLink';
import AuthCheckbox from '@/components/auth/AuthCheckbox';
import PasswordStrength from '@/components/auth/PasswordStrength';
import { handleGoogleLogin, handleRegister } from '@/services/auth.api';

export default function RegisterPage() {
  const router = useRouter();

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dynamic Password Strength Calculation
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

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    // Client-side validations
    if (!trimmedName) {
      setErrorMessage('Vui lòng nhập họ và tên của bạn.');
      return;
    }

    if (!trimmedEmail) {
      setErrorMessage('Vui lòng nhập địa chỉ email học tập.');
      return;
    }

    if (!password) {
      setErrorMessage('Vui lòng nhập mật khẩu.');
      return;
    }

    if (password.length < 8 || password.length > 64) {
      setErrorMessage('Mật khẩu phải từ 8 đến 64 ký tự.');
      return;
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(password)) {
      setErrorMessage(
        'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt (@$!%*?&).'
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    if (!agreedToTerms) {
      setErrorMessage(
        'Vui lòng đồng ý với Điều khoản dịch vụ và Chính sách bảo vệ dữ liệu để tiếp tục.'
      );
      return;
    }

    setIsLoading(true);

    try {
      const result = await handleRegister({
        name: trimmedName,
        email: trimmedEmail,
        password,
      });

      if (!result.success) {
        setErrorMessage(result.error || 'Đăng ký không thành công.');
        setIsLoading(false);
        return;
      }

      setSuccessMessage(
        result.message ||
          'Vui lòng kiểm tra hộp thư để xác thực email. Đang chuyển hướng...'
      );

      // Điều hướng người dùng sang trang xác thực email kèm email vừa đăng ký
      setTimeout(() => {
        router.push(
          `/auth/email-verification?email=${encodeURIComponent(trimmedEmail)}`
        );
      }, 1000);
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Đã có lỗi xảy ra. Vui lòng kiểm tra lại kết nối.'
      );
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Card Header (Khung định danh tinh gọn, loại bỏ các badge tiếp thị rườm rà) */}
      <AuthCardHeader variant="register" showBadge={false} />

      {/* Google OAuth (Secondary Action theo quy tắc 1 Primary CTA) */}
      <div className="mt-7">
        <GoogleButton
          label="Tiếp tục với Google"
          onClick={onGoogleClick}
          isLoading={isGoogleLoading}
          disabled={isLoading || isGoogleLoading}
        />
      </div>

      {/* Hairline Divider thanh lịch */}
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

        {/* Full Name */}
        <AuthInput
          label="Họ và tên"
          type="text"
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading || isGoogleLoading}
          placeholder="Nguyễn Văn A"
          icon={<User className="w-4 h-4" strokeWidth={1.8} />}
        />

        {/* Email */}
        <AuthInput
          label="Email học tập"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading || isGoogleLoading}
          placeholder="nguyen_van_a@student.edu.vn"
          icon={<Mail className="w-4 h-4" strokeWidth={1.8} />}
        />

        {/* Password */}
        <div>
          <AuthInput
            label="Mật khẩu"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading || isGoogleLoading}
            placeholder="Tối thiểu 8 ký tự"
            icon={<Lock className="w-4 h-4" strokeWidth={1.8} />}
            showPasswordToggle
          />
          {/* Dynamic Password Strength Indicator */}
          <PasswordStrength
            value={passwordStrength.text}
            level={passwordStrength.level}
          />
        </div>

        {/* Confirm Password */}
        <AuthInput
          label="Xác nhận mật khẩu"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading || isGoogleLoading}
          placeholder="Nhập lại mật khẩu"
          icon={<ShieldCheck className="w-4 h-4" strokeWidth={1.8} />}
          showPasswordToggle
        />

        {/* Terms Checkbox */}
        <div className="pt-0.5">
          <AuthCheckbox
            name="terms"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            disabled={isLoading || isGoogleLoading}
            label={
              <span>
                Tôi đồng ý với{' '}
                <Link
                  href="/terms"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  Điều khoản dịch vụ
                </Link>{' '}
                và{' '}
                <Link
                  href="/privacy"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  Chính sách bảo vệ dữ liệu học tập
                </Link>{' '}
                của AI StudyMate.
              </span>
            }
          />
        </div>

        {/* The 1 Primary CTA Button */}
        <div className="pt-2">
          <AuthSubmitButton
            label="Tạo tài khoản"
            type="submit"
            isLoading={isLoading}
            loadingLabel="Đang tạo tài khoản..."
            disabled={isLoading || isGoogleLoading}
          />
        </div>
      </form>

      {/* Switch Link */}
      <AuthSwitchLink
        text="Đã có tài khoản?"
        linkText="Đăng nhập"
        href="/auth/login"
      />

      {/* Deferent Footnote (Thay thế hộp banner lấp lánh bằng dòng ghi chú tin cậy tinh tế) */}
      <p className="mt-4 text-center text-[12px] text-gray-400 dark:text-gray-500 select-none">
        Miễn phí hoàn toàn cho sinh viên • Không cần thẻ tín dụng
      </p>
    </>
  );
}
