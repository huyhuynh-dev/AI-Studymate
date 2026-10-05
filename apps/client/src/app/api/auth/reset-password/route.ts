import { NextResponse } from 'next/server';
import axios, { isAxiosError } from 'axios';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

interface ResetPasswordBackendResponse {
  message: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { reset_token, new_password } = body;

    // Validate request body
    if (!reset_token || typeof reset_token !== 'string') {
      return NextResponse.json(
        { error: 'Mã xác thực đặt lại mật khẩu (reset_token) không hợp lệ hoặc để trống.' },
        { status: 400 }
      );
    }

    if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
      return NextResponse.json(
        { error: 'Mật khẩu mới không được để trống và phải có tối thiểu 8 ký tự.' },
        { status: 400 }
      );
    }

    // Call Backend reset-password endpoint
    const backendResponse = await axios.post<ResetPasswordBackendResponse>(
      `${BACKEND_URL}/auth/reset-password`,
      {
        reset_token: reset_token.trim(),
        new_password,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return NextResponse.json({
      success: true,
      message:
        backendResponse.data?.message ||
        'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
    });
  } catch (error: unknown) {
    let statusCode = 500;
    let backendMessage: string | undefined;

    if (isAxiosError(error)) {
      statusCode = error.response?.status || 500;
      const data = error.response?.data as { message?: string | string[] } | undefined;
      if (data?.message) {
        backendMessage = Array.isArray(data.message)
          ? data.message.join(', ')
          : data.message;
      }
      console.error('Error during reset-password route handler:', error.response?.data || error.message);
    } else if (error instanceof Error) {
      console.error('Error during reset-password route handler:', error.message);
    }

    let errorMessage =
      backendMessage || 'Lỗi khi đặt lại mật khẩu. Vui lòng thử lại sau.';

    if (!backendMessage) {
      if (statusCode === 400) {
        errorMessage =
          'Mã đặt lại mật khẩu không hợp lệ, đã hết hạn hoặc mật khẩu không đủ 8 ký tự.';
      } else if (statusCode === 404) {
        errorMessage = 'Không tìm thấy người dùng tương ứng với token.';
      } else if (statusCode === 429) {
        errorMessage = 'Đã vượt quá số lần thử cho phép. Vui lòng thử lại sau.';
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
