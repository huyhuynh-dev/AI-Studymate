import Link from 'next/link';

export interface AuthSwitchLinkProps {
  text: string; // e.g. 'Chưa có tài khoản?' or 'Đã có tài khoản?'
  linkText: string; // e.g. 'Đăng ký ngay miễn phí' or 'Đăng nhập'
  href: string; // e.g. '/auth/register' or '/auth/login'
}

export function AuthSwitchLink({ text, linkText, href }: AuthSwitchLinkProps) {
  return (
    <p className="text-center mt-5 text-sm text-gray-500">
      {text}
      <Link
        href={href}
        className="text-indigo-600 font-semibold hover:text-indigo-700 hover:underline ml-1"
      >
        {linkText}
      </Link>
    </p>
  );
}

export default AuthSwitchLink;
