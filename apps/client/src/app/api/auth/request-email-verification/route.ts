import { NextResponse } from 'next/server';
import axios, { isAxiosError } from 'axios';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

interface RequestEmailVerificationBackendResponse {
  message: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    // Client-side quick email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return NextResponse.json(
        {
          statusCode: 400,
          error: 'Email không hợp lệ.',
          message: 'Email không hợp lệ.',
        },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim();

    // Call Backend request-email-verification endpoint
    const backendResponse = await axios.post<RequestEmailVerificationBackendResponse>(
      `${BACKEND_URL}/auth/request-email-verification`,
      { email: trimmedEmail },
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
        'Nếu email hợp lệ, mã OTP sẽ được gửi đến hộp thư.',
    });
  } catch (error: unknown) {
    let statusCode = 500;
    let backendMessage: string | undefined;

    if (isAxiosError(error)) {
      statusCode = error.response?.status || 500;
      const data = error.response?.data as
        | { statusCode?: number; message?: string | string[]; error?: string }
        | undefined;

      if (data?.statusCode) {
        statusCode = data.statusCode;
      }

      if (data?.message) {
        backendMessage = Array.isArray(data.message)
          ? data.message.join(', ')
          : data.message;
      }

      console.error(
        'Error during request-email-verification route handler:',
        error.response?.data || error.message
      );
    } else if (error instanceof Error) {
      console.error(
        'Error during request-email-verification route handler:',
        error.message
      );
    }

    let errorMessage =
      backendMessage || 'Không thể gửi mã xác minh email. Vui lòng thử lại sau.';

    if (statusCode === 400) {
      errorMessage = 'Email không hợp lệ.';
    } else if (statusCode === 429) {
      errorMessage = 'Bạn đã gửi yêu cầu quá số lần cho phép. Vui lòng đợi giây lát rồi thử lại.';
    }

    return NextResponse.json(
      {
        statusCode,
        error: errorMessage,
        message: backendMessage || errorMessage,
      },
      { status: statusCode }
    );
  }
}
