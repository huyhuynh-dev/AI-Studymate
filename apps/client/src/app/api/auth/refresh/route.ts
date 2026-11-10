import { NextResponse } from 'next/server';
import axios from 'axios';
import { cookies } from 'next/headers';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Không tìm thấy refresh token trong cookie' },
        { status: 401 }
      );
    }

    // Gọi backend API với refresh token truyền qua Header
    const backendResponse = await axios.get(`${BACKEND_URL}/auth/refresh`, {
      headers: {
        Authorization: `Bearer ${refreshToken}`,
      },
    });

    const { access_token, refresh_token } = backendResponse.data;

    if (!access_token || !refresh_token) {
      throw new Error('Backend không trả về token mới');
    }

    const response = NextResponse.json({ success: true, message: 'Refresh token thành công' });
    const isProduction = process.env.NODE_ENV === 'production';

    // Cập nhật lại Cookies
    response.cookies.set('access_token', access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60, // 1 giờ
    });

    response.cookies.set('refresh_token', refresh_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 ngày
    });

    return response;
  } catch (error: any) {
    console.error('Refresh Token Error:', error.response?.data || error.message);

    // Nếu refresh token cũng không hợp lệ, xóa cookies
    const response = NextResponse.json(
      { error: 'Refresh token thất bại hoặc đã hết hạn' },
      { status: 401 }
    );
    response.cookies.delete('access_token');
    response.cookies.delete('refresh_token');
    return response;
  }
}
