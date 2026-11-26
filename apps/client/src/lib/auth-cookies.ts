import type { NextResponse } from 'next/server';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const DEFAULT_ACCESS_MAX_AGE_SECONDS = 60 * 60; // 1 giờ
const DEFAULT_REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 ngày
const DEFAULT_REMEMBER_REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 ngày

export interface AuthTokenPair {
  access_token: string;
  refresh_token: string;
}

/**
 * Đọc trường `exp` (Unix timestamp tính bằng giây) từ JWT payload để đồng bộ
 * maxAge của cookie HttpOnly với thời hạn thực tế của JWT do Backend cấp.
 */
export function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) {
      return null;
    }

    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as { exp?: unknown };
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
      return payload.exp;
    }
    return null;
  } catch {
    return null;
  }
}

export function computeCookieMaxAge(
  token: string,
  fallbackSeconds: number,
  nowMs = Date.now(),
): number {
  const exp = decodeJwtExp(token);
  if (exp === null) {
    return fallbackSeconds;
  }

  const remaining = Math.floor(exp - nowMs / 1000);
  return remaining > 0 ? remaining : 0;
}

export function applyAuthCookies(
  response: NextResponse,
  tokens: AuthTokenPair,
  options?: { rememberMe?: boolean },
): void {
  const isProduction = process.env.NODE_ENV === 'production';

  const accessMaxAge = computeCookieMaxAge(
    tokens.access_token,
    DEFAULT_ACCESS_MAX_AGE_SECONDS,
  );
  const refreshFallback = options?.rememberMe
    ? DEFAULT_REMEMBER_REFRESH_MAX_AGE_SECONDS
    : DEFAULT_REFRESH_MAX_AGE_SECONDS;
  const refreshMaxAge = computeCookieMaxAge(
    tokens.refresh_token,
    refreshFallback,
  );

  response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.access_token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: accessMaxAge,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refresh_token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: refreshMaxAge,
  });
}

export function clearAuthCookies(response: NextResponse): void {
  const isProduction = process.env.NODE_ENV === 'production';

  response.cookies.set(ACCESS_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
