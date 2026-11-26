import { cookies } from 'next/headers';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  type AuthTokenPair,
} from './auth-cookies';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

const RECENT_REFRESH_GRACE_MS = 15_000;
const MAX_RECENT_REFRESH_CACHE_ENTRIES = 200;

export type RefreshAttemptResult =
  | { ok: true; tokens: AuthTokenPair }
  | {
      ok: false;
      status: number;
      shouldClearCookies: boolean;
      message: string;
    };

const inFlightRefreshes = new Map<string, Promise<RefreshAttemptResult>>();
const recentRefreshCache = new Map<
  string,
  { tokens: AuthTokenPair; expiresAt: number }
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

/**
 * Làm mới cặp token từ Backend với cơ chế single-flight (gom request đồng thời)
 * và cache ngắn hạn theo refresh token cũ để tránh xung đột rotation giữa các tab.
 */
export async function refreshTokensWithDedupe(
  refreshToken: string,
  backendUrl = BACKEND_URL,
): Promise<RefreshAttemptResult> {
  const now = Date.now();
  const cached = recentRefreshCache.get(refreshToken);
  if (cached && cached.expiresAt > now) {
    return { ok: true, tokens: cached.tokens };
  }

  const existingPromise = inFlightRefreshes.get(refreshToken);
  if (existingPromise) {
    return existingPromise;
  }

  const refreshPromise = (async (): Promise<RefreshAttemptResult> => {
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
        let message = 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.';
        try {
          const payload = (await backendRes.json()) as {
            message?: string | string[];
            error?: string;
          };
          if (Array.isArray(payload?.message)) {
            message = payload.message.join(', ');
          } else if (typeof payload?.message === 'string') {
            message = payload.message;
          } else if (typeof payload?.error === 'string') {
            message = payload.error;
          }
        } catch {
          // Bỏ qua lỗi parse JSON từ backend
        }

        return {
          ok: false,
          status: shouldClearCookies ? 401 : backendRes.status,
          shouldClearCookies,
          message,
        };
      }

      const data = (await backendRes.json()) as Partial<AuthTokenPair>;
      if (!data.access_token || !data.refresh_token) {
        return {
          ok: false,
          status: 502,
          shouldClearCookies: false,
          message: 'Backend không trả về cặp token làm mới hợp lệ.',
        };
      }

      const tokens: AuthTokenPair = {
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
        message: 'Không thể kết nối tới máy chủ xác thực.',
      };
    } finally {
      inFlightRefreshes.delete(refreshToken);
    }
  })();

  inFlightRefreshes.set(refreshToken, refreshPromise);
  return refreshPromise;
}

export interface BackendAuthFetchResult {
  backendResponse: Response;
  refreshedTokens: AuthTokenPair | null;
  shouldClearCookies: boolean;
}

/**
 * Gọi Backend kèm access_token từ HttpOnly cookie; nếu access_token vắng mặt
 * hoặc Backend trả 401 khi vẫn còn refresh_token thì tự động refresh một lần
 * và phát lại request (hỗ trợ cả streaming chat AI, BlockNote AI và TTS).
 */
export async function fetchBackendWithAuthRefresh(options: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  signal?: AbortSignal;
}): Promise<BackendAuthFetchResult> {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  let refreshedTokens: AuthTokenPair | null = null;
  let shouldClearCookies = false;

  if (!accessToken && refreshToken) {
    const refreshResult = await refreshTokensWithDedupe(refreshToken);
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

  let backendResponse = await fetch(options.url, {
    method: options.method,
    headers: buildHeaders(accessToken),
    body: options.body,
    cache: 'no-store',
    signal: options.signal,
  });

  if (
    backendResponse.status === 401 &&
    refreshToken &&
    !refreshedTokens &&
    !options.signal?.aborted
  ) {
    const refreshResult = await refreshTokensWithDedupe(refreshToken);
    if (refreshResult.ok) {
      await backendResponse.body?.cancel().catch(() => {});
      refreshedTokens = refreshResult.tokens;
      backendResponse = await fetch(options.url, {
        method: options.method,
        headers: buildHeaders(refreshResult.tokens.access_token),
        body: options.body,
        cache: 'no-store',
        signal: options.signal,
      });
    } else if (refreshResult.shouldClearCookies) {
      shouldClearCookies = true;
    }
  }

  return {
    backendResponse,
    refreshedTokens,
    shouldClearCookies,
  };
}
