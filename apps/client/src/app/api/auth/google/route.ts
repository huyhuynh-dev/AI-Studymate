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

/**
 * GET /api/auth/google
 * - If called with ?authCode=..., exchanges authCode with backend, sets cookies, and redirects to home.
 * - Otherwise, fetches Google OAuth consent URL from backend and returns it.
 */
export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const authCode = searchParams.get('authCode') || searchParams.get('code');

    // Scenario A: Direct OAuth callback redirect containing authCode
    if (authCode) {
      try {
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
        const redirectParam = searchParams.get('redirect');
        const targetPath =
          redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')
            ? redirectParam
            : '/home';
        const redirectUrl = new URL(targetPath, origin);
        const response = NextResponse.redirect(redirectUrl);

        const isProduction = process.env.NODE_ENV === 'production';
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
      } catch (exchangeError: any) {
        console.error(
          'Error exchanging authCode in GET /api/auth/google:',
          exchangeError.response?.data || exchangeError.message
        );
        const redirectUrl = new URL('/auth/login?error=oauth_failed', origin);
        return NextResponse.redirect(redirectUrl);
      }
    }

    // Scenario B: Request Google OAuth authorization URL
    const response = await fetch(`${BACKEND_URL}/auth/google-auth`, {
      method: 'GET',
      redirect: 'manual', // Do not automatically follow redirect so we can extract Location header
    });

    const locationHeader = response.headers.get('location');

    if (locationHeader) {
      return NextResponse.json({ url: locationHeader });
    }

    // If backend returned url in body
    const bodyText = await response.text();
    try {
      const parsed = JSON.parse(bodyText);
      if (parsed.url) {
        return NextResponse.json({ url: parsed.url });
      }
    } catch {
      // not JSON
    }

    if (bodyText && bodyText.startsWith('http')) {
      return NextResponse.json({ url: bodyText });
    }

    // Default fallback to direct endpoint
    return NextResponse.json({ url: `${BACKEND_URL}/auth/google-auth` });
  } catch (error: any) {
    console.error('Error fetching Google auth URL:', error.message);
    return NextResponse.json(
      { url: `${BACKEND_URL}/auth/google-auth` },
      { status: 200 }
    );
  }
}

/**
 * POST /api/auth/google
 * Exchanges authCode for access and refresh tokens, setting HttpOnly cookies.
 */
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
      message: 'Xác thực Google thành công.',
    });

    const isProduction = process.env.NODE_ENV === 'production';

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
      'Error during Google OAuth exchange-code in /api/auth/google:',
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
