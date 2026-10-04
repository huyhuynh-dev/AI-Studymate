'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import axios from 'axios';

/**
 * Client-side Google OAuth Callback Handler.
 *
 * Flow:
 * 1. Backend redirects the user back with `?authCode=...` (single-use authorization code).
 * 2. This component extracts `authCode` and sends it to `/api/auth/exchange-code`
 *    (or `/api/auth/set-tokens`), which exchanges the code with the backend Redis store
 *    and writes HttpOnly Secure cookies (`access_token`, `refresh_token`).
 * 3. Immediately scrubs the sensitive `authCode` from the browser address bar
 *    using `window.history.replaceState` to prevent replay attacks or re-triggering upon refresh.
 * 4. Refreshes the router or redirects away from auth pages to home/dashboard.
 * 5. Uses a Set ref to prevent duplicate executions caused by React 18+ StrictMode.
 */
export function OAuthCallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Track processed codes to avoid double-firing in React 18+ Strict Mode
  const processedCodesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const authCode = searchParams.get('authCode') || searchParams.get('code');
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refresh_token');

    // Case 1: Primary flow - Received single-use authCode from Backend
    if (authCode) {
      if (processedCodesRef.current.has(authCode)) {
        return;
      }
      processedCodesRef.current.add(authCode);

      // Clean browser address bar immediately to prevent duplicate requests on page reload
      const cleanUrl = removeAuthParams(searchParams, pathname);
      window.history.replaceState(null, '', cleanUrl);

      axios
        .post('/api/auth/exchange-code', { authCode })
        .then(() => {
          // If user landed on auth pages (login/register), redirect to home
          if (pathname.includes('/auth/login') || pathname.includes('/auth/register')) {
            router.replace('/');
          } else {
            router.refresh();
          }
        })
        .catch((err) => {
          const data = err.response?.data;
          const msg = data?.message || data?.error || 'oauth_failed';
          console.error('Failed to exchange OAuth authCode:', data || err.message);
          
          router.replace(`/auth/login?error=${encodeURIComponent(msg)}`);
        });

      return;
    }

    // Case 2: Legacy fallback - Direct tokens in URL params
    if (token && refreshToken) {
      const fallbackKey = `${token.slice(0, 10)}_${refreshToken.slice(0, 10)}`;
      if (processedCodesRef.current.has(fallbackKey)) {
        return;
      }
      processedCodesRef.current.add(fallbackKey);

      const cleanUrl = removeAuthParams(searchParams, pathname);
      window.history.replaceState(null, '', cleanUrl);

      axios
        .post('/api/auth/set-tokens', {
          token,
          refresh_token: refreshToken,
        })
        .then(() => {
          if (pathname.includes('/auth/login') || pathname.includes('/auth/register')) {
            router.replace('/');
          } else {
            router.refresh();
          }
        })
        .catch((err) => {
          console.error('Failed to store OAuth tokens via API fallback:', err);
        });
    }
  }, [searchParams, router, pathname]);

  return null;
}

/**
 * Remove OAuth-related query parameters from searchParams string.
 */
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
