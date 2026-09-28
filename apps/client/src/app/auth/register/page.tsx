import { User, Mail, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import AuthCardHeader from '@/components/auth/AuthCardHeader';
import GoogleButton from '@/components/auth/GoogleButton';
import AuthDivider from '@/components/auth/AuthDivider';
import AuthInput from '@/components/auth/AuthInput';
import AuthSubmitButton from '@/components/auth/AuthSubmitButton';
import AuthSwitchLink from '@/components/auth/AuthSwitchLink';
import AuthInfoBox from '@/components/auth/AuthInfoBox';
import AuthCheckbox from '@/components/auth/AuthCheckbox';
import PasswordStrength from '@/components/auth/PasswordStrength';

export default function RegisterPage() {
    return (
        <>
            {/* Card Header */}
            <AuthCardHeader variant="register" />

            {/* Google Button */}
            <div className="mt-7">
                <GoogleButton label="Tiếp tục với Google" />
            </div>

            {/* Divider */}
            <AuthDivider text="Hoặc đăng ký bằng Email" />

            {/* Form Fields */}
            <div className="space-y-5">
                <AuthInput
                    label="Họ và tên"
                    type="text"
                    placeholder="Nguyễn Văn A"
                    icon={<User size={18} />}
                />

                <AuthInput
                    label="Email học tập"
                    type="email"
                    placeholder="nguyen_van_a@student.edu.vn"
                    icon={<Mail size={18} />}
                />

                <div>
                    <AuthInput
                        label="Mật khẩu"
                        type="password"
                        placeholder="Tối thiểu 8 ký tự"
                        icon={<Lock size={18} />}
                        showPasswordToggle
                    />
                    <PasswordStrength />
                </div>

                <AuthInput
                    label="Xác nhận mật khẩu"
                    type="password"
                    placeholder="Nhập lại mật khẩu"
                    icon={<ShieldCheck size={18} />}
                />
            </div>

            {/* Terms Checkbox */}
            <div className="mt-4">
                <AuthCheckbox
                    label={
                        <>
                            Tôi đồng ý với{' '}
                            <Link href="/terms" className="text-indigo-600 hover:underline font-medium">
                                Điều khoản dịch vụ
                            </Link>{' '}
                            và{' '}
                            <Link href="/privacy" className="text-indigo-600 hover:underline font-medium">
                                Chính sách bảo vệ dữ liệu học tập
                            </Link>{' '}
                            của AI StudyMate.
                        </>
                    }
                />
            </div>

            {/* Submit Button */}
            <div className="mt-6">
                <AuthSubmitButton label="Tạo tài khoản học tập" />
            </div>

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