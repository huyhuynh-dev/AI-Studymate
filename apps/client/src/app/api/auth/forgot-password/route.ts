import { NextResponse } from 'next/server';
import axios, { isAxiosError } from 'axios';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

interface ForgotPasswordBackendResponse {
  message: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate request body
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'Email trống hoặc sai định dạng.' },
        { status: 400 }
      );
    }

    // Call Backend forgot-password endpoint
    const backendResponse = await axios.post<ForgotPasswordBackendResponse>(
      `${BACKEND_URL}/auth/forgot-password`,
      { email: email.trim() },
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
        'Nếu email tồn tại trong hệ thống, mã OTP xác thực sẽ được gửi đến hộp thư của bạn.',
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
      console.error('Error during forgot-password route handler:', error.response?.data || error.message);
    } else if (error instanceof Error) {
      console.error('Error during forgot-password route handler:', error.message);
    }

    let errorMessage =
      backendMessage || 'Có lỗi xảy ra khi yêu cầu mã OTP. Vui lòng thử lại sau.';

    if (!backendMessage) {
      if (statusCode === 429) {
        errorMessage =
          'Đã yêu cầu quá nhanh; cần chờ 60 giây trước khi yêu cầu mã mới.';
      } else if (statusCode === 400) {
        errorMessage = 'Email trống hoặc sai định dạng.';
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
