'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Mail,
  Lock,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

import AuthCardHeader from '@/components/auth/AuthCardHeader';
import GoogleButton from '@/components/auth/GoogleButton';
import AuthDivider from '@/components/auth/AuthDivider';
import AuthInput from '@/components/auth/AuthInput';
import AuthSubmitButton from '@/components/auth/AuthSubmitButton';
import AuthSwitchLink from '@/components/auth/AuthSwitchLink';
import AuthInfoBox from '@/components/auth/AuthInfoBox';
import AuthCheckbox from '@/components/auth/AuthCheckbox';
import PasswordStrength from '@/components/auth/PasswordStrength';
import { handleGoogleLogin, handleRegister } from '@/apis/auth.api';

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

    let score = 0;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score >= 2 && password.length >= 10)
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

    if (password.length < 8) {
      setErrorMessage('Mật khẩu cần có tối thiểu 8 ký tự.');
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

      setSuccessMessage('Đăng ký tài khoản thành công! Đang chuyển hướng...');

      // Redirect user to home
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 700);
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Đã có lỗi xảy ra. Vui lòng kiểm tra lại kết nối.'
      );
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Card Header */}
      <AuthCardHeader variant="register" />

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
      <AuthDivider text="Hoặc đăng ký bằng Email" />

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
          icon={<User size={18} />}
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
          icon={<Mail size={18} />}
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
            icon={<Lock size={18} />}
            showPasswordToggle
          />
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
          icon={<ShieldCheck size={18} />}
          showPasswordToggle
        />

        {/* Terms Checkbox */}
        <div className="pt-1">
          <AuthCheckbox
            name="terms"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            disabled={isLoading || isGoogleLoading}
            label={
              <>
                Tôi đồng ý với{' '}
                <Link
                  href="/terms"
                  className="text-indigo-600 hover:underline font-medium"
                >
                  Điều khoản dịch vụ
                </Link>{' '}
                và{' '}
                <Link
                  href="/privacy"
                  className="text-indigo-600 hover:underline font-medium"
                >
                  Chính sách bảo vệ dữ liệu học tập
                </Link>{' '}
                của AI StudyMate.
              </>
            }
          />
        </div>

        {/* Submit Button */}
        <div className="mt-6">
          <AuthSubmitButton
            label="Tạo tài khoản học tập"
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

      {/* Info Box */}
      <AuthInfoBox
        icon={<Sparkles size={16} className="text-amber-400" />}
        text="Miễn phí hoàn toàn cho sinh viên • Không cần thẻ tín dụng"
        variant="plain"
      />
    </>
  );
}