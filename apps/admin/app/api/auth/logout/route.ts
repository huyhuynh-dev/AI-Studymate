import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('admin_access_token')?.value;

    if (accessToken) {
      try {
        await fetch(`${BACKEND_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });
      } catch {
        // Bỏ qua lỗi backend khi thu hồi token để luôn xóa sạch cookie phía Admin
      }
    }
  } catch {
    // Vẫn tiếp tục xóa cookies
  }

  const response = NextResponse.json({
    success: true,
    message: 'Đã đăng xuất khỏi Cổng Quản trị.',
  });

  response.cookies.set('admin_access_token', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set('admin_refresh_token', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
