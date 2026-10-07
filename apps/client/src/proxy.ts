import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Danh sách các đường dẫn liên quan đến xác thực (Auth routes)
 */
const AUTH_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/email-verification',
];

/**
 * Next.js Proxy / Middleware (Next.js 16 convention)
 * Tự động chặn và bảo vệ các Private Routes, điều hướng người dùng chưa đăng nhập,
 * xử lý OAuth tokens và ngăn người dùng đã đăng nhập truy cập lại các trang Auth.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 1. Alias chuyển hướng: /auth/sign-in -> /auth/login, /auth/sign-up -> /auth/register
  if (pathname === '/auth/sign-in') {
    return NextResponse.redirect(new URL(`/auth/login${search}`, request.url));
  }
  if (pathname === '/auth/sign-up') {
    return NextResponse.redirect(new URL(`/auth/register${search}`, request.url));
  }

  // 2. Tự động chặn và trích xuất OAuth token từ URL query parameter (ví dụ Google OAuth callback)
  const token = request.nextUrl.searchParams.get('token');
  const refreshToken = request.nextUrl.searchParams.get('refresh_token');

  if (token && refreshToken) {
    const redirectParam = request.nextUrl.searchParams.get('redirect');
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete('token');
    cleanUrl.searchParams.delete('refresh_token');
    cleanUrl.searchParams.delete('redirect');

    // Chuyển hướng người dùng sau khi nhận token OAuth:
    // Nếu có query redirect hợp lệ thì ưu tiên, nếu là root '/' hoặc '/auth/*' thì đưa vào '/home'
    if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
      cleanUrl.pathname = redirectParam;
    } else if (cleanUrl.pathname === '/' || cleanUrl.pathname.startsWith('/auth')) {
      cleanUrl.pathname = '/home';
    }

    const response = NextResponse.redirect(cleanUrl);
    const isProduction = process.env.NODE_ENV === 'production';

    // Lưu token vào HttpOnly Secure Cookies
    response.cookies.set('access_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 ngày
    });

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 ngày
    });

    return response;
  }

  // 3. Kiểm tra trạng thái đăng nhập dựa trên Cookies
  const accessToken = request.cookies.get('access_token')?.value;
  const refreshTokenCookie = request.cookies.get('refresh_token')?.value;
  const isAuthenticated = Boolean(accessToken || refreshTokenCookie);

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isLandingPage = pathname === '/';

  // 4. Trường hợp người dùng ĐÃ ĐĂNG NHẬP:
  // Nếu đã đăng nhập mà cố gắng truy cập lại vào các trang Auth (trừ khi vừa bị session_expired)
  // thì tự động chuyển hướng về /home
  if (isAuthenticated && isAuthRoute) {
    const isSessionExpired = request.nextUrl.searchParams.get('session_expired') === 'true';
    if (!isSessionExpired) {
      return NextResponse.redirect(new URL('/home', request.url));
    }
  }

  // 5. Trường hợp người dùng CHƯA ĐĂNG NHẬP:
  // Nếu chưa đăng nhập và truy cập vào các Protected Route (không phải landing page '/' và không phải auth routes)
  // thì chuyển hướng về trang đăng nhập kèm tham số redirect
  if (!isAuthenticated && !isLandingPage && !isAuthRoute) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - static assets (.svg, .png, .jpg, .jpeg, .gif, .webp, .ico, .woff, .woff2)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ico)$).*)',
  ],
};
