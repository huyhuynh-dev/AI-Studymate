import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accessToken = body.access_token || body.token;
    const refreshToken = body.refresh_token;

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: 'Thiếu access_token hoặc refresh_token' },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: 'Tokens saved to HttpOnly cookies successfully',
    });

    const isProduction = process.env.NODE_ENV === 'production';

    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Lỗi khi lưu cookies' },
      { status: 500 }
    );
  }
}
