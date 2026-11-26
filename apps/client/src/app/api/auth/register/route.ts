import { NextResponse } from 'next/server';
import axios from 'axios';
import { verifyCsrfRequest } from '@/lib/csrf-guard';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

interface SignUpBackendResponse {
  message: string;
}

export async function POST(request: Request) {
  const csrfError = verifyCsrfRequest(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const { name, email, password } = body;

    // Validate request body
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp đầy đủ họ tên, email và mật khẩu.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Mật khẩu phải chứa tối thiểu 8 ký tự.' },
        { status: 400 }
      );
    }

    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const clientIpHeader = forwardedFor || realIp;

    // Call Backend sign-up endpoint
    const backendResponse = await axios.post<SignUpBackendResponse>(
      `${BACKEND_URL}/auth/sign-up`,
      {
        name: name.trim(),
        email: email.trim(),
        password,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(clientIpHeader ? { 'X-Forwarded-For': clientIpHeader } : {}),
        },
      }
    );

    const message =
      backendResponse.data?.message ||
      'Vui lòng kiểm tra hộp thư để xác thực email.';

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error: any) {
    console.error('Error during sign-up route handler:', error.response?.data || error.message);

    const backendData = error.response?.data;
    let errorMessage = 'Đăng ký không thành công. Vui lòng thử lại sau.';

    if (backendData?.message) {
      if (Array.isArray(backendData.message)) {
        errorMessage = backendData.message.join(', ');
      } else if (typeof backendData.message === 'string') {
        errorMessage = backendData.message;
      }
    }

    const statusCode = error.response?.status || 500;
    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
