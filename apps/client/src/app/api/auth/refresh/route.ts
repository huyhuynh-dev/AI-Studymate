import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  applyAuthCookies,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
} from '@/lib/auth-cookies';
import { verifyCsrfRequest } from '@/lib/csrf-guard';
import { refreshTokensWithDedupe } from '@/lib/proxy-auth';

export async function GET(request: Request) {
  const csrfError = verifyCsrfRequest(request, { checkSafeMethods: true });
  if (csrfError) return csrfError;

  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Không tìm thấy refresh token trong cookie' },
        { status: 401 }
      );
    }

    const result = await refreshTokensWithDedupe(refreshToken);

    if (!result.ok) {
      const response = NextResponse.json(
        { error: result.message },
        { status: result.status }
      );
      if (result.shouldClearCookies) {
        clearAuthCookies(response);
      }
      return response;
    }

    const response = NextResponse.json({
      success: true,
      message: 'Refresh token thành công',
    });
    applyAuthCookies(response, result.tokens);

    return response;
  } catch (error: unknown) {
    console.error(
      'Refresh Token Error:',
      error instanceof Error ? error.message : String(error)
    );

    return NextResponse.json(
      { error: 'Không thể làm mới phiên đăng nhập. Vui lòng thử lại.' },
      { status: 502 }
    );
  }
}
