import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_COOKIE,
  clearAdminAuthCookies,
} from '@/lib/auth-cookies';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

export async function POST() {
  let serverRevoked = false;

  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ADMIN_ACCESS_TOKEN_COOKIE)?.value;
    const refreshToken = cookieStore.get(ADMIN_REFRESH_TOKEN_COOKIE)?.value;

    if (accessToken || refreshToken) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      try {
        const backendRes = await fetch(`${BACKEND_URL}/auth/logout`, {
          method: 'POST',
          headers,
          body: JSON.stringify(refreshToken ? { refreshToken } : {}),
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        });
        serverRevoked = backendRes.ok;
      } catch {
        // Vẫn xóa sạch cookie phía Admin dù Backend không phản hồi
        serverRevoked = false;
      }
    } else {
      serverRevoked = true;
    }
  } catch {
    serverRevoked = false;
  }

  const response = NextResponse.json({
    success: true,
    serverRevoked,
    message: serverRevoked
      ? 'Đã đăng xuất khỏi Cổng Quản trị.'
      : 'Đã xóa phiên trên thiết bị này (chưa thể xác nhận thu hồi phiên phía máy chủ).',
  });

  clearAdminAuthCookies(response);
  return response;
}
