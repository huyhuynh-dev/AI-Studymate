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
 * Tự động chặn và bảo vệ các Private Routes, điều hướng người dùng chưa đăng nhập
 * và ngăn người dùng đã đăng nhập truy cập lại các trang Auth.
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

  // 2. Kiểm tra trạng thái đăng nhập dựa trên HttpOnly Cookies
  const accessToken = request.cookies.get('access_token')?.value;
  const refreshTokenCookie = request.cookies.get('refresh_token')?.value;
  const isAuthenticated = Boolean(accessToken || refreshTokenCookie);

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isLandingPage = pathname === '/';

  // 3. Trường hợp người dùng ĐÃ ĐĂNG NHẬP:
  // Nếu đã đăng nhập mà cố gắng truy cập lại vào các trang Auth (trừ khi vừa bị session_expired)
  // thì tự động chuyển hướng về /home
  if (isAuthenticated && isAuthRoute) {
    const isSessionExpired = request.nextUrl.searchParams.get('session_expired') === 'true';
    if (!isSessionExpired) {
      return NextResponse.redirect(new URL('/home', request.url));
    }
  }

  // 4. Trường hợp người dùng CHƯA ĐĂNG NHẬP:
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
