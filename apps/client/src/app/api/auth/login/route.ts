import { NextResponse } from 'next/server';
import axios from 'axios';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

interface SignInBackendResponse {
  access_token: string;
  refresh_token: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, rememberMe } = body;

    // Validate request body
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp đầy đủ email và mật khẩu' },
        { status: 400 }
      );
    }

    // Call Backend sign-in endpoint
    const backendResponse = await axios.post<SignInBackendResponse>(
      `${BACKEND_URL}/auth/sign-in`,
      { email, password },
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

    // Create JSON response
    const response = NextResponse.json({
      success: true,
      message: 'Đăng nhập thành công',
    });

    const isProduction = process.env.NODE_ENV === 'production';

    // Set HttpOnly Secure Cookies
    // access_token: short/medium term (e.g. 1 day = 86400 seconds)
    response.cookies.set('access_token', access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60, // 1 hour
    });

    // refresh_token: long term (30 days if rememberMe, otherwise 7 days)
    const refreshMaxAge = rememberMe
      ? 60 * 60 * 24 * 30 // 30 days
      : 60 * 60 * 24 * 7; // 7 days

    response.cookies.set('refresh_token', refresh_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: refreshMaxAge,
    });

    return response;
  } catch (error: any) {
    console.error('Error during sign-in route handler:', error.response?.data || error.message);

    const backendData = error.response?.data;
    const statusCode = error.response?.status || 500;

    // Check specifically for unverified email response from backend
    if (
      statusCode === 403 &&
      (backendData?.message === 'Email is not verified' ||
        (typeof backendData?.message === 'string' &&
          backendData.message.toLowerCase().includes('email is not verified')))
    ) {
      return NextResponse.json(
        {
          statusCode: 403,
          message: backendData?.message || 'Email is not verified',
          error: backendData?.error || 'Forbidden',
        },
        { status: 403 }
      );
    }

    let errorMessage = 'Đăng nhập thất bại. Vui lòng thử lại sau.';

    if (backendData?.message) {
      if (Array.isArray(backendData.message)) {
        errorMessage = backendData.message.join(', ');
      } else if (typeof backendData.message === 'string') {
        if (backendData.message.toLowerCase().includes('invalid credentials')) {
          errorMessage = 'Email hoặc mật khẩu không chính xác.';
        } else {
          errorMessage = backendData.message;
        }
      }
    }

    return NextResponse.json(
      {
        statusCode,
        error: errorMessage,
        message: backendData?.message || errorMessage,
      },
      { status: statusCode }
    );
  }
}
