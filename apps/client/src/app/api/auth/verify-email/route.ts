import { NextResponse } from 'next/server';
import axios, { isAxiosError } from 'axios';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    // Validate request body
    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json(
        {
          success: false,
          statusCode: 400,
          error: 'Email không được để trống.',
          message: 'Email không được để trống.',
        },
        { status: 400 }
      );
    }

    if (!otp || typeof otp !== 'string' || !otp.trim()) {
      return NextResponse.json(
        {
          success: false,
          statusCode: 400,
          error: 'Mã OTP không được để trống.',
          message: 'Mã OTP không được để trống.',
        },
        { status: 400 }
      );
    }

    // Call Backend verify-email endpoint
    const backendResponse = await axios.post(
      `${BACKEND_URL}/auth/verify-email`,
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

    // Backend returns HTTP 200 with object: { verified: true } on success
    const rawData = backendResponse.data;
    const isOtpValid =
      rawData === true ||
      rawData === 'true' ||
      (typeof rawData === 'object' && (rawData?.verified === true || rawData?.isVerified === true || rawData?.data === true));

    if (isOtpValid) {
      return NextResponse.json({
        success: true,
        isVerified: true,
        message: 'Xác thực email thành công!',
      });
    }

    return NextResponse.json(
      {
        success: false,
        isVerified: false,
        error: 'Phản hồi từ máy chủ không hợp lệ.',
        message: 'Phản hồi từ máy chủ không hợp lệ.',
      },
      { status: 400 }
    );
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
        'Error during verify-email route handler:',
        error.response?.data || error.message
      );
    } else if (error instanceof Error) {
      console.error('Error during verify-email route handler:', error.message);
    }

    let errorMessage =
      backendMessage || 'Xác thực email thất bại. Vui lòng thử lại sau.';

    if (statusCode === 400) {
      errorMessage =
        backendMessage ||
        'Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng yêu cầu mã mới.';
    } else if (statusCode === 404) {
      errorMessage = 'Email không tồn tại trong hệ thống.';
    } else if (statusCode === 500) {
      errorMessage = 'Lỗi hệ thống trong quá trình xác thực. Vui lòng thử lại sau.';
    }

    return NextResponse.json(
      {
        success: false,
        statusCode,
        error: errorMessage,
        message: backendMessage || errorMessage,
      },
      { status: statusCode }
    );
  }
}
