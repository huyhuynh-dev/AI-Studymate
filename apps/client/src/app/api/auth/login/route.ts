import { NextResponse } from 'next/server';
import axios from 'axios';
import { applyAuthCookies } from '@/lib/auth-cookies';

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
      { email, password, rememberMe: Boolean(rememberMe) },
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

    applyAuthCookies(
      response,
      { access_token, refresh_token },
      { rememberMe: Boolean(rememberMe) }
    );

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
