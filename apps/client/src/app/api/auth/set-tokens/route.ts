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
    let accessToken = body.access_token || body.token;
    let refreshToken = body.refresh_token;
    const authCode = body.authCode;

    // If client provided authCode, exchange it for tokens at backend
    if (authCode && (!accessToken || !refreshToken)) {
      try {
        const backendResponse = await axios.post<TokenPairResponse>(
          `${BACKEND_URL}/auth/exchange-code`,
          { authCode: String(authCode).trim() },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        accessToken = backendResponse.data.access_token;
        refreshToken = backendResponse.data.refresh_token;
      } catch (exchangeError: any) {
        console.error(
          'Error exchanging authCode in set-tokens route:',
          exchangeError.response?.data || exchangeError.message
        );

        const status = exchangeError.response?.status || 500;
        let errorMessage = 'Xác thực mã thất bại. Vui lòng đăng nhập lại.';
        if (status === 401) {
          errorMessage =
            'Mã xác thực không hợp lệ, đã hết hạn hoặc đã được sử dụng.';
        } else if (exchangeError.response?.data?.message) {
          errorMessage = Array.isArray(exchangeError.response.data.message)
            ? exchangeError.response.data.message.join(', ')
            : exchangeError.response.data.message;
        }

        return NextResponse.json(
          { error: errorMessage, statusCode: status },
          { status }
        );
      }
    }

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: 'Thiếu mã xác thực (authCode) hoặc token xác thực (access_token/refresh_token).' },
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
