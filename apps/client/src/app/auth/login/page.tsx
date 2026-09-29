'use client';

import { AtSign, Lock, ShieldCheck } from 'lucide-react';
import AuthCardHeader from '@/components/auth/AuthCardHeader';
import GoogleButton from '@/components/auth/GoogleButton';
import AuthDivider from '@/components/auth/AuthDivider';
import AuthInput from '@/components/auth/AuthInput';
import AuthSubmitButton from '@/components/auth/AuthSubmitButton';
import AuthSwitchLink from '@/components/auth/AuthSwitchLink';
import AuthInfoBox from '@/components/auth/AuthInfoBox';
import AuthCheckbox from '@/components/auth/AuthCheckbox';
import Link from 'next/link';



export default function LoginPage() {

  return (
    <>
      {/* Card Header */}
      <AuthCardHeader variant="login" />

      {/* Google Button */}
      <div className="mt-7">
        <GoogleButton label="Tiếp tục với Google" />
      </div>

      {/* Divider */}
      <AuthDivider text="HOẶC ĐĂNG NHẬP BẰNG EMAIL" />

      {/* Form Fields */}
      <div className="space-y-5">
        <AuthInput
          label="Email sinh viên / Học đường"
          type="email"
          placeholder="nguyen_van_a@student.edu.vn"
          icon={<AtSign size={18} />}
        />

        <AuthInput
          label="Mật khẩu"
          type="password"
          placeholder="••••••••"
          icon={<Lock size={18} />}
          showPasswordToggle
          rightLabel={
            <Link
              href="/auth/forgot-password"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Quên mật khẩu?
            </Link>
          }
        />
      </div>

      {/* Remember Me */}
      <div className="mt-4">
        <AuthCheckbox
          label="Ghi nhớ đăng nhập trên thiết bị này"
          defaultChecked
        />
      </div>

      {/* Submit Button */}
      <div className="mt-6">
        <AuthSubmitButton label="Đăng nhập vào góc học tập" />
      </div>

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