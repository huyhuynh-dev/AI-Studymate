import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

interface RefreshBackendResponse {
  access_token?: string;
  refresh_token?: string;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('admin_refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { statusCode: 401, message: 'Không tìm thấy phiên làm mới Admin.' },
        { status: 401 },
      );
    }

    const backendRes = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${refreshToken}`,
      },
      cache: 'no-store',
    });

    if (!backendRes.ok) {
      const response = NextResponse.json(
        { statusCode: 401, message: 'Phiên đăng nhập Admin đã hết hạn.' },
        { status: 401 },
      );
      response.cookies.delete('admin_access_token');
      response.cookies.delete('admin_refresh_token');
      return response;
    }

    const data = (await backendRes.json()) as RefreshBackendResponse;
    if (!data.access_token || !data.refresh_token) {
      throw new Error('Backend không trả về cặp token làm mới hợp lệ.');
    }

    const response = NextResponse.json({
      success: true,
      message: 'Làm mới phiên Admin thành công.',
    });
    const isProduction = process.env.NODE_ENV === 'production';

    response.cookies.set('admin_access_token', data.access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60,
    });

    response.cookies.set('admin_refresh_token', data.refresh_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch {
    const response = NextResponse.json(
      { statusCode: 401, message: 'Không thể làm mới phiên đăng nhập Admin.' },
      { status: 401 },
    );
    response.cookies.delete('admin_access_token');
    response.cookies.delete('admin_refresh_token');
    return response;
  }
}
