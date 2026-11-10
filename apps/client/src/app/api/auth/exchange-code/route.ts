import { NextResponse } from 'next/server';
import axios from 'axios';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { authCode } = body;

    if (!authCode || typeof authCode !== 'string' || !authCode.trim()) {
      return NextResponse.json(
        { error: 'Mã xác thực (authCode) không hợp lệ hoặc bị thiếu.' },
        { status: 400 }
      );
    }

    // Call Backend exchange-code endpoint
    const backendResponse = await axios.post<TokenPairResponse>(
      `${BACKEND_URL}/auth/exchange-code`,
      { authCode: authCode.trim() },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const { access_token, refresh_token } = backendResponse.data;

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: 'Phản hồi từ máy chủ không hợp lệ (thiếu token xác thực).' },
        { status: 502 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: 'Đăng nhập Google thành công.',
    });

    const isProduction = process.env.NODE_ENV === 'production';

    // Set HttpOnly Secure Cookies for access_token and refresh_token
    response.cookies.set('access_token', access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    response.cookies.set('refresh_token', refresh_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error(
      'Error during Google OAuth exchange-code:',
      error.response?.data || error.message
    );

    const statusCode = error.response?.status || 500;
    const backendData = error.response?.data;

    let errorMessage = 'Xác thực Google thất bại. Vui lòng thử lại sau.';
    if (statusCode === 401) {
      errorMessage =
        'Mã xác thực không hợp lệ, đã được sử dụng hoặc đã hết hạn. Vui lòng đăng nhập lại.';
    } else if (backendData?.message) {
      errorMessage = Array.isArray(backendData.message)
        ? backendData.message.join(', ')
        : backendData.message;
    }

    return NextResponse.json(
      {
        statusCode,
        error: errorMessage,
        message: errorMessage,
      },
      { status: statusCode }
    );
  }
}
