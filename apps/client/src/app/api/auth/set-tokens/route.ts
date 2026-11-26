import { NextResponse } from 'next/server';
import axios from 'axios';
import { applyAuthCookies } from '@/lib/auth-cookies';
import { verifyCsrfRequest } from '@/lib/csrf-guard';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
}

/**
 * Endpoint tương thích chỉ chấp nhận mã trao đổi ngắn hạn `authCode` một lần.
 * Nhánh nhận trực tiếp `access_token`/`refresh_token` từ phía client đã bị loại bỏ.
 */
export async function POST(request: Request) {
  const csrfError = verifyCsrfRequest(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const authCode = body.authCode;

    if (body.access_token || body.token || body.refresh_token) {
      return NextResponse.json(
        {
          error:
            'Không hỗ trợ truyền trực tiếp token qua endpoint này. Vui lòng sử dụng authCode.',
        },
        { status: 400 }
      );
    }

    if (!authCode || typeof authCode !== 'string' || !authCode.trim()) {
      return NextResponse.json(
        { error: 'Thiếu mã xác thực (authCode).' },
        { status: 400 }
      );
    }

    const backendResponse = await axios.post<TokenPairResponse>(
      `${BACKEND_URL}/auth/exchange-code`,
      { authCode: String(authCode).trim(), rememberMe: true },
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
      message: 'Tokens saved to HttpOnly cookies successfully',
    });

    applyAuthCookies(
      response,
      { access_token, refresh_token },
      { rememberMe: true }
    );

    return response;
  } catch (error: unknown) {
    const axiosErr = error as {
      response?: { status?: number; data?: { message?: string | string[] } };
      message?: string;
    };
    const status = axiosErr.response?.status || 500;
    let errorMessage = 'Xác thực mã thất bại. Vui lòng đăng nhập lại.';
    if (status === 401) {
      errorMessage = 'Mã xác thực không hợp lệ, đã hết hạn hoặc đã được sử dụng.';
    } else if (axiosErr.response?.data?.message) {
      errorMessage = Array.isArray(axiosErr.response.data.message)
        ? axiosErr.response.data.message.join(', ')
        : axiosErr.response.data.message;
    }

    return NextResponse.json({ error: errorMessage, statusCode: status }, { status });
  }
}
