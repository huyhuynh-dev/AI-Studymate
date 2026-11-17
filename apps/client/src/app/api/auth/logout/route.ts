import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    if (accessToken) {
      try {
        await axios.post(
          `${BACKEND_URL}/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 5000,
          },
        );
      } catch {
        // Bỏ qua lỗi từ backend (ví dụ token đã hết hạn hoặc tài khoản vừa bị xóa) để luôn xóa sạch cookie
      }
    }
  } catch {
    // Vẫn tiếp tục xóa cookies phía client
  }

  const response = NextResponse.json({
    success: true,
    message: 'Đã đăng xuất tài khoản',
  });

  response.cookies.set('access_token', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set('refresh_token', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
