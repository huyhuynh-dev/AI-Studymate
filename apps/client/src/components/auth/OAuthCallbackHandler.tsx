'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import axios from 'axios';

/**
 * Client-side safety fallback for Google OAuth redirect handling.
 * If query string still contains `token` and `refresh_token`, this component
 * sends them to /api/auth/set-tokens to ensure HttpOnly cookies are set,
 * and scrubs sensitive tokens from the browser URL.
 */
export function OAuthCallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refresh_token');

    if (token && refreshToken) {
      axios
        .post('/api/auth/set-tokens', {
          token,
          refresh_token: refreshToken,
        })
        .then(() => {
          // Remove token & refresh_token from browser address bar
          const params = new URLSearchParams(searchParams.toString());
          params.delete('token');
          params.delete('refresh_token');

          const newSearch = params.toString();
          const cleanUrl = newSearch ? `${pathname}?${newSearch}` : pathname;

          window.history.replaceState(null, '', cleanUrl);
          router.refresh();
        })
        .catch((err) => {
          console.error('Failed to store OAuth tokens via API fallback:', err);
        });
    }
  }, [searchParams, router, pathname]);

  return null;
}

export default OAuthCallbackHandler;
