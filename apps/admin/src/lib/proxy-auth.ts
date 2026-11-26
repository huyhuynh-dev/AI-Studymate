import { cookies } from 'next/headers';
import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_COOKIE,
  type AdminTokenPair,
} from './auth-cookies';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

const RECENT_REFRESH_GRACE_MS = 15_000;
const MAX_RECENT_REFRESH_CACHE_ENTRIES = 100;

export type AdminRefreshAttemptResult =
  | { ok: true; tokens: AdminTokenPair }
  | {
      ok: false;
      status: number;
      shouldClearCookies: boolean;
      message: string;
    };

const inFlightRefreshes = new Map<string, Promise<AdminRefreshAttemptResult>>();
const recentRefreshCache = new Map<
  string,
  { tokens: AdminTokenPair; expiresAt: number }
>();

function pruneRecentRefreshCache(now: number): void {
  for (const [key, entry] of recentRefreshCache.entries()) {
    if (entry.expiresAt <= now) {
      recentRefreshCache.delete(key);
    }
  }
  while (recentRefreshCache.size > MAX_RECENT_REFRESH_CACHE_ENTRIES) {
    const oldestKey = recentRefreshCache.keys().next().value;
    if (!oldestKey) break;
    recentRefreshCache.delete(oldestKey);
  }
}

export async function refreshAdminTokensWithDedupe(
  refreshToken: string,
  backendUrl = BACKEND_URL,
): Promise<AdminRefreshAttemptResult> {
  const now = Date.now();
  const cached = recentRefreshCache.get(refreshToken);
  if (cached && cached.expiresAt > now) {
    return { ok: true, tokens: cached.tokens };
  }

  const existing = inFlightRefreshes.get(refreshToken);
  if (existing) {
    return existing;
  }

  const promise = (async (): Promise<AdminRefreshAttemptResult> => {
    try {
      const backendRes = await fetch(`${backendUrl}/auth/refresh`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
        cache: 'no-store',
      });

      if (!backendRes.ok) {
        const shouldClearCookies =
          backendRes.status === 401 || backendRes.status === 403;
        return {
          ok: false,
          status: shouldClearCookies ? 401 : backendRes.status,
          shouldClearCookies,
          message: 'Phiên đăng nhập Admin đã hết hạn.',
        };
      }

      const data = (await backendRes.json()) as Partial<AdminTokenPair>;
      if (!data.access_token || !data.refresh_token) {
        return {
          ok: false,
          status: 502,
          shouldClearCookies: false,
          message: 'Backend không trả về cặp token làm mới hợp lệ.',
        };
      }

      const tokens: AdminTokenPair = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      };

      const doneAt = Date.now();
      pruneRecentRefreshCache(doneAt);
      recentRefreshCache.set(refreshToken, {
        tokens,
        expiresAt: doneAt + RECENT_REFRESH_GRACE_MS,
      });

      return { ok: true, tokens };
    } catch {
      return {
        ok: false,
        status: 502,
        shouldClearCookies: false,
        message: 'Không thể kết nối tới máy chủ Backend.',
      };
    } finally {
      inFlightRefreshes.delete(refreshToken);
    }
  })();

  inFlightRefreshes.set(refreshToken, promise);
  return promise;
}

export async function fetchBackendWithAdminAuthRefresh(options: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{
  backendRes: Response;
  refreshedTokens: AdminTokenPair | null;
  shouldClearCookies: boolean;
}> {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ADMIN_ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(ADMIN_REFRESH_TOKEN_COOKIE)?.value;

  let refreshedTokens: AdminTokenPair | null = null;
  let shouldClearCookies = false;

  if (!accessToken && refreshToken) {
    const refreshResult = await refreshAdminTokensWithDedupe(refreshToken);
    if (refreshResult.ok) {
      accessToken = refreshResult.tokens.access_token;
      refreshedTokens = refreshResult.tokens;
    } else if (refreshResult.shouldClearCookies) {
      shouldClearCookies = true;
    }
  }

  const buildHeaders = (token?: string): Record<string, string> => {
    const merged: Record<string, string> = { ...(options.headers ?? {}) };
    if (token) {
      merged.Authorization = `Bearer ${token}`;
    }
    return merged;
  };

  let backendRes = await fetch(options.url, {
    method: options.method,
    headers: buildHeaders(accessToken),
    body: options.body,
    cache: 'no-store',
  });

  if (backendRes.status === 401 && refreshToken && !refreshedTokens) {
    const refreshResult = await refreshAdminTokensWithDedupe(refreshToken);
    if (refreshResult.ok) {
      await backendRes.body?.cancel().catch(() => {});
      refreshedTokens = refreshResult.tokens;
      backendRes = await fetch(options.url, {
        method: options.method,
        headers: buildHeaders(refreshResult.tokens.access_token),
        body: options.body,
        cache: 'no-store',
      });
    } else if (refreshResult.shouldClearCookies) {
      shouldClearCookies = true;
    }
  }

  return {
    backendRes,
    refreshedTokens,
    shouldClearCookies,
  };
}
