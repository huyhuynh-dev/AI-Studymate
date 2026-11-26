import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ADMIN_REFRESH_TOKEN_COOKIE,
  applyAdminAuthCookies,
  clearAdminAuthCookies,
} from '@/lib/auth-cookies';
import { verifyAdminCsrfRequest } from '@/lib/csrf-guard';
import { refreshAdminTokensWithDedupe } from '@/lib/proxy-auth';

export async function GET(request: Request) {
  const csrfError = verifyAdminCsrfRequest(request, { checkSafeMethods: true });
  if (csrfError) return csrfError;

  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(ADMIN_REFRESH_TOKEN_COOKIE)?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { statusCode: 401, message: 'Không tìm thấy phiên làm mới Admin.' },
        { status: 401 },
      );
    }

    const result = await refreshAdminTokensWithDedupe(refreshToken);

    if (!result.ok) {
      const response = NextResponse.json(
        { statusCode: result.status, message: result.message },
        { status: result.status },
      );
      if (result.shouldClearCookies) {
        clearAdminAuthCookies(response);
      }
      return response;
    }

    const response = NextResponse.json({
      success: true,
      message: 'Làm mới phiên Admin thành công.',
    });
    applyAdminAuthCookies(response, result.tokens);

    return response;
  } catch {
    return NextResponse.json(
      { statusCode: 502, message: 'Không thể làm mới phiên đăng nhập Admin.' },
      { status: 502 },
    );
  }
}
