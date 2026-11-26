'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import axios from 'axios';

/**
 * Fallback Client-side Google OAuth Callback Handler.
 *
 * Luồng chính đã được xử lý hoàn toàn ở server-side tại GET /api/auth/google.
 * Component này giữ vai trò tương thích nếu một cấu hình REDIRECT_TO_LOGIN cũ
 * điều hướng thẳng kèm ?authCode=... về trang client; không còn xử lý token trực tiếp từ URL.
 */
export function OAuthCallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const processedCodesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const authCode = searchParams.get('authCode') || searchParams.get('code');

    if (authCode) {
      if (processedCodesRef.current.has(authCode)) {
        return;
      }
      processedCodesRef.current.add(authCode);

      const cleanUrl = removeAuthParams(searchParams, pathname);
      window.history.replaceState(null, '', cleanUrl);

      axios
        .post('/api/auth/exchange-code', { authCode })
        .then(() => {
          const rawRedirect = searchParams.get('redirect');
          const target =
            rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
              ? rawRedirect
              : '/home';

          router.replace(target);
          router.refresh();
        })
        .catch((err) => {
          const data = err.response?.data;
          const msg = data?.message || data?.error || 'oauth_failed';
          console.error('Failed to exchange OAuth authCode:', data || err.message);

          router.replace(`/auth/login?error=${encodeURIComponent(msg)}`);
        });

      return;
    }

    // Dọn dẹp nếu có tham số token legacy vô tình xuất hiện trên URL (không lưu cookie)
    if (searchParams.get('token') || searchParams.get('refresh_token')) {
      const cleanUrl = removeAuthParams(searchParams, pathname);
      window.history.replaceState(null, '', cleanUrl);
    }
  }, [searchParams, router, pathname]);

  return null;
}

function removeAuthParams(searchParams: URLSearchParams, pathname: string): string {
  const params = new URLSearchParams(searchParams.toString());
  params.delete('authCode');
  params.delete('code');
  params.delete('token');
  params.delete('refresh_token');

  const newSearch = params.toString();
  return newSearch ? `${pathname}?${newSearch}` : pathname;
}

export default OAuthCallbackHandler;
