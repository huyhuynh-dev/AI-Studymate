import { NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

interface SignInBackendResponse {
  access_token?: string;
  refresh_token?: string;
  message?: string | string[];
}

interface RawBackendError {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

interface RawUserMe {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  avatar_url?: string | null;
}

function extractMessage(data: RawBackendError | null, fallback: string): string {
  if (!data?.message) return fallback;
  if (Array.isArray(data.message)) {
    return data.message.join(', ');
  }
  return data.message;
}

async function safeParseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      email?: string;
      password?: string;
      rememberMe?: boolean;
    } | null;

    const email = body?.email?.trim() ?? '';
    const password = body?.password ?? '';
    const rememberMe = Boolean(body?.rememberMe);

    if (!email || !password) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: 'Vui lòng nhập đầy đủ email và mật khẩu quản trị.',
        },
        { status: 400 },
      );
    }

    // 1. Xác thực thông tin đăng nhập qua Backend
    const signInRes = await fetch(`${BACKEND_URL}/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });

    const signInData = await safeParseJson<SignInBackendResponse>(signInRes);
    if (!signInRes.ok) {
      const msg = extractMessage(
        signInData as RawBackendError | null,
        'Email hoặc mật khẩu không chính xác.',
      );
      return NextResponse.json(
        {
          statusCode: signInRes.status,
          message: msg.toLowerCase().includes('invalid credentials')
            ? 'Email hoặc mật khẩu không chính xác.'
            : msg,
        },
        { status: signInRes.status },
      );
    }

    const accessToken = signInData?.access_token;
    const refreshToken = signInData?.refresh_token;
    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        {
          statusCode: 502,
          message: 'Máy chủ không trả về token xác thực hợp lệ.',
        },
        { status: 502 },
      );
    }

    // 2. Kiểm tra bắt buộc quyền Admin qua AdminGuard trước khi cấp phiên
    const adminCheckRes = await fetch(`${BACKEND_URL}/admin/overview`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!adminCheckRes.ok) {
      const checkErr = await safeParseJson<RawBackendError>(adminCheckRes);
      if (adminCheckRes.status === 403) {
        return NextResponse.json(
          {
            statusCode: 403,
            message:
              'Tài khoản này không có quyền Quản trị viên (Admin). Vui lòng dùng tài khoản Admin hoặc cấu hình ADMIN_EMAILS trong backend.',
          },
          { status: 403 },
        );
      }

      return NextResponse.json(
        {
          statusCode: adminCheckRes.status,
          message: extractMessage(
            checkErr,
            'Không thể xác minh quyền Quản trị viên từ máy chủ.',
          ),
        },
        { status: adminCheckRes.status },
      );
    }

    // 3. Nạp hồ sơ cơ bản cho phiên Admin
    let profile: RawUserMe = { email, name: email.split('@')[0], role: 'admin' };
    try {
      const meRes = await fetch(`${BACKEND_URL}/users/me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (meRes.ok) {
        const meJson = await safeParseJson<RawUserMe>(meRes);
        if (meJson) {
          profile = meJson;
        }
      }
    } catch {
      // Giữ thông tin tối thiểu nếu /users/me tạm thời không phản hồi
    }

    const response = NextResponse.json({
      success: true,
      message: 'Đăng nhập Cổng Quản trị thành công.',
      user: {
        id: profile.id ?? '',
        email: profile.email ?? email,
        name: profile.name ?? email.split('@')[0],
        role: profile.role ?? 'admin',
        avatarUrl: profile.avatar_url ?? null,
      },
    });

    const isProduction = process.env.NODE_ENV === 'production';

    response.cookies.set('admin_access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60, // 1 giờ
    });

    response.cookies.set('admin_refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Không thể kết nối tới máy chủ Backend.';
    return NextResponse.json(
      { statusCode: 500, message },
      { status: 500 },
    );
  }
}
