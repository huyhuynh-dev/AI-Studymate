import { NextResponse } from 'next/server';
import axios from 'axios';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

interface SignUpBackendResponse {
  access_token: string;
  refresh_token: string;
}

export async function POST(request: Request) {
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
        },
      }
    );

    // Backend hiện tại trả về boolean: true khi đăng ký thành công (không tạo hoặc trả về token)
    /* Code cũ cấp và lưu token vào cookies trước đây:
    const { access_token, refresh_token } = backendResponse.data;

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: 'Phản hồi từ máy chủ không hợp lệ (thiếu token xác thực).' },
        { status: 502 }
      );
    }
    */

    const rawData = backendResponse.data;
    const isSuccess =
      rawData === true ||
      rawData === 'true' ||
      (typeof rawData === 'object' && (rawData as any)?.data === true) ||
      Boolean(rawData);

    // Create JSON response
    const response = NextResponse.json({
      success: isSuccess,
      message: 'Đăng ký tài khoản thành công.',
    });

    /* Code cũ set HttpOnly Secure Cookies cho access_token và refresh_token:
    const isProduction = process.env.NODE_ENV === 'production';

    // Set HttpOnly Secure Cookies
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
    */

    return response;
  } catch (error: any) {
    console.error('Error during sign-up route handler:', error.response?.data || error.message);

    const backendData = error.response?.data;
    let errorMessage = 'Đăng ký không thành công. Vui lòng thử lại sau.';

    if (backendData?.message) {
      if (Array.isArray(backendData.message)) {
        errorMessage = backendData.message.join(', ');
      } else if (typeof backendData.message === 'string') {
        const msgLower = backendData.message.toLowerCase();
        if (msgLower.includes('already exists') || msgLower.includes('conflict')) {
          errorMessage = 'Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác.';
        } else {
          errorMessage = backendData.message;
        }
      }
    }

    const statusCode = error.response?.status || 500;
    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
