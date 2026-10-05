import { NextResponse } from 'next/server';
import axios, { isAxiosError } from 'axios';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

interface VerifyOtpBackendResponse {
  reset_token: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    // Validate request body
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'Email không hợp lệ hoặc để trống.' },
        { status: 400 }
      );
    }

    if (!otp || typeof otp !== 'string' || otp.trim().length !== 6) {
      return NextResponse.json(
        { error: 'Mã OTP phải có đúng 6 chữ số.' },
        { status: 400 }
      );
    }

    // Call Backend verify-otp endpoint
    const backendResponse = await axios.post<VerifyOtpBackendResponse>(
      `${BACKEND_URL}/auth/verify-otp`,
      {
        email: email.trim(),
        otp: otp.trim(),
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const { reset_token } = backendResponse.data;

    if (!reset_token) {
      return NextResponse.json(
        { error: 'Phản hồi từ máy chủ không hợp lệ (thiếu token đặt lại mật khẩu).' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      reset_token,
      message: 'Xác thực mã OTP thành công.',
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
      console.error('Error during verify-otp route handler:', error.response?.data || error.message);
    } else if (error instanceof Error) {
      console.error('Error during verify-otp route handler:', error.message);
    }

    let errorMessage =
      backendMessage || 'Lỗi khi xác minh OTP. Vui lòng thử lại sau.';

    if (!backendMessage) {
      if (statusCode === 400) {
        errorMessage = 'Email hoặc OTP không hợp lệ.';
      } else if (statusCode === 403) {
        errorMessage = 'Mã OTP không chính xác. Tối đa 3 lần thử.';
      } else if (statusCode === 404) {
        errorMessage = 'Mã OTP không tồn tại, đã hết hạn, hoặc không tìm thấy người dùng.';
      } else if (statusCode === 429) {
        errorMessage = 'Đã vượt quá số lần thử cho phép. Vui lòng thử lại sau.';
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
